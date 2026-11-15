import { DEFAULT_SETTINGS } from '../../../shared/src/constants.ts';
import { MAP_NODE_IDS } from '../../../shared/src/map.ts';
import type { GameSettings, GameState, Player, TicketType } from '../../../shared/src/types.ts';

export function emptyTickets(): Record<TicketType, number> {
    return { taxi: 0, bus: 0, underground: 0, black: 0 };
}

export function createGame(lobbyCode: string): GameState {
    return {
        lobbyCode,
        phase: 'LOBBY',
        players: [],
        turn: '',
        round: 0,
        settings: structuredClone(DEFAULT_SETTINGS),
        moveHistory: [],
        pendingDoubleMove: false
    };
}

export function addPlayer(game: GameState, socketId: string): Player {
    const isHost = game.players.length === 0;
    const role = isHost ? 'MR_X' : 'DETECTIVE';

    const takenPositions = new Set(game.players.map(player => player.position));
    const availablePositions = MAP_NODE_IDS.filter(nodeId => !takenPositions.has(nodeId));

    let startPosition = role === 'MR_X' ? 1 : 13;
    if (availablePositions.length > 0) {
        const randomIndex = Math.floor(Math.random() * availablePositions.length);
        startPosition = availablePositions[randomIndex];
    }

    const player: Player = {
        id: socketId,
        role,
        position: startPosition,
        tickets: { ...DEFAULT_SETTINGS.detectiveStartTickets },
        doubleTickets: 0,
        isReady: false,
        isHost
    };

    game.players.push(player);
    return player;
}

export function claimMrX(game: GameState, socketId: string): boolean {
    if (game.phase !== 'LOBBY') return false;

    const requester = game.players.find(player => player.id === socketId);
    const currentMrX = game.players.find(player => player.role === 'MR_X');
    if (!requester || !currentMrX || requester.id === currentMrX.id) return false;

    currentMrX.role = 'DETECTIVE';
    currentMrX.position = 13;
    requester.role = 'MR_X';
    requester.position = 1;

    game.players.forEach(player => {
        player.isReady = false;
    });

    return true;
}

export function startGame(game: GameState, socketId: string): boolean {
    const host = game.players.find(player => player.id === socketId);
    if (game.phase !== 'LOBBY' || !host?.isHost) return false;
    if (!game.players.every(player => player.isReady)) return false;

    const mrX = game.players.find(player => player.role === 'MR_X');
    game.phase = 'PLAYING';
    game.round = 1;
    game.turn = mrX?.id ?? game.players[0]?.id ?? '';
    game.pendingDoubleMove = false;

    game.players.forEach(player => {
        player.tickets = game.settings.infiniteTickets
            ? { taxi: 999, bus: 999, underground: 999, black: 999 }
            : player.role === 'MR_X'
                ? { ...game.settings.mrXStartTickets }
                : { ...game.settings.detectiveStartTickets };
        player.doubleTickets = player.role === 'MR_X' ? game.settings.mrXDoubleTickets : 0;
    });

    return true;
}

export function applySettings(game: GameState, settings: Partial<GameSettings>): void {
    game.settings = { ...game.settings, ...settings };
}
