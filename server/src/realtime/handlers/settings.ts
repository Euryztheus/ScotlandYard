import { applySettings } from '../../game/factory.ts';
import type { GameStore } from '../../game/GameStore.ts';
import { broadcastGameUpdate } from '../broadcast.ts';
import { RateLimiter } from '../rateLimit.ts';
import { parseSettings } from '../validation.ts';
import type { GameServer, GameSocket } from '../types.ts';
import {
    getSessionForSocket,
    getUserForSocket,
    sendError
} from './util.ts';

export function registerSettingsHandlers(
    io: GameServer,
    socket: GameSocket,
    store: GameStore
): void {
    const settingsLimiter = new RateLimiter(20, 10_000);

    socket.on('update_settings', rawSettings => {
        if (!settingsLimiter.allow('settings')) {
            sendError(socket, 'RATE_LIMITED', 'Too many settings updates');
            return;
        }
        const session = getSessionForSocket(store, socket);
        const user = session ? getUserForSocket(session, socket) : undefined;
        if (!session || !user) return;

        if (session.state.phase !== 'LOBBY') {
            sendError(socket, 'BAD_STATE', 'Settings can only be changed in the lobby');
            return;
        }
        if (session.state.hostId !== user.id) {
            sendError(socket, 'NOT_HOST', 'Only the host can change settings');
            return;
        }

        const settings = parseSettings(rawSettings);
        if (!settings) {
            sendError(socket, 'INVALID_SETTINGS', 'Settings contain invalid values');
            return;
        }

        applySettings(session.state, settings);
        broadcastGameUpdate(io, session);
    });
}
