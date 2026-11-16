import { addSeat, createGame, startGame } from './factory.ts';
import type { GameState, Player } from '../../../shared/src/types.ts';

/** Creates a lobby with one seat per owner (the first owner becomes Mr. X). */
export function createTestGame(ownerIds: string[]): GameState {
    const game = createGame('TEST1');

    ownerIds.forEach((ownerId, index) => {
        game.users.push({
            id: ownerId,
            number: index + 1,
            connected: true
        });
        if (!game.hostId) game.hostId = ownerId;
        addSeat(game, ownerId);
    });

    return game;
}

export function startTestGame(game: GameState): void {
    game.players.forEach(player => {
        player.isReady = true;
    });
    const result = startGame(game, game.hostId);
    if (!result.ok) throw new Error(result.message);
}

export function seatOf(game: GameState, ownerId: string): Player {
    const player = game.players.find(candidate => candidate.ownerId === ownerId);
    if (!player) throw new Error(`Missing seat for ${ownerId}`);
    return player;
}

export function seatsOf(game: GameState, ownerId: string): Player[] {
    return game.players.filter(candidate => candidate.ownerId === ownerId);
}

export function mrXOf(game: GameState): Player {
    const player = game.players.find(candidate => candidate.role === 'MR_X');
    if (!player) throw new Error('Missing Mr. X');
    return player;
}

export function detectiveOf(game: GameState, ownerId: string): Player {
    const player = seatsOf(game, ownerId).find(candidate => candidate.role === 'DETECTIVE');
    if (!player) throw new Error(`Missing detective for ${ownerId}`);
    return player;
}
