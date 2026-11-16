import type { GameOverResult } from '../../../shared/src/types.ts';
import { config } from '../config.ts';
import { resetReadiness } from '../game/factory.ts';
import type { GameStore } from '../game/GameStore.ts';
import type { GameSession, GameUser } from '../game/session.ts';
import {
    applyWinCondition
} from '../game/rules/win.ts';
import {
    isMrXTurn,
    maybeAdvanceRound,
    repairTurnAfterRemoval
} from '../game/rules/turn.ts';
import { broadcastGameUpdate } from './broadcast.ts';
import type { GameServer } from './types.ts';

export type RemovalReason = 'left' | 'expired';

function finish(
    session: GameSession,
    winner: GameOverResult['winner'],
    reason: string
): void {
    session.state.phase = 'FINISHED';
    session.state.result = { gameOver: true, winner, reason };
    session.state.turn = '';
}

/**
 * Removes a user and all of their seats. Used for both an explicit leave and
 * for expiry after the reconnect grace period.
 */
export function removeUserFromSession(
    io: GameServer,
    store: GameStore,
    session: GameSession,
    user: GameUser,
    reason: RemovalReason
): void {
    const state = session.state;
    const removedSeats = session.playersOf(user.id);
    const wasMrX = removedSeats.some(player => player.role === 'MR_X');
    const wasHost = state.hostId === user.id;
    const wasTurn = removedSeats.some(player => player.id === state.turn);
    const removedIds = new Set(removedSeats.map(player => player.id));
    const turnIndex = state.players.findIndex(player => player.id === state.turn);

    let nextTurnId = '';
    if (wasTurn && turnIndex >= 0) {
        for (let step = 1; step <= state.players.length; step += 1) {
            const candidate = state.players[(turnIndex + step) % state.players.length];
            if (!removedIds.has(candidate.id)) {
                nextTurnId = candidate.id;
                break;
            }
        }
    }

    session.removeUser(user);

    if (state.users.length === 0) {
        store.remove(state.lobbyCode);
        return;
    }

    if (wasHost) {
        state.hostId = session.pickHost();
    }

    if (state.phase === 'PLAYING') {
        if (wasMrX) {
            finish(
                session,
                'DETECTIVES',
                reason === 'expired'
                    ? 'Mr. X did not reconnect in time'
                    : 'Mr. X left the game'
            );
        } else {
            if (wasTurn) {
                repairTurnAfterRemoval(state, nextTurnId);
                if (isMrXTurn(state)) {
                    maybeAdvanceRound(state);
                }
            }
            applyWinCondition(state);
        }
    } else if (state.phase === 'LOBBY') {
        resetReadiness(state);
    }

    broadcastGameUpdate(io, session);
}

/** Periodically drops users whose reconnect grace period has elapsed. */
export function startReconnectSweeper(io: GameServer, store: GameStore): () => void {
    const timer = setInterval(() => {
        for (const session of store.all()) {
            const expired = session.users.filter(user =>
                session.isExpired(user, config.reconnectGraceMs)
            );

            for (const user of expired) {
                if (!store.get(session.state.lobbyCode)) break;
                if (!session.isExpired(user, config.reconnectGraceMs)) continue;
                removeUserFromSession(io, store, session, user, 'expired');
            }
        }
    }, config.reconnectSweepMs);

    timer.unref();
    return () => clearInterval(timer);
}
