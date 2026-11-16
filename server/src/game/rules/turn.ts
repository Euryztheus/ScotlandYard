import { hasValidMoves } from '../../../../shared/src/map.ts';
import type { GameState, Player } from '../../../../shared/src/types.ts';

export function currentPlayer(game: GameState): Player | undefined {
    return game.players.find(player => player.id === game.turn);
}

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
        !hasValidMoves(players, nextPlayer) &&
        attempts < players.length
    ) {
        nextIndex = (nextIndex + 1) % players.length;
        nextPlayer = players[nextIndex];
        attempts += 1;
    }

    game.turn = nextPlayer.id;
}

/**
 * A round starts when Mr. X begins his turn. If the turn has just moved back
 * to Mr. X, the round is over and the next one begins.
 */
export function maybeAdvanceRound(game: GameState): void {
    const player = currentPlayer(game);
    if (player?.role === 'MR_X') {
        game.round += 1;
    }
}

/**
 * After a user loses their seats, continue from the next remaining seat in
 * the original turn order. Stuck detectives are skipped like in a normal turn.
 */
export function repairTurnAfterRemoval(game: GameState, nextPlayerId: string): void {
    if (game.players.length === 0) {
        game.turn = '';
        return;
    }

    game.turn = game.players.some(player => player.id === nextPlayerId)
        ? nextPlayerId
        : game.players[0].id;

    const player = currentPlayer(game);
    if (player?.role === 'DETECTIVE' && !hasValidMoves(game.players, player)) {
        advanceTurn(game, player.id);
    }
}

export function isMrXTurn(game: GameState): boolean {
    return currentPlayer(game)?.role === 'MR_X';
}
