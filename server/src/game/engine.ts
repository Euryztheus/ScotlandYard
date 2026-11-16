import type {
    GameOverResult,
    GameState,
    MoveErrorCode,
    MoveRequest
} from '../../../shared/src/types.ts';
import { applyMove } from './rules/moves.ts';
import { advanceTurn, maybeAdvanceRound } from './rules/turn.ts';
import { applyWinCondition } from './rules/win.ts';

export type PlayMoveResult =
    | { ok: true; gameOver?: GameOverResult }
    | { ok: false; code: MoveErrorCode; message: string };

export function playMove(game: GameState, ownerId: string, request: MoveRequest): PlayMoveResult {
    const player = game.players.find(candidate => candidate.id === game.turn);
    if (!player) {
        return { ok: false, code: 'NOT_YOUR_TURN', message: 'There is no active turn' };
    }
    if (player.ownerId !== ownerId) {
        return { ok: false, code: 'NOT_YOUR_TURN', message: 'It is not your turn' };
    }

    const isSecondLeg = Boolean(game.pendingDoubleMove) && player.role === 'MR_X';

    const moveResult = applyMove(game, player, request, isSecondLeg);
    if (!moveResult.ok) {
        return moveResult;
    }

    let winResult = applyWinCondition(game);
    if (winResult) {
        return { ok: true, gameOver: winResult };
    }

    // First leg of a double move: Mr. X plays again in the same round.
    if (request.useDoubleTicket && player.role === 'MR_X') {
        game.pendingDoubleMove = true;
        return { ok: true };
    }

    if (isSecondLeg) {
        game.pendingDoubleMove = false;
    }

    advanceTurn(game, player.id);
    maybeAdvanceRound(game);

    winResult = applyWinCondition(game);
    if (winResult) {
        return { ok: true, gameOver: winResult };
    }

    return { ok: true };
}
