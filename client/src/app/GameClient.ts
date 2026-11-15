import type Phaser from 'phaser';
import type {
    GameOverResult,
    GameSettings,
    GameState,
    MoveRequest,
    Player
} from '../../../shared/src/types.ts';
import { createPhaserGame } from '../game/createGame.ts';
import {
    GameScene,
    MOVE_INTENT_EVENT,
    SCENE_READY_EVENT
} from '../game/scenes/GameScene.ts';
import { Network } from '../network/Network.ts';
import { showToast } from '../ui/dom.ts';
import { GameHud } from '../ui/screens/GameHud.ts';
import { LobbyScreen } from '../ui/screens/LobbyScreen.ts';
import { MenuScreen } from '../ui/screens/MenuScreen.ts';

export class GameClient {
    private readonly menu: MenuScreen;
    private readonly lobby: LobbyScreen;
    private readonly hud: GameHud;
    private readonly phaser: Phaser.Game;
    private readonly network: Network;

    private state: GameState | null = null;
    private myId = '';
    private doubleMoveActive = false;

    constructor(uiRoot: HTMLElement) {
        this.menu = new MenuScreen({
            onCreate: () => this.network.createGame(),
            onJoin: code => this.network.joinGame(code)
        });

        this.lobby = new LobbyScreen({
            onReady: () => this.network.toggleReady(),
            onStart: () => this.network.startGame(),
            onClaimMrX: () => this.network.claimMrX(),
            onSettingsChange: (settings: Partial<GameSettings>) =>
                this.network.updateSettings(settings)
        });

        this.hud = new GameHud({
            onFocusPlayer: playerId => this.focusOnPlayer(playerId),
            onTogglePlayers: visible => this.setPlayersVisible(visible),
            onToggleDouble: () => this.toggleDoubleMove()
        });

        uiRoot.append(this.menu.root, this.lobby.root, this.hud.root);
        this.menu.show();
        this.lobby.hide();
        this.hud.hide();

        this.phaser = createPhaserGame();
        this.phaser.events.on(MOVE_INTENT_EVENT, this.handleMoveIntent, this);
        this.phaser.events.on(SCENE_READY_EVENT, this.applyStateToScene, this);

        this.network = new Network({
            onState: state => this.handleState(state),
            onGameOver: result => this.handleGameOver(result),
            onError: error => showToast(error.message),
            onConnect: id => {
                this.myId = id;
            },
            onDisconnect: () => showToast('Disconnected from server')
        });
    }

    private handleState(state: GameState): void {
        this.state = state;
        this.myId = this.network.getID();
        const me = this.findMe();

        if (state.phase === 'LOBBY') {
            this.menu.hide();
            this.hud.hide();
            this.lobby.show();
            this.lobby.render(state, me);
            return;
        }

        if (state.phase === 'PLAYING') {
            this.menu.hide();
            this.lobby.hide();
            this.hud.show();
            this.hud.render(state, me, this.myId, this.doubleMoveActive);
            this.applyStateToScene();

            if (state.pendingDoubleMove && me?.role === 'MR_X' && this.doubleMoveActive) {
                this.setDoubleMove(false);
            }
        }
    }

    private applyStateToScene(): void {
        if (!this.state) return;

        const scene = this.getScene();
        if (!scene) return;

        scene.setMyId(this.myId);
        scene.updateGameState(this.state);
    }

    private handleGameOver(result: GameOverResult): void {
        setTimeout(() => {
            alert(`GAME OVER!\nWinner: ${result.winner}\nReason: ${result.reason}`);
            window.location.reload();
        }, 100);
    }

    private handleMoveIntent = (move: MoveRequest): void => {
        const useDoubleTicket = this.doubleMoveActive;

        this.network.sendMove({ ...move, useDoubleTicket }, result => {
            if (!result.ok) showToast(result.message);
        });

        if (useDoubleTicket) {
            this.setDoubleMove(false);
        }
    };

    private toggleDoubleMove(): void {
        const me = this.findMe();
        if (me?.role !== 'MR_X' || me.doubleTickets <= 0) return;
        this.setDoubleMove(!this.doubleMoveActive);
    }

    private setDoubleMove(active: boolean): void {
        this.doubleMoveActive = active;
        this.hud.setDoubleMoveActive(active);
    }

    private focusOnPlayer(playerId: string): void {
        this.getScene()?.focusOnPlayer(playerId);
    }

    private setPlayersVisible(visible: boolean): void {
        this.getScene()?.setPlayersVisible(visible);
    }

    private findMe(): Player | undefined {
        return this.state?.players.find(player => player.id === this.myId);
    }

    private getScene(): GameScene | null {
        return (this.phaser.scene.getScene('GameScene') as GameScene | null) ?? null;
    }
}
