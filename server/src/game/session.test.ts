import { describe, expect, it } from 'vitest';
import { createGame } from './factory.ts';
import { GameSession } from './session.ts';

describe('game session identity', () => {
    it('creates stable users, attaches sockets and tracks offline state', () => {
        const session = new GameSession(createGame('TEST1'));

        const user = session.addUser('client-1111-aaaa');
        expect(session.addUser('client-1111-aaaa')).toBe(user);
        expect(session.state.hostId).toBe(user.id);
        expect(session.state.users).toHaveLength(1);

        session.attach(user, 'socket-1');
        expect(user.connected).toBe(true);
        expect(session.userBySocketId('socket-1')).toBe(user);
        expect(session.state.users[0]).toMatchObject({ connected: true });

        expect(session.detach(user, 'socket-1')).toBe(true);
        expect(user.connected).toBe(false);
        expect(user.disconnectedAt).not.toBeNull();
        expect(session.state.users[0]).toMatchObject({ connected: false });
        expect(session.isExpired(user, 0)).toBe(true);

        session.attach(user, 'socket-2');
        expect(session.isExpired(user, 60_000)).toBe(false);
        expect(session.detach(user, 'socket-1')).toBe(false);
    });

    it('removes users and their seats and chooses a new host', () => {
        const session = new GameSession(createGame('TEST1'));
        const first = session.addUser('client-1111-aaaa');
        const second = session.addUser('client-2222-bbbb');

        session.attach(first, 'socket-1');
        session.attach(second, 'socket-2');

        session.state.players.push({
            id: 'seat-1',
            ownerId: first.id,
            role: 'MR_X',
            seat: 0,
            position: 1,
            tickets: { taxi: 0, bus: 0, underground: 0, black: 0 },
            doubleTickets: 0,
            isReady: false
        });

        const removed = session.removeUser(first);

        expect(removed).toHaveLength(1);
        expect(session.state.users).toHaveLength(1);
        expect(session.state.players).toHaveLength(0);
        expect(session.userByClientId(first.clientId)).toBeUndefined();
        expect(session.pickHost()).toBe(second.id);
    });
});
