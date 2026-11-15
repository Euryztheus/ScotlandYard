import type { GameSettings } from './types.ts';

export const DEFAULT_SETTINGS: GameSettings = {
    mrXStartTickets: { taxi: 4, bus: 3, underground: 3, black: 4 },
    mrXDoubleTickets: 2,
    detectiveStartTickets: { taxi: 10, bus: 8, underground: 4, black: 0 },
    infiniteTickets: false
};

export const REVEAL_ROUNDS: readonly number[] = [3, 8, 13, 18, 24];

export const MAX_ROUNDS = 24;

export const MAP_WIDTH = 2849;
export const MAP_HEIGHT = 2235;
