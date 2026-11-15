import type { Player } from '../../../shared/src/types.ts';

export const DETECTIVE_COLORS = [
    '#EF4444',
    '#10B981',
    '#3B82F6',
    '#F59E0B',
    '#8B5CF6',
    '#EC4899'
] as const;

export function detectiveColorCss(playerId: string, players: Player[]): string {
    const detectives = players
        .filter(player => player.role === 'DETECTIVE')
        .sort((a, b) => a.id.localeCompare(b.id));
    const index = detectives.findIndex(player => player.id === playerId);
    if (index === -1) return '#aaaaaa';
    return DETECTIVE_COLORS[index % DETECTIVE_COLORS.length];
}

export function detectiveColorHex(playerId: string, players: Player[]): number {
    return Number.parseInt(detectiveColorCss(playerId, players).slice(1), 16);
}
