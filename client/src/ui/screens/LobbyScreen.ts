import { MAX_DETECTIVES } from '../../../../shared/src/constants.ts';
import type { GameSettings, GameState, Player } from '../../../../shared/src/types.ts';
import { detectiveColorCss } from '../../game/colors.ts';
import { SettingsForm } from '../components/SettingsForm.ts';
import { element, setHidden, showToast } from '../dom.ts';

export interface LobbyCallbacks {
    onReady: () => void;
    onStart: () => void;
    onClaimMrX: () => void;
    onSettingsChange: (settings: Partial<GameSettings>) => void;
    onAddDetective: () => void;
    onRemoveDetective: () => void;
    onLeave: () => void;
}

function roleLabel(player: Player): string {
    return player.role === 'MR_X' ? 'MR.X' : `DET ${player.seat}`;
}

export class LobbyScreen {
    readonly root = element('div', 'screen lobby-screen');
    private readonly title: HTMLElement;
    private readonly subtitle: HTMLElement;
    private readonly userList = element('div', 'lobby-user-list');
    private readonly readyButton: HTMLButtonElement;
    private readonly startButton: HTMLButtonElement;
    private readonly claimButton: HTMLButtonElement;
    private readonly addButton: HTMLButtonElement;
    private readonly removeButton: HTMLButtonElement;
    private readonly copyButton: HTMLButtonElement;
    private readonly settingsForm: SettingsForm;
    private lobbyCode = '';

    constructor(callbacks: LobbyCallbacks) {
        this.root.innerHTML = `
            <h1 class="lobby-title">LOBBY <span class="lobby-code">???</span></h1>
            <div class="lobby-code-row">
                <button class="btn btn-secondary btn-small" data-action="copy">COPY CODE</button>
            </div>
            <p class="lobby-subtitle">WAITING FOR PLAYERS</p>
            <div class="lobby-user-list"></div>
            <div class="lobby-seat-actions">
                <button class="btn btn-dark btn-small hidden" data-action="add">ADD DETECTIVE</button>
                <button class="btn btn-dark btn-small hidden" data-action="remove">REMOVE DETECTIVE</button>
                <button class="btn btn-dark btn-small hidden" data-action="claim">CLAIM MR. X</button>
            </div>
            <div class="lobby-actions">
                <button class="btn btn-secondary" data-action="ready">NOT READY</button>
                <button class="btn btn-success hidden" data-action="start">START GAME</button>
                <button class="btn btn-dark btn-small" data-action="leave">LEAVE</button>
            </div>
            <div class="lobby-settings-slot"></div>
        `;

        this.title = this.query<HTMLElement>('.lobby-code');
        this.subtitle = this.query<HTMLElement>('.lobby-subtitle');
        this.readyButton = this.query<HTMLButtonElement>('[data-action="ready"]');
        this.startButton = this.query<HTMLButtonElement>('[data-action="start"]');
        this.claimButton = this.query<HTMLButtonElement>('[data-action="claim"]');
        this.addButton = this.query<HTMLButtonElement>('[data-action="add"]');
        this.removeButton = this.query<HTMLButtonElement>('[data-action="remove"]');
        this.copyButton = this.query<HTMLButtonElement>('[data-action="copy"]');
        this.settingsForm = new SettingsForm(settings => callbacks.onSettingsChange(settings));

        this.query('.lobby-user-list').replaceWith(this.userList);
        this.query('.lobby-settings-slot').replaceWith(this.settingsForm.root);

        this.readyButton.addEventListener('click', () => callbacks.onReady());
        this.startButton.addEventListener('click', () => callbacks.onStart());
        this.claimButton.addEventListener('click', () => callbacks.onClaimMrX());
        this.addButton.addEventListener('click', () => callbacks.onAddDetective());
        this.removeButton.addEventListener('click', () => callbacks.onRemoveDetective());
        this.query<HTMLButtonElement>('[data-action="leave"]').addEventListener('click', () =>
            callbacks.onLeave()
        );
        this.copyButton.addEventListener('click', () => this.copyCode());
    }

    show(): void {
        setHidden(this.root, false);
    }

    hide(): void {
        setHidden(this.root, true);
    }

