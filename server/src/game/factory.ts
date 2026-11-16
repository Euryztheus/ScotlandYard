import { randomUUID } from 'node:crypto';
import {
    DEFAULT_SETTINGS,
    DETECTIVE_STARTS,
    MAX_DETECTIVES,
    MR_X_START
} from '../../../shared/src/constants.ts';
import { MAP_NODE_IDS } from '../../../shared/src/map.ts';
import type { GameSettings, GameState, Player } from '../../../shared/src/types.ts';

export type FactoryResult = { ok: true } | { ok: false; code: string; message: string };

function fail(code: string, message: string): FactoryResult {
    return { ok: false, code, message };
}

export function createGame(lobbyCode: string): GameState {
    return {
        lobbyCode,
        phase: 'LOBBY',
        players: [],
        users: [],
        hostId: '',
        turn: '',
        round: 0,
        settings: structuredClone(DEFAULT_SETTINGS),
        moveHistory: [],
        pendingDoubleMove: false
    };
}

function isTaken(game: GameState, nodeId: number): boolean {
    return game.players.some(player => player.position === nodeId);
}

function startPositionFor(game: GameState, role: Player['role'], seat: number): number {
    const preferred =
        role === 'MR_X'
            ? MR_X_START
            : seat >= 1 && seat <= DETECTIVE_STARTS.length
              ? DETECTIVE_STARTS[seat - 1]
              : undefined;

    if (preferred !== undefined && !isTaken(game, preferred)) return preferred;

    const preferredPool = role === 'MR_X' ? [MR_X_START] : DETECTIVE_STARTS;
    const freePreferred = preferredPool.find(nodeId => !isTaken(game, nodeId));
    if (freePreferred !== undefined) return freePreferred;

    const free = MAP_NODE_IDS.filter(nodeId => !isTaken(game, nodeId));
    return free[Math.floor(Math.random() * free.length)] ?? MR_X_START;
}

function nextDetectiveSeat(game: GameState): number | null {
    for (let seat = 1; seat <= MAX_DETECTIVES; seat += 1) {
        if (!game.players.some(player => player.role === 'DETECTIVE' && player.seat === seat)) {
            return seat;
        }
    }
    return null;
}

function createSeat(game: GameState, ownerId: string, role: Player['role'], seat: number): Player {
    const player: Player = {
        id: randomUUID(),
        ownerId,
        role,
        seat,
        position: startPositionFor(game, role, seat),
        tickets: { ...DEFAULT_SETTINGS.detectiveStartTickets },
        doubleTickets: 0,
        isReady: false
    };
    game.players.push(player);
    return player;
}

export function detectiveCount(game: GameState): number {
    return game.players.filter(player => player.role === 'DETECTIVE').length;
}

export function hasMrX(game: GameState): boolean {
    return game.players.some(player => player.role === 'MR_X');
}

/**
 * Adds a first seat for a user. The first user (or the first user after the
 * previous Mr. X left) becomes Mr. X; everyone else becomes a detective.
 */
export function addSeat(game: GameState, ownerId: string): Player | null {
    const role = hasMrX(game) ? 'DETECTIVE' : 'MR_X';
    if (role === 'DETECTIVE' && detectiveCount(game) >= MAX_DETECTIVES) return null;

    const seat = role === 'MR_X' ? 0 : nextDetectiveSeat(game);
    if (seat === null) return null;

    return createSeat(game, ownerId, role, seat);
}

/** Adds another detective pawn for an existing user. */
export function addDetectiveSeat(game: GameState, ownerId: string): Player | null {
    if (game.phase !== 'LOBBY') return null;

    const ownSeats = game.players.filter(player => player.ownerId === ownerId);
    if (ownSeats.some(player => player.role === 'MR_X')) return null;
    if (detectiveCount(game) >= MAX_DETECTIVES) return null;

    const seat = nextDetectiveSeat(game);
    if (seat === null) return null;

    const player = createSeat(game, ownerId, 'DETECTIVE', seat);
    resetReadiness(game, ownerId);
    return player;
}

