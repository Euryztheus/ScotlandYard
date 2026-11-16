import Phaser from 'phaser';
import { getNode } from '../../../shared/src/map.ts';
import type { GameUserView, MoveRecord, Player } from '../../../shared/src/types.ts';
import { detectiveColorHex } from './colors.ts';
import { findLastKnownPosition } from './history.ts';

export class TokenManager {
    private readonly tokens = new Map<string, Phaser.GameObjects.Container>();

    constructor(private readonly scene: Phaser.Scene) {}

    update(
        players: Player[],
        users: GameUserView[],
        visible: boolean,
        history: MoveRecord[]
    ): void {        const playerIds = new Set(players.map(player => player.id));
        const connectedByOwner = new Map(users.map(user => [user.id, user.connected]));

        for (const [id, token] of this.tokens) {
            if (!playerIds.has(id)) {
                token.destroy();
                this.tokens.delete(id);
            }
        }

        players.forEach(player => {
            if (!this.tokens.has(player.id)) {
                this.createToken(player);
            }
        });

        players.forEach(player => {
            const token = this.tokens.get(player.id);
            if (!token) return;

            if (!visible) {
                token.setVisible(false);
                return;
            }

            const connected = connectedByOwner.get(player.ownerId) ?? true;

            if (player.role === 'DETECTIVE') {
                this.moveToken(token, player.position, connected ? 1 : 0.4);
                return;
            }

            if (player.position > 0) {
                this.moveToken(token, player.position, connected ? 1 : 0.4);
                return;
            }

            const lastKnown = findLastKnownPosition(history);
            if (lastKnown > 0) {
                this.moveToken(token, lastKnown, connected ? 0.9 : 0.4);
            } else {
                token.setVisible(false);
            }
        });
    }

    clear(): void {
        for (const token of this.tokens.values()) {
            token.destroy();
        }
        this.tokens.clear();
    }

    private createToken(player: Player): void {
        const container = this.scene.add.container(0, 0).setDepth(100);
        const color =
            player.role === 'DETECTIVE' ? detectiveColorHex(player.seat) : 0x000000;

        const outline = this.scene.add.circle(0, 0, 17, 0x05070d);
        const circle = this.scene.add.circle(0, 0, 15, color).setStrokeStyle(2, 0xffffff);
        const shine = this.scene.add.circle(-5, -5, 4, 0xffffff, 0.35);

        container.add([outline, circle, shine]);
        this.tokens.set(player.id, container);
    }

    private moveToken(
        token: Phaser.GameObjects.Container,
        nodeId: number,
        alpha: number
    ): void {
        const node = getNode(nodeId);
        if (!node) return;

        token.setVisible(true);
        token.setAlpha(alpha);

        this.scene.tweens.killTweensOf(token);
        this.scene.tweens.add({
            targets: token,
            x: node.x,
            y: node.y,
            duration: 400,
            ease: 'Power2'
        });
    }
}
