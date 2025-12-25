import Phaser from 'phaser';
import mapData from '../../shared/mapData.json';
import { GameNode } from '../../shared/types.ts';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    preload() {
        // Ensure map.png is in client/public/
        this.load.image('map-bg', '/map.jpeg');
    }

    create() {
        // 1. Add Background
        this.add.image(0, 0, 'map-bg').setOrigin(0);
        
        // 2. Set World Bounds to match your 2849x2235 image
        this.cameras.main.setBounds(0, 0, 2849, 2235);

        // 3. Draw Nodes Only
        Object.values(mapData.nodes).forEach((node: any) => {
            const container = this.add.container(node.x, node.y);
            
            // Outer circle (Hit area)
            const circle = this.add.circle(0, 0, 22, 0xffffff, 0.3)
                .setStrokeStyle(2, 0x000000)
                .setInteractive({ useHandCursor: true });

            // Station ID Label
            /*
            const text = this.add.text(0, 0, node.id.toString(), {
                color: '#000000',
                fontSize: '16px',
                fontStyle: 'bold',
                backgroundColor: '#ffffffaa',
                padding: { x: 2, y: 2 }
            }).setOrigin(0.5);

            container.add([circle, text]);*/

            container.add([circle]);
            circle.on('pointerdown', () => {
                this.handleNodeClick(node);
            });
        });

        // 4. Camera Drag Logic
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.isDown) return;
            this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
            this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
        });

        // 5. Camera Zoom Logic
        this.input.on('wheel', (pointer: any, gameObjects: any, dx: number, dy: number) => {
            const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.3, 2.0);
            this.cameras.main.setZoom(newZoom);
        });
    }

    private handleNodeClick(node: GameNode) {
        console.log(`Node ${node.id} selected. Connections:`, node.edges);
        // Next step: Send this to server
    }
}