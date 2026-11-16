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

/**
 * A seat on the board, not a connected user. One user can own several
 * detective seats; Mr. X is always a single seat with seat number 0.
 */
export interface Player {
    id: string;
    ownerId: string;
    role: Role;
    seat: number;
    position: number;
    tickets: Record<TicketType, number>;
    doubleTickets: number;
    isReady: boolean;
}

/**
 * Public view of a connected user. `id` is an opaque group id used to
 * associate seats; the reconnect secret is never exposed.
 */
export interface GameUserView {
    id: string;
    number: number;
    connected: boolean;
    disconnectedAt?: number;
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
    users: GameUserView[];
    hostId: string;
    turn: string;
    round: number;
    settings: GameSettings;
    moveHistory: MoveRecord[];
    pendingDoubleMove?: boolean;
    result?: GameOverResult;
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
    | 'INVALID_REQUEST'
    | 'INVALID_EDGE'
    | 'NODE_OCCUPIED'
    | 'NO_TICKET'
    | 'DOUBLE_NOT_ALLOWED'
    | 'RATE_LIMITED'
    | 'BAD_STATE';

export type MoveResult =
    | { ok: true }
    | { ok: false; code: MoveErrorCode; message: string };

export interface ServerError {
    code: string;
    message: string;
}

export interface SessionSuccess {
    ok: true;
    lobbyCode: string;
    ownerId: string;
    gameState: GameState;
}

export interface SessionFailure {
    ok: false;
    code: string;
    message: string;
}

export type SessionResult = SessionSuccess | SessionFailure;
