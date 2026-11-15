import { startGame } from '../../game/factory.ts';
import { playMove } from '../../game/engine.ts';
import type { GameStore } from '../../game/GameStore.ts';
import { broadcastGameUpdate } from '../broadcast.ts';
import type { GameServer, GameSocket } from '../types.ts';
import { getGameForSocket } from './util.ts';

export function registerGameHandlers(
    io: GameServer,
    socket: GameSocket,
    store: GameStore
): void {
    socket.on('player_move', (move, ack) => {
        const game = getGameForSocket(store, socket);
        if (!game) {
            ack?.({ ok: false, code: 'NOT_IN_GAME', message: 'Game not found' });
            return;
        }

        const result = playMove(game, socket.id, move);
        if (!result.ok) {
            ack?.(result);
            return;
        }

        ack?.({ ok: true });

        if (result.gameOver) {
            io.to(game.lobbyCode).emit('game_over', result.gameOver);
            return;
        }

        broadcastGameUpdate(io, game);
    });

    socket.on('start_game', () => {
        const game = getGameForSocket(store, socket);
        if (!game) return;

        if (!startGame(game, socket.id)) {
            socket.emit('server_error', {
                code: 'CANNOT_START',
                message: 'Only the host can start the game once every player is ready'
            });
            return;
        }

        broadcastGameUpdate(io, game);
    });
}
