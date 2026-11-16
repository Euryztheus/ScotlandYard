import type { GameSettings } from '../../../../shared/src/types.ts';
import { element } from '../dom.ts';

type InputKey =
    | 'detTaxi'
    | 'detBus'
    | 'detUnd'
    | 'mrxTaxi'
    | 'mrxBus'
    | 'mrxUnd'
    | 'mrxBlack'
    | 'mrx2x';

export class SettingsForm {
    readonly root = element('div', 'lobby-settings');
    private readonly infinite: HTMLInputElement;
    private readonly inputs: Record<InputKey, HTMLInputElement>;

    constructor(private readonly onChange: (settings: Partial<GameSettings>) => void) {
        this.root.innerHTML = `
            <h3>[ GAME SETTINGS ]</h3>
            <label class="checkbox-row">
                <input type="checkbox" data-setting="infinite"> INFINITE TICKETS
            </label>
            <div class="settings-grid">
                <div class="settings-card detectives">
                    <strong>DETECTIVES</strong>
                    <div class="settings-fields">
                        TAXI: <input type="number" data-setting="det-taxi" min="0" max="99"><br>
                        BUS: <input type="number" data-setting="det-bus" min="0" max="99"><br>
                        UND: <input type="number" data-setting="det-und" min="0" max="99">
                    </div>
                </div>
                <div class="settings-card mrx">
                    <strong>MR. X</strong>
                    <div class="settings-fields">
                        TAXI: <input type="number" data-setting="mrx-taxi" min="0" max="99"><br>
                        BUS: <input type="number" data-setting="mrx-bus" min="0" max="99"><br>
                        UND: <input type="number" data-setting="mrx-und" min="0" max="99"><br>
                        BLACK: <input type="number" data-setting="mrx-black" min="0" max="99"><br>
                        <hr class="settings-divider">
                        2X: <input type="number" data-setting="mrx-2x" min="0" max="5">
                    </div>
                </div>
            </div>
        `;

        this.infinite = this.query('infinite');
        this.inputs = {
            detTaxi: this.query('det-taxi'),
            detBus: this.query('det-bus'),
            detUnd: this.query('det-und'),
            mrxTaxi: this.query('mrx-taxi'),
            mrxBus: this.query('mrx-bus'),
            mrxUnd: this.query('mrx-und'),
            mrxBlack: this.query('mrx-black'),
            mrx2x: this.query('mrx-2x')
        };

        this.infinite.addEventListener('change', () => this.onChange(this.read()));
        Object.values(this.inputs).forEach(input => {
            input.addEventListener('change', () => this.onChange(this.read()));
        });
    }

    render(settings: GameSettings, isHost: boolean): void {
        this.infinite.disabled = !isHost;
        Object.values(this.inputs).forEach(input => {
            input.disabled = !isHost;
        });

        // Only protect the field the host is currently editing. Other fields
        // should still reflect broadcasts from the server.
        const focused = document.activeElement;

        this.infinite.checked = settings.infiniteTickets;

        const values: Record<InputKey, number> = {
            detTaxi: settings.detectiveStartTickets.taxi,
            detBus: settings.detectiveStartTickets.bus,
            detUnd: settings.detectiveStartTickets.underground,
            mrxTaxi: settings.mrXStartTickets.taxi,
            mrxBus: settings.mrXStartTickets.bus,
            mrxUnd: settings.mrXStartTickets.underground,
            mrxBlack: settings.mrXStartTickets.black,
            mrx2x: settings.mrXDoubleTickets
        };

        (Object.keys(this.inputs) as InputKey[]).forEach(key => {
            const input = this.inputs[key];
            if (input !== focused) {
                input.value = String(values[key]);
            }
        });
    }

    read(): Partial<GameSettings> {
        return {
            infiniteTickets: this.infinite.checked,
            detectiveStartTickets: {
                taxi: this.number('detTaxi'),
                bus: this.number('detBus'),
                underground: this.number('detUnd'),
                black: 0
            },
            mrXStartTickets: {
                taxi: this.number('mrxTaxi'),
                bus: this.number('mrxBus'),
                underground: this.number('mrxUnd'),
                black: this.number('mrxBlack')
            },
            mrXDoubleTickets: this.number('mrx2x')
        };
    }

    private query(name: string): HTMLInputElement {
        const input = this.root.querySelector<HTMLInputElement>(`[data-setting="${name}"]`);
        if (!input) throw new Error(`Missing settings input: ${name}`);
        return input;
    }

    private number(key: InputKey): number {
        return Number.parseInt(this.inputs[key].value, 10) || 0;
    }
}
