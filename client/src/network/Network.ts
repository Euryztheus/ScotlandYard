import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/src/events.ts';
import type {
    GameOverResult,
    GameSettings,
    GameState,
    MoveRequest,
    MoveResult,
    ServerError
} from '../../../shared/src/types.ts';

export interface NetworkCallbacks {
    onState: (state: GameState) => void;
    onGameOver: (result: GameOverResult) => void;
    onError: (error: ServerError) => void;
    onConnect?: (id: string) => void;
    onDisconnect?: () => void;
}

export class Network {
    private readonly socket: Socket<ServerToClientEvents, ClientToServerEvents>;

    constructor(callbacks: NetworkCallbacks) {
        this.socket = io();

        this.socket.on('connect', () => {
            callbacks.onConnect?.(this.socket.id ?? '');
        });
        this.socket.on('disconnect', () => {
            callbacks.onDisconnect?.();
        });
        this.socket.on('game_created', payload => {
            callbacks.onState(payload.gameState);
        });
        this.socket.on('game_update', callbacks.onState);
        this.socket.on('game_over', callbacks.onGameOver);
        this.socket.on('server_error', callbacks.onError);
    }

    createGame(): void {
        this.socket.emit('create_game');
    }

    joinGame(code: string): void {
        this.socket.emit('join_game', code);
    }

    sendMove(move: MoveRequest, ack: (result: MoveResult) => void): void {
        this.socket.emit('player_move', move, ack);
    }

    getID(): string {
        return this.socket.id ?? '';
    }

    toggleReady(): void {
        this.socket.emit('toggle_ready');
    }

    updateSettings(settings: Partial<GameSettings>): void {
        this.socket.emit('update_settings', settings);
    }

    startGame(): void {
        this.socket.emit('start_game');
    }

    claimMrX(): void {
        this.socket.emit('claim_mr_x');
    }
}
