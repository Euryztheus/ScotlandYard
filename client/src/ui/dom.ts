export function element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function button(label: string, className = 'btn'): HTMLButtonElement {
    return element('button', className, label);
}

export function setHidden(node: HTMLElement, hidden: boolean): void {
    node.classList.toggle('hidden', hidden);
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string): void {
    document.querySelector('.toast')?.remove();

    const toast = element('div', 'toast', message);
    document.body.append(toast);

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.remove();
        toastTimer = undefined;
    }, 3000);
}
