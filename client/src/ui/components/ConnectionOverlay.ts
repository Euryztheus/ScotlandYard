import { element, setHidden } from '../dom.ts';

export class ConnectionOverlay {
    readonly root = element('div', 'connection-overlay');
    private readonly message = element('p', 'connection-message', 'CONNECTION LOST');
    private readonly detail = element('p', 'connection-detail', 'Trying to reconnect…');

    constructor() {
        const panel = element('div', 'connection-panel');
        panel.append(
            element('span', 'connection-dot'),
            this.message,
            this.detail
        );
        this.root.append(panel);
        this.hide();
    }

    show(message: string, detail = 'Trying to reconnect…'): void {
        this.message.textContent = message;
        this.detail.textContent = detail;
        setHidden(this.root, false);
    }

    hide(): void {
        setHidden(this.root, true);
    }
}
