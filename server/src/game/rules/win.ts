import { MAX_ROUNDS } from '../../../../shared/src/constants.ts';
import { hasValidMoves } from '../../../../shared/src/map.ts';
import type { GameState, WinCheck } from '../../../../shared/src/types.ts';

export function checkWinCondition(game: GameState): WinCheck {
    const mrX = game.players.find(player => player.role === 'MR_X');
    const detectives = game.players.filter(player => player.role === 'DETECTIVE');

    if (!mrX) {
        return { gameOver: false };
    }

    if (detectives.some(detective => detective.position === mrX.position)) {
        return { gameOver: true, winner: 'DETECTIVES', reason: 'Mr. X was caught!' };
    }

    if (game.round > MAX_ROUNDS) {
        return { gameOver: true, winner: 'MR_X', reason: 'Time ran out (24 Rounds)' };
    }

    if (game.turn === mrX.id && !hasValidMoves(mrX)) {
        return { gameOver: true, winner: 'DETECTIVES', reason: 'Mr. X has no valid moves!' };
    }

    const activeDetectives = detectives.filter(detective => hasValidMoves(detective));
    if (activeDetectives.length === 0 && detectives.length > 0) {
        return { gameOver: true, winner: 'MR_X', reason: 'All Detectives are stuck!' };
    }

    return { gameOver: false };
}
