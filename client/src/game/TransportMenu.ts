import Phaser from 'phaser';
import type {
    Edge,
    EdgeType,
    GameNode,
    MoveRequest,
    Player
} from '../../../shared/src/types.ts';

const PANEL_WIDTH = 180;
const BUTTON_WIDTH = 150;
const BUTTON_HEIGHT = 32;
const BUTTON_GAP = 8;
const HEADER_HEIGHT = 30;
const PADDING = 10;
const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';

const PANEL_COLOR = 0x10162a;
const PANEL_BORDER = 0x5f74c7;
const INK = 0x05070d;
const MUTED = '#8d97c4';
const DARK_TEXT = '#05070d';
const LIGHT_TEXT = '#ffffff';

interface MenuRow {
    type: EdgeType;
    label: string;
    color: number;
    textColor: string;
    useBlackTicket: boolean;
}

export class TransportMenu {
    private container: Phaser.GameObjects.Container | null = null;
    private blocker: Phaser.GameObjects.Rectangle | null = null;

    constructor(private readonly scene: Phaser.Scene) {}

    destroy(): void {
        this.container?.destroy();
        this.container = null;

        this.blocker?.destroy();
        this.blocker = null;
    }

    show(
        targetNode: GameNode,
        edges: Edge[],
        me: Player,
        onSelect: (move: MoveRequest) => void
    ): void {
        this.destroy();

        const camera = this.scene.cameras.main;
        const rows = this.buildRows(edges, me);

        const totalHeight =
            PADDING * 2 +
            HEADER_HEIGHT +
            rows.length * BUTTON_HEIGHT +
            Math.max(0, rows.length - 1) * BUTTON_GAP;

        // worldView can be stale if the menu is opened before the first render.
        const viewX = camera.worldView.width > 0 ? camera.worldView.x : camera.scrollX;
        const viewY = camera.worldView.height > 0 ? camera.worldView.y : camera.scrollY;
        const viewWidth =
            camera.worldView.width > 0 ? camera.worldView.width : camera.width / camera.zoom;
        const viewHeight =
            camera.worldView.height > 0 ? camera.worldView.height : camera.height / camera.zoom;

        const minX = viewX + PANEL_WIDTH / 2 + 12;
        const maxX = viewX + viewWidth - PANEL_WIDTH / 2 - 12;
        const menuX =
            maxX >= minX
                ? Phaser.Math.Clamp(targetNode.x, minX, maxX)
                : viewX + viewWidth / 2;

        const minY = viewY + totalHeight / 2 + 12;
        const maxY = viewY + viewHeight - totalHeight / 2 - 12;
        const menuY =
            maxY >= minY
                ? Phaser.Math.Clamp(targetNode.y - totalHeight / 2 - 36, minY, maxY)
                : viewY + viewHeight / 2;

        this.blocker = this.scene.add
            .rectangle(
                camera.scrollX + camera.width / 2,
                camera.scrollY + camera.height / 2,
                5000,
                5000,
                0x000000,
                0.28
            )
            .setDepth(199)
            .setInteractive();

        this.blocker.on('pointerdown', () => this.destroy());

        const container = this.scene.add.container(menuX, menuY).setDepth(200);

        const children: Phaser.GameObjects.GameObject[] = [];
        const top = -totalHeight / 2;

        // Pixel drop shadow, then the panel.
        children.push(
            this.scene.add.rectangle(5, 5, PANEL_WIDTH, totalHeight, INK, 0.85),
            this.scene.add
                .rectangle(0, 0, PANEL_WIDTH, totalHeight, PANEL_COLOR, 0.98)
                .setStrokeStyle(2, PANEL_BORDER)
        );

        const headerY = top + PADDING + HEADER_HEIGHT / 2 - 2;
        children.push(
            this.scene.add
                .text(0, headerY, 'TRAVEL', {
                    fontFamily: PIXEL_FONT,
                    fontSize: '8px',
                    color: MUTED
                })
                .setOrigin(0.5),
            this.scene.add.rectangle(0, headerY + 11, BUTTON_WIDTH, 1, PANEL_BORDER, 0.7)
        );

        const firstRowY = top + PADDING + HEADER_HEIGHT + BUTTON_HEIGHT / 2;

        rows.forEach((row, index) => {
            const rowY = firstRowY + index * (BUTTON_HEIGHT + BUTTON_GAP);

            children.push(
                this.scene.add.rectangle(3, rowY + 3, BUTTON_WIDTH, BUTTON_HEIGHT, INK, 0.9)
            );

            const button = this.scene.add
                .rectangle(0, rowY, BUTTON_WIDTH, BUTTON_HEIGHT, row.color)
                .setStrokeStyle(2, INK)
                .setInteractive({ useHandCursor: true });

            const label = this.scene.add
                .text(0, rowY, row.label, {
                    fontFamily: PIXEL_FONT,
                    fontSize: '10px',
                    color: row.textColor
                })
                .setOrigin(0.5);

            button.on('pointerover', () => button.setFillStyle(this.lighten(row.color)));
            button.on('pointerout', () => button.setFillStyle(row.color));
            button.on('pointerdown', () => {
                onSelect({
                    toNode: targetNode.id,
                    transport: row.type,
                    useBlackTicket: row.useBlackTicket
                });
                this.destroy();
            });

            children.push(button, label);
        });

        container.add(children);
        this.container = container;
    }

    private buildRows(edges: Edge[], me: Player): MenuRow[] {
        const rows: MenuRow[] = edges.map(edge => ({
            type: edge.type,
            label: this.labelFor(edge.type),
            color: this.getTransportColor(edge.type),
            textColor: edge.type === 'water' ? LIGHT_TEXT : DARK_TEXT,
            useBlackTicket: false
        }));

        if (me.role === 'MR_X' && me.tickets.black > 0 && edges.length > 0) {
            rows.push({
                type: edges[0].type,
                label: 'BLACK',
                color: 0x1b2340,
                textColor: LIGHT_TEXT,
                useBlackTicket: true
            });
        }

        return rows;
    }

    private labelFor(type: EdgeType): string {
        switch (type) {
            case 'taxi':
                return 'TAXI';
            case 'bus':
                return 'BUS';
            case 'underground':
                return 'UND';
            case 'water':
                return 'WATER';
        }
    }

    private getTransportColor(type: EdgeType): number {
        switch (type) {
            case 'taxi':
                return 0xffd447;
            case 'bus':
                return 0x5ee7ff;
            case 'underground':
                return 0xff5c7a;
            case 'water':
                return 0x2a3358;
            default:
                return 0x9fb3ff;
        }
    }

    private lighten(color: number): number {
        return Phaser.Display.Color.IntegerToColor(color).brighten(18).color;
    }
}
