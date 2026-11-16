import type { MoveRecord } from '../../../shared/src/types.ts';

export function findLastKnownPosition(history: MoveRecord[]): number {
    for (let index = history.length - 1; index >= 0; index -= 1) {
        const position = history[index]?.position;
        if (position) return position;
    }
    return 0;
}
