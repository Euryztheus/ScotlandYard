import type { SessionFailure, SessionResult } from '../../../../shared/src/types.ts';
import type { GameSession, GameUser } from '../../game/session.ts';
import type { GameStore } from '../../game/GameStore.ts';
import { stateForUser } from '../broadcast.ts';
import type { GameServer, GameSocket } from '../types.ts';

export function getSessionForSocket(
    store: GameStore,
    socket: GameSocket
): GameSession | undefined {
    const session = store.get(socket.data.gameCode);
    if (!session) {
        socket.data.gameCode = undefined;
    }
    return session;
}

export function getUserForSocket(
    session: GameSession,
    socket: GameSocket
): GameUser | undefined {
    return session.userBySocketId(socket.id);
}

export function sessionSuccess(session: GameSession, user: GameUser): SessionResult {
    return {
        ok: true,
        lobbyCode: session.state.lobbyCode,
        ownerId: user.id,
        gameState: stateForUser(session, user.id)
    };
}

export function sessionFailure(code: string, message: string): SessionFailure {
    return { ok: false, code, message };
}

export function sendError(socket: GameSocket, code: string, message: string): void {
    socket.emit('server_error', { code, message });
}

/**
 * Binds a socket to a user. If the user is already connected in another tab,
 * that tab is told and disconnected; the new socket wins.
 */
export function attachUser(
    io: GameServer,
    socket: GameSocket,
    session: GameSession,
    user: GameUser
): void {
    const previousSocketId = user.socketId;

    socket.join(session.state.lobbyCode);
    socket.data.gameCode = session.state.lobbyCode;
    session.attach(user, socket.id);

    if (previousSocketId && previousSocketId !== socket.id) {
        const previousSocket = io.sockets.sockets.get(previousSocketId);
        if (previousSocket) {
            previousSocket.emit('session_replaced');
            previousSocket.disconnect(true);
        }
    }
}
