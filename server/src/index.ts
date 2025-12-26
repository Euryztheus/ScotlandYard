import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { GameState, Player } from '../../shared/types.js';
import mapData from '../../shared/mapData.json' assert { type: "json" };

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
      turn: socket.id,
      round: 1
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
  // HANDLE MOVE
  socket.on('player_move', (data: { toNode: number, transport: string }) => {
    // 1. Find Game & Player
    let game: GameState | undefined;
    let gameCode: string | undefined;

    for (const [code, g] of games.entries()) {
      if (g.players.some(p => p.id === socket.id)) {
        game = g;
        gameCode = code;
        break;
      }
    }

    if (!game || !gameCode) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    // 2. TURN CHECK (Is it this player's turn?)
    if (game.turn !== socket.id) {
      console.log(`[NOT YOUR TURN] ${socket.id} tried to move, but it is ${game.turn}'s turn.`);
      return;
    }

    // 3. VALIDATE CONNECTION
    // Get the node the player is currently at
    const currentNode = (mapData.nodes as any)[player.position];

    // Find if an edge exists to the target with the requested transport
    const validEdge = currentNode.edges.find((e: any) =>
      e.to === data.toNode && e.type === data.transport
    );

    if (!validEdge) {
      console.log(`[CHEATING ATTEMPT] ${player.role} tried to move ${player.position} -> ${data.toNode} via ${data.transport} but no edge exists.`);
      return; // Ignore the request
    }

    // 4. VALIDATE TICKETS
    // Check if player has tickets (Mr. X has infinite/special logic later, but for now standard check)
    // Cast strict keys to avoid TypeScript errors
    const transportType = data.transport as keyof typeof player.tickets;

    if (player.tickets[transportType] <= 0) {
      console.log(`[NO TICKETS] ${player.role} has no ${transportType} tickets left.`);
      return;
    }

    // 5. EXECUTE MOVE
    console.log(`[VALID MOVE] ${player.role} moved to ${data.toNode} via ${data.transport}`);

    // Deduct ticket
    player.tickets[transportType]--;

    // Update position
    player.position = data.toNode;

    // 6. TOGGLE TURN (Simple Round-Robin for now)
    const currentPlayerIndex = game.players.findIndex(p => p.id === socket.id);
    let nextPlayerIndex = (currentPlayerIndex + 1) % game.players.length;

    // Update Turn ID
    game.turn = game.players[nextPlayerIndex].id;

    // If we wrapped back to Player 0 (Mr. X), increment the round
    if (nextPlayerIndex === 0) {
      game.round++;
      console.log(`[NEW ROUND] Starting Round ${game.round}`);
    }

    io.to(gameCode).emit('game_update', game);
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