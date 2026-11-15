import { hasValidMoves } from '../../../../shared/src/map.ts';
import type { GameState, Player } from '../../../../shared/src/types.ts';

export function advanceTurn(game: GameState, currentPlayerId: string): void {
    const { players } = game;
    if (players.length === 0) {
        game.turn = '';
        return;
    }

    const currentIndex = players.findIndex(player => player.id === currentPlayerId);
    let nextIndex = (currentIndex + 1) % players.length;
    let nextPlayer: Player = players[nextIndex];
    let attempts = 0;

    // Detectives with no legal move are skipped automatically.
    while (
        nextPlayer.role === 'DETECTIVE' &&
        !hasValidMoves(nextPlayer) &&
        attempts < players.length
    ) {
        nextIndex = (nextIndex + 1) % players.length;
        nextPlayer = players[nextIndex];
        attempts += 1;
    }

    game.turn = nextPlayer.id;
}
