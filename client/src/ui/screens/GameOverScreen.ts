import type { GameOverResult, GameState } from '../../../../shared/src/types.ts';
import { button, element, setHidden } from '../dom.ts';

export class GameOverScreen {
    readonly root = element('div', 'screen game-over-screen');
    private readonly winner = element('h1', 'game-over-winner', 'GAME OVER');
    private readonly reason = element('p', 'game-over-reason');
    private readonly meta = element('p', 'game-over-meta');

    constructor(onLeave: () => void) {
        const back = button('BACK TO MENU', 'btn btn-primary');
        back.addEventListener('click', onLeave);

        this.root.append(
            element('p', 'game-over-label', 'FINAL RESULT'),
            this.winner,
            this.reason,
            this.meta,
            back
        );
    }

    show(): void {
        setHidden(this.root, false);
    }

    hide(): void {
        setHidden(this.root, true);
    }

    render(result: GameOverResult | undefined, state: GameState): void {
        if (!result) {
            this.winner.textContent = 'GAME OVER';
            this.reason.textContent = '';
        } else {
            this.winner.textContent = result.winner === 'MR_X' ? 'MR. X WINS' : 'DETECTIVES WIN';
            this.reason.textContent = result.reason;
            this.winner.classList.toggle('mrx-win', result.winner === 'MR_X');
        }
        this.meta.textContent = `LOBBY ${state.lobbyCode} · ROUND ${Math.min(state.round, 24)}`;
    }
}
