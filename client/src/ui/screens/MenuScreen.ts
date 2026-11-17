import { button, element, setHidden } from '../dom.ts';

export interface MenuCallbacks {
    onCreate: () => void;
    onJoin: (code: string) => void;
}

export class MenuScreen {
    readonly root = element('div', 'screen menu-overlay');
    private readonly input: HTMLInputElement;
    private readonly createButton: HTMLButtonElement;
    private readonly joinButton: HTMLButtonElement;

    constructor(callbacks: MenuCallbacks) {
        const title = element('h1', 'menu-title');
        title.innerHTML = 'SCOTLAND<br>YARD';

        this.createButton = button('CREATE GAME', 'btn btn-primary menu-create');

        const divider = element('div', 'menu-divider');
        divider.append(element('span', undefined, 'OR'));

        const joinRow = element('div', 'join-row');

        this.input = element('input', 'code-input');
        this.input.type = 'text';
        this.input.placeholder = 'ENTER CODE';
        this.input.maxLength = 5;

        this.joinButton = button('JOIN GAME', 'btn btn-secondary');

        const footer = element('p', 'menu-footer', '2-6 SEATS · ONLINE');
        const prompt = element('p', 'menu-prompt', '► SELECT MODE ◄');

        this.createButton.addEventListener('click', () => callbacks.onCreate());
        this.joinButton.addEventListener('click', () => this.join(callbacks));
        this.input.addEventListener('keydown', event => {
            if (event.key === 'Enter') this.join(callbacks);
        });

        joinRow.append(this.input, this.joinButton);
        this.root.append(title, this.createButton, divider, joinRow, footer, prompt);
    }

    show(): void {
        setHidden(this.root, false);
    }

    hide(): void {
        setHidden(this.root, true);
    }

    setBusy(busy: boolean): void {
        this.createButton.disabled = busy;
        this.joinButton.disabled = busy;
        this.input.disabled = busy;
    }

    private join(callbacks: MenuCallbacks): void {
        const code = this.input.value.trim().toUpperCase();
        if (code) callbacks.onJoin(code);
    }
}
