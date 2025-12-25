// server/src/MapManager.ts
import mapData from './data/mapData.json';

export class MapManager {
  static isValidMove(fromId: number, toId: number, transport: string): boolean {
    const node = mapData.nodes[fromId];
    if (!node) return false;
    
    // Check if there is an edge to the target with the specific transport
    return node.edges.some(edge => edge.to === toId && edge.type === transport);
  }

  static getPlayerPossibleMoves(nodeId: number, tickets: Record<string, number>) {
    const node = mapData.nodes[nodeId];
    return node.edges.filter(edge => tickets[edge.type] > 0);
  }
}