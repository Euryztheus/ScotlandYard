import type { EdgeType, GameSettings, MoveRequest } from '../../../shared/src/types.ts';

const EDGE_TYPES: readonly EdgeType[] = ['taxi', 'bus', 'underground', 'water'];
const TICKET_KEYS = ['taxi', 'bus', 'underground', 'black'] as const;
const LOBBY_CODE_PATTERN = /^[A-Z0-9]{5}$/;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isClientId(value: unknown): value is string {
    return typeof value === 'string' && CLIENT_ID_PATTERN.test(value);
}

export function normalizeLobbyCode(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const code = value.trim().toUpperCase();
    return LOBBY_CODE_PATTERN.test(code) ? code : null;
}

export function parseMoveRequest(value: unknown): MoveRequest | null {
    if (!isRecord(value)) return null;

    const { toNode, transport, useBlackTicket, useDoubleTicket } = value;
    if (typeof toNode !== 'number' || !Number.isInteger(toNode) || toNode < 1) return null;
    if (typeof transport !== 'string' || !EDGE_TYPES.includes(transport as EdgeType)) return null;
    if (useBlackTicket !== undefined && typeof useBlackTicket !== 'boolean') return null;
    if (useDoubleTicket !== undefined && typeof useDoubleTicket !== 'boolean') return null;

    return {
        toNode,
        transport: transport as EdgeType,
        ...(useBlackTicket === true ? { useBlackTicket: true } : {}),
        ...(useDoubleTicket === true ? { useDoubleTicket: true } : {})
    };
}

function parseTicketRecord(value: unknown): Partial<Record<string, number>> | null {
    if (!isRecord(value)) return null;

    const parsed: Partial<Record<string, number>> = {};
    for (const key of Object.keys(value)) {
        if (!(TICKET_KEYS as readonly string[]).includes(key)) return null;
        const count = value[key];
        if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 99) {
            return null;
        }
        parsed[key] = count;
    }
    return parsed;
}

/**
 * Validates and clamps settings from the host. The client is untrusted even
 * while it is the host: values eventually reach every player's browser.
 */
export function parseSettings(value: unknown): Partial<GameSettings> | null {
    if (!isRecord(value)) return null;

    const settings: Partial<GameSettings> = {};

    for (const key of Object.keys(value)) {
        if (
            key !== 'infiniteTickets' &&
            key !== 'mrXDoubleTickets' &&
            key !== 'mrXStartTickets' &&
            key !== 'detectiveStartTickets'
        ) {
            return null;
        }
    }

    if (value.infiniteTickets !== undefined) {
        if (typeof value.infiniteTickets !== 'boolean') return null;
        settings.infiniteTickets = value.infiniteTickets;
    }

    if (value.mrXDoubleTickets !== undefined) {
        const doubles = value.mrXDoubleTickets;
        if (typeof doubles !== 'number' || !Number.isInteger(doubles) || doubles < 0 || doubles > 5) {
            return null;
        }
        settings.mrXDoubleTickets = doubles;
    }

    if (value.mrXStartTickets !== undefined) {
        const tickets = parseTicketRecord(value.mrXStartTickets);
        if (!tickets) return null;
        settings.mrXStartTickets = tickets as GameSettings['mrXStartTickets'];
    }

    if (value.detectiveStartTickets !== undefined) {
        const tickets = parseTicketRecord(value.detectiveStartTickets);
        if (!tickets) return null;
        settings.detectiveStartTickets = tickets as GameSettings['detectiveStartTickets'];
    }

    return settings;
}
