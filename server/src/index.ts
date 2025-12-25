import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { GameState, Player } from '../../shared/types.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" } // Allow Vite client to connect
});

// Store all active games: Map<LobbyCode, GameState>
const games = new Map<string, GameState>();

io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);

  // CREATE GAME
  socket.on('create_game', () => {
    const lobbyCode = generateLobbyCode();
    console.log(`[SERVER] Game Created. Code: ${lobbyCode} | Creator: ${socket.id}`); // <--- ADDED LOG
    
    const newGame: GameState = {
      players: [],
      turn: '', 
      round: 0
    };
    
    games.set(lobbyCode, newGame);
    socket.join(lobbyCode);
    
    // Mr. X (Player 1) starts at Node 1 (Taxi/Bus/Underground)
    const player = addPlayerToGame(newGame, socket.id);
    
    socket.emit('game_created', { lobbyCode, gameState: newGame });
  });

  // JOIN GAME
  socket.on('join_game', (code: string) => {
    console.log(`[SERVER] Join Request for Code: ${code} from ${socket.id}`); // <--- ADDED LOG
    
    const game = games.get(code);
    if (!game) {
      console.log(`[SERVER] Failed Join: Game ${code} not found.`); // <--- ADDED LOG
      socket.emit('error', 'Game not found');
      return;
    }
    
    socket.join(code);
    // Detective (Player 2) starts at Node 13 (Taxi/Bus/Underground)
    const player = addPlayerToGame(game, socket.id);
    
    console.log(`[SERVER] Player Joined. Total Players: ${game.players.length}`); // <--- ADDED LOG
    
    // IMPORTANT: Emit to everyone in the room
    io.to(code).emit('game_update', game);
  });
  socket.on('player_move', (data: { toNode: number, transport: string }) => {
    console.log(`[SERVER] Move Request from ${socket.id}:`, data);

    // 1. Find the game
    let game: GameState | undefined;
    let gameCode: string | undefined;

    // Search all active games to find which one contains this player
    for (const [code, g] of games.entries()) {
      if (g.players.some(p => p.id === socket.id)) {
        game = g;
        gameCode = code;
        break;
      }
    }

    if (!game || !gameCode) {
      console.error(`[SERVER] ERROR: Player ${socket.id} is not in any active game!`);
      return;
    }

    // 2. Find the player
    const player = game.players.find(p => p.id === socket.id);
    
    if (!player) {
      console.error(`[SERVER] ERROR: Game found (${gameCode}) but player not in list?`);
      return;
    }

    // 3. Execute Move (No validation yet, just teleport)
    console.log(`[SERVER] Moving ${player.role} from ${player.position} to ${data.toNode}`);
    player.position = data.toNode;

    // 4. Broadcast Update
    io.to(gameCode).emit('game_update', game);
    console.log(`[SERVER] Broadcasted update to room ${gameCode}`);
  });
});

function generateLobbyCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function addPlayerToGame(game: GameState, id: string): Player {
  const role = game.players.length === 0 ? 'MR_X' : 'DETECTIVE';
  const player: Player = {
    id,
    role,
    position: role === 'MR_X' ? 1 : 13, // Placeholder start positions
    tickets: { taxi: 10, bus: 8, underground: 4, water: 0 }
  };
  game.players.push(player);
  return player;
}

httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});