import { GameSettings } from "./types.ts";

export const DEFAULT_SETTINGS: GameSettings = {
    mrXStartTickets: { taxi: 4, bus: 3, underground: 3, water: 0 }, // Reduced for testing
    detectiveStartTickets: { taxi: 10, bus: 8, underground: 4, water: 0 },
    infiniteTickets: false
};