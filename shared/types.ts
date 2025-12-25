export type Transport = 'taxi' | 'bus' | 'underground' | 'water';

export interface Edge {
    to: number;
    type: Transport;
}

export interface GameNode {
    id: number;
    x: number;
    y: number;
    types: Transport[];
    edges: Edge[];
}

export interface MapData {
    nodes: Record<number, GameNode>;
}

export interface Player {
    id: string;
    role: 'MR_X' | 'DETECTIVE';
    position: number;
    tickets: Record<Transport, number>;
}

export interface GameState {
    players: Player[];
    turn: string; // Player ID
    round: number;
}