import type { GameState, Player } from '../../../../shared/src/types.ts';
import { MrXTracker } from '../components/MrXTracker.ts';
import { PlayerList } from '../components/PlayerList.ts';
import { element, setHidden } from '../dom.ts';
import { makeDraggable } from '../drag.ts';

export interface GameHudCallbacks {
    onFocusPlayer: (playerId: string) => void;
    onTogglePlayers: (visible: boolean) => void;
    onToggleDouble: () => void;
}

export class GameHud {
    readonly root = element('div', 'game-hud');
    private readonly header = element('h2', 'hud-header');
    private readonly lobbyCode = element('span', 'lobby-code', '???');
    private readonly roundDisplay = element('span', 'round-display', '0');
    private readonly playerList = new PlayerList();
    private readonly tracker = new MrXTracker();
    private readonly mrxActions = element('div', 'mrx-actions');
    private readonly doubleButton: HTMLButtonElement;
    private readonly togglePlayersButton: HTMLButtonElement;
    private playersVisible = true;

    constructor(private readonly callbacks: GameHudCallbacks) {
        this.header.append(
            element('span', 'hud-status-dot'),
            document.createTextNode('LOBBY: '),
            this.lobbyCode
        );

        this.doubleButton = element('button', 'btn-2x', 'USE 2X TICKET');
        this.mrxActions.append(this.doubleButton);

        const playerSlot = element('div', 'player-list-slot');
        playerSlot.append(this.playerList.root);

        const trackerSlot = element('div', 'tracker-slot');
        trackerSlot.append(this.tracker.root);

        this.togglePlayersButton = element('button', 'btn-util', 'HIDE TOKENS');
        const footer = element('div', 'hud-footer');
        footer.append('ROUND ', this.roundDisplay, this.togglePlayersButton);

        this.root.append(this.header, playerSlot, this.mrxActions, trackerSlot, footer);
        makeDraggable(this.root, this.header);

        this.doubleButton.addEventListener('click', () => callbacks.onToggleDouble());
        this.togglePlayersButton.addEventListener('click', () => this.togglePlayers());
    }

    show(): void {
        setHidden(this.root, false);
    }

    hide(): void {
        setHidden(this.root, true);
    }

    render(state: GameState, me: Player | undefined, myId: string, doubleActive: boolean): void {
        this.lobbyCode.textContent = state.lobbyCode;
        this.roundDisplay.textContent = String(state.round);

        this.playerList.render(state.players, state.turn, myId, this.callbacks.onFocusPlayer);
        this.tracker.render(state.moveHistory, state.round);

        const showActions =
            me?.role === 'MR_X' && state.turn === myId && !state.pendingDoubleMove;
        setHidden(this.mrxActions, !showActions);

        this.doubleButton.disabled = !me || me.doubleTickets <= 0;
        this.setDoubleMoveActive(doubleActive);
    }

    setDoubleMoveActive(active: boolean): void {
        this.doubleButton.classList.toggle('active', active);
        this.doubleButton.textContent = active ? 'CANCEL 2X' : 'USE 2X TICKET';
    }

    private togglePlayers(): void {
        this.playersVisible = !this.playersVisible;
        this.togglePlayersButton.textContent = this.playersVisible
            ? 'HIDE TOKENS'
            : 'SHOW TOKENS';
        this.callbacks.onTogglePlayers(this.playersVisible);
    }
}
