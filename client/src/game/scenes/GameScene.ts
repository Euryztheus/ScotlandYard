import Phaser from 'phaser';
import { getEdges } from '../../../../shared/src/map.ts';
import type { GameNode, GameState, MoveRequest, Player } from '../../../../shared/src/types.ts';
import { CameraController } from '../CameraController.ts';
import { findLastKnownPosition } from '../history.ts';
import { MapRenderer } from '../MapRenderer.ts';
import { TokenManager } from '../TokenManager.ts';
import { TransportMenu } from '../TransportMenu.ts';

export const MOVE_INTENT_EVENT = 'move-intent';
export const SCENE_READY_EVENT = 'scene-ready';

export class GameScene extends Phaser.Scene {
    private mapRenderer!: MapRenderer;
    private cameraController!: CameraController;
    private tokenManager!: TokenManager;
    private transportMenu!: TransportMenu;

    private currentPlayers: Player[] = [];
    private myId = '';
    private lastState: GameState | null = null;
    private globalVisibility = true;

    constructor() {
        super('GameScene');
    }

    preload(): void {
        this.load.image('map-bg', '/map.jpeg');
    }

    create(): void {
        this.mapRenderer = new MapRenderer(this);
        this.cameraController = new CameraController(this);
        this.tokenManager = new TokenManager(this);
        this.transportMenu = new TransportMenu(this);

        this.mapRenderer.render(node => this.handleNodeClick(node));

        if (this.lastState) {
            this.applyState(this.lastState);
        }

        this.game.events.emit(SCENE_READY_EVENT);
    }

    setMyId(id: string): void {
        this.myId = id;
    }

    setPlayersVisible(visible: boolean): void {
        this.globalVisibility = visible;
        if (this.lastState && this.tokenManager) {
            this.applyState(this.lastState);
        }
    }

    updateGameState(state: GameState): void {
        this.lastState = state;
        this.currentPlayers = state.players;
        if (this.tokenManager) {
            this.applyState(state);
        }
    }

    focusOnPlayer(playerId: string): void {
        const player = this.currentPlayers.find(candidate => candidate.id === playerId);
        if (!player || !this.cameraController) return;

        let targetId = player.position;

        if (player.role === 'MR_X' && targetId === 0 && this.lastState) {
            targetId = findLastKnownPosition(this.lastState.moveHistory);
        }

        if (targetId <= 0) return;
        this.cameraController.focusOnNode(targetId);
    }

    private applyState(state: GameState): void {
        this.tokenManager.update(state.players, this.globalVisibility, state.moveHistory);
    }

    private handleNodeClick(targetNode: GameNode): void {
        this.transportMenu.destroy();

        if (!this.myId) return;

        const me = this.currentPlayers.find(player => player.id === this.myId);
        if (!me) return;

        const validEdges = getEdges(me.position).filter(edge => edge.to === targetNode.id);
        if (validEdges.length === 0) return;

        this.transportMenu.show(targetNode, validEdges, me, (move: MoveRequest) => {
            this.game.events.emit(MOVE_INTENT_EVENT, move);
        });
    }
}
