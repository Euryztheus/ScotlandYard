import { describe, expect, it } from 'vitest';
import { addPlayer, createGame } from './factory.ts';
import { projectStateFor } from './view.ts';

describe('state projection', () => {
    it('hides Mr. X from detectives without mutating the real state', () => {
        const game = createGame('TEST1');
        addPlayer(game, 'mrx');
        addPlayer(game, 'det1');
        game.players[0].position = 42;

        const detectiveView = projectStateFor(game, 'det1');

        expect(detectiveView.players.find(player => player.role === 'MR_X')?.position).toBe(0);
        expect(game.players.find(player => player.role === 'MR_X')?.position).toBe(42);
    });

    it('shows Mr. X his own position', () => {
        const game = createGame('TEST1');
        addPlayer(game, 'mrx');
        addPlayer(game, 'det1');
        game.players[0].position = 42;

        const mrXView = projectStateFor(game, 'mrx');

        expect(mrXView.players.find(player => player.role === 'MR_X')?.position).toBe(42);
    });
});
