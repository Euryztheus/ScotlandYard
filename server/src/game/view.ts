import type { GameState } from '../../../shared/src/types.ts';

/**
 * Builds the state a specific user is allowed to see. A user playing Mr. X
 * sees the real position; a detective-only user sees the hidden token as
 * node 0. Users are groups because one user can control several detectives.
 */
export function projectStateFor(game: GameState, viewerOwnerId: string): GameState {
    const state = structuredClone(game);
    const viewerIsMrX = game.players.some(
        player => player.ownerId === viewerOwnerId && player.role === 'MR_X'
    );

    if (!viewerIsMrX) {
        state.players.forEach(player => {
            if (player.role === 'MR_X') {
                player.position = 0;
            }
        });
    }

    return state;
}
