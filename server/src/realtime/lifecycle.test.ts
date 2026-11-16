import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../shared/src/types.ts';
import { addSeat, createGame, startGame } from '../game/factory.ts';
import { GameStore } from '../game/GameStore.ts';
import { GameSession } from '../game/session.ts';
import { removeUserFromSession } from './lifecycle.ts';
import type { GameServer } from './types.ts';

function makeSession(clientIds: string[]): { session: GameSession; users: ReturnType<GameSession['addUser']>[] } {
    const session = new GameSession(createGame('TEST1'));
    const users = clientIds.map((clientId, index) => {
        const user = session.addUser(clientId);
        session.attach(user, `socket-${index}`);
        addSeat(session.state, user.id);
        return user;
    });
    return { session, users };
}

function startSession(session: GameSession): void {
    session.state.players.forEach(player => {
        player.isReady = true;
    });
    const result = startGame(session.state, session.state.hostId);
    if (!result.ok) throw new Error(result.message);
}

function fakeIo(sent: Array<{ socketId: string; state: GameState }>): GameServer {
    return {
        to: (socketId: string) => ({
            emit: (_event: string, state: GameState) => {
                sent.push({ socketId, state });
            }
        })
    } as unknown as GameServer;
}

describe('removing users', () => {
    it('repairs the turn when the current detective leaves', () => {
        const { session, users } = makeSession([
            'client-1111-aaaa',
            'client-2222-bbbb',
            'client-3333-cccc'
        ]);
        startSession(session);

        const departing = session.playersOf(users[1].id)[0];
        const nextSeat = session.playersOf(users[2].id)[0];
        session.state.turn = departing.id;

        const sent: Array<{ socketId: string; state: GameState }> = [];
        const store = new GameStore();
        store.create(session);

        removeUserFromSession(fakeIo(sent), store, session, users[1], 'left');

        expect(session.state.phase).toBe('PLAYING');
        expect(session.state.players).toHaveLength(2);
        expect(session.state.turn).toBe(nextSeat.id);
        expect(sent.length).toBeGreaterThan(0);
    });

    it('ends the game and transfers host when Mr. X expires', () => {
        const { session, users } = makeSession(['client-1111-aaaa', 'client-2222-bbbb']);
        startSession(session);

        const store = new GameStore();
        store.create(session);
        const sent: Array<{ socketId: string; state: GameState }> = [];

        removeUserFromSession(fakeIo(sent), store, session, users[0], 'expired');

        expect(session.state.phase).toBe('FINISHED');
        expect(session.state.result).toMatchObject({
            winner: 'DETECTIVES',
            reason: 'Mr. X did not reconnect in time'
        });
        expect(session.state.hostId).toBe(users[1].id);
        expect(store.get('TEST1')).toBe(session);
    });

    it('keeps a lobby alive without Mr. X so a new Mr. X can join', () => {
        const { session, users } = makeSession(['client-1111-aaaa', 'client-2222-bbbb']);
        const store = new GameStore();
        store.create(session);
        const sent: Array<{ socketId: string; state: GameState }> = [];

        removeUserFromSession(fakeIo(sent), store, session, users[0], 'expired');

        expect(session.state.phase).toBe('LOBBY');
        expect(session.state.players.every(player => player.role === 'DETECTIVE')).toBe(true);
        expect(session.state.hostId).toBe(users[1].id);
        expect(session.state.players.every(player => !player.isReady)).toBe(true);
    });

    it('deletes the game when the last user leaves', () => {
        const { session, users } = makeSession(['client-1111-aaaa']);
        const store = new GameStore();
        store.create(session);

        removeUserFromSession(
            fakeIo([]),
            store,
            session,
            users[0],
            'left'
        );

        expect(store.get('TEST1')).toBeUndefined();
    });
});
