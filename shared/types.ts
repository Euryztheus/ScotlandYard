export type Transport = 'taxi' | 'bus' | 'underground' | 'black';
export type GamePhase = 'LOBBY' | 'PLAYING' | 'FINISHED';

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

export interface GameSettings {
    mrXStartTickets: Record<Transport, number>;
    mrXDoubleTickets: number;
    detectiveStartTickets: Record<Transport, number>;
    infiniteTickets: boolean;
}

export interface Player {
    id: string;
    role: 'MR_X' | 'DETECTIVE';
    position: number;
    tickets: Record<Transport, number>;
    doubleTickets: number;
    isReady: boolean; 
    isHost: boolean; 
}

export interface MoveRecord {
    round: number;
    transport: Transport; 
    position?: number;    
    isHidden: boolean;
    isDoubleMove?: boolean;
}

export interface GameState {
    lobbyCode: string;
    phase: GamePhase;
    players: Player[];
    turn: string; 
    round: number;
    settings: GameSettings;
    moveHistory: MoveRecord[];
    pendingDoubleMove?: boolean; 
}