import { describe, expect, it } from 'vitest';
import type { GameState, Player } from '../../../shared/src/types.ts';
import { playMove } from './engine.ts';
import { addPlayer, createGame, startGame } from './factory.ts';
import { checkWinCondition } from './rules/win.ts';

function setupGame(playerCount = 2): GameState {
    const game = createGame('TEST1');
    for (let index = 0; index < playerCount; index += 1) {
        addPlayer(game, index === 0 ? 'mrx' : `det${index}`);
    }

    game.players[0].position = 1;
    if (game.players[1]) game.players[1].position = 13;
    if (game.players[2]) game.players[2].position = 3;

    game.players.forEach(player => {
        player.isReady = true;
    });

    startGame(game, 'mrx');

    // startGame does not change positions; pin them again for deterministic tests.
    game.players[0].position = 1;
    if (game.players[1]) game.players[1].position = 13;
    if (game.players[2]) game.players[2].position = 3;

    game.round = 1;
    game.turn = 'mrx';
    return game;
}

function player(game: GameState, id: string): Player {
    const found = game.players.find(candidate => candidate.id === id);
    if (!found) throw new Error(`Missing player ${id}`);
    return found;
}

describe('movement', () => {
    it('moves a detective and transfers the spent ticket to Mr. X', () => {
        const game = setupGame();
        game.turn = 'det1';

        const result = playMove(game, 'det1', { toNode: 4, transport: 'taxi' });

        expect(result.ok).toBe(true);
        expect(player(game, 'det1').position).toBe(4);
        expect(player(game, 'det1').tickets.taxi).toBe(9);
        expect(player(game, 'mrx').tickets.taxi).toBe(5);
        expect(game.turn).toBe('mrx');
    });

    it('rejects a move that is not on a valid edge', () => {
        const game = setupGame();

        const result = playMove(game, 'mrx', { toNode: 13, transport: 'taxi' });

        expect(result).toEqual({ ok: false, code: 'INVALID_EDGE', message: expect.any(String) });
    });

    it('rejects a move from the wrong player', () => {
        const game = setupGame();
        game.turn = 'det1';

        const result = playMove(game, 'mrx', { toNode: 8, transport: 'taxi' });

        expect(result).toEqual({ ok: false, code: 'NOT_YOUR_TURN', message: expect.any(String) });
    });

    it('rejects a move when the required ticket is missing', () => {
        const game = setupGame();
        player(game, 'mrx').tickets.taxi = 0;
        player(game, 'mrx').tickets.black = 0;

        const result = playMove(game, 'mrx', { toNode: 8, transport: 'taxi' });

        expect(result).toEqual({ ok: false, code: 'NO_TICKET', message: expect.any(String) });
    });
});

describe('black tickets and water routes', () => {
    it('spends a black ticket on a normal edge', () => {
        const game = setupGame();

        const result = playMove(game, 'mrx', {
            toNode: 8,
            transport: 'taxi',
            useBlackTicket: true
        });

        expect(result.ok).toBe(true);
        expect(player(game, 'mrx').position).toBe(8);
        expect(player(game, 'mrx').tickets.black).toBe(3);
        expect(player(game, 'mrx').tickets.taxi).toBe(4);
    });

    it('lets Mr. X cross a water route with a black ticket', () => {
        const game = setupGame();
        player(game, 'mrx').position = 108;

        const result = playMove(game, 'mrx', { toNode: 115, transport: 'water' });

        expect(result.ok).toBe(true);
        expect(player(game, 'mrx').position).toBe(115);
        expect(player(game, 'mrx').tickets.black).toBe(3);
    });

    it('does not let detectives cross water routes', () => {
        const game = setupGame();
        player(game, 'det1').position = 108;
        game.turn = 'det1';

        const result = playMove(game, 'det1', { toNode: 115, transport: 'water' });

        expect(result).toEqual({ ok: false, code: 'NO_TICKET', message: expect.any(String) });
    });
});

