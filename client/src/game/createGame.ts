import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.ts';

export function createPhaserGame(): Phaser.Game {
    return new Phaser.Game({
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'game-container',
        backgroundColor: '#222222',
        scene: [GameScene],
        scale: { mode: Phaser.Scale.RESIZE }
    });
}
