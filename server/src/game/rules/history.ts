import { REVEAL_ROUNDS } from '../../../../shared/src/constants.ts';
import type { GameState, Player, TicketType } from '../../../../shared/src/types.ts';

export function recordMrXMove(
    game: GameState,
    player: Player,
    transport: TicketType,
    isDoubleMove: boolean
): void {
    // The first Mr. X move of the game starts round 1.
    if (game.round === 0) game.round = 1;

    const isRevealRound = REVEAL_ROUNDS.includes(game.round);

    game.moveHistory.push({
        round: game.round,
        transport,
        position: isRevealRound ? player.position : undefined,
        isHidden: !isRevealRound,
        isDoubleMove
    });

    // Each Mr. X move advances the round counter. This matches the original
    // behaviour, including the 2x ticket counting as two moves.
    game.round += 1;
}
