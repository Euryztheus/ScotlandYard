import type Phaser from 'phaser';
import type {
    GameSettings,
    GameState,
    MoveRequest,
    Player
} from '../../../shared/src/types.ts';
import { createPhaserGame } from '../game/createGame.ts';
import {
    GameScene,
    SCENE_READY_EVENT,
    TRANSPORT_REQUEST_EVENT
} from '../game/scenes/GameScene.ts';
import type { TransportRequest } from '../game/transport.ts';
import { Network } from '../network/Network.ts';
import { ConfirmDialog } from '../ui/components/ConfirmDialog.ts';
import { ConnectionOverlay } from '../ui/components/ConnectionOverlay.ts';
import { TransportMenu } from '../ui/components/TransportMenu.ts';
import { showToast } from '../ui/dom.ts';
import { GameHud } from '../ui/screens/GameHud.ts';
import { GameOverScreen } from '../ui/screens/GameOverScreen.ts';
import { LobbyScreen } from '../ui/screens/LobbyScreen.ts';
import { MenuScreen } from '../ui/screens/MenuScreen.ts';

export class GameClient {
    private readonly menu: MenuScreen;
    private readonly lobby: LobbyScreen;
    private readonly hud: GameHud;
    private readonly gameOver: GameOverScreen;
    private readonly connection = new ConnectionOverlay();
    private readonly confirmDialog = new ConfirmDialog();
    private readonly transportMenu = new TransportMenu();
    private readonly phaser: Phaser.Game;
    private readonly network: Network;

    private state: GameState | null = null;
    private ownerId = '';
    private doubleMoveActive = false;
    private sessionReplaced = false;
    private hasSession = false;
    private connected = false;
    private transportTurn = '';

    constructor(uiRoot: HTMLElement) {
        this.menu = new MenuScreen({
            onCreate: () => {
                this.menu.setBusy(true);
                this.network.createGame();
            },
            onJoin: code => {
                this.menu.setBusy(true);
                this.network.joinGame(code);
            }
        });

        this.lobby = new LobbyScreen({
            onReady: () => this.network.toggleReady(),
            onStart: () => this.network.startGame(),
            onClaimMrX: () => this.network.claimMrX(),
            onAddDetective: () => this.network.addDetective(),
            onRemoveDetective: () => this.network.removeDetective(),
            onLeave: () => this.leaveLobby(),
            onSettingsChange: (settings: Partial<GameSettings>) =>
                this.network.updateSettings(settings)
        });

        this.hud = new GameHud({
            onFocusPlayer: playerId => this.focusOnPlayer(playerId),
            onTogglePlayers: visible => this.setPlayersVisible(visible),
            onToggleDouble: () => this.toggleDoubleMove(),
            onLeave: () => this.leaveActiveGame()
        });

        this.gameOver = new GameOverScreen(() => this.leaveFinishedGame());

        uiRoot.append(
            this.menu.root,
            this.lobby.root,
            this.hud.root,
            this.gameOver.root,
            this.connection.root,
            this.transportMenu.root,
            this.confirmDialog.root
        );
        this.menu.show();
        this.lobby.hide();
        this.hud.hide();
        this.gameOver.hide();
        this.menu.setBusy(true);
        this.connection.show('CONNECTING', 'Contacting the server…');

        this.phaser = createPhaserGame();
        this.phaser.events.on(SCENE_READY_EVENT, this.applyStateToScene, this);
        this.phaser.events.on(TRANSPORT_REQUEST_EVENT, this.showTransportMenu, this);

        this.network = new Network({
            onState: state => this.handleState(state),
            onSession: ownerId => {
                this.ownerId = ownerId;
                this.sessionReplaced = false;
                this.hasSession = true;
                this.connected = true;
            },
            onError: error => showToast(error.message),
            onConnect: () => {
                this.connected = true;
            },
            onDisconnect: () => {
                this.connected = false;
                this.hideTransportMenu();
                if (this.sessionReplaced) return;
                this.connection.show('CONNECTION LOST', 'Trying to reconnect…');
                this.menu.setBusy(Boolean(this.network?.savedGameCode));
            },
            onReconnectStart: () => {
                this.hideTransportMenu();
                this.menu.setBusy(true);
                this.connection.show('RECONNECTING', 'Restoring your seats…');
            },
            onReconnectEnd: ok => {
                this.menu.setBusy(false);
                if (ok) {
                    this.connection.hide();
                    return;
                }

                this.connection.hide();
                this.resetToMenu();
            },
            onSessionReplaced: () => {
                this.sessionReplaced = true;
                this.hasSession = false;
                this.hideTransportMenu();
                this.confirmDialog.cancel();
                this.menu.setBusy(false);
                this.connection.show(
                    'SESSION OPENED ELSEWHERE',
                    'This game is now controlled by another tab.'
                );
            }
        });
    }

