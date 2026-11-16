export function makeDraggable(element: HTMLElement, handle: HTMLElement = element): void {
    let pos1 = 0;
    let pos2 = 0;
    let pos3 = 0;
    let pos4 = 0;

    handle.style.cursor = 'move';

    const closeDragElement = (): void => {
        document.onmouseup = null;
        document.onmousemove = null;
    };

    const elementDrag = (event: MouseEvent): void => {
        event.preventDefault();
        pos1 = pos3 - event.clientX;
        pos2 = pos4 - event.clientY;
        pos3 = event.clientX;
        pos4 = event.clientY;

        let newTop = element.offsetTop - pos2;
        let newLeft = element.offsetLeft - pos1;

        const maxX = window.innerWidth - element.offsetWidth;
        const maxY = window.innerHeight - element.offsetHeight;

        if (newTop < 0) newTop = 0;
        if (newLeft < 0) newLeft = 0;
        if (newTop > maxY) newTop = maxY;
        if (newLeft > maxX) newLeft = maxX;

        element.style.top = `${newTop}px`;
        element.style.left = `${newLeft}px`;
        element.style.right = 'auto';
    };

    const dragMouseDown = (event: MouseEvent): void => {
        event.preventDefault();
        pos3 = event.clientX;
        pos4 = event.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    };

    handle.onmousedown = dragMouseDown;
}
