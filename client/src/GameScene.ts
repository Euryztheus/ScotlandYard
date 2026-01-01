import Phaser from 'phaser';
import mapData from '../../shared/mapData.json'; 
import { Player } from '../../shared/types';

const DETECTIVE_COLORS = [
    0xEF4444, 0x10B981, 0x3B82F6, 0xF59E0B, 0x8B5CF6, 0xEC4899
];

export class GameScene extends Phaser.Scene {
    private playerTokens: Map<string, Phaser.GameObjects.Container> = new Map();
    private currentPlayers: Player[] = [];
    private myId: string = "";
    private activePopup: Phaser.GameObjects.Container | null = null; 
    private menuBlocker: Phaser.GameObjects.Rectangle | null = null; 
    
    // --- VISIBILITY FLAGS ---
    private globalVisibility: boolean = true;
    private lastState: any = null;

    constructor() {
        super('GameScene');
    }

    public setMyId(id: string) {
        this.myId = id;
    }
    
    public setPlayersVisible(visible: boolean) {
        this.globalVisibility = visible;
        if (this.lastState) {
            this.updateGameState(this.lastState);
        }
    }

    // --- NEW FOCUS METHOD ---
    public focusOnPlayer(playerId: string) {
        const player = this.currentPlayers.find(p => p.id === playerId);
        if (!player) return;

        let targetId = player.position;

        // Special Logic for Mr. X
        if (player.role === 'MR_X') {
            // Use last known position instead of current (which might be 0/Hidden)
            // Note: If Mr X is the local player, player.position IS the real position,
            // but for observers/detectives it might be 0.
            if (targetId === 0 && this.lastState) {
                targetId = this.findLastKnownPosition(this.lastState.moveHistory);
            }
        }

        // If still 0 (Hidden and no reveals yet), do nothing
        if (targetId <= 0) return;

        const node = (mapData.nodes as any)[targetId];
        if (node) {
            this.cameras.main.pan(node.x, node.y, 800, 'Power2');
            this.cameras.main.zoomTo(1.5, 800, 'Power2');
        }
    }

    preload() {
        this.load.image('map-bg', '/map.jpeg'); 
    }

    create() {
        this.add.image(0, 0, 'map-bg').setOrigin(0).setDepth(0);
        this.cameras.main.setBounds(0, 0, 2849, 2235);

        Object.values(mapData.nodes).forEach((node: any) => {
            const circle = this.add.circle(node.x, node.y, 35, 0x000000, 0.0) 
                .setDepth(1)
                .setInteractive({ useHandCursor: true });

            circle.on('pointerdown', () => {
                this.handleNodeClick(node);
            });
        });

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
        this.destroyPopup(); 

        if (!this.myId) return;
        const me = this.currentPlayers.find(p => p.id === this.myId);
        if (!me) return;

        const currentNode = (mapData.nodes as any)[me.position];
        if (!currentNode) return;

        const validEdges = currentNode.edges.filter((e: any) => e.to === targetNode.id);
        if (validEdges.length === 0) return;

        this.showTransportMenu(targetNode.x, targetNode.y, targetNode.id, validEdges, me);
    }

    private showTransportMenu(x: number, y: number, targetId: number, edges: any[], me: Player) {
        this.menuBlocker = this.add.rectangle(
            this.cameras.main.scrollX + this.cameras.main.width / 2, 
            this.cameras.main.scrollY + this.cameras.main.height / 2, 
            5000, 5000, 0x000000, 0.0
        ).setDepth(199).setInteractive();

        this.menuBlocker.on('pointerdown', () => {
            this.destroyPopup();
        });

        const container = this.add.container(x, y - 50).setDepth(200);
        const buttons: Phaser.GameObjects.GameObject[] = [];

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

        const blackTickets = me.tickets.black ?? (me.tickets as any).water ?? 0;
        
        if (me.role === 'MR_X' && blackTickets > 0) {
            const btnY = edges.length * 40 + 20;
            const btn = this.add.rectangle(0, btnY, 120, 30, 0x222222)
                .setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true });
            
            const text = this.add.text(0, btnY, "BLACK TICKET", {
                fontSize: '12px', color: '#fff', fontStyle: 'bold'
            }).setOrigin(0.5);

            btn.on('pointerdown', () => {
                this.game.events.emit('request_move', { 
                    toNode: targetId, 
                    transport: edges[0].type, 
                    useBlackTicket: true 
                });
                this.destroyPopup();
            });

            buttons.push(btn, text);
        }

        const totalHeight = (buttons.length / 2) * 40 + 20;
        const bg = this.add.rectangle(0, totalHeight / 2 - 10, 140, totalHeight, 0xffffff, 0.95)
            .setStrokeStyle(2, 0x000000);
        
        container.add([bg, ...buttons]);
        this.activePopup = container;
    }

    public updateGameState(state: any) {
        this.lastState = state; 
        this.currentPlayers = state.players as Player[];
        
        this.currentPlayers.forEach(p => {
            if (!this.playerTokens.has(p.id)) this.createPlayerToken(p);
        });

        this.currentPlayers.forEach(p => {
            const token = this.playerTokens.get(p.id);
            if (!token) return;

            if (!this.globalVisibility) {
                token.setVisible(false);
                return;
            }

            if (p.role === 'DETECTIVE') {
                this.moveToken(token, p.position, 1.0);
            } 
            else if (p.role === 'MR_X') {
                if (p.position > 0) {
                    this.moveToken(token, p.position, 1.0);
                } else {
                    const lastKnown = this.findLastKnownPosition(state.moveHistory);
                    if (lastKnown > 0) {
                        this.moveToken(token, lastKnown, 0.9); 
                    } else {
                        token.setVisible(false);
                    }
                }
            }
        });
    }

    private findLastKnownPosition(history: any[]): number {
        if (!history || history.length === 0) return 0;
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
        
        let color = 0x000000; 
        
        if (p.role === 'DETECTIVE') {
            const detectives = this.currentPlayers
                .filter(pl => pl.role === 'DETECTIVE')
                .sort((a, b) => a.id.localeCompare(b.id)); 
            
            const index = detectives.findIndex(pl => pl.id === p.id);
            if (index !== -1) {
                color = DETECTIVE_COLORS[index % DETECTIVE_COLORS.length];
            }
        }
        
        const circle = this.add.circle(0, 0, 15, color).setStrokeStyle(2, 0xffffff);
        container.add([circle]);
        this.playerTokens.set(p.id, container);
    }

    private getTransportColor(type: string): number {
        switch (type) {
            case 'taxi': return 0xf6e05e; 
            case 'bus': return 0x4299e1; 
            case 'underground': return 0xf56565; 
            case 'black': return 0x333333; 
            case 'water': return 0x333333; 
            default: return 0xcccccc;
        }
    }
}