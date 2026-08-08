import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { GameState, GameSettings, Player, Transport} from '../../shared/types.js';
import { DEFAULT_SETTINGS, REVEAL_ROUNDS } from '../../shared/constants.js';
import mapData from '../../shared/mapData.json' with { type: "json" };

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const games = new Map<string, GameState>();

function broadcastGameUpdate(gameCode: string) {
    const game = games.get(gameCode);
    if (!game) return;

    game.players.forEach(p => {
        const stateToSend = JSON.parse(JSON.stringify(game));
        if (p.role === 'DETECTIVE') {
            stateToSend.players.forEach((target: Player) => {
                if (target.role === 'MR_X') {
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
  return node.edges.some((edge: any) => {
      const costType = edge.type as Transport;
      const hasTicket = player.tickets[costType] > 0;
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

  if (detectives.some(d => d.position === mrX.position)) {
      return { gameOver: true, winner: 'DETECTIVES', reason: 'Mr. X was caught!' };
  }
  if (game.round > 24) {
      return { gameOver: true, winner: 'MR_X', reason: 'Time ran out (24 Rounds)' };
  }
  if (game.turn === mrX.id && !hasValidMoves(mrX)) {
      return { gameOver: true, winner: 'DETECTIVES', reason: 'Mr. X has no valid moves!' };
  }
  const activeDetectives = detectives.filter(d => hasValidMoves(d));
  if (activeDetectives.length === 0 && detectives.length > 0) {
      return { gameOver: true, winner: 'MR_X', reason: 'All Detectives are stuck!' };
  }

  return { gameOver: false };
}

io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);

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
      moveHistory: [],
      pendingDoubleMove: false
    };

    games.set(lobbyCode, newGame);
    socket.join(lobbyCode);
    addPlayerToGame(newGame, socket.id);
    socket.emit('game_created', { lobbyCode, gameState: newGame });
  });

  socket.on('join_game', (code: string) => {
    const game = games.get(code);
    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }
    socket.join(code);
    addPlayerToGame(game, socket.id);
    broadcastGameUpdate(code);
  });

  // --- MODIFIED MOVE HANDLER ---
  socket.on('player_move', (data: { toNode: number, transport: Transport, useBlackTicket: boolean, useDoubleTicket?: boolean }) => {
    const { game, gameCode } = findGame(socket.id);
    if (!game || !gameCode) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player || game.turn !== socket.id) return;

    // 1. Double Ticket Validation
    if (data.useDoubleTicket) {
        if (player.role !== 'MR_X' || player.doubleTickets <= 0) return;
        // Cannot use double ticket if already in the middle of one
        if (game.pendingDoubleMove) return; 
    }

    const currentNode = (mapData.nodes as any)[player.position];
    const validEdge = currentNode.edges.find((e: any) => 
        e.to === data.toNode && e.type === data.transport
    );
    if (!validEdge) return; 

    let ticketCostType: Transport = data.transport;
    if (data.useBlackTicket) {
        if (player.role !== 'MR_X') return;
        ticketCostType = 'black';
    }

    // Check Balance
    if (player.tickets[ticketCostType] <= 0) return;

    // --- EXECUTE MOVE ---
    player.tickets[ticketCostType]--;
    if (player.role === 'DETECTIVE') {
        const mrX = game.players.find(p => p.role === 'MR_X');
        if (mrX) mrX.tickets[ticketCostType]++;
    }
    player.position = data.toNode;

    // Deduct Double Ticket if used
    if (data.useDoubleTicket && player.role === 'MR_X') {
        player.doubleTickets--;
    }

    // --- HISTORY & ROUNDS ---
    if (player.role === 'MR_X') {
        // Mr. X moves increment the round counter immediately
        // (Move 1 fills Round N, Move 2 fills Round N+1)
        if (game.round === 0) game.round = 1; // Start game fix

        const isRevealRound = REVEAL_ROUNDS.includes(game.round);
        game.moveHistory.push({
            round: game.round,
            transport: ticketCostType,
            position: isRevealRound ? player.position : undefined,
            isHidden: !isRevealRound,
            isDoubleMove: data.useDoubleTicket
        });

        // Always increment round after Mr X moves
        game.round++; 
    }

    // --- WIN CHECK ---
    let winCheck = checkWinCondition(game);
    if (winCheck.gameOver) {
        game.phase = 'FINISHED';
        io.to(gameCode).emit('game_over', winCheck); 
        return; 
    }

    // --- TURN ROTATION LOGIC ---
    // Case 1: Mr X used 2x (First Leg)
    if (data.useDoubleTicket && player.role === 'MR_X') {
        game.pendingDoubleMove = true;
        // Do NOT rotate turn. Mr X plays again.
        broadcastGameUpdate(gameCode);
        return;
    }

    // Case 2: Mr X finishing 2x (Second Leg)
    if (game.pendingDoubleMove && player.role === 'MR_X') {
        game.pendingDoubleMove = false;
        // Now rotate turn to detectives
    }

    // Normal Rotation
    let nextPlayerIndex = (game.players.findIndex(p => p.id === socket.id) + 1) % game.players.length;
    let nextPlayer = game.players[nextPlayerIndex];
    
    // Auto-skip stuck detectives
    let attempts = 0;
    while (nextPlayer.role === 'DETECTIVE' && !hasValidMoves(nextPlayer) && attempts < game.players.length) {
        nextPlayerIndex = (nextPlayerIndex + 1) % game.players.length;
        nextPlayer = game.players[nextPlayerIndex];
        attempts++;
    }
    game.turn = nextPlayer.id;

    // --- FINAL WIN CHECK & BROADCAST ---
    winCheck = checkWinCondition(game);
    if (winCheck.gameOver) {
        game.phase = 'FINISHED';
        io.to(gameCode).emit('game_over', winCheck);
    } else {
        broadcastGameUpdate(gameCode);
    }
  });

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
            game.turn = game.players[0].id; 
            
            game.players.forEach(player => {
                if (game.settings.infiniteTickets) {
                    player.tickets = { taxi: 999, bus: 999, underground: 999, black: 999 };
                } else {
                    player.tickets = player.role === 'MR_X' 
                        ? { ...game.settings.mrXStartTickets }
                        : { ...game.settings.detectiveStartTickets };
                }
                // Double tickets are independent of infinite setting
                player.doubleTickets = player.role === 'MR_X' ? game.settings.mrXDoubleTickets : 0;
            });
            broadcastGameUpdate(gameCode);
        }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const { game, gameCode } = findGame(socket.id);
    if (game && gameCode) {
        game.players = game.players.filter(p => p.id !== socket.id);
        if (game.players.length === 0) {
            games.delete(gameCode);
        } else {
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
  
  const allNodeIds = Object.keys(mapData.nodes).map(Number);
  const takenPositions = game.players.map(p => p.position);
  const availablePositions = allNodeIds.filter(id => !takenPositions.includes(id));
  
  let startPos = role === 'MR_X' ? 1 : 13; 
  if (availablePositions.length > 0) {
      const randomIndex = Math.floor(Math.random() * availablePositions.length);
      startPos = availablePositions[randomIndex];
  }

  const player: Player = {
    id,
    role,
    position: startPos, 
    tickets: { ...DEFAULT_SETTINGS.detectiveStartTickets },
    doubleTickets: 0, 
    isReady: false,
    isHost
  };
  game.players.push(player);
  return player;
}

httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});