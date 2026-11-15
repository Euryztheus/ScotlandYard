import rawMapData from './mapData.json' with { type: 'json' };
import type {
    Edge,
    EdgeType,
    GameNode,
    MapData,
    Player,
    TicketType,
    Transport
} from './types.ts';

const mapData = rawMapData as unknown as MapData;

export const MAP: MapData = mapData;
export const MAP_NODES: Record<number, GameNode> = mapData.nodes;
export const MAP_NODE_IDS: number[] = Object.keys(MAP_NODES).map(Number);

export function getNode(id: number): GameNode | undefined {
    return MAP_NODES[id];
}

export function getEdges(id: number): Edge[] {
    return getNode(id)?.edges ?? [];
}

export function findEdge(fromId: number, toId: number, type: EdgeType): Edge | undefined {
    return getEdges(fromId).find(edge => edge.to === toId && edge.type === type);
}

export function findAnyEdgeTo(fromId: number, toId: number): Edge | undefined {
    return getEdges(fromId).find(edge => edge.to === toId);
}

export function isTicketType(type: EdgeType): type is Transport {
    return type !== 'water';
}

/**
 * The ticket a player would spend on an edge, or null when the edge is not
 * usable by that player at all.
 */
export function ticketTypeForEdge(edge: Edge, player: Player): TicketType | null {
    if (edge.type === 'water') {
        return player.role === 'MR_X' && player.tickets.black > 0 ? 'black' : null;
    }
    if (player.tickets[edge.type] > 0) {
        return edge.type;
    }
    if (player.role === 'MR_X' && player.tickets.black > 0) {
        return 'black';
    }
    return null;
}

export function hasValidMoves(player: Player): boolean {
    return getEdges(player.position).some(edge => ticketTypeForEdge(edge, player) !== null);
}
