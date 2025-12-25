import { io, Socket } from 'socket.io-client';
import { GameState } from '../../shared/types';

export class Network {
    private socket: Socket;
    private onStateChange: (state: GameState) => void;

    constructor(onStateChange: (state: GameState) => void) {
        this.onStateChange = onStateChange;
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
    }

    public createGame() {
        this.socket.emit('create_game');
    }

    public joinGame(code: string) {
        this.socket.emit('join_game', code);
    }

    // This was missing
    public sendMove(toNode: number, transport: string) {
        console.log(`Sending move: Node ${toNode} via ${transport}`);
        this.socket.emit('player_move', { toNode, transport });
    }
}