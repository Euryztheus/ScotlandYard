import { randomUUID } from 'node:crypto';
import type { GameState, Player } from '../../../shared/src/types.ts';

/**
 * Server-side connection identity. `clientId` is the reconnect secret and is
 * never included in a GameState sent to clients. `id` is the public group id
 * that appears on Player.ownerId.
 */
export interface GameUser {
    id: string;
    clientId: string;
    number: number;
    socketId: string | null;
    connected: boolean;
    disconnectedAt: number | null;
}

export class GameSession {
    readonly state: GameState;

    private readonly usersById = new Map<string, GameUser>();
    private readonly usersByClientId = new Map<string, GameUser>();
    private readonly usersBySocketId = new Map<string, GameUser>();
    private nextUserNumber = 1;

    constructor(state: GameState) {
        this.state = state;
    }

    get users(): GameUser[] {
        return [...this.usersById.values()];
    }

    userByClientId(clientId: string): GameUser | undefined {
        return this.usersByClientId.get(clientId);
    }

    userBySocketId(socketId: string): GameUser | undefined {
        return this.usersBySocketId.get(socketId);
    }

    addUser(clientId: string): GameUser {
        const existing = this.usersByClientId.get(clientId);
        if (existing) return existing;

        const user: GameUser = {
            id: randomUUID(),
            clientId,
            number: this.nextUserNumber,
            socketId: null,
            connected: false,
            disconnectedAt: null
        };
        this.nextUserNumber += 1;

        this.usersById.set(user.id, user);
        this.usersByClientId.set(clientId, user);
        this.state.users.push({
            id: user.id,
            number: user.number,
            connected: false
        });

        if (!this.state.hostId) {
            this.state.hostId = user.id;
        }

        return user;
    }

    attach(user: GameUser, socketId: string): void {
        if (user.socketId && user.socketId !== socketId) {
            this.usersBySocketId.delete(user.socketId);
        }

        user.socketId = socketId;
        user.connected = true;
        user.disconnectedAt = null;
        this.usersBySocketId.set(socketId, user);

        const view = this.state.users.find(candidate => candidate.id === user.id);
        if (view) {
            view.connected = true;
            delete view.disconnectedAt;
        }
    }

    detach(user: GameUser, socketId: string): boolean {
        if (user.socketId !== socketId) return false;

        user.socketId = null;
        user.connected = false;
        user.disconnectedAt = Date.now();
        this.usersBySocketId.delete(socketId);

        const view = this.state.users.find(candidate => candidate.id === user.id);
        if (view) {
            view.connected = false;
            view.disconnectedAt = user.disconnectedAt;
        }

        return true;
    }

    removeUser(user: GameUser): Player[] {
        const removedPlayers = this.state.players.filter(player => player.ownerId === user.id);
        this.state.players = this.state.players.filter(player => player.ownerId !== user.id);
        this.state.users = this.state.users.filter(candidate => candidate.id !== user.id);

        this.usersById.delete(user.id);
        this.usersByClientId.delete(user.clientId);
        if (user.socketId) this.usersBySocketId.delete(user.socketId);

        return removedPlayers;
    }

    playersOf(ownerId: string): Player[] {
        return this.state.players.filter(player => player.ownerId === ownerId);
    }

    isExpired(user: GameUser, graceMs: number, now = Date.now()): boolean {
        return (
            !user.connected &&
            user.disconnectedAt !== null &&
            now - user.disconnectedAt >= graceMs
        );
    }

    /** Prefer a connected user; otherwise keep a deterministic fallback. */
    pickHost(): string {
        const connected = this.users.filter(user => user.connected);
        const pool = connected.length > 0 ? connected : this.users;
        return pool.sort((a, b) => a.number - b.number)[0]?.id ?? '';
    }
}
