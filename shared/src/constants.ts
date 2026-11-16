import type { GameSettings } from './types.ts';

export const DEFAULT_SETTINGS: GameSettings = {
    mrXStartTickets: { taxi: 4, bus: 3, underground: 3, black: 5 },
    mrXDoubleTickets: 2,
    detectiveStartTickets: { taxi: 10, bus: 8, underground: 4, black: 0 },
    infiniteTickets: false
};

export const REVEAL_ROUNDS: readonly number[] = [3, 8, 13, 18, 24];

export const MAX_ROUNDS = 24;

/** The standard game has at most five detective pawns and one Mr. X. */
export const MAX_DETECTIVES = 5;
export const MAX_SEATS = MAX_DETECTIVES + 1;

/** A disconnected user keeps their seats for this long. */
export const RECONNECT_GRACE_MS = 5 * 60 * 1000;

/** Preferred starting stations, in seat order. */
export const MR_X_START = 103;
export const DETECTIVE_STARTS: readonly number[] = [13, 26, 29, 34, 50];

export const MAP_WIDTH = 2849;
export const MAP_HEIGHT = 2235;
