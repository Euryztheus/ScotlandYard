import type { GameSession } from './session.ts';

export class GameStore {
    private readonly games = new Map<string, GameSession>();

    create(session: GameSession): void {
        this.games.set(session.state.lobbyCode, session);
    }

    get(lobbyCode: string | undefined): GameSession | undefined {
        if (!lobbyCode) return undefined;
        return this.games.get(lobbyCode);
    }

    remove(lobbyCode: string): void {
        this.games.delete(lobbyCode);
    }

    all(): GameSession[] {
        return [...this.games.values()];
    }
}
