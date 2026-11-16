import { REVEAL_ROUNDS } from '../../../../shared/src/constants.ts';
import type { GameState, Player, TicketType } from '../../../../shared/src/types.ts';

export interface MrXMoveOptions {
    isDoubleMove: boolean;
    /** The second leg of a double move is hidden, even on a reveal round. */
    hidePosition?: boolean;
}

export function recordMrXMove(
    game: GameState,
    player: Player,
    transport: TicketType,
    options: MrXMoveOptions
): void {
    const isRevealRound = REVEAL_ROUNDS.includes(game.round) && !options.hidePosition;

    game.moveHistory.push({
        round: game.round,
        transport,
        position: isRevealRound ? player.position : undefined,
        isHidden: !isRevealRound,
        isDoubleMove: options.isDoubleMove
    });
}