    private handleState(state: GameState): void {
        if (!this.hasSession) return;

        const previousTurn = this.state?.turn;
        this.state = state;
        if (this.connected) {
            this.connection.hide();
        }

        if (state.phase !== 'PLAYING' || state.turn !== this.transportTurn) {
            this.hideTransportMenu();
        }

        if (state.phase === 'LOBBY') {
            this.menu.hide();
            this.hud.hide();
            this.gameOver.hide();
            this.lobby.show();
            this.lobby.render(state, this.ownerId);
            return;
        }

        if (state.phase === 'PLAYING') {
            this.menu.hide();
            this.lobby.hide();
            this.gameOver.hide();
            this.hud.show();
            this.hud.render(state, this.ownerId, this.doubleMoveActive);
            this.applyStateToScene();

            const active = state.players.find(player => player.id === state.turn);
            if (active?.ownerId === this.ownerId && state.turn !== previousTurn) {
                this.getScene()?.focusOnPlayer(active.id);
            }

            if (state.pendingDoubleMove && this.doubleMoveActive) {
                this.setDoubleMove(false);
            }
            return;
        }

        this.menu.hide();
        this.lobby.hide();
        this.hud.hide();
        this.gameOver.show();
        this.gameOver.render(state.result, state);
        this.applyStateToScene();
    }

    private applyStateToScene(): void {
        if (!this.state) return;

        const scene = this.getScene();
        if (!scene) return;

        scene.setMyOwnerId(this.ownerId);
        scene.updateGameState(this.state);
    }

    private handleMoveIntent = (move: MoveRequest): void => {
        const useDoubleTicket = this.doubleMoveActive;

        this.network.sendMove({ ...move, useDoubleTicket }, result => {
            if (!result.ok) {
                showToast(result.message);
                return;
            }
            if (useDoubleTicket) {
                this.setDoubleMove(false);
            }
        });
    };

    private showTransportMenu = (request: TransportRequest): void => {
        this.transportTurn = request.me.id;
        this.transportMenu.show(request, move => this.handleMoveIntent(move));
    };

    private hideTransportMenu(): void {
        this.transportMenu.hide();
        this.transportTurn = '';
    }

    private toggleDoubleMove(): void {
        const mrX = this.mySeats().find(player => player.role === 'MR_X');
        if (
            !mrX ||
            !this.state ||
            this.state.turn !== mrX.id ||
            mrX.doubleTickets <= 0
        ) {
            return;
        }
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

    private mySeats(): Player[] {
        if (!this.state) return [];
        return this.state.players.filter(player => player.ownerId === this.ownerId);
    }

    private leaveLobby(): void {
        void this.confirmDialog
            .ask({
                title: 'LEAVE LOBBY?',
                message: 'You will give up your seats in this lobby.',
                confirmLabel: 'LEAVE',
                cancelLabel: 'STAY',
                danger: true
            })
            .then(confirmed => {
                if (!confirmed) return;
                this.network.leaveGame();
                this.resetToMenu();
            });
    }

    private leaveActiveGame(): void {
        void this.confirmDialog
            .ask({
                title: 'LEAVE GAME?',
                message: 'Your seats will be released and the game will continue without you.',
                confirmLabel: 'LEAVE',
                cancelLabel: 'STAY',
                danger: true
            })
            .then(confirmed => {
                if (!confirmed) return;
                this.network.leaveGame();
                this.resetToMenu();
            });
    }

    private leaveFinishedGame(): void {
        this.network.leaveGame();
        this.resetToMenu();
    }

    private resetToMenu(): void {
        this.state = null;
        this.ownerId = '';
        this.doubleMoveActive = false;
        this.sessionReplaced = false;
        this.hasSession = false;
        this.connected = false;
        this.transportTurn = '';
        this.transportMenu.hide();
        this.confirmDialog.cancel();
        this.lobby.hide();
        this.hud.hide();
        this.gameOver.hide();
        this.connection.hide();
        this.menu.show();
        this.menu.setBusy(false);
        this.getScene()?.clearGame();
    }

    private getScene(): GameScene | null {
        return (this.phaser.scene.getScene('GameScene') as GameScene | null) ?? null;
    }
}
