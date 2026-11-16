import Phaser from 'phaser';
import { getNode } from '../../../shared/src/map.ts';

export class CameraController {
    constructor(private readonly scene: Phaser.Scene) {
        scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.isDown) return;
            const camera = scene.cameras.main;
            camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
            camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
        });

        scene.input.on(
            'wheel',
            (
                _pointer: Phaser.Input.Pointer,
                _gameObjects: Phaser.GameObjects.GameObject[],
                _deltaX: number,
                deltaY: number
            ) => {
                const camera = scene.cameras.main;
                camera.setZoom(Phaser.Math.Clamp(camera.zoom - deltaY * 0.001, 0.2, 1.5));
            }
        );
    }

    focusOnNode(nodeId: number): void {
        const node = getNode(nodeId);
        if (!node) return;

        this.scene.cameras.main.pan(node.x, node.y, 800, 'Power2');
        this.scene.cameras.main.zoomTo(1.5, 800, 'Power2');
    }
}
