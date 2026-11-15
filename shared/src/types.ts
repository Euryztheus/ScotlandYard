export type Transport = 'taxi' | 'bus' | 'underground';
export type EdgeType = Transport | 'water';
export type TicketType = Transport | 'black';

export type GamePhase = 'LOBBY' | 'PLAYING' | 'FINISHED';
export type Role = 'MR_X' | 'DETECTIVE';

export interface Edge {
    to: number;
    type: EdgeType;
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
    mrXStartTickets: Record<TicketType, number>;
    mrXDoubleTickets: number;
    detectiveStartTickets: Record<TicketType, number>;
    infiniteTickets: boolean;
}

export interface Player {
    id: string;
    role: Role;
    position: number;
    tickets: Record<TicketType, number>;
    doubleTickets: number;
    isReady: boolean;
    isHost: boolean;
}

export interface MoveRecord {
    round: number;
    transport: TicketType;
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

export interface MoveRequest {
    toNode: number;
    transport: EdgeType;
    useBlackTicket?: boolean;
    useDoubleTicket?: boolean;
}

export interface GameOverResult {
    gameOver: true;
    winner: 'MR_X' | 'DETECTIVES';
    reason: string;
}

export interface GameOngoing {
    gameOver: false;
}

export type WinCheck = GameOverResult | GameOngoing;

export type MoveErrorCode =
    | 'NOT_IN_GAME'
    | 'INVALID_PLAYER'
    | 'NOT_YOUR_TURN'
    | 'INVALID_EDGE'
    | 'NO_TICKET'
    | 'DOUBLE_NOT_ALLOWED'
    | 'BAD_STATE';

export type MoveResult =
    | { ok: true }
    | { ok: false; code: MoveErrorCode; message: string };

export interface ServerError {
    code: string;
    message: string;
}
