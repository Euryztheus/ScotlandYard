import { REVEAL_ROUNDS } from '../../../../shared/src/constants.ts';
import type { MoveRecord } from '../../../../shared/src/types.ts';
import { element } from '../dom.ts';

const TRANSPORT_LABELS: Record<string, string> = {
    taxi: 'TAXI',
    bus: 'BUS',
    underground: 'UND',
    black: 'BLACK',
    water: 'WATER'
};

export class MrXTracker {
    readonly root = element('div', 'mrx-tracker');
    private readonly summary = element('span', 'tracker-summary', 'ROUND 0');
    private readonly nextReveal = element('span', 'next-reveal', '3');
    private readonly history = element('div', 'tracker-history');
    private readonly icon = element('span', 'tracker-icon', '▼');
    private open = false;

    constructor() {
        const header = element('div', 'tracker-header');
        header.append(
            element('span', 'tracker-title', 'MR. X LOG'),
            this.summary,
            this.icon
        );

        const mini = element('div', 'tracker-mini');
        mini.append('NEXT REVEAL: ROUND ', this.nextReveal);

        this.root.append(header, mini, this.history);
        this.root.addEventListener('click', () => this.toggle());
        this.history.addEventListener('click', event => event.stopPropagation());
    }

    render(moveHistory: MoveRecord[], round: number): void {
        this.summary.textContent = `ROUND ${round}`;
        const nextReveal = REVEAL_ROUNDS.find(candidate => candidate > round) ?? 'END';
        this.nextReveal.textContent = String(nextReveal);

        this.history.replaceChildren();

        moveHistory.forEach(move => {
            const row = element('div', 'tracker-row');
            if (!move.isHidden) {
                row.classList.add('reveal');
            }

            const roundLabel = element('span', 'tracker-round', `${move.round}.`);
            const badge = element(
                'span',
                `badge badge-${move.transport}`,
                TRANSPORT_LABELS[move.transport] ?? move.transport.toUpperCase()
            );

            const position = element('span', 'tracker-position');
            if (move.position) {
                position.textContent = `at Node ${move.position}`;
                position.classList.add('known');
            } else {
                position.textContent = '???';
                position.classList.add('unknown');
            }

            if (move.isDoubleMove) {
                position.append(element('span', 'double-tag', ' (2x)'));
            }

            row.append(roundLabel, badge, position);
            this.history.append(row);
        });

        this.history.scrollTop = this.history.scrollHeight;
    }

    private toggle(): void {
        this.open = !this.open;
        this.history.classList.toggle('open', this.open);
        this.icon.textContent = this.open ? '▲' : '▼';
    }
}
