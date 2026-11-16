import { describe, expect, it } from 'vitest';
import { addDetectiveSeat } from './factory.ts';
import { projectStateFor } from './view.ts';
import { createTestGame, mrXOf } from './testUtils.ts';

describe('state projection', () => {
    it('hides Mr. X from detectives without mutating the real state', () => {
        const game = createTestGame(['mrx', 'det1']);
        mrXOf(game).position = 42;

        const detectiveView = projectStateFor(game, 'det1');

        expect(detectiveView.players.find(player => player.role === 'MR_X')?.position).toBe(0);
        expect(mrXOf(game).position).toBe(42);
    });

    it('shows Mr. X his own position', () => {
        const game = createTestGame(['mrx', 'det1']);
        mrXOf(game).position = 42;

        const mrXView = projectStateFor(game, 'mrx');

        expect(mrXView.players.find(player => player.role === 'MR_X')?.position).toBe(42);
    });

    it('hides Mr. X from a user controlling several detectives', () => {
        const game = createTestGame(['mrx', 'det1']);
        addDetectiveSeat(game, 'det1');
        mrXOf(game).position = 42;

        const detectiveView = projectStateFor(game, 'det1');

        expect(detectiveView.players.find(player => player.role === 'MR_X')?.position).toBe(0);
    });
});
