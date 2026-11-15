import { button, element, setHidden } from '../dom.ts';

export interface MenuCallbacks {
    onCreate: () => void;
    onJoin: (code: string) => void;
}

export class MenuScreen {
    readonly root = element('div', 'screen menu-overlay');
    private readonly input: HTMLInputElement;

    constructor(callbacks: MenuCallbacks) {
        const title = element('h1', 'menu-title');
        title.innerHTML = 'SCOTLAND<br>YARD';

        const subtitle = element('p', 'menu-subtitle', 'A GAME OF HIDE & SEEK');

        const createButton = button('CREATE GAME', 'btn btn-primary menu-create');

        const divider = element('div', 'menu-divider');
        divider.append(element('span', undefined, 'OR'));

        const joinRow = element('div', 'join-row');

        this.input = element('input', 'code-input');
        this.input.type = 'text';
        this.input.placeholder = 'ENTER CODE';
        this.input.maxLength = 5;

        const joinButton = button('JOIN GAME', 'btn btn-secondary');

        const footer = element('p', 'menu-footer', '1-6 PLAYERS · ONLINE');
        const prompt = element('p', 'menu-prompt', '► SELECT MODE ◄');

        createButton.addEventListener('click', () => callbacks.onCreate());
        joinButton.addEventListener('click', () => {
            const code = this.input.value.trim().toUpperCase();
            if (code) callbacks.onJoin(code);
        });
        this.input.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                const code = this.input.value.trim().toUpperCase();
                if (code) callbacks.onJoin(code);
            }
        });

        joinRow.append(this.input, joinButton);
        this.root.append(title, subtitle, createButton, divider, joinRow, footer, prompt);
    }

    show(): void {
        setHidden(this.root, false);
    }

    hide(): void {
        setHidden(this.root, true);
    }
}
