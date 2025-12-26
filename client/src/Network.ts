import { io, Socket } from 'socket.io-client';
import { GameState } from '../../shared/types';

export class Network {
    private socket: Socket;
    private onStateChange: (state: GameState) => void;
    private onGameOver: (data: any) => void;

    constructor(
        onStateChange: (state: GameState) => void,
        onGameOver: (data: any) => void
    ) {
        this.onStateChange = onStateChange;
        this.onGameOver = onGameOver;
        this.socket = io('http://localhost:3000');

        this.socket.on('connect', () => {
            console.log('Connected to server with ID:', this.socket.id);
        });

        this.socket.on('game_created', (data: { lobbyCode: string, gameState: GameState }) => {
            console.log('Game Created:', data.lobbyCode);
            this.onStateChange(data as any);
        });

        this.socket.on('game_update', (state: GameState) => {
            console.log('Game Updated:', state);
            this.onStateChange(state);
        });

        this.socket.on('game_over', (data: any) => {
            console.log("Game Over received:", data);
            this.onGameOver(data);
        });
    }

    public createGame() {
        this.socket.emit('create_game');
    }

    public joinGame(code: string) {
        this.socket.emit('join_game', code);
    }

    public sendMove(toNode: number, transport: string, useBlackTicket: boolean = false) {
        console.log(`Sending move: Node ${toNode} via ${transport} (Black: ${useBlackTicket})`);
        this.socket.emit('player_move', { toNode, transport, useBlackTicket });
    }

    public getID(): string {
        return this.socket.id || "";
    }

    public toggleReady() {
        this.socket.emit('toggle_ready');
    }

    public updateSettings(settings: any) {
        this.socket.emit('update_settings', settings);
    }

    public startGame() {
        this.socket.emit('start_game');
    }

    public claimMrX() {
        this.socket.emit('claim_mr_x');
    }
}