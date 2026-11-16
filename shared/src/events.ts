import type {
    GameSettings,
    GameState,
    MoveRequest,
    MoveResult,
    ServerError,
    SessionResult
} from './types.ts';

export interface ClientToServerEvents {
    create_game: (clientId: string, ack: (result: SessionResult) => void) => void;
    join_game: (
        lobbyCode: string,
        clientId: string,
        ack: (result: SessionResult) => void
    ) => void;
    reconnect_game: (
        lobbyCode: string,
        clientId: string,
        ack: (result: SessionResult) => void
    ) => void;
    leave_game: () => void;
    add_detective: () => void;
    remove_detective: () => void;
    player_move: (move: MoveRequest, ack: (result: MoveResult) => void) => void;
    toggle_ready: () => void;
    claim_mr_x: () => void;
    update_settings: (settings: Partial<GameSettings>) => void;
    start_game: () => void;
}

export interface ServerToClientEvents {
    game_update: (state: GameState) => void;
    server_error: (error: ServerError) => void;
    session_replaced: () => void;
}

export interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    gameCode?: string;
}
