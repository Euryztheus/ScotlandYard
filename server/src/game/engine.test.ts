import { describe, expect, it } from 'vitest';
import { getEdges, ticketTypeForEdge } from '../../../shared/src/map.ts';
import type { GameState, MoveRequest, Player } from '../../../shared/src/types.ts';
import { playMove } from './engine.ts';
import { addDetectiveSeat } from './factory.ts';
import { checkWinCondition } from './rules/win.ts';
import {
    createTestGame,
    detectiveOf,
    mrXOf,
    seatsOf,
    startTestGame
} from './testUtils.ts';

function setupGame(ownerIds: string[] = ['mrx', 'det1']): GameState {
    const game = createTestGame(ownerIds);
    const mrx = mrXOf(game);
    const detectivePositions = [13, 26, 29, 34, 50];
    game.players
        .filter(player => player.role === 'DETECTIVE')
        .forEach((player, index) => {
            player.position = detectivePositions[index] ?? player.position;
        });
    mrx.position = 1;

    startTestGame(game);

    mrx.position = 1;
    game.players
        .filter(player => player.role === 'DETECTIVE')
        .forEach((player, index) => {
            player.position = detectivePositions[index] ?? player.position;
        });
    game.round = 1;
    game.turn = mrx.id;
    return game;
}

function freeMoveFor(game: GameState, player: Player): MoveRequest {
    const occupied = new Set(
        game.players.filter(candidate => candidate.id !== player.id).map(candidate => candidate.position)
    );
    const edge = getEdges(player.position).find(candidate => {
        if (candidate.type === 'water') return false;
        if (occupied.has(candidate.to)) return false;
        return ticketTypeForEdge(candidate, player) !== null;
    });

    if (!edge) throw new Error(`No free move from ${player.position}`);
    return { toNode: edge.to, transport: edge.type };
}

describe('movement', () => {
    it('moves a detective and transfers the spent ticket to Mr. X', () => {
        const game = setupGame();
        const detective = detectiveOf(game, 'det1');
        const mrX = mrXOf(game);
        game.turn = detective.id;

        const result = playMove(game, 'det1', { toNode: 4, transport: 'taxi' });

        expect(result.ok).toBe(true);
        expect(detective.position).toBe(4);
        expect(detective.tickets.taxi).toBe(9);
        expect(mrX.tickets.taxi).toBe(5);
        expect(game.turn).toBe(mrX.id);
        expect(game.round).toBe(2);
    });

    it('rejects a move that is not on a valid edge', () => {
        const game = setupGame();

        const result = playMove(game, 'mrx', { toNode: 13, transport: 'taxi' });

        expect(result).toEqual({ ok: false, code: 'INVALID_EDGE', message: expect.any(String) });
    });

    it('rejects a move from the wrong player', () => {
        const game = setupGame();
        game.turn = detectiveOf(game, 'det1').id;

        const result = playMove(game, 'mrx', { toNode: 8, transport: 'taxi' });

        expect(result).toEqual({ ok: false, code: 'NOT_YOUR_TURN', message: expect.any(String) });
    });

    it('rejects a move when the required ticket is missing', () => {
        const game = setupGame();
        const mrX = mrXOf(game);
        mrX.tickets.taxi = 0;
        mrX.tickets.black = 0;

        const result = playMove(game, 'mrx', { toNode: 8, transport: 'taxi' });

        expect(result).toEqual({ ok: false, code: 'NO_TICKET', message: expect.any(String) });
    });

    it('rejects a move onto a station occupied by another pawn', () => {
        const game = setupGame(['mrx', 'det1', 'det2']);
        const det1 = detectiveOf(game, 'det1');
        const det2 = detectiveOf(game, 'det2');
        det1.position = 13;
        det2.position = 4;
        game.turn = det1.id;

        const result = playMove(game, 'det1', { toNode: 4, transport: 'taxi' });

        expect(result).toEqual({
            ok: false,
            code: 'NODE_OCCUPIED',
            message: expect.any(String)
        });
    });

    it('does not let Mr. X move onto a detective', () => {
        const game = setupGame();
        const mrX = mrXOf(game);
        detectiveOf(game, 'det1').position = 8;
        mrX.position = 1;

        const result = playMove(game, 'mrx', { toNode: 8, transport: 'taxi' });

        expect(result).toEqual({
            ok: false,
            code: 'NODE_OCCUPIED',
            message: expect.any(String)
        });
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
        expect(mrXOf(game).position).toBe(8);
        expect(mrXOf(game).tickets.black).toBe(4);
        expect(mrXOf(game).tickets.taxi).toBe(4);
    });

    it('lets Mr. X cross a water route with a black ticket', () => {
        const game = setupGame();
        mrXOf(game).position = 108;

        const result = playMove(game, 'mrx', { toNode: 115, transport: 'water' });

        expect(result.ok).toBe(true);
        expect(mrXOf(game).position).toBe(115);
        expect(mrXOf(game).tickets.black).toBe(4);
    });

    it('does not let detectives cross water routes', () => {
        const game = setupGame();
        const detective = detectiveOf(game, 'det1');
        detective.position = 108;
        game.turn = detective.id;

        const result = playMove(game, 'det1', { toNode: 115, transport: 'water' });

        expect(result).toEqual({ ok: false, code: 'NO_TICKET', message: expect.any(String) });
    });
});

