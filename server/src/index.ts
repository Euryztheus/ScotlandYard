import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { GameState, GameSettings, Player } from '../../shared/types.ts';
import { DEFAULT_SETTINGS } from '../../shared/constants.ts';
import mapData from '../../shared/mapData.json' assert { type: "json" };

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const games = new Map<string, GameState>();

// --- HELPER: Broadcast State with Privacy (Hides Mr. X) ---
function broadcastGameUpdate(gameCode: string) {
    const game = games.get(gameCode);
    if (!game) return;

    // We must send a customized state to each player
    game.players.forEach(p => {
        // Create a deep copy to modify safely
        const stateToSend = JSON.parse(JSON.stringify(game));

        // If the recipient is a DETECTIVE, hide Mr. X's position
        if (p.role === 'DETECTIVE') {
            stateToSend.players.forEach((target: Player) => {
                if (target.role === 'MR_X') {
                    // Set to 0 (which doesn't exist on map) to indicate "Hidden"
                    // TODO: Add logic here for Reveal Rounds (3, 8, 13, etc.) later
                    target.position = 0; 
                }
            });
        }

        io.to(p.id).emit('game_update', stateToSend);
    });
}

function findGame(socketId: string) {
    for (const [code, game] of games.entries()) {
        if (game.players.some(p => p.id === socketId)) {
            return { game, gameCode: code };
        }
    }
    return { game: undefined, gameCode: undefined };
}

io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);

  // CREATE GAME
  socket.on('create_game', () => {
    const lobbyCode = generateLobbyCode();
    console.log(`[SERVER] Game Created. Code: ${lobbyCode}`);

    const newGame: GameState = {
      lobbyCode,
      phase: 'LOBBY',
      players: [],
      turn: '', 
      round: 0,
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    };

    games.set(lobbyCode, newGame);
    socket.join(lobbyCode);
    addPlayerToGame(newGame, socket.id);

    // Initial Broadcast
    socket.emit('game_created', { lobbyCode, gameState: newGame });
  });

  // JOIN GAME
  socket.on('join_game', (code: string) => {
    const game = games.get(code);
    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }
    
    socket.join(code);
    addPlayerToGame(game, socket.id);
    console.log(`[SERVER] Player Joined ${code}`);
    
    broadcastGameUpdate(code); // <--- Uses new helper
  });

  // HANDLE MOVE
  socket.on('player_move', (data: { toNode: number, transport: string }) => {
    const { game, gameCode } = findGame(socket.id);
    if (!game || !gameCode) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    if (game.turn !== socket.id) return; // Turn Check

    // Validate Move (Map Connection)
    const currentNode = (mapData.nodes as any)[player.position];
    const validEdge = currentNode.edges.find((e: any) => 
        e.to === data.toNode && e.type === data.transport
    );

    if (!validEdge) {
        console.log(`[INVALID MOVE] ${player.role} tried invalid move.`);
        return; 
    }

    // Validate Tickets
    const transportType = data.transport as keyof typeof player.tickets;
    if (player.tickets[transportType] <= 0) return;

    // --- EXECUTE MOVE ---
    console.log(`[MOVE] ${player.role} to ${data.toNode} via ${data.transport}`);
    
    // 1. Deduct Ticket
    player.tickets[transportType]--;

    // 2. Transfer Ticket (Detective -> Mr. X)
    if (player.role === 'DETECTIVE') {
        const mrX = game.players.find(p => p.role === 'MR_X');
        if (mrX) {
            mrX.tickets[transportType]++;
            console.log(`[TICKET TRANSFER] Gave 1 ${transportType} ticket to Mr. X`);
        }
    }

    // 3. Update Position
    player.position = data.toNode;

    // 4. Rotate Turn
    const currentPlayerIndex = game.players.findIndex(p => p.id === socket.id);
    let nextPlayerIndex = (currentPlayerIndex + 1) % game.players.length;
    game.turn = game.players[nextPlayerIndex].id;

    if (nextPlayerIndex === 0) {
      game.round++;
      console.log(`[NEW ROUND] Starting Round ${game.round}`);
    }

    broadcastGameUpdate(gameCode); // <--- Uses new helper
  });

  // LOBBY ACTIONS
  socket.on('toggle_ready', () => {
    const { game, gameCode } = findGame(socket.id);
    if (game && gameCode) {
        const p = game.players.find(pl => pl.id === socket.id);
        if (p) {
            p.isReady = !p.isReady;
            broadcastGameUpdate(gameCode);
        }
    }
  });

  socket.on('claim_mr_x', () => {
    const { game, gameCode } = findGame(socket.id);
    if (!game || !gameCode || game.phase !== 'LOBBY') return;

    const requester = game.players.find(p => p.id === socket.id);
    const currentMrX = game.players.find(p => p.role === 'MR_X');

    if (requester && currentMrX && requester.id !== currentMrX.id) {
        currentMrX.role = 'DETECTIVE';
        currentMrX.position = 13; 
        requester.role = 'MR_X';
        requester.position = 1; 
        game.players.forEach(p => p.isReady = false);
        broadcastGameUpdate(gameCode);
    }
  });

  socket.on('update_settings', (newSettings: Partial<GameSettings>) => {
    const { game, gameCode } = findGame(socket.id);
    if (game && gameCode) {
        const p = game.players.find(pl => pl.id === socket.id);
        if (p?.isHost) {
            game.settings = { ...game.settings, ...newSettings };
            broadcastGameUpdate(gameCode);
        }
    }
  });

  socket.on('start_game', () => {
    const { game, gameCode } = findGame(socket.id);
    if (game && gameCode) {
        const p = game.players.find(pl => pl.id === socket.id);
        if (p?.isHost && game.players.every(pl => pl.isReady)) {
            game.phase = 'PLAYING';
            game.round = 1;
            game.turn = game.players[0].id; // Mr X starts
            
            // Distribute Tickets
            game.players.forEach(player => {
                if (game.settings.infiniteTickets) {
                    player.tickets = { taxi: 999, bus: 999, underground: 999, water: 999 };
                } else {
                    player.tickets = player.role === 'MR_X' 
                        ? { ...game.settings.mrXStartTickets }
                        : { ...game.settings.detectiveStartTickets };
                }
            });

            broadcastGameUpdate(gameCode);
        }
    }
  });
});

function generateLobbyCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function addPlayerToGame(game: GameState, id: string): Player {
  const isHost = game.players.length === 0;
  const role = isHost ? 'MR_X' : 'DETECTIVE';
  
  const player: Player = {
    id,
    role,
    position: role === 'MR_X' ? 1 : 13, 
    tickets: { ...DEFAULT_SETTINGS.detectiveStartTickets },
    isReady: false,
    isHost
  };
  
  game.players.push(player);
  return player;
}

httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});