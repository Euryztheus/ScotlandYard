import { addPlayer, claimMrX, createGame } from '../../game/factory.ts';
import type { GameStore } from '../../game/GameStore.ts';
import { generateLobbyCode } from '../../util/ids.ts';
import { broadcastGameUpdate } from '../broadcast.ts';
import type { GameServer, GameSocket } from '../types.ts';
import { getGameForSocket, getPlayerForSocket } from './util.ts';

export function registerLobbyHandlers(
    io: GameServer,
    socket: GameSocket,
    store: GameStore
): void {
    socket.on('create_game', () => {
        let lobbyCode = generateLobbyCode();
        while (store.get(lobbyCode)) {
            lobbyCode = generateLobbyCode();
        }

        const game = createGame(lobbyCode);
        store.create(game);

        socket.join(lobbyCode);
        socket.data.gameCode = lobbyCode;
        addPlayer(game, socket.id);

        console.log(`[SERVER] Game created: ${lobbyCode}`);
        socket.emit('game_created', { lobbyCode, gameState: game });
    });

    socket.on('join_game', code => {
        const lobbyCode = String(code ?? '').trim().toUpperCase();
        const game = store.get(lobbyCode);

        if (!game) {
            socket.emit('server_error', { code: 'GAME_NOT_FOUND', message: 'Game not found' });
            return;
        }

        socket.join(lobbyCode);
        socket.data.gameCode = lobbyCode;
        if (!game.players.some(player => player.id === socket.id)) {
            addPlayer(game, socket.id);
        }
        broadcastGameUpdate(io, game);
    });

    socket.on('toggle_ready', () => {
        const game = getGameForSocket(store, socket);
        if (!game) return;

        const player = getPlayerForSocket(game, socket);
        if (!player) return;

        player.isReady = !player.isReady;
        broadcastGameUpdate(io, game);
    });

    socket.on('claim_mr_x', () => {
        const game = getGameForSocket(store, socket);
        if (!game) return;

        if (claimMrX(game, socket.id)) {
            broadcastGameUpdate(io, game);
        }
    });

    socket.on('disconnect', () => {
        const game = getGameForSocket(store, socket) ?? store.findByPlayer(socket.id);
        const lobbyCode = game?.lobbyCode;
        socket.data.gameCode = undefined;

        if (!game || !lobbyCode) return;

        game.players = game.players.filter(player => player.id !== socket.id);

        if (game.players.length === 0) {
            store.remove(lobbyCode);
            console.log(`[SERVER] Game removed: ${lobbyCode}`);
        } else {
            broadcastGameUpdate(io, game);
        }
    });
}
