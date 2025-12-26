import Phaser from 'phaser';
import mapData from '../../shared/mapData.json'; 
import { Player, Transport } from '../../shared/types';

export class GameScene extends Phaser.Scene {
    private playerTokens: Map<string, Phaser.GameObjects.Container> = new Map();
    private currentPlayers: Player[] = [];
    private myId: string = "";
    private activePopup: Phaser.GameObjects.Container | null = null; 
    private menuBlocker: Phaser.GameObjects.Rectangle | null = null; // New "Click Blocker"

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

        // 2. Draw Clickable Nodes
        Object.values(mapData.nodes).forEach((node: any) => {
            const circle = this.add.circle(node.x, node.y, 35, 0x000000, 0.0) // Invisible hit area
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
    }

    private destroyPopup() {
        if (this.activePopup) {
            this.activePopup.destroy();
            this.activePopup = null;
        }
        if (this.menuBlocker) {
            this.menuBlocker.destroy();
            this.menuBlocker = null;
        }
    }

    private handleNodeClick(targetNode: any) {
        this.destroyPopup(); // Close any existing menu

        if (!this.myId) return;
        const me = this.currentPlayers.find(p => p.id === this.myId);
        if (!me) return;

        // Validation: Must be connected to CURRENT position
        const currentNode = (mapData.nodes as any)[me.position];
        if (!currentNode) return;

        const validEdges = currentNode.edges.filter((e: any) => e.to === targetNode.id);
        if (validEdges.length === 0) return;

        this.showTransportMenu(targetNode.x, targetNode.y, targetNode.id, validEdges, me);
    }

    private showTransportMenu(x: number, y: number, targetId: number, edges: any[], me: Player) {
        // 1. Create a full-screen invisible blocker to catch clicks outside the menu
        // This fixes the "Stuck Menu" issue completely.
        this.menuBlocker = this.add.rectangle(
            this.cameras.main.scrollX + this.cameras.main.width / 2, // Center relative to camera
            this.cameras.main.scrollY + this.cameras.main.height / 2, 
            5000, 5000, 0x000000, 0.0
        )
        .setDepth(199) // Just below the menu
        .setInteractive();

        this.menuBlocker.on('pointerdown', () => {
            this.destroyPopup();
        });

        // 2. Create the Menu Container
        const container = this.add.container(x, y - 50).setDepth(200);
        const buttons: Phaser.GameObjects.GameObject[] = [];

        // --- Standard Buttons ---
        edges.forEach((edge, index) => {
            const btnY = index * 40 + 20;
            const color = this.getTransportColor(edge.type);
            
            const btn = this.add.rectangle(0, btnY, 120, 30, color)
                .setStrokeStyle(1, 0x000000)
                .setInteractive({ useHandCursor: true });
            
            const text = this.add.text(0, btnY, edge.type.toUpperCase(), {
                fontSize: '14px', color: '#000', fontStyle: 'bold'
            }).setOrigin(0.5).setResolution(4);

            btn.on('pointerdown', () => {
                this.game.events.emit('request_move', { 
                    toNode: targetId, 
                    transport: edge.type,
                    useBlackTicket: false 
                });
                this.destroyPopup();
            });

            buttons.push(btn, text);
        });

        // --- Black Ticket Button (Mr. X Only) ---
        // Robust Check: Handle 'black' OR 'water' (legacy) tickets
        const blackTickets = me.tickets.black ?? (me.tickets as any).water ?? 0;
        
        if (me.role === 'MR_X' && blackTickets > 0) {
            console.log("Mr X has black tickets:", blackTickets); // Debug log
            
            const btnY = edges.length * 40 + 20;
            
            const btn = this.add.rectangle(0, btnY, 120, 30, 0x222222)
                .setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true });
            
            const text = this.add.text(0, btnY, "BLACK TICKET", {
                fontSize: '12px', color: '#fff', fontStyle: 'bold'
            }).setOrigin(0.5);

            btn.on('pointerdown', () => {
                // Use the first valid physical edge, but flag it as Black Ticket
                this.game.events.emit('request_move', { 
                    toNode: targetId, 
                    transport: edges[0].type, 
                    useBlackTicket: true 
                });
                this.destroyPopup();
            });

            buttons.push(btn, text);
        }

        // --- Background ---
        const totalHeight = (buttons.length / 2) * 40 + 20;
        const bg = this.add.rectangle(0, totalHeight / 2 - 10, 140, totalHeight, 0xffffff, 0.95)
            .setStrokeStyle(2, 0x000000);
        
        // Add BG first so it is behind buttons
        container.add([bg, ...buttons]);
        this.activePopup = container;
    }

    public updateGameState(state: any) {
        this.currentPlayers = state.players as Player[];
        
        // 1. Create Tokens
        this.currentPlayers.forEach(p => {
            if (!this.playerTokens.has(p.id)) this.createPlayerToken(p);
        });

        // 2. Move Tokens
        this.currentPlayers.forEach(p => {
            const token = this.playerTokens.get(p.id);
            if (!token) return;

            if (p.role === 'DETECTIVE') {
                this.moveToken(token, p.position, 1.0);
            } 
            else if (p.role === 'MR_X') {
                // --- GHOST LOGIC ---
                if (p.position > 0) {
                    // We know the real position (Reveal Round OR We are Mr X)
                    this.moveToken(token, p.position, 1.0);
                } else {
                    // Hidden -> Check history for last reveal
                    const lastKnown = this.findLastKnownPosition(state.moveHistory);
                    
                    if (lastKnown > 0) {
                        // Move to last known (Ghost)
                        this.moveToken(token, lastKnown, 0.9); // 60% opacity
                        
                        // Optional: Tint it grey to indicate it's "old"
                        // (Requires accessing the circle child, simplified here)
                    } else {
                        // Completely hidden (Start of game)
                        token.setVisible(false);
                    }
                }
            }
        });
    }

    private findLastKnownPosition(history: any[]): number {
        if (!history || history.length === 0) return 0;
        // Search backwards
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].position) return history[i].position;
        }
        return 0; 
    }

    private moveToken(token: Phaser.GameObjects.Container, nodeId: number, alpha: number) {
        const node = (mapData.nodes as any)[nodeId];
        if (!node) return;

        token.setVisible(true);
        token.setAlpha(alpha);
        
        this.tweens.add({
            targets: token,
            x: node.x,
            y: node.y,
            duration: 400,
            ease: 'Power2'
        });
    }

    private createPlayerToken(p: Player) {
        const container = this.add.container(0, 0).setDepth(100);
        const color = p.role === 'MR_X' ? 0x000000 : 0x0000FF; 
        
        const circle = this.add.circle(0, 0, 15, color).setStrokeStyle(2, 0xffffff);
        const label = this.add.text(0, -25, p.role === 'MR_X' ? 'MR X' : 'DET', { 
            fontSize: '12px', backgroundColor: '#000', color: '#fff', padding: { x: 2, y: 2 }
        }).setOrigin(0.5);

        container.add([circle, label]);
        this.playerTokens.set(p.id, container);
    }

    private getTransportColor(type: string): number {
        switch (type) {
            case 'taxi': return 0xf6e05e; // Yellow
            case 'bus': return 0x4299e1; // Blue
            case 'underground': return 0xf56565; // Red
            case 'black': return 0x333333; // Black
            case 'water': return 0x333333; // Legacy Black
            default: return 0xcccccc;
        }
    }
}