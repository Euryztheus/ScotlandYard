import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { GameState, GameSettings, Player, Transport} from '../../shared/types.ts';
import { DEFAULT_SETTINGS, REVEAL_ROUNDS } from '../../shared/constants.ts'; 
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

function hasValidMoves(player: Player): boolean {
  const node = (mapData.nodes as any)[player.position];
  if (!node) return false;

  // Check if ANY edge is traversable with current tickets
  return node.edges.some((edge: any) => {
      const costType = edge.type as Transport;
      const hasTicket = player.tickets[costType] > 0;
      
      // Mr. X can also use Black tickets on ANY edge
      if (player.role === 'MR_X') {
          return hasTicket || player.tickets.black > 0;
      }
      return hasTicket;
  });
}

function checkWinCondition(game: GameState): { gameOver: boolean, winner?: string, reason?: string } {
  const mrX = game.players.find(p => p.role === 'MR_X');
  const detectives = game.players.filter(p => p.role === 'DETECTIVE');

  if (!mrX) return { gameOver: false };

  // 1. Detectives Caught Mr. X (Same Position)
  if (detectives.some(d => d.position === mrX.position)) {
      return { gameOver: true, winner: 'DETECTIVES', reason: 'Mr. X was caught!' };
  }

  // 2. Max Rounds Reached (Mr. X Wins)
  if (game.round > 24) {
      return { gameOver: true, winner: 'MR_X', reason: 'Time ran out (24 Rounds)' };
  }

  // 3. Mr. X Stuck / No Tickets
  if (game.turn === mrX.id && !hasValidMoves(mrX)) {
      return { gameOver: true, winner: 'DETECTIVES', reason: 'Mr. X has no valid moves!' };
  }

  // 4. All Detectives Stuck (Mr. X Wins)
  const activeDetectives = detectives.filter(d => hasValidMoves(d));
  if (activeDetectives.length === 0 && detectives.length > 0) {
      return { gameOver: true, winner: 'MR_X', reason: 'All Detectives are stuck!' };
  }

  return { gameOver: false };
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
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      moveHistory: []
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
  socket.on('player_move', (data: { toNode: number, transport: Transport, useBlackTicket: boolean }) => {
    const { game, gameCode } = findGame(socket.id);
    if (!game || !gameCode) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player || game.turn !== socket.id) return;

    const currentNode = (mapData.nodes as any)[player.position];
    
    // 1. Find the Map Connection (The physical path)
    // Note: The map edge will be 'taxi', 'bus', 'underground', or 'water'
    const validEdge = currentNode.edges.find((e: any) => 
        e.to === data.toNode && e.type === data.transport
    );

    if (!validEdge) return; // Invalid path

    // 2. Determine Ticket Cost
    // If it's a WATER edge, player MUST use Black Ticket (and must be Mr X)
    // If player explicitly requests Black Ticket, use that.
    let ticketCostType: Transport = data.transport;
    
    if (data.useBlackTicket) {
        if (player.role !== 'MR_X') return; // Detectives can't use black/water
        ticketCostType = 'black';
    }

    // 3. Validate Ticket Balance
    if (player.tickets[ticketCostType] <= 0) return;

    // 4. EXECUTE MOVE
    player.tickets[ticketCostType]--;
    
    // Transfer Ticket (Detective -> Mr. X)
    // Note: Detectives never use Black tickets, so they always give valid transport tickets
    if (player.role === 'DETECTIVE') {
        const mrX = game.players.find(p => p.role === 'MR_X');
        if (mrX) mrX.tickets[ticketCostType]++;
    }

    player.position = data.toNode;

    // 5. UPDATE HISTORY (Only for Mr. X moves)
    if (player.role === 'MR_X') {
        const isRevealRound = REVEAL_ROUNDS.includes(game.round);
        game.moveHistory.push({
            round: game.round,
            transport: ticketCostType, // Shows 'black' if black ticket used
            position: isRevealRound ? player.position : undefined,
            isHidden: !isRevealRound
        });
    }

    // --- NEW: CHECK WIN CONDITION (Immediate Catch) ---
    let winCheck = checkWinCondition(game);
    if (winCheck.gameOver) {
        game.phase = 'FINISHED';
        console.log(`[GAME OVER] Winner: ${winCheck.winner}`);
        io.to(gameCode).emit('game_over', winCheck); 
        return; 
    }

    // --- NEW: ROTATE TURN (With Skip Logic) ---
    let nextPlayerIndex = (game.players.findIndex(p => p.id === socket.id) + 1) % game.players.length;
    let nextPlayer = game.players[nextPlayerIndex];
    
    // Auto-skip detectives who have no tickets/moves
    let attempts = 0;
    while (nextPlayer.role === 'DETECTIVE' && !hasValidMoves(nextPlayer) && attempts < game.players.length) {
        console.log(`[SKIP] ${nextPlayer.role} has no moves.`);
        nextPlayerIndex = (nextPlayerIndex + 1) % game.players.length;
        nextPlayer = game.players[nextPlayerIndex];
        attempts++;
    }

    game.turn = nextPlayer.id;

    if (nextPlayerIndex === 0) {
      game.round++;
      console.log(`[NEW ROUND] Starting Round ${game.round}`);
    }

    // --- NEW: CHECK WIN CONDITION AGAIN (In case all detectives were skipped) ---
    winCheck = checkWinCondition(game);
    if (winCheck.gameOver) {
        game.phase = 'FINISHED';
        io.to(gameCode).emit('game_over', winCheck);
    } else {
        broadcastGameUpdate(gameCode);
    }
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
                    player.tickets = { taxi: 999, bus: 999, underground: 999, black: 999 };
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

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const { game, gameCode } = findGame(socket.id);
    if (game && gameCode) {
        // Remove player
        game.players = game.players.filter(p => p.id !== socket.id);
        
        // If empty, delete game
        if (game.players.length === 0) {
            console.log(`[CLEANUP] Deleting empty lobby ${gameCode}`);
            games.delete(gameCode);
        } else {
            // Notify others
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
  
  // --- RANDOM START LOGIC ---
  // Get all valid node IDs from the map data
  const allNodeIds = Object.keys(mapData.nodes).map(Number);
  
  // Get positions currently taken by other players in this game
  const takenPositions = game.players.map(p => p.position);
  
  // Filter out taken spots to ensure unique spawns
  const availablePositions = allNodeIds.filter(id => !takenPositions.includes(id));
  
  // Pick a random spot
  // Fallback to 1 or 13 if map is somehow full (unlikely)
  let startPos = role === 'MR_X' ? 1 : 13; 
  if (availablePositions.length > 0) {
      const randomIndex = Math.floor(Math.random() * availablePositions.length);
      startPos = availablePositions[randomIndex];
  }

  console.log(`[SERVER] Adding ${role} (${id}) at Random Node ${startPos}`);

  const player: Player = {
    id,
    role,
    position: startPos, 
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