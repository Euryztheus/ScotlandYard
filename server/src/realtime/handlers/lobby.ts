import { config } from '../../config.ts';
import {
    addDetectiveSeat,
    addSeat,
    claimMrX,
    createGame,
    resetReadiness
} from '../../game/factory.ts';
import type { GameStore } from '../../game/GameStore.ts';
import { GameSession } from '../../game/session.ts';
import { generateLobbyCode } from '../../util/ids.ts';
import { broadcastGameUpdate } from '../broadcast.ts';
import { removeUserFromSession } from '../lifecycle.ts';
import { RateLimiter } from '../rateLimit.ts';
import type { GameServer, GameSocket } from '../types.ts';
import {
    isClientId,
    normalizeLobbyCode
} from '../validation.ts';
import {
    attachUser,
    getSessionForSocket,
    getUserForSocket,
    sendError,
    sessionFailure,
    sessionSuccess
} from './util.ts';

export function registerLobbyHandlers(
    io: GameServer,
    socket: GameSocket,
    store: GameStore
): void {
    const sessionLimiter = new RateLimiter(15, 10_000);
    const actionLimiter = new RateLimiter(30, 10_000);

    socket.on('create_game', (clientId, ack) => {
        const reply = typeof ack === 'function' ? ack : () => undefined;

        if (!sessionLimiter.allow('session')) {
            reply(sessionFailure('RATE_LIMITED', 'Too many session attempts'));
            return;
        }
        if (!isClientId(clientId)) {
            reply(sessionFailure('INVALID_REQUEST', 'Invalid client id'));
            return;
        }
        if (getSessionForSocket(store, socket)) {
            reply(sessionFailure('ALREADY_IN_GAME', 'Leave your current game first'));
            return;
        }

        let lobbyCode = generateLobbyCode();
        while (store.get(lobbyCode)) {
            lobbyCode = generateLobbyCode();
        }

        const session = new GameSession(createGame(lobbyCode));
        const user = session.addUser(clientId);
        const seat = addSeat(session.state, user.id);
        if (!seat) {
            reply(sessionFailure('GAME_FULL', 'The game has no free seats'));
            return;
        }

        store.create(session);
        attachUser(io, socket, session, user);

        console.log(`[SERVER] Game created: ${lobbyCode}`);
        reply(sessionSuccess(session, user));
        broadcastGameUpdate(io, session);
    });

    socket.on('join_game', (rawCode, clientId, ack) => {
        const reply = typeof ack === 'function' ? ack : () => undefined;
        if (!sessionLimiter.allow('session')) {
            reply(sessionFailure('RATE_LIMITED', 'Too many session attempts'));
            return;
        }
        const lobbyCode = normalizeLobbyCode(rawCode);

        if (!lobbyCode || !isClientId(clientId)) {
            reply(sessionFailure('INVALID_REQUEST', 'Invalid lobby code or client id'));
            return;
        }
        if (getSessionForSocket(store, socket)) {
            reply(sessionFailure('ALREADY_IN_GAME', 'Leave your current game first'));
            return;
        }

        let session = store.get(lobbyCode);
        if (!session) {
            reply(sessionFailure('GAME_NOT_FOUND', 'Game not found'));
            return;
        }

        let user = session.userByClientId(clientId);
        if (user && session.isExpired(user, config.reconnectGraceMs)) {
            removeUserFromSession(io, store, session, user, 'expired');
            session = store.get(lobbyCode);
            user = undefined;
            if (!session) {
                reply(sessionFailure('GAME_NOT_FOUND', 'Game is no longer available'));
                return;
            }
        }

        if (!user) {
            if (session.state.phase !== 'LOBBY') {
                reply(
                    sessionFailure(
                        'GAME_IN_PROGRESS',
                        'This game has already started and cannot be joined'
                    )
                );
                return;
            }

            user = session.addUser(clientId);
            const seat = addSeat(session.state, user.id);
            if (!seat) {
                session.removeUser(user);
                reply(sessionFailure('GAME_FULL', 'All six seats are already taken'));
                return;
            }
        }

        attachUser(io, socket, session, user);
        reply(sessionSuccess(session, user));
        broadcastGameUpdate(io, session);
    });

    socket.on('reconnect_game', (rawCode, clientId, ack) => {
        const reply = typeof ack === 'function' ? ack : () => undefined;
        if (!sessionLimiter.allow('session')) {
            reply(sessionFailure('RATE_LIMITED', 'Too many session attempts'));
            return;
        }
        const lobbyCode = normalizeLobbyCode(rawCode);

        if (!lobbyCode || !isClientId(clientId)) {
            reply(sessionFailure('INVALID_REQUEST', 'Invalid lobby code or client id'));
            return;
        }
        if (
            socket.data.gameCode &&
            socket.data.gameCode !== lobbyCode &&
            store.get(socket.data.gameCode)
        ) {
            reply(sessionFailure('ALREADY_IN_GAME', 'You are already connected to a game'));
            return;
        }

        const session = store.get(lobbyCode);
        if (!session) {
            reply(sessionFailure('SESSION_EXPIRED', 'This game is no longer available'));
            return;
        }

        const user = session.userByClientId(clientId);
        if (!user) {
            reply(
                sessionFailure(
                    'SESSION_EXPIRED',
                    'Your seat is no longer held. The reconnect window has expired.'
                )
            );
            return;
        }

        if (session.isExpired(user, config.reconnectGraceMs)) {
            removeUserFromSession(io, store, session, user, 'expired');
            reply(sessionFailure('SESSION_EXPIRED', 'Your reconnect window has expired'));
            return;
        }

        attachUser(io, socket, session, user);
        reply(sessionSuccess(session, user));
        broadcastGameUpdate(io, session);
    });

    socket.on('leave_game', () => {
        const session = getSessionForSocket(store, socket);
        const user = session ? getUserForSocket(session, socket) : undefined;
        const lobbyCode = session?.state.lobbyCode;

        socket.data.gameCode = undefined;
        if (lobbyCode) socket.leave(lobbyCode);

        if (!session || !user) return;
        removeUserFromSession(io, store, session, user, 'left');
    });

    socket.on('add_detective', () => {
        if (!actionLimiter.allow('action')) {
            sendError(socket, 'RATE_LIMITED', 'Too many lobby actions');
            return;
        }
        const session = getSessionForSocket(store, socket);
        const user = session ? getUserForSocket(session, socket) : undefined;
        if (!session || !user) return;

        if (session.state.phase !== 'LOBBY') {
            sendError(socket, 'BAD_STATE', 'Detectives can only be added in the lobby');
            return;
        }
        if (session.playersOf(user.id).some(player => player.role === 'MR_X')) {
            sendError(socket, 'MRX_CANNOT_ADD', 'Mr. X cannot control detective pawns');
            return;
        }
        if (!addDetectiveSeat(session.state, user.id)) {
            sendError(socket, 'DETECTIVE_LIMIT', 'No detective seats are available');
            return;
        }

        broadcastGameUpdate(io, session);
    });

    socket.on('remove_detective', () => {
        if (!actionLimiter.allow('action')) {
            sendError(socket, 'RATE_LIMITED', 'Too many lobby actions');
            return;
        }
        const session = getSessionForSocket(store, socket);
        const user = session ? getUserForSocket(session, socket) : undefined;
        if (!session || !user) return;
        if (session.state.phase !== 'LOBBY') return;

        const ownSeats = session.playersOf(user.id);
        if (ownSeats.some(player => player.role === 'MR_X')) {
            sendError(socket, 'MRX_CANNOT_REMOVE', 'Mr. X cannot remove a detective');
            return;
        }
        if (ownSeats.length <= 1) {
            sendError(socket, 'LAST_SEAT', 'Use Leave instead of removing your last seat');
            return;
        }

        const seat = [...ownSeats].sort((a, b) => b.seat - a.seat)[0];
        session.state.players = session.state.players.filter(player => player.id !== seat.id);
        resetReadiness(session.state, user.id);
        broadcastGameUpdate(io, session);
    });

    socket.on('toggle_ready', () => {
        if (!actionLimiter.allow('action')) {
            sendError(socket, 'RATE_LIMITED', 'Too many lobby actions');
            return;
        }
        const session = getSessionForSocket(store, socket);
        const user = session ? getUserForSocket(session, socket) : undefined;
        if (!session || !user) return;
        if (session.state.phase !== 'LOBBY') return;

        const ownSeats = session.playersOf(user.id);
        if (ownSeats.length === 0) return;

        const target = !ownSeats.every(player => player.isReady);
        ownSeats.forEach(player => {
            player.isReady = target;
        });

        broadcastGameUpdate(io, session);
    });

    socket.on('claim_mr_x', () => {
        if (!actionLimiter.allow('action')) {
            sendError(socket, 'RATE_LIMITED', 'Too many lobby actions');
            return;
        }
        const session = getSessionForSocket(store, socket);
        const user = session ? getUserForSocket(session, socket) : undefined;
        if (!session || !user) return;

        const result = claimMrX(session.state, user.id);
        if (!result.ok) {
            sendError(socket, result.code, result.message);
            return;
        }

        broadcastGameUpdate(io, session);
    });

    socket.on('disconnect', () => {
        const session = getSessionForSocket(store, socket);
        const user = session ? getUserForSocket(session, socket) : undefined;
        socket.data.gameCode = undefined;

        if (!session || !user) return;

        if (session.detach(user, socket.id)) {
            console.log(`[SERVER] User disconnected: ${user.number} (${session.state.lobbyCode})`);
            broadcastGameUpdate(io, session);
        }
    });
}
