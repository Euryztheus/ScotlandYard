import { findAnyEdgeTo, findEdge, isNodeBlocked } from '../../../../shared/src/map.ts';
import type {
    Edge,
    GameState,
    MoveErrorCode,
    MoveRequest,
    MoveResult,
    Player,
    TicketType
} from '../../../../shared/src/types.ts';
import { recordMrXMove } from './history.ts';
import { canAfford, grantTicket, spendTicket } from './tickets.ts';

function fail(code: MoveErrorCode, message: string): MoveResult {
    return { ok: false, code, message };
}

export function applyMove(
    game: GameState,
    player: Player,
    request: MoveRequest,
    isSecondLeg: boolean
): MoveResult {
    if (game.phase !== 'PLAYING') {
        return fail('BAD_STATE', 'The game is not in progress');
    }
    if (game.turn !== player.id) {
        return fail('NOT_YOUR_TURN', 'It is not your turn');
    }

    if (request.useDoubleTicket) {
        if (player.role !== 'MR_X' || player.doubleTickets <= 0) {
            return fail('DOUBLE_NOT_ALLOWED', 'No double ticket available');
        }
        if (game.pendingDoubleMove) {
            return fail('DOUBLE_NOT_ALLOWED', 'A double move is already in progress');
        }
    }

    let edge: Edge | undefined;
    let costType: TicketType;

    if (request.useBlackTicket) {
        if (player.role !== 'MR_X') {
            return fail('NO_TICKET', 'Only Mr. X can use black tickets');
        }
        edge = findAnyEdgeTo(player.position, request.toNode);
        if (!edge) {
            return fail('INVALID_EDGE', 'There is no connection to that station');
        }
        costType = 'black';
    } else {
        edge = findEdge(player.position, request.toNode, request.transport);
        if (!edge) {
            return fail('INVALID_EDGE', 'Invalid connection for that transport');
        }
        if (edge.type === 'water') {
            if (player.role !== 'MR_X') {
                return fail('NO_TICKET', 'Only Mr. X can use water routes');
            }
            costType = 'black';
        } else {
            costType = edge.type;
        }
    }

    if (isNodeBlocked(game.players, player, request.toNode)) {
        return fail('NODE_OCCUPIED', 'That station is occupied by another pawn');
    }

    if (!canAfford(player, costType)) {
        return fail('NO_TICKET', `No ${costType} tickets left`);
    }

    spendTicket(player, costType);
    if (player.role === 'DETECTIVE') {
        const mrX = game.players.find(candidate => candidate.role === 'MR_X');
        if (mrX) grantTicket(mrX, costType);
    }

    player.position = request.toNode;

    if (request.useDoubleTicket && player.role === 'MR_X') {
        player.doubleTickets -= 1;
    }

    if (player.role === 'MR_X') {
        recordMrXMove(game, player, costType, {
            isDoubleMove: Boolean(request.useDoubleTicket) || isSecondLeg,
            hidePosition: isSecondLeg
        });
    }

    return { ok: true };
}
