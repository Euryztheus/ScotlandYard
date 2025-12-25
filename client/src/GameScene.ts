import Phaser from 'phaser';
import mapData from '../../shared/mapData.json'; 
import { Player } from '../../shared/types';

export class GameScene extends Phaser.Scene {
    // Store reference to player tokens
    private playerTokens: Map<string, Phaser.GameObjects.Container> = new Map();

    constructor() {
        super('GameScene');
    }

    preload() {
        this.load.image('map-bg', '/map.jpeg');
    }

    create() {
        // 1. Draw Map (Depth 0)
        this.add.image(0, 0, 'map-bg').setOrigin(0).setDepth(0);
        
        // 2. Set Camera Bounds
        this.cameras.main.setBounds(0, 0, 2849, 2235);

        // 3. Draw Invisible Clickable Nodes (Depth 1)
        Object.values(mapData.nodes).forEach((node: any) => {
            const circle = this.add.circle(node.x, node.y, 30, 0x000000, 0.0) // 0.0 = Invisible
                .setDepth(1)
                .setInteractive({ useHandCursor: true });

            circle.on('pointerdown', () => {
                console.log(`[Input] Requesting move to Node ${node.id}`);
                // EMIT THE EVENT so main.ts can send it to the server
                this.game.events.emit('request_move', { 
                    toNode: node.id, 
                    transport: 'taxi' 
                });
            });
        });

        // 4. Camera Controls
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!p.isDown) return;
            this.cameras.main.scrollX -= (p.x - p.prevPosition.x) / this.cameras.main.zoom;
            this.cameras.main.scrollY -= (p.y - p.prevPosition.y) / this.cameras.main.zoom;
        });

        this.input.on('wheel', (p: any, g: any, dx: number, dy: number) => {
            this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.2, 1.5));
        });
    }

    // Called by main.ts when server sends update
    public updateGameState(state: any) {
        console.log(`[Scene] Updating positions for ${state.players.length} players`);
        const players = state.players as Player[];
        
        // 1. Create Token if it doesn't exist
        players.forEach(p => {
            if (!this.playerTokens.has(p.id)) {
                this.createPlayerToken(p);
            }
        });

        // 2. Move Token
        players.forEach(p => {
            const token = this.playerTokens.get(p.id);
            const node = (mapData.nodes as any)[p.position];

            if (token && node) {
                // Tween (animate) to new position
                this.tweens.add({
                    targets: token,
                    x: node.x,
                    y: node.y,
                    duration: 300,
                    ease: 'Power2'
                });
            }
        });
    }

    private createPlayerToken(p: Player) {
        // Create a container at 0,0 (will be moved instantly by updateGameState)
        const container = this.add.container(0, 0).setDepth(100); // HIGH DEPTH
        
        // Mr X = Black, Detective = Blue
        const color = p.role === 'MR_X' ? 0x000000 : 0x0000FF; 
        
        // Draw a visible SQUARE so we can't miss it
        const shape = this.add.rectangle(0, 0, 40, 40, color).setStrokeStyle(3, 0xffffff);
        
        const label = this.add.text(0, -30, p.role, { 
            fontSize: '14px', 
            backgroundColor: '#000',
            color: '#fff',
            padding: { x: 4, y: 4 }
        }).setOrigin(0.5);

        container.add([shape, label]);
        this.playerTokens.set(p.id, container);
    }
}