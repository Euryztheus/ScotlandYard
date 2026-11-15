import type { GameState } from '../../../shared/src/types.ts';

/**
 * Builds the state a specific player is allowed to see. Detectives must not
 * receive Mr. X's real position; the hidden token is represented by node 0.
 */
export function projectStateFor(game: GameState, viewerId: string): GameState {
    const state = structuredClone(game);
    const viewer = state.players.find(player => player.id === viewerId);

    if (viewer?.role === 'DETECTIVE') {
        state.players.forEach(player => {
            if (player.role === 'MR_X') {
                player.position = 0;
            }
        });
    }

    return state;
}
