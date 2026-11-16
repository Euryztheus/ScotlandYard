import { describe, expect, it } from 'vitest';
import {
    isClientId,
    normalizeLobbyCode,
    parseMoveRequest,
    parseSettings
} from './validation.ts';

describe('socket validation', () => {
    it('accepts valid move requests and rejects malformed payloads', () => {
        expect(parseMoveRequest({ toNode: 8, transport: 'taxi' })).toEqual({
            toNode: 8,
            transport: 'taxi'
        });
        expect(
            parseMoveRequest({
                toNode: 8,
                transport: 'taxi',
                useBlackTicket: true,
                useDoubleTicket: true
            })
        ).toEqual({
            toNode: 8,
            transport: 'taxi',
            useBlackTicket: true,
            useDoubleTicket: true
        });

        expect(parseMoveRequest(null)).toBeNull();
        expect(parseMoveRequest({})).toBeNull();
        expect(parseMoveRequest({ toNode: '8', transport: 'taxi' })).toBeNull();
        expect(parseMoveRequest({ toNode: 8, transport: 'plane' })).toBeNull();
        expect(parseMoveRequest({ toNode: 0, transport: 'taxi' })).toBeNull();
        expect(parseMoveRequest({ toNode: 8, transport: 'taxi', useBlackTicket: 'yes' })).toBeNull();
    });

    it('accepts bounded settings and rejects injected or out-of-range values', () => {
        expect(
            parseSettings({
                infiniteTickets: false,
                mrXDoubleTickets: 2,
                mrXStartTickets: { taxi: 4, bus: 3, underground: 3, black: 5 },
                detectiveStartTickets: { taxi: 10, bus: 8, underground: 4, black: 0 }
            })
        ).toEqual({
            infiniteTickets: false,
            mrXDoubleTickets: 2,
            mrXStartTickets: { taxi: 4, bus: 3, underground: 3, black: 5 },
            detectiveStartTickets: { taxi: 10, bus: 8, underground: 4, black: 0 }
        });

        expect(parseSettings(null)).toBeNull();
        expect(parseSettings({ mrXDoubleTickets: 999 })).toBeNull();
        expect(
            parseSettings({ mrXStartTickets: { taxi: '<img src=x onerror=alert(1)>' } })
        ).toBeNull();
        expect(parseSettings({ detectiveStartTickets: { taxi: -1 } })).toBeNull();
        expect(parseSettings({ unknownSetting: true })).toBeNull();
    });

    it('validates lobby codes and client ids', () => {
        expect(normalizeLobbyCode(' abcde ')).toBe('ABCDE');
        expect(normalizeLobbyCode('abc')).toBeNull();
        expect(normalizeLobbyCode(42)).toBeNull();
        expect(isClientId('12345678-abcd-4321-abcd-1234567890ab')).toBe(true);
        expect(isClientId('short')).toBe(false);
        expect(isClientId('')).toBe(false);
    });
});
