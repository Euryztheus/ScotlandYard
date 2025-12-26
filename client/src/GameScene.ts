import Phaser from 'phaser';
import mapData from '../../shared/mapData.json'; 
import { Player } from '../../shared/types';

export class GameScene extends Phaser.Scene {
    private playerTokens: Map<string, Phaser.GameObjects.Container> = new Map();
    private currentPlayers: Player[] = [];
    private myId: string = "";
    private activePopup: Phaser.GameObjects.Container | null = null; // Track open menu

    constructor() {
        super('GameScene');
    }

    public setMyId(id: string) {
        this.myId = id;
    }

    preload() {
        this.load.image('map-bg', '/map.jpeg');
    }

    create() {
        // 1. Draw Map (Depth 0)
        this.add.image(0, 0, 'map-bg').setOrigin(0).setDepth(0);
        this.cameras.main.setBounds(0, 0, 2849, 2235);

        // 2. Draw Invisible Clickable Nodes
        Object.values(mapData.nodes).forEach((node: any) => {
            const circle = this.add.circle(node.x, node.y, 30, 0x000000, 0.0) // Invisible
                .setDepth(1)
                .setInteractive({ useHandCursor: true });

            circle.on('pointerdown', () => {
                this.handleNodeClick(node);
            });
        });

        // 3. Camera Controls
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!p.isDown) return;
            this.cameras.main.scrollX -= (p.x - p.prevPosition.x) / this.cameras.main.zoom;
            this.cameras.main.scrollY -= (p.y - p.prevPosition.y) / this.cameras.main.zoom;
        });

        this.input.on('wheel', (p: any, g: any, dx: number, dy: number) => {
            this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.2, 1.5));
        });
        
        // Close menu if clicking elsewhere
        this.input.on('pointerdown', (pointer: any, gameObjects: any[]) => {
            if (gameObjects.length === 0 && this.activePopup) {
                this.activePopup.destroy();
                this.activePopup = null;
            }
        });
    }

    private handleNodeClick(targetNode: any) {
        // 1. Close existing menu
        if (this.activePopup) {
            this.activePopup.destroy();
            this.activePopup = null;
        }

        // 2. Identify Myself
        if (!this.myId) return;
        const me = this.currentPlayers.find(p => p.id === this.myId);
        if (!me) return;

        // 3. Check for VALID connections
        const currentNode = (mapData.nodes as any)[me.position];
        // Filter edges that point to our target
        const validEdges = currentNode.edges.filter((e: any) => e.to === targetNode.id);

        if (validEdges.length === 0) {
            console.log("No connection to this node.");
            return;
        }

        // 4. Show the Menu
        this.showTransportMenu(targetNode.x, targetNode.y, targetNode.id, validEdges);
    }

    private showTransportMenu(x: number, y: number, targetId: number, edges: any[]) {
        const container = this.add.container(x, y - 50).setDepth(200);
        
        // Background
        const bgHeight = edges.length * 40 + 10;
        const bg = this.add.rectangle(0, bgHeight / 2, 120, bgHeight, 0x222222, 0.9)
            .setStrokeStyle(2, 0xffffff);
        container.add(bg);

        // Buttons
        edges.forEach((edge, index) => {
            const btnY = index * 40 + 20;
            const color = this.getTransportColor(edge.type);
            
            // Button Shape
            const btn = this.add.rectangle(0, btnY, 100, 30, color)
                .setInteractive({ useHandCursor: true });
            
            // Button Text
            const text = this.add.text(0, btnY, edge.type.toUpperCase(), {
                fontSize: '14px', color: '#000', fontStyle: 'bold'
            }).setOrigin(0.5);

            btn.on('pointerdown', () => {
                console.log(`Selected ${edge.type} to Node ${targetId}`);
                this.game.events.emit('request_move', { 
                    toNode: targetId, 
                    transport: edge.type 
                });
                container.destroy();
                this.activePopup = null;
            });

            container.add([btn, text]);
        });

        this.activePopup = container;
    }

    private getTransportColor(type: string): number {
        switch (type) {
            case 'taxi': return 0xf6e05e; // Yellow
            case 'bus': return 0x4299e1; // Blue
            case 'underground': return 0xf56565; // Red
            case 'water': return 0xffffff; // White
            default: return 0xcccccc;
        }
    }
    
    public updateGameState(state: any) {
        this.currentPlayers = state.players as Player[];
        
        // Create Tokens
        this.currentPlayers.forEach(p => {
            if (!this.playerTokens.has(p.id)) this.createPlayerToken(p);
        });

        // Move Tokens
        this.currentPlayers.forEach(p => {
            const token = this.playerTokens.get(p.id);
            const node = (mapData.nodes as any)[p.position];

            if (token) {
                if (node) {
                    // Node exists (Visible) -> Show and Move
                    token.setVisible(true);
                    this.tweens.add({
                        targets: token,
                        x: node.x,
                        y: node.y,
                        duration: 300,
                        ease: 'Power2'
                    });
                } else {
                    // Node undefined (Position 0/Hidden) -> Hide Token
                    token.setVisible(false);
                }
            }
        });
    }

    private createPlayerToken(p: Player) {
        const container = this.add.container(0, 0).setDepth(100);
        const color = p.role === 'MR_X' ? 0x000000 : 0x0000FF; 
        const shape = this.add.rectangle(0, 0, 40, 40, color).setStrokeStyle(3, 0xffffff);
        const label = this.add.text(0, -30, p.role, { 
            fontSize: '14px', backgroundColor: '#000', color: '#fff', padding: { x: 4, y: 4 }
        }).setOrigin(0.5);
        container.add([shape, label]);
        this.playerTokens.set(p.id, container);
    }
}