import type { GameState, Player } from '../../../../shared/src/types.ts';
import { MrXTracker } from '../components/MrXTracker.ts';
import { PlayerList } from '../components/PlayerList.ts';
import { element, setHidden } from '../dom.ts';
import { makeDraggable } from '../drag.ts';

export interface GameHudCallbacks {
    onFocusPlayer: (playerId: string) => void;
    onTogglePlayers: (visible: boolean) => void;
    onToggleDouble: () => void;
    onLeave: () => void;
}

function seatLabel(player: Player | undefined): string {
    if (!player) return '';
    return player.role === 'MR_X' ? 'MR. X' : `DET ${player.seat}`;
}

export class GameHud {
    readonly root = element('div', 'game-hud');
    private readonly header = element('h2', 'hud-header');
    private readonly lobbyCode = element('span', 'lobby-code', '???');
    private readonly roundDisplay = element('span', 'round-display', '0');
    private readonly banner = element('div', 'hud-banner');
    private readonly playerList = new PlayerList();
    private readonly tracker = new MrXTracker();
    private readonly mrxActions = element('div', 'mrx-actions');
    private readonly doubleButton: HTMLButtonElement;
    private readonly togglePlayersButton: HTMLButtonElement;
    private readonly leaveButton: HTMLButtonElement;
    private playersVisible = true;

    constructor(private readonly callbacks: GameHudCallbacks) {
        this.header.append(
            element('span', 'hud-status-dot'),
            document.createTextNode('GAME: '),
            this.lobbyCode
        );

        this.doubleButton = element('button', 'btn-2x', 'USE 2X TICKET');
        this.mrxActions.append(this.doubleButton);

        const playerSlot = element('div', 'player-list-slot');
        playerSlot.append(this.playerList.root);

        const trackerSlot = element('div', 'tracker-slot');
        trackerSlot.append(this.tracker.root);

        this.togglePlayersButton = element('button', 'btn-util', 'HIDE TOKENS');
        this.leaveButton = element('button', 'btn-util', 'LEAVE GAME');
        const footer = element('div', 'hud-footer');
        footer.append(
            'ROUND ',
            this.roundDisplay,
            this.togglePlayersButton,
            this.leaveButton
        );

        this.root.append(
            this.header,
            this.banner,
            playerSlot,
            this.mrxActions,
            trackerSlot,
            footer
        );
        makeDraggable(this.root, this.header);

        this.doubleButton.addEventListener('click', () => callbacks.onToggleDouble());
        this.togglePlayersButton.addEventListener('click', () => this.togglePlayers());
        this.leaveButton.addEventListener('click', () => callbacks.onLeave());
    }

    show(): void {
        setHidden(this.root, false);
    }

    hide(): void {
        setHidden(this.root, true);
    }

    render(state: GameState, ownerId: string, doubleActive: boolean): void {
        this.lobbyCode.textContent = state.lobbyCode;
        this.roundDisplay.textContent = String(state.round);

        this.playerList.render(
            state.players,
            state.users,
            state.turn,
            ownerId,
            this.callbacks.onFocusPlayer
        );
        this.tracker.render(state.moveHistory, state.round);

        const mySeats = state.players.filter(player => player.ownerId === ownerId);
        const myMrX = mySeats.find(player => player.role === 'MR_X');
        const active = state.players.find(player => player.id === state.turn);
        const activeUser = state.users.find(user => user.id === active?.ownerId);
        const isMyTurn = active?.ownerId === ownerId;

        if (!active) {
            this.banner.textContent = '';
            setHidden(this.banner, true);
        } else if (isMyTurn) {
            this.banner.textContent = `YOUR TURN — ${seatLabel(active)}`;
            this.banner.classList.add('active');
            this.banner.classList.remove('waiting');
            setHidden(this.banner, false);
        } else {
            const offline = activeUser && !activeUser.connected ? ' (RECONNECTING)' : '';
            this.banner.textContent = `WAITING FOR P${activeUser?.number ?? '?'}${offline}`;
            this.banner.classList.remove('active');
            this.banner.classList.add('waiting');
            setHidden(this.banner, false);
        }

        const showActions =
            Boolean(myMrX) &&
            isMyTurn &&
            active?.id === myMrX?.id &&
            !state.pendingDoubleMove;
        setHidden(this.mrxActions, !showActions);

        this.doubleButton.disabled = !myMrX || myMrX.doubleTickets <= 0;
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
