import type { Edge, GameNode, Player } from '../../../shared/src/types.ts';

/** Payload emitted by the map scene when a player clicks an adjacent station. */
export interface TransportRequest {
    target: GameNode;
    edges: Edge[];
    me: Player;
    screenX: number;
    screenY: number;
}