    render(state: GameState, ownerId: string): void {
        this.lobbyCode = state.lobbyCode;
        this.title.textContent = state.lobbyCode;

        const mySeats = state.players.filter(player => player.ownerId === ownerId);
        const isMrX = mySeats.some(player => player.role === 'MR_X');
        const isHost = state.hostId === ownerId;
        const hasMrX = state.players.some(player => player.role === 'MR_X');
        const mrX = state.players.find(player => player.role === 'MR_X');
        const mrXUser = state.users.find(user => user.id === mrX?.ownerId);
        const totalDetectives = state.players.filter(
            player => player.role === 'DETECTIVE'
        ).length;
        const allReady = state.players.length > 0 && state.players.every(p => p.isReady);
        const allConnected =
            state.users.length > 0 && state.users.every(user => user.connected);
        const ownReady = mySeats.length > 0 && mySeats.every(p => p.isReady);

        if (!hasMrX) {
            this.subtitle.textContent = 'WAITING FOR MR. X TO JOIN';
        } else if (!allConnected) {
            this.subtitle.textContent = 'WAITING FOR PLAYERS TO RECONNECT';
        } else if (allReady) {
            this.subtitle.textContent = 'ALL SEATS READY';
        } else {
            this.subtitle.textContent = 'WAITING FOR PLAYERS';
        }

        this.renderUsers(state, ownerId);

        this.readyButton.textContent = ownReady ? 'READY' : 'NOT READY';
        this.readyButton.classList.toggle('is-ready', ownReady);
        setHidden(this.readyButton, mySeats.length === 0);

        const canStart =
            isHost &&
            hasMrX &&
            totalDetectives > 0 &&
            allReady &&
            allConnected &&
            state.players.length > 0;
        setHidden(this.startButton, !canStart);

        setHidden(
            this.addButton,
            isMrX ||
                mySeats.length === 0 ||
                mySeats.length >= MAX_DETECTIVES ||
                totalDetectives >= MAX_DETECTIVES
        );
        setHidden(this.removeButton, isMrX || mySeats.length <= 1);
        setHidden(
            this.claimButton,
            isMrX || mySeats.length !== 1 || !hasMrX || !mrXUser?.connected
        );

        this.settingsForm.render(state.settings, isHost);
        setHidden(this.settingsForm.root, !isHost);
    }

    private renderUsers(state: GameState, ownerId: string): void {
        this.userList.replaceChildren();

        const users = [...state.users].sort((a, b) => a.number - b.number);
        users.forEach(user => {
            const seats = state.players.filter(player => player.ownerId === user.id);
            if (seats.length === 0) return;

            const group = element('div', 'lobby-user-group');
            const header = element('div', 'lobby-user-header');
            const name = element(
                'span',
                'lobby-user-name',
                user.id === ownerId ? 'YOU' : `PLAYER ${user.number}`
            );
            header.append(name);

            if (state.hostId === user.id) {
                header.append(element('span', 'host-tag', 'HOST'));
            }
            if (!user.connected) {
                header.append(element('span', 'offline-tag', 'OFFLINE'));
            }

            const seatRow = element('div', 'lobby-seats');
            seats.forEach(player => {
                const seat = element('span', 'seat-chip');
                const role = element(
                    'span',
                    `role-tag ${player.role === 'MR_X' ? 'mrx' : 'detective'}`,
                    roleLabel(player)
                );
                if (player.role === 'DETECTIVE') {
                    role.style.background = detectiveColorCss(player.seat);
                }
                const status = element(
                    'span',
                    `player-status ${player.isReady ? 'ready' : 'waiting'}`,
                    player.isReady ? 'READY' : 'WAITING'
                );
                seat.append(role, status);
                seatRow.append(seat);
            });

            group.append(header, seatRow);
            this.userList.append(group);
        });
    }

    private copyCode(): void {
        if (!this.lobbyCode) return;
        navigator.clipboard
            ?.writeText(this.lobbyCode)
            .then(() => showToast(`Copied ${this.lobbyCode}`))
            .catch(() => showToast('Could not copy the code'));
    }

    private query<T extends Element>(selector: string): T {
        const found = this.root.querySelector<T>(selector);
        if (!found) throw new Error(`Missing lobby element: ${selector}`);
        return found;
    }
}