describe('double moves', () => {
    it('keeps the turn and clears the pending flag after the second leg', () => {
        const game = setupGame();

        const first = playMove(game, 'mrx', {
            toNode: 8,
            transport: 'taxi',
            useDoubleTicket: true
        });

        expect(first.ok).toBe(true);
        expect(game.pendingDoubleMove).toBe(true);
        expect(game.turn).toBe('mrx');
        expect(player(game, 'mrx').doubleTickets).toBe(1);
        expect(game.round).toBe(2);

        const second = playMove(game, 'mrx', { toNode: 18, transport: 'taxi' });

        expect(second.ok).toBe(true);
        expect(game.pendingDoubleMove).toBe(false);
        expect(game.turn).toBe('det1');
        expect(game.round).toBe(3);
    });

    it('rejects a second double ticket while one is pending', () => {
        const game = setupGame();
        playMove(game, 'mrx', { toNode: 8, transport: 'taxi', useDoubleTicket: true });

        const result = playMove(game, 'mrx', {
            toNode: 18,
            transport: 'taxi',
            useDoubleTicket: true
        });

        expect(result).toEqual({
            ok: false,
            code: 'DOUBLE_NOT_ALLOWED',
            message: expect.any(String)
        });
    });
});

describe('history and rounds', () => {
    it('records Mr. X moves and increments the round', () => {
        const game = setupGame();

        playMove(game, 'mrx', { toNode: 8, transport: 'taxi' });

        expect(game.round).toBe(2);
        expect(game.moveHistory).toHaveLength(1);
        expect(game.moveHistory[0]).toMatchObject({
            round: 1,
            transport: 'taxi',
            isHidden: true,
            isDoubleMove: false
        });
        expect(game.moveHistory[0].position).toBeUndefined();
    });

    it('reveals the position on reveal rounds', () => {
        const game = setupGame();
        game.round = 3;

        playMove(game, 'mrx', { toNode: 8, transport: 'taxi' });

        expect(game.moveHistory[0]).toMatchObject({
            round: 3,
            position: 8,
            isHidden: false
        });
        expect(game.round).toBe(4);
    });
});

describe('win conditions', () => {
    it('ends the game when a detective catches Mr. X', () => {
        const game = setupGame();
        player(game, 'mrx').position = 8;
        player(game, 'det1').position = 1;
        game.turn = 'det1';

        const result = playMove(game, 'det1', { toNode: 8, transport: 'taxi' });

        expect(result).toMatchObject({
            ok: true,
            gameOver: { winner: 'DETECTIVES', reason: 'Mr. X was caught!' }
        });
        expect(game.phase).toBe('FINISHED');
    });

    it('ends the game after the final round', () => {
        const game = setupGame();
        game.round = 25;

        expect(checkWinCondition(game)).toEqual({
            gameOver: true,
            winner: 'MR_X',
            reason: 'Time ran out (24 Rounds)'
        });
    });

    it('ends the game when Mr. X has no valid moves', () => {
        const game = setupGame();
        game.turn = 'mrx';
        player(game, 'mrx').tickets = { taxi: 0, bus: 0, underground: 0, black: 0 };

        expect(checkWinCondition(game)).toMatchObject({
            gameOver: true,
            winner: 'DETECTIVES',
            reason: 'Mr. X has no valid moves!'
        });
    });

    it('ends the game when all detectives are stuck', () => {
        const game = setupGame();
        game.turn = 'det1';
        game.players
            .filter(candidate => candidate.role === 'DETECTIVE')
            .forEach(detective => {
                detective.tickets = { taxi: 0, bus: 0, underground: 0, black: 0 };
            });

        expect(checkWinCondition(game)).toMatchObject({
            gameOver: true,
            winner: 'MR_X',
            reason: 'All Detectives are stuck!'
        });
    });
});

describe('turn order', () => {
    it('skips detectives without valid moves', () => {
        const game = setupGame(3);
        game.turn = 'det1';
        player(game, 'det2').tickets = { taxi: 0, bus: 0, underground: 0, black: 0 };

        const result = playMove(game, 'det1', { toNode: 4, transport: 'taxi' });

        expect(result.ok).toBe(true);
        expect(game.turn).toBe('mrx');
    });
});
