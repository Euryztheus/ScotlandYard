import type { GameState } from '../../../shared/src/types.ts';
import { projectStateFor } from '../game/view.ts';
import type { GameSession } from '../game/session.ts';
import type { GameServer } from './types.ts';

export function broadcastGameUpdate(io: GameServer, session: GameSession): void {
    session.users.forEach(user => {
        if (!user.connected || !user.socketId) return;
        const state = projectStateFor(session.state, user.id);
        io.to(user.socketId).emit('game_update', state);
    });
}

export function stateForUser(session: GameSession, ownerId: string): GameState {
    return projectStateFor(session.state, ownerId);
}
