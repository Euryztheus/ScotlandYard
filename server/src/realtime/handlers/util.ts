import type { GameState, Player } from '../../../../shared/src/types.ts';
import type { GameStore } from '../../game/GameStore.ts';
import type { GameSocket } from '../types.ts';

export function getGameForSocket(store: GameStore, socket: GameSocket): GameState | undefined {
    const game = store.get(socket.data.gameCode);
    if (!game) {
        socket.data.gameCode = undefined;
    }
    return game;
}

export function getPlayerForSocket(game: GameState, socket: GameSocket): Player | undefined {
    return game.players.find(player => player.id === socket.id);
}
