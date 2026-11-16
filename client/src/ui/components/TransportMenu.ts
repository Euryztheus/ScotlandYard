import type { Edge, EdgeType, MoveRequest, Player } from '../../../../shared/src/types.ts';
import { button, element, setHidden } from '../dom.ts';
import type { TransportRequest } from '../../game/transport.ts';

interface MenuRow {
    type: EdgeType;
    label: string;
    className: string;
    useBlackTicket: boolean;
}

const MAX_WIDTH = 200;

function labelFor(type: EdgeType): string {
    switch (type) {
        case 'taxi':
            return 'TAXI';
        case 'bus':
            return 'BUS';
        case 'underground':
            return 'UNDERGROUND';
        case 'water':
            return 'RIVER';
    }
}

function buildRows(edges: Edge[], me: Player): MenuRow[] {
    const rows: MenuRow[] = [];

    edges.forEach(edge => {
        if (edge.type === 'water') {
            if (me.role === 'MR_X' && me.tickets.black > 0) {
                rows.push({
                    type: edge.type,
                    label: labelFor(edge.type),
                    className: 'water',
                    useBlackTicket: false
                });
            }
            return;
        }

        if (me.tickets[edge.type] > 0) {
            rows.push({
                type: edge.type,
                label: labelFor(edge.type),
                className: edge.type,
                useBlackTicket: false
            });
        }
    });

    if (me.role === 'MR_X' && me.tickets.black > 0 && edges.length > 0) {
        rows.push({
            type: edges[0].type,
            label: 'BLACK TICKET',
            className: 'black',
            useBlackTicket: true
        });
    }

    return rows;
}

export class TransportMenu {
    readonly root = element('div', 'transport-layer');
    private readonly backdrop = element('div', 'transport-backdrop');
    private readonly panel = element('div', 'transport-menu');

    constructor() {
        this.root.append(this.backdrop, this.panel);
        this.backdrop.addEventListener('click', () => this.hide());
        this.panel.addEventListener('click', event => event.stopPropagation());
        this.hide();
    }

    show(request: TransportRequest, onSelect: (move: MoveRequest) => void): void {
        this.hide();

        const rows = buildRows(request.edges, request.me);
        if (rows.length === 0) return;

        this.panel.append(
            element('div', 'transport-title', 'TRAVEL'),
            element('div', 'transport-node', `STATION ${request.target.id}`)
        );

        rows.forEach(row => {
            const option = button(row.label, `transport-option ${row.className}`);
            option.type = 'button';
            option.addEventListener('click', () => {
                onSelect({
                    toNode: request.target.id,
                    transport: row.type,
                    useBlackTicket: row.useBlackTicket
                });
                this.hide();
            });
            this.panel.append(option);
        });

        setHidden(this.root, false);

        const panelWidth = this.panel.offsetWidth || 200;
        const panelHeight = this.panel.offsetHeight || 150;
        const maxLeft = Math.max(8, window.innerWidth - panelWidth - 8);
        const left = Math.min(Math.max(request.screenX - panelWidth / 2, 8), maxLeft);

        let top = request.screenY - panelHeight - 24;
        if (top < 8) {
            top = Math.min(
                request.screenY + 24,
                Math.max(8, window.innerHeight - panelHeight - 8)
            );
        }

        this.panel.style.left = `${Math.round(left)}px`;
        this.panel.style.top = `${Math.round(top)}px`;
        this.panel.style.width = `${Math.min(MAX_WIDTH, window.innerWidth - 16)}px`;
    }

    hide(): void {
        setHidden(this.root, true);
        this.panel.replaceChildren();
        this.panel.style.removeProperty('left');
        this.panel.style.removeProperty('top');
        this.panel.style.removeProperty('width');
    }
}
