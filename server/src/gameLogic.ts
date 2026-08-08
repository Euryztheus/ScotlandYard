// server/src/MapManager.ts
import mapData from '../../shared/mapData.json' with { type: "json" };

export class MapManager {
  static isValidMove(fromId: number, toId: number, transport: string): boolean {
    const node = (mapData.nodes as any)[fromId];
    if (!node) return false;

    // Check if there is an edge to the target with the specific transport
    return node.edges.some((edge: { to: number; type: string }) => edge.to === toId && edge.type === transport);
  }

  static getPlayerPossibleMoves(nodeId: number, tickets: Record<string, number>) {
    const node = (mapData.nodes as any)[nodeId];
    return node.edges.filter((edge: { type: string }) => tickets[edge.type] > 0);
  }
}