import { describe, expect, it } from 'vitest';
import { addPlayer, claimMrX, createGame, startGame } from './factory.ts';

function createLobby() {
    const game = createGame('TEST1');
    addPlayer(game, 'host');
    addPlayer(game, 'guest');
    return game;
}

describe('game setup', () => {
    it('starts with Mr. X first even when the host gave up the role', () => {
        const game = createLobby();

        expect(claimMrX(game, 'guest')).toBe(true);
        expect(game.players.find(player => player.id === 'guest')?.role).toBe('MR_X');
        expect(game.players.find(player => player.id === 'host')?.role).toBe('DETECTIVE');

        game.players.forEach(player => {
            player.isReady = true;
        });

        expect(startGame(game, 'host')).toBe(true);
        expect(game.turn).toBe('guest');
    });

    it('initializes tickets from the game settings', () => {
        const game = createLobby();
        game.players.forEach(player => {
            player.isReady = true;
        });
        game.settings.mrXDoubleTickets = 3;

        expect(startGame(game, 'host')).toBe(true);

        const mrX = game.players.find(player => player.role === 'MR_X');
        const detective = game.players.find(player => player.role === 'DETECTIVE');

        expect(mrX?.tickets).toEqual(game.settings.mrXStartTickets);
        expect(mrX?.doubleTickets).toBe(3);
        expect(detective?.tickets).toEqual(game.settings.detectiveStartTickets);
        expect(detective?.doubleTickets).toBe(0);
    });
});
