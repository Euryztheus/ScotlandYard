import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/src/events.ts';
import type {
    GameSettings,
    GameState,
    MoveRequest,
    MoveResult,
    ServerError,
    SessionResult
} from '../../../shared/src/types.ts';

const CLIENT_ID_KEY = 'sy-client-id';
const GAME_CODE_KEY = 'sy-game-code';

export interface NetworkCallbacks {
    onState: (state: GameState) => void;
    onSession: (ownerId: string, lobbyCode: string) => void;
    onError: (error: ServerError) => void;
    onConnect: (id: string) => void;
    onDisconnect: () => void;
    onReconnectStart: () => void;
    onReconnectEnd: (ok: boolean, message?: string) => void;
    onSessionReplaced: () => void;
}

function readStorage(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(key: string, value: string | null): void {
    try {
        if (value === null) {
            window.localStorage.removeItem(key);
        } else {
            window.localStorage.setItem(key, value);
        }
    } catch {
        // Private browsing or storage disabled: reconnection is unavailable.
    }
}

function createClientId(): string {
    const random =
        globalThis.crypto?.randomUUID?.() ??
        `c_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    return random;
}

export class Network {
    private readonly socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    private readonly clientId: string;

    private reconnecting = false;
    private sessionPending = false;
    private sessionReplaced = false;

    constructor(private readonly callbacks: NetworkCallbacks) {
        const storedClientId = readStorage(CLIENT_ID_KEY);
        this.clientId = storedClientId ?? createClientId();
        if (!storedClientId) writeStorage(CLIENT_ID_KEY, this.clientId);

        this.socket = io();

        this.socket.on('connect', () => {
            callbacks.onConnect(this.socket.id ?? '');
            if (this.sessionReplaced || this.sessionPending) return;

            const savedCode = this.savedGameCode;
            if (savedCode) {
                this.reconnect(savedCode);
            } else {
                callbacks.onReconnectEnd(true);
            }
        });

        this.socket.on('disconnect', () => {
            this.sessionPending = false;
            if (!this.sessionReplaced) callbacks.onDisconnect();
        });

        this.socket.on('connect_error', () => {
            if (!this.sessionReplaced) callbacks.onDisconnect();
        });

        this.socket.on('game_update', callbacks.onState);
        this.socket.on('server_error', callbacks.onError);

        this.socket.on('session_replaced', () => {
            this.sessionReplaced = true;
            callbacks.onSessionReplaced();
        });
    }

    getID(): string {
        return this.socket.id ?? '';
    }

    get savedGameCode(): string | null {
        return readStorage(GAME_CODE_KEY);
    }

    createGame(): void {
        if (this.reconnecting || this.sessionPending) return;
        this.sessionPending = true;
        this.socket.emit('create_game', this.clientId, result =>
            this.handleResult(result, false)
        );
    }

    joinGame(code: string): void {
        if (this.reconnecting || this.sessionPending) return;
        this.sessionPending = true;
        this.socket.emit('join_game', code, this.clientId, result =>
            this.handleResult(result, false)
        );
    }

    leaveGame(): void {
        this.socket.emit('leave_game');
        this.clearSavedGame();
        this.reconnecting = false;
        this.sessionReplaced = false;
    }

    addDetective(): void {
        this.socket.emit('add_detective');
    }

    removeDetective(): void {
        this.socket.emit('remove_detective');
    }

    sendMove(move: MoveRequest, ack: (result: MoveResult) => void): void {
        this.socket.emit('player_move', move, ack);
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

    private reconnect(lobbyCode: string): void {
        this.reconnecting = true;
        this.callbacks.onReconnectStart();

        this.socket.emit('reconnect_game', lobbyCode, this.clientId, result =>
            this.handleResult(result, true)
        );
    }

    private handleResult(result: SessionResult, fromReconnect: boolean): void {
        this.reconnecting = false;
        this.sessionPending = false;

        if (result.ok) {
            this.saveGameCode(result.lobbyCode);
            this.callbacks.onSession(result.ownerId, result.lobbyCode);
            this.callbacks.onState(result.gameState);
            this.callbacks.onReconnectEnd(true);
            return;
        }

        if (fromReconnect && result.code !== 'RATE_LIMITED') this.clearSavedGame();
        this.callbacks.onError({ code: result.code, message: result.message });
        this.callbacks.onReconnectEnd(false, result.message);
    }

    private saveGameCode(lobbyCode: string): void {
        writeStorage(GAME_CODE_KEY, lobbyCode);
    }

    private clearSavedGame(): void {
        writeStorage(GAME_CODE_KEY, null);
    }
}