export function resetReadiness(game: GameState, ownerId?: string): void {
    game.players.forEach(player => {
        if (!ownerId || player.ownerId === ownerId) {
            player.isReady = false;
        }
    });
}

export function claimMrX(game: GameState, ownerId: string): FactoryResult {
    if (game.phase !== 'LOBBY') {
        return fail('BAD_STATE', 'Mr. X can only be claimed in the lobby');
    }

    const requester = game.players.find(player => player.ownerId === ownerId);
    const requesterSeats = game.players.filter(player => player.ownerId === ownerId);
    const currentMrX = game.players.find(player => player.role === 'MR_X');

    if (!requester || requesterSeats.length !== 1) {
        return fail('ONE_SEAT_REQUIRED', 'You must control exactly one seat to claim Mr. X');
    }
    if (!currentMrX || currentMrX.ownerId === ownerId) {
        return fail('NO_MRX', 'There is no other Mr. X to claim from');
    }
    if (game.players.filter(player => player.ownerId === currentMrX.ownerId).length !== 1) {
        return fail('MRX_HAS_MULTIPLE_SEATS', 'The current Mr. X controls more than one seat');
    }
    const currentMrXUser = game.users.find(user => user.id === currentMrX.ownerId);
    if (!currentMrXUser?.connected) {
        return fail('MRX_OFFLINE', 'The current Mr. X is offline');
    }

    const previousMrXPosition = currentMrX.position;
    const requesterSeat = requester.seat;
    const requesterPosition = requester.position;

    currentMrX.role = 'DETECTIVE';
    currentMrX.seat = requesterSeat;
    currentMrX.position = requesterPosition;

    requester.role = 'MR_X';
    requester.seat = 0;
    requester.position = previousMrXPosition;

    resetReadiness(game);
    return { ok: true };
}

export function startGame(game: GameState, hostId: string): FactoryResult {
    if (game.phase !== 'LOBBY') {
        return fail('BAD_STATE', 'The game has already started');
    }
    if (game.hostId !== hostId) {
        return fail('NOT_HOST', 'Only the host can start the game');
    }
    if (!hasMrX(game)) {
        return fail('NO_MRX', 'A Mr. X is required before the game can start');
    }
    if (detectiveCount(game) === 0) {
        return fail('NO_DETECTIVES', 'At least one detective is required before the game can start');
    }
    if (!game.players.every(player => player.isReady)) {
        return fail('NOT_READY', 'Every seat must be ready');
    }
    if (!game.users.every(user => user.connected)) {
        return fail('OFFLINE_PLAYERS', 'Every player must be connected');
    }

    const mrX = game.players.find(player => player.role === 'MR_X');
    game.players.sort((a, b) => {
        if (a.role !== b.role) return a.role === 'MR_X' ? -1 : 1;
        return a.seat - b.seat;
    });
    game.phase = 'PLAYING';
    game.round = 1;
    game.turn = mrX?.id ?? '';
    game.pendingDoubleMove = false;
    game.result = undefined;
    game.moveHistory = [];

    game.players.forEach(player => {
        player.tickets = game.settings.infiniteTickets
            ? { taxi: 999, bus: 999, underground: 999, black: 999 }
            : player.role === 'MR_X'
              ? { ...game.settings.mrXStartTickets }
              : { ...game.settings.detectiveStartTickets };
        player.doubleTickets = player.role === 'MR_X' ? game.settings.mrXDoubleTickets : 0;
    });

    return { ok: true };
}

export function applySettings(game: GameState, settings: Partial<GameSettings>): void {
    game.settings = {
        ...game.settings,
        ...settings,
        mrXStartTickets: settings.mrXStartTickets
            ? { ...game.settings.mrXStartTickets, ...settings.mrXStartTickets }
            : game.settings.mrXStartTickets,
        detectiveStartTickets: settings.detectiveStartTickets
            ? { ...game.settings.detectiveStartTickets, ...settings.detectiveStartTickets }
            : game.settings.detectiveStartTickets
    };
}
