import type {
    GameOverResult,
    GameState,
    MoveErrorCode,
    MoveRequest
} from '../../../shared/src/types.ts';
import { applyMove } from './rules/moves.ts';
import { advanceTurn } from './rules/turn.ts';
import { checkWinCondition } from './rules/win.ts';

export type PlayMoveResult =
    | { ok: true; gameOver?: GameOverResult }
    | { ok: false; code: MoveErrorCode; message: string };

export function playMove(game: GameState, playerId: string, request: MoveRequest): PlayMoveResult {
    const player = game.players.find(candidate => candidate.id === playerId);
    if (!player) {
        return { ok: false, code: 'INVALID_PLAYER', message: 'Player is not in this game' };
    }

    const moveResult = applyMove(game, player, request);
    if (!moveResult.ok) {
        return moveResult;
    }

    let winCheck = checkWinCondition(game);
    if (winCheck.gameOver) {
        game.phase = 'FINISHED';
        return { ok: true, gameOver: winCheck };
    }

    // First leg of a double move: Mr. X plays again.
    if (request.useDoubleTicket && player.role === 'MR_X') {
        game.pendingDoubleMove = true;
        return { ok: true };
    }

    // Second leg of a double move: clear the flag and rotate normally.
    if (game.pendingDoubleMove && player.role === 'MR_X') {
        game.pendingDoubleMove = false;
    }

    advanceTurn(game, player.id);

    winCheck = checkWinCondition(game);
    if (winCheck.gameOver) {
        game.phase = 'FINISHED';
        return { ok: true, gameOver: winCheck };
    }

    return { ok: true };
}
