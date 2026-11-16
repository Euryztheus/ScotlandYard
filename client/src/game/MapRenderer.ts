import Phaser from 'phaser';
import { MAP_HEIGHT, MAP_WIDTH } from '../../../shared/src/constants.ts';
import { MAP_NODES } from '../../../shared/src/map.ts';
import type { GameNode } from '../../../shared/src/types.ts';

export class MapRenderer {
    constructor(private readonly scene: Phaser.Scene) {}

    render(onNodeClick: (node: GameNode, pointer: Phaser.Input.Pointer) => void): void {
        this.scene.add.image(0, 0, 'map-bg').setOrigin(0).setDepth(0);
        this.scene.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

        Object.values(MAP_NODES).forEach(node => {
            const circle = this.scene.add
                .circle(node.x, node.y, 32, 0xffd447, 0)
                .setStrokeStyle(2, 0xffd447, 0)
                .setDepth(1)
                .setInteractive({ useHandCursor: true });

            circle.on('pointerover', () => {
                circle.setFillStyle(0xffd447, 0.14);
                circle.setStrokeStyle(2, 0xffd447, 0.9);
            });
            circle.on('pointerout', () => {
                circle.setFillStyle(0xffd447, 0);
                circle.setStrokeStyle(2, 0xffd447, 0);
            });
            circle.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
                onNodeClick(node, pointer)
            );
        });
    }
}
