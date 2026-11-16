import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { GameStore } from '../game/GameStore.ts';
import { registerGameHandlers } from './handlers/game.ts';
import { registerLobbyHandlers } from './handlers/lobby.ts';
import { registerSettingsHandlers } from './handlers/settings.ts';
import { startReconnectSweeper } from './lifecycle.ts';
import type { GameServer } from './types.ts';

export function createSocketServer(httpServer: HttpServer): GameServer {
    const io: GameServer = new Server(httpServer);
    const store = new GameStore();
    const stopSweeper = startReconnectSweeper(io, store);

    httpServer.on('close', stopSweeper);

    io.on('connection', socket => {
        console.log('User connected:', socket.id);

        registerLobbyHandlers(io, socket, store);
        registerGameHandlers(io, socket, store);
        registerSettingsHandlers(io, socket, store);
    });

    io.engine.on('connection_error', error => {
        console.warn('[socket.io] connection error', error.message);
    });

    return io;
}
