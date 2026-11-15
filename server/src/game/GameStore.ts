import type { GameState } from '../../../shared/src/types.ts';

export class GameStore {
    private readonly games = new Map<string, GameState>();

    create(game: GameState): void {
        this.games.set(game.lobbyCode, game);
    }

    get(lobbyCode: string | undefined): GameState | undefined {
        if (!lobbyCode) return undefined;
        return this.games.get(lobbyCode);
    }

    findByPlayer(socketId: string): GameState | undefined {
        for (const game of this.games.values()) {
            if (game.players.some(player => player.id === socketId)) {
                return game;
            }
        }
        return undefined;
    }

    remove(lobbyCode: string): void {
        this.games.delete(lobbyCode);
    }

    get size(): number {
        return this.games.size;
    }
}