describe('double moves', () => {
    it('plays both legs in the same round', () => {
        const game = setupGame();
        const detective = detectiveOf(game, 'det1');

        const first = playMove(game, 'mrx', {
            toNode: 8,
            transport: 'taxi',
            useDoubleTicket: true
        });

        expect(first.ok).toBe(true);
        expect(game.pendingDoubleMove).toBe(true);
        expect(game.turn).toBe(mrXOf(game).id);
        expect(mrXOf(game).doubleTickets).toBe(1);
        expect(game.round).toBe(1);

        const second = playMove(game, 'mrx', { toNode: 18, transport: 'taxi' });

        expect(second.ok).toBe(true);
        expect(game.pendingDoubleMove).toBe(false);
        expect(game.turn).toBe(detective.id);
        expect(game.round).toBe(1);
        expect(game.moveHistory).toHaveLength(2);
        expect(game.moveHistory.map(move => move.round)).toEqual([1, 1]);

        const detectiveMove = playMove(game, 'det1', { toNode: 4, transport: 'taxi' });
        expect(detectiveMove.ok).toBe(true);
        expect(game.round).toBe(2);
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

    it('reveals only the intermediate position on a reveal-round double move', () => {
        const game = setupGame();
        game.round = 3;

        playMove(game, 'mrx', {
            toNode: 8,
            transport: 'taxi',
            useDoubleTicket: true
        });
        playMove(game, 'mrx', { toNode: 18, transport: 'taxi' });

        expect(game.moveHistory).toHaveLength(2);
        expect(game.moveHistory[0]).toMatchObject({
            round: 3,
            position: 8,
            isHidden: false,
            isDoubleMove: true
        });
        expect(game.moveHistory[1]).toMatchObject({
            round: 3,
            isHidden: true,
            isDoubleMove: true
        });
        expect(game.moveHistory[1].position).toBeUndefined();
    });
});

describe('history and rounds', () => {
    it('records Mr. X moves without advancing the round until the detectives are done', () => {
        const game = setupGame(['mrx', 'det1']);

        playMove(game, 'mrx', { toNode: 8, transport: 'taxi' });

        expect(game.round).toBe(1);
        expect(game.moveHistory).toHaveLength(1);
        expect(game.moveHistory[0]).toMatchObject({
            round: 1,
            transport: 'taxi',
            isHidden: true,
            isDoubleMove: false
        });
        expect(game.moveHistory[0].position).toBeUndefined();

        playMove(game, 'det1', { toNode: 4, transport: 'taxi' });
        expect(game.round).toBe(2);
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
        expect(game.round).toBe(3);

        playMove(game, 'det1', { toNode: 4, transport: 'taxi' });
        expect(game.round).toBe(4);
    });
});

describe('win conditions', () => {
    it('ends the game when a detective catches Mr. X', () => {
        const game = setupGame();
        const mrX = mrXOf(game);
        const detective = detectiveOf(game, 'det1');
        mrX.position = 8;
        detective.position = 1;
        game.turn = detective.id;

        const result = playMove(game, 'det1', { toNode: 8, transport: 'taxi' });

        expect(result).toMatchObject({
            ok: true,
            gameOver: { winner: 'DETECTIVES', reason: 'Mr. X was caught!' }
        });
        expect(game.phase).toBe('FINISHED');
        expect(game.result).toMatchObject({ winner: 'DETECTIVES' });
    });

    it('lets the detectives finish round 24 before Mr. X wins', () => {
        const game = setupGame();
        game.round = 24;
        game.turn = detectiveOf(game, 'det1').id;

        const result = playMove(game, 'det1', { toNode: 4, transport: 'taxi' });

        expect(result).toMatchObject({
            ok: true,
            gameOver: { winner: 'MR_X', reason: 'Time ran out (24 Rounds)' }
        });
        expect(game.round).toBe(25);
        expect(game.phase).toBe('FINISHED');
    });

    it('ends the game when Mr. X has no valid moves', () => {
        const game = setupGame();
        game.turn = mrXOf(game).id;
        mrXOf(game).tickets = { taxi: 0, bus: 0, underground: 0, black: 0 };

        expect(checkWinCondition(game)).toMatchObject({
            gameOver: true,
            winner: 'DETECTIVES',
            reason: 'Mr. X has no valid moves!'
        });
    });

    it('ends the game when all detectives are stuck', () => {
        const game = setupGame();
        game.turn = detectiveOf(game, 'det1').id;
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

    it('ends the game if Mr. X is missing', () => {
        const game = setupGame();
        game.players = game.players.filter(player => player.role !== 'MR_X');

        expect(checkWinCondition(game)).toMatchObject({
            gameOver: true,
            winner: 'DETECTIVES',
            reason: 'Mr. X left the game'
        });
    });

    it('ends the game if every detective is missing', () => {
        const game = setupGame();
        game.players = game.players.filter(player => player.role !== 'DETECTIVE');

        expect(checkWinCondition(game)).toMatchObject({
            gameOver: true,
            winner: 'MR_X',
            reason: 'All detectives left the game'
        });
    });
});

describe('turn order', () => {
    it('skips detectives without valid moves', () => {
        const game = setupGame(['mrx', 'det1', 'det2']);
        const det1 = detectiveOf(game, 'det1');
        const det2 = detectiveOf(game, 'det2');
        game.turn = det1.id;
        det2.tickets = { taxi: 0, bus: 0, underground: 0, black: 0 };

        const result = playMove(game, 'det1', { toNode: 4, transport: 'taxi' });

        expect(result.ok).toBe(true);
        expect(game.turn).toBe(mrXOf(game).id);
        expect(game.round).toBe(2);
    });

    it('lets one user control several detective seats in order', () => {
        const game = createTestGame(['mrx', 'me']);
        expect(addDetectiveSeat(game, 'me')).not.toBeNull();
        expect(addDetectiveSeat(game, 'me')).not.toBeNull();

        const seats = seatsOf(game, 'me');
        expect(seats).toHaveLength(3);
        expect(new Set(seats.map(seat => seat.seat)).size).toBe(3);
        expect(new Set(game.players.map(player => player.position)).size).toBe(4);

        game.players
            .filter(player => player.role === 'DETECTIVE')
            .forEach((player, index) => {
                player.position = [13, 26, 29][index] ?? player.position;
            });
        mrXOf(game).position = 1;

        startTestGame(game);
        game.round = 1;
        game.turn = mrXOf(game).id;

        const mrXMove = freeMoveFor(game, mrXOf(game));
        expect(playMove(game, 'mrx', mrXMove).ok).toBe(true);

        for (const seat of seats) {
            expect(game.turn).toBe(seat.id);
            const move = freeMoveFor(game, seat);
            expect(playMove(game, 'me', move).ok).toBe(true);
        }

        expect(game.turn).toBe(mrXOf(game).id);
        expect(game.round).toBe(2);
    });
});
