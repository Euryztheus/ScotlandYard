import { button, element, setHidden } from '../dom.ts';

export interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
}

export class ConfirmDialog {
    readonly root = element('div', 'confirm-overlay');
    private readonly title = element('h2', 'confirm-title');
    private readonly message = element('p', 'confirm-message');
    private readonly cancelButton: HTMLButtonElement;
    private readonly confirmButton: HTMLButtonElement;
    private resolve: ((confirmed: boolean) => void) | null = null;
    private previousFocus: HTMLElement | null = null;

    constructor() {
        const panel = element('div', 'screen confirm-panel');
        this.title.id = 'confirm-dialog-title';
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute('aria-labelledby', this.title.id);

        this.cancelButton = button('STAY', 'btn btn-secondary');
        this.confirmButton = button('LEAVE', 'btn btn-dark');
        this.cancelButton.type = 'button';
        this.confirmButton.type = 'button';

        const actions = element('div', 'confirm-actions');
        actions.append(this.cancelButton, this.confirmButton);
        panel.append(this.title, this.message, actions);
        this.root.append(panel);

        this.root.addEventListener('click', event => {
            if (event.target === this.root) this.settle(false);
        });
        this.cancelButton.addEventListener('click', () => this.settle(false));
        this.confirmButton.addEventListener('click', () => this.settle(true));
        document.addEventListener('keydown', event => {
            if (!this.resolve) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                this.settle(false);
            }
        });

        setHidden(this.root, true);
    }

    ask(options: ConfirmOptions): Promise<boolean> {
        this.settle(false);

        this.title.textContent = options.title;
        this.message.textContent = options.message;
        this.cancelButton.textContent = options.cancelLabel ?? 'STAY';
        this.confirmButton.textContent = options.confirmLabel ?? 'LEAVE';
        this.confirmButton.className = options.danger === false ? 'btn btn-primary' : 'btn btn-dark';

        this.previousFocus =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setHidden(this.root, false);
        this.cancelButton.focus();

        return new Promise<boolean>(resolve => {
            this.resolve = resolve;
        });
    }

    cancel(): void {
        this.settle(false);
    }

    private settle(confirmed: boolean): void {
        if (!this.resolve) return;

        const resolve = this.resolve;
        this.resolve = null;
        setHidden(this.root, true);
        resolve(confirmed);

        if (!confirmed) {
            this.previousFocus?.focus();
        }
        this.previousFocus = null;
    }
}
