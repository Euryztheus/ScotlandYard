export const DETECTIVE_COLORS = [
    '#EF4444',
    '#10B981',
    '#3B82F6',
    '#F59E0B',
    '#8B5CF6',
    '#EC4899'
] as const;

/** Seats are stable, unlike socket ids or join order. */
export function detectiveColorCss(seat: number): string {
    const index = Math.max(0, seat - 1);
    return DETECTIVE_COLORS[index % DETECTIVE_COLORS.length];
}

export function detectiveColorHex(seat: number): number {
    return Number.parseInt(detectiveColorCss(seat).slice(1), 16);
}
