import type { GameSettings, GameState, Player } from '../../../../shared/src/types.ts';
import { SettingsForm } from '../components/SettingsForm.ts';
import { element, setHidden } from '../dom.ts';

export interface LobbyCallbacks {
    onReady: () => void;
    onStart: () => void;
    onClaimMrX: () => void;
    onSettingsChange: (settings: Partial<GameSettings>) => void;
}

export class LobbyScreen {
    readonly root = element('div', 'screen lobby-screen');
    private readonly title = element('span', 'lobby-code', '???');
    private readonly subtitle: HTMLElement;
    private readonly playerList = element('div', 'lobby-player-list');
    private readonly readyButton: HTMLButtonElement;
    private readonly startButton: HTMLButtonElement;
    private readonly claimButton: HTMLButtonElement;
    private readonly settingsForm: SettingsForm;

    constructor(callbacks: LobbyCallbacks) {
        this.root.innerHTML = `
            <h1 class="lobby-title">LOBBY <span class="lobby-code">???</span></h1>
            <p class="lobby-subtitle">WAITING FOR PLAYERS</p>
            <div class="lobby-toolbar">
                <button class="btn btn-dark btn-small" data-action="claim">CLAIM MR. X</button>
            </div>
            <div class="lobby-player-list"></div>
            <div class="lobby-settings-slot"></div>
            <div class="lobby-actions">
                <button class="btn btn-secondary" data-action="ready">NOT READY</button>
                <button class="btn btn-success hidden" data-action="start">START GAME</button>
            </div>
        `;

        this.subtitle = this.query<HTMLElement>('.lobby-subtitle');
        this.readyButton = this.query<HTMLButtonElement>('[data-action="ready"]');
        this.startButton = this.query<HTMLButtonElement>('[data-action="start"]');
        this.claimButton = this.query<HTMLButtonElement>('[data-action="claim"]');
        this.settingsForm = new SettingsForm(settings => callbacks.onSettingsChange(settings));

        this.query('.lobby-title').replaceChildren(
            document.createTextNode('LOBBY '),
            this.title
        );
        this.query('.lobby-player-list').replaceWith(this.playerList);
        this.query('.lobby-settings-slot').replaceWith(this.settingsForm.root);

        this.readyButton.addEventListener('click', () => callbacks.onReady());
        this.startButton.addEventListener('click', () => callbacks.onStart());
        this.claimButton.addEventListener('click', () => callbacks.onClaimMrX());
    }

    show(): void {
        setHidden(this.root, false);
    }

    hide(): void {
        setHidden(this.root, true);
    }

    render(state: GameState, me: Player | undefined): void {
        this.title.textContent = state.lobbyCode;

        const detectives = state.players
            .filter(player => player.role === 'DETECTIVE')
            .sort((a, b) => a.id.localeCompare(b.id));

        this.playerList.replaceChildren();
        state.players.forEach(player => {
            const row = element('div', 'lobby-player-row');
            const detectiveIndex = detectives.findIndex(candidate => candidate.id === player.id);
            const roleLabel =
                player.role === 'MR_X' ? 'MR.X' : `DET ${detectiveIndex + 1}`;

            const roleTag = element(
                'span',
                `role-tag ${player.role === 'MR_X' ? 'mrx' : 'detective'}`,
                roleLabel
            );

            const name = element(
                'span',
                'lobby-player-name',
                player.id === me?.id ? 'YOU' : 'PLAYER'
            );

            if (player.isHost) {
                name.append(element('span', 'host-tag', 'HOST'));
            }

            const status = element(
                'span',
                `player-status ${player.isReady ? 'ready' : 'waiting'}`,
                player.isReady ? 'READY' : 'WAITING'
            );

            row.append(roleTag, name, status);
            this.playerList.append(row);
        });

        const isHost = me?.isHost ?? false;
        const allReady = state.players.length > 0 && state.players.every(p => p.isReady);

        this.subtitle.textContent = allReady ? 'ALL PLAYERS READY' : 'WAITING FOR PLAYERS';
        this.readyButton.textContent = me?.isReady ? 'READY' : 'NOT READY';
        this.readyButton.classList.toggle('is-ready', Boolean(me?.isReady));
        setHidden(this.startButton, !(isHost && allReady));
        this.settingsForm.render(state.settings, isHost);
    }

    readSettings(): Partial<GameSettings> {
        return this.settingsForm.read();
    }

    private query<T extends Element>(selector: string): T {
        const found = this.root.querySelector<T>(selector);
        if (!found) throw new Error(`Missing lobby element: ${selector}`);
        return found;
    }
}
