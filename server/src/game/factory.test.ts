import { describe, expect, it } from 'vitest';
import {
    addDetectiveSeat,
    claimMrX,
    startGame
} from './factory.ts';
import {
    createTestGame,
    mrXOf,
    seatOf,
    seatsOf
} from './testUtils.ts';

describe('game setup', () => {
    it('starts with Mr. X first even when the host gave up the role', () => {
        const game = createTestGame(['host', 'guest']);

        expect(claimMrX(game, 'guest')).toEqual({ ok: true });
        expect(seatOf(game, 'guest').role).toBe('MR_X');
        expect(seatOf(game, 'host').role).toBe('DETECTIVE');

        game.players.forEach(player => {
            player.isReady = true;
        });

        expect(startGame(game, 'host')).toEqual({ ok: true });
        expect(game.turn).toBe(mrXOf(game).id);
        expect(game.players[0].role).toBe('MR_X');
        expect(game.players[1].role).toBe('DETECTIVE');
    });

    it('initializes tickets from the game settings', () => {
        const game = createTestGame(['host', 'guest']);
        game.players.forEach(player => {
            player.isReady = true;
        });
        game.settings.mrXDoubleTickets = 3;

        expect(startGame(game, 'host')).toEqual({ ok: true });

        const mrX = mrXOf(game);
        const detective = seatOf(game, 'guest');

        expect(mrX.tickets).toEqual(game.settings.mrXStartTickets);
        expect(mrX.doubleTickets).toBe(3);
        expect(detective.tickets).toEqual(game.settings.detectiveStartTickets);
        expect(detective.doubleTickets).toBe(0);
    });

    it('requires every seat to be ready', () => {
        const game = createTestGame(['host', 'guest']);
        seatOf(game, 'guest').isReady = true;

        const result = startGame(game, 'host');

        expect(result).toMatchObject({ ok: false, code: 'NOT_READY' });
    });

    it('requires every user to be connected', () => {
        const game = createTestGame(['host', 'guest']);
        game.players.forEach(player => {
            player.isReady = true;
        });
        const guest = game.users.find(user => user.id === 'guest');
        if (guest) guest.connected = false;

        const result = startGame(game, 'host');

        expect(result).toMatchObject({ ok: false, code: 'OFFLINE_PLAYERS' });
    });

    it('does not start without Mr. X', () => {
        const game = createTestGame(['host', 'guest']);
        game.players = game.players.filter(player => player.role !== 'MR_X');
        game.players.forEach(player => {
            player.isReady = true;
        });

        const result = startGame(game, 'host');

        expect(result).toMatchObject({ ok: false, code: 'NO_MRX' });
    });

    it('does not start without detectives', () => {
        const game = createTestGame(['host']);
        game.players.forEach(player => {
            player.isReady = true;
        });

        const result = startGame(game, 'host');

        expect(result).toMatchObject({ ok: false, code: 'NO_DETECTIVES' });
    });

    it('adds up to five detective seats for one user', () => {
        const game = createTestGame(['host', 'me']);

        for (let index = 0; index < 4; index += 1) {
            expect(addDetectiveSeat(game, 'me')).not.toBeNull();
        }

        expect(seatsOf(game, 'me')).toHaveLength(5);
        expect(addDetectiveSeat(game, 'me')).toBeNull();
        expect(addDetectiveSeat(game, 'host')).toBeNull();
        expect(new Set(game.players.map(player => player.position)).size).toBe(
            game.players.length
        );
    });

    it('allows claiming Mr. X only with a single seat', () => {
        const game = createTestGame(['host', 'guest']);
        addDetectiveSeat(game, 'guest');

        expect(claimMrX(game, 'guest')).toMatchObject({
            ok: false,
            code: 'ONE_SEAT_REQUIRED'
        });
    });

    it('does not hand over Mr. X while the current Mr. X is offline', () => {
        const game = createTestGame(['host', 'guest']);
        const host = game.users.find(user => user.id === 'host');
        if (host) host.connected = false;

        expect(claimMrX(game, 'guest')).toMatchObject({
            ok: false,
            code: 'MRX_OFFLINE'
        });
    });
});
