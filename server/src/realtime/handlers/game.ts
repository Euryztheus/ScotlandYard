import { playMove } from '../../game/engine.ts';
import { startGame } from '../../game/factory.ts';
import type { GameStore } from '../../game/GameStore.ts';
import { applyWinCondition } from '../../game/rules/win.ts';
import { broadcastGameUpdate } from '../broadcast.ts';
import { RateLimiter } from '../rateLimit.ts';
import { parseMoveRequest } from '../validation.ts';
import type { GameServer, GameSocket } from '../types.ts';
import {
    getSessionForSocket,
    getUserForSocket,
    sendError
} from './util.ts';

export function registerGameHandlers(
    io: GameServer,
    socket: GameSocket,
    store: GameStore
): void {
    const moveLimiter = new RateLimiter(40, 10_000);
    const startLimiter = new RateLimiter(5, 10_000);

    socket.on('player_move', (rawMove, ack) => {
        const reply = typeof ack === 'function' ? ack : undefined;
        if (!moveLimiter.allow('moves')) {
            reply?.({ ok: false, code: 'RATE_LIMITED', message: 'Too many moves' });
            return;
        }
        const session = getSessionForSocket(store, socket);
        const user = session ? getUserForSocket(session, socket) : undefined;

        if (!session || !user) {
            reply?.({ ok: false, code: 'NOT_IN_GAME', message: 'Game not found' });
            return;
        }

        const move = parseMoveRequest(rawMove);
        if (!move) {
            reply?.({ ok: false, code: 'INVALID_REQUEST', message: 'Invalid move request' });
            return;
        }

        const result = playMove(session.state, user.id, move);
        if (!result.ok) {
            reply?.(result);
            return;
        }

        reply?.({ ok: true });
        broadcastGameUpdate(io, session);
    });

    socket.on('start_game', () => {
        if (!startLimiter.allow('start')) {
            sendError(socket, 'RATE_LIMITED', 'Too many start attempts');
            return;
        }
        const session = getSessionForSocket(store, socket);
        const user = session ? getUserForSocket(session, socket) : undefined;
        if (!session || !user) return;

        const result = startGame(session.state, user.id);
        if (!result.ok) {
            sendError(socket, result.code, result.message);
            return;
        }

        applyWinCondition(session.state);
        broadcastGameUpdate(io, session);
    });
}
