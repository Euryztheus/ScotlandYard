import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { Network } from './Network';
import { GameState } from '../../shared/types'; // Import types for safety

// 1. Setup Phaser
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#222222',
    scene: [GameScene],
    scale: { mode: Phaser.Scale.RESIZE }
};

const game = new Phaser.Game(config);

// 2. Setup Network & Menu Logic
document.addEventListener('DOMContentLoaded', () => {
    // Get all UI elements
    const menu = document.getElementById('menu-overlay');
    const btnCreate = document.getElementById('btn-create');
    const btnJoin = document.getElementById('btn-join');
    const inputCode = document.getElementById('input-code') as HTMLInputElement;

    // Get the new In-Game UI elements
    const gameUi = document.getElementById('game-ui');
    const lobbyDisplay = document.getElementById('lobby-code-display');
    const playerList = document.getElementById('player-list');
    const roundDisplay = document.getElementById('round-display');

    // Safety check: If elements are missing, stop execution to prevent crash
    if (!menu || !btnCreate || !btnJoin || !inputCode || !gameUi || !lobbyDisplay || !playerList || !roundDisplay) {
        console.error("Critical UI elements missing! Check index.html");
        return;
    }

    let currentLobbyCode = "???";

    // This function runs every time the server sends an update
    const onGameStateUpdate = (data: any) => {
        // 1. Handle the data format
        // 'data' might be just GameState, OR { lobbyCode, gameState }
        let state: GameState;

        if (data.gameState) {
            // It's the "Game Created" packet
            currentLobbyCode = data.lobbyCode;
            state = data.gameState;
        } else {
            // It's a standard update packet
            state = data;
        }

        // 2. Hide Menu / Show Game UI
        menu.style.display = 'none';
        gameUi.style.display = 'block';

        // 3. Update Text Info
        lobbyDisplay.innerText = currentLobbyCode;
        roundDisplay.innerText = state.round.toString();

        // 4. Update Player List
        playerList.innerHTML = ''; // Clear current list
        state.players.forEach((p: any) => {
            const div = document.createElement('div');
            // Gray for Mr. X, Blue for Detectives
            const color = p.role === 'MR_X' ? '#aaaaaa' : '#4299e1'; 
            div.style.color = color;
            div.style.marginBottom = '4px';
            div.style.fontWeight = 'bold';
            div.innerText = `${p.role} (Node ${p.position})`; 
            playerList.appendChild(div);
        });

        // 5. Update the Phaser Scene (The Map)
        const scene = game.scene.getScene('GameScene') as GameScene;
        if (scene) {
            scene.updateGameState(state);
        }
    };

    // Initialize Network
    const network = new Network(onGameStateUpdate);

    // Button Listeners
    btnCreate.onclick = () => {
        console.log("Creating game...");
        network.createGame();
    };

    btnJoin.onclick = () => {
        const code = inputCode.value.toUpperCase();
        console.log("Joining game:", code);
        network.joinGame(code);
    };

    // Listen for Move Requests from the Phaser Scene
    game.events.on('request_move', (data: any) => {
        console.log("Sending move to server:", data);
        network.sendMove(data.toNode, data.transport);
    });
});