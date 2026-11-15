import { applySettings } from '../../game/factory.ts';
import type { GameStore } from '../../game/GameStore.ts';
import { broadcastGameUpdate } from '../broadcast.ts';
import type { GameServer, GameSocket } from '../types.ts';
import { getGameForSocket, getPlayerForSocket } from './util.ts';

export function registerSettingsHandlers(
    io: GameServer,
    socket: GameSocket,
    store: GameStore
): void {
    socket.on('update_settings', settings => {
        const game = getGameForSocket(store, socket);
        if (!game) return;

        const player = getPlayerForSocket(game, socket);
        if (!player?.isHost) return;

        applySettings(game, settings);
        broadcastGameUpdate(io, game);
    });
}
