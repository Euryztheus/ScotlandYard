import Phaser from 'phaser';
import { getEdges, isNodeBlocked } from '../../../../shared/src/map.ts';
import type { GameNode, GameState, Player } from '../../../../shared/src/types.ts';
import { CameraController } from '../CameraController.ts';
import { findLastKnownPosition } from '../history.ts';
import type { TransportRequest } from '../transport.ts';
import { MapRenderer } from '../MapRenderer.ts';
import { TokenManager } from '../TokenManager.ts';

export const TRANSPORT_REQUEST_EVENT = 'transport-request';
export const SCENE_READY_EVENT = 'scene-ready';

export class GameScene extends Phaser.Scene {
    private mapRenderer!: MapRenderer;
    private cameraController!: CameraController;
    private tokenManager!: TokenManager;

    private currentPlayers: Player[] = [];
    private myOwnerId = '';
    private lastState: GameState | null = null;
    private globalVisibility = true;
    private pendingFocusPlayerId = '';

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

        this.mapRenderer.render((node, pointer) => this.handleNodeClick(node, pointer));

        if (this.lastState) {
            this.applyState(this.lastState);
        }

        if (this.pendingFocusPlayerId) {
            const playerId = this.pendingFocusPlayerId;
            this.pendingFocusPlayerId = '';
            this.focusOnPlayer(playerId);
        }

        this.game.events.emit(SCENE_READY_EVENT);
    }

    setMyOwnerId(id: string): void {
        this.myOwnerId = id;
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

    clearGame(): void {
        this.lastState = null;
        this.currentPlayers = [];
        this.pendingFocusPlayerId = '';
        this.myOwnerId = '';
        this.tokenManager?.clear();
        this.cameras?.main?.setScroll(0, 0);
        this.cameras?.main?.setZoom(1);
    }

    focusOnPlayer(playerId: string): void {
        if (!this.cameraController) {
            this.pendingFocusPlayerId = playerId;
            return;
        }

        const player = this.currentPlayers.find(candidate => candidate.id === playerId);
        if (!player) return;

        let targetId = player.position;

        if (player.role === 'MR_X' && targetId === 0 && this.lastState) {
            targetId = findLastKnownPosition(this.lastState.moveHistory);
        }

        if (targetId <= 0) return;
        this.cameraController.focusOnNode(targetId);
    }

    private applyState(state: GameState): void {
        this.tokenManager.update(
            state.players,
            state.users,
            this.globalVisibility,
            state.moveHistory
        );
    }

    private handleNodeClick(
        targetNode: GameNode,
        pointer: Phaser.Input.Pointer
    ): void {
        const state = this.lastState;
        if (!state || !this.myOwnerId) return;

        const active = state.players.find(player => player.id === state.turn);
        if (!active || active.ownerId !== this.myOwnerId) return;

        const edges = getEdges(active.position).filter(
            edge =>
                edge.to === targetNode.id &&
                !isNodeBlocked(this.currentPlayers, active, edge.to)
        );
        if (edges.length === 0) return;

        const request: TransportRequest = {
            target: targetNode,
            edges,
            me: active,
            screenX: pointer.x,
            screenY: pointer.y
        };
        this.game.events.emit(TRANSPORT_REQUEST_EVENT, request);
    }
}
