import type { GameState } from '../../../shared/src/types.ts';
import { projectStateFor } from '../game/view.ts';
import type { GameServer } from './types.ts';

export function broadcastGameUpdate(io: GameServer, game: GameState): void {
    game.players.forEach(player => {
        io.to(player.id).emit('game_update', projectStateFor(game, player.id));
    });
}
