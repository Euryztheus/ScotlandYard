import type {
    GameOverResult,
    GameSettings,
    GameState,
    MoveRequest,
    MoveResult,
    ServerError
} from './types.ts';

export interface ClientToServerEvents {
    create_game: () => void;
    join_game: (lobbyCode: string) => void;
    player_move: (move: MoveRequest, ack: (result: MoveResult) => void) => void;
    toggle_ready: () => void;
    claim_mr_x: () => void;
    update_settings: (settings: Partial<GameSettings>) => void;
    start_game: () => void;
}

export interface ServerToClientEvents {
    game_created: (payload: { lobbyCode: string; gameState: GameState }) => void;
    game_update: (state: GameState) => void;
    game_over: (result: GameOverResult) => void;
    server_error: (error: ServerError) => void;
}

export interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    gameCode?: string;
}
