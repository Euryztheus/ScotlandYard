import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { Network } from './Network';
import { GameState, Player, Transport } from '../../shared/types'; 

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

document.addEventListener('DOMContentLoaded', () => {
    // --- UI ELEMENTS ---
    const menu = document.getElementById('menu-overlay')!;
    const btnCreate = document.getElementById('btn-create')!;
    const btnJoin = document.getElementById('btn-join')!;
    const inputCode = document.getElementById('input-code') as HTMLInputElement;

    const gameUi = document.getElementById('game-ui')!;
    const lobbyDisplay = document.getElementById('lobby-code-display')!;
    const playerList = document.getElementById('player-list')!;
    const roundDisplay = document.getElementById('round-display')!;

    const lobbyScreen = document.getElementById('lobby-screen')!;
    const lobbyTitle = document.getElementById('lobby-code-title')!;
    const lobbyPlayerList = document.getElementById('lobby-player-list')!;
    const btnReady = document.getElementById('btn-ready')!;
    const btnStart = document.getElementById('btn-start')!;
    const btnClaimMrX = document.getElementById('btn-claim-mrx')!;

    // Settings Inputs
    const settingInfinite = document.getElementById('setting-infinite') as HTMLInputElement;
    const inputs = {
        detTaxi: document.getElementById('set-det-taxi') as HTMLInputElement,
        detBus: document.getElementById('set-det-bus') as HTMLInputElement,
        detUnd: document.getElementById('set-det-und') as HTMLInputElement,
        mrxTaxi: document.getElementById('set-mrx-taxi') as HTMLInputElement,
        mrxBus: document.getElementById('set-mrx-bus') as HTMLInputElement,
        mrxUnd: document.getElementById('set-mrx-und') as HTMLInputElement,
    };

    if (!menu || !lobbyScreen) {
        console.error("Critical UI elements missing! Check index.html");
        return;
    }

    let currentLobbyCode = "???";

    // --- HELPER: Display Tickets ---
    const formatTickets = (tickets: Record<Transport, number>) => {
        if (!tickets) return "";
        // Simple Icons: 🚕 🚌 🚇 ⛴️
        return `🚕${tickets.taxi} 🚌${tickets.bus} 🚇${tickets.underground} ⛴️${tickets.water}`;
    };

    // --- GAME STATE HANDLER ---
    const onGameStateUpdate = (data: any) => {
        let state: GameState = data.gameState || data;
        if (data.gameState) currentLobbyCode = data.lobbyCode;

        if (state.lobbyCode) {
            currentLobbyCode = state.lobbyCode;
        }

        const myId = network.getID();
        const me = state.players.find((p: Player) => p.id === myId);

        // --- PHASE 1: LOBBY ---
        if (state.phase === 'LOBBY') {
            menu.style.display = 'none';
            gameUi.style.display = 'none';
            lobbyScreen.style.display = 'block';

            lobbyTitle.innerText = currentLobbyCode;

            // Render Lobby Player List
            lobbyPlayerList.innerHTML = '';
            state.players.forEach((p: Player) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.padding = '5px';
                row.style.borderBottom = '1px solid #555';
                
                const isMe = p.id === myId ? " (YOU)" : "";
                const hostText = p.isHost ? ' [HOST]' : '';
                const roleIcon = p.role === 'MR_X' ? '🕵️' : '👮';

                row.innerText = `${roleIcon} ${p.role}${isMe}${hostText}`;
                
                const statusSpan = document.createElement('span');
                statusSpan.innerText = p.isReady ? "✅ READY" : "⏳ ...";
                statusSpan.style.color = p.isReady ? '#48bb78' : '#cbd5e0';
                
                row.appendChild(statusSpan);
                lobbyPlayerList.appendChild(row);
            });

            // Update Ready Button
            if (me) {
                btnReady.innerText = me.isReady ? "Ready!" : "Not Ready";
                btnReady.style.backgroundColor = me.isReady ? "#28a745" : "#555";
            }

            // --- SYNC SETTINGS ---
            // Update the input fields to match the server state
            if (state.settings) {
                // Only update inputs if I am NOT the host (to avoid overwriting while typing)
                // OR if it's the first load
                if (!me?.isHost || document.activeElement?.tagName !== 'INPUT') {
                    settingInfinite.checked = state.settings.infiniteTickets;
                    inputs.detTaxi.value = state.settings.detectiveStartTickets.taxi.toString();
                    inputs.detBus.value = state.settings.detectiveStartTickets.bus.toString();
                    inputs.detUnd.value = state.settings.detectiveStartTickets.underground.toString();
                    inputs.mrxTaxi.value = state.settings.mrXStartTickets.taxi.toString();
                    inputs.mrxBus.value = state.settings.mrXStartTickets.bus.toString();
                    inputs.mrxUnd.value = state.settings.mrXStartTickets.underground.toString();
                }
            }

            // Enable/Disable Controls based on Host status
            const isHost = me?.isHost || false;
            settingInfinite.disabled = !isHost;
            Object.values(inputs).forEach(input => input.disabled = !isHost);
            
            // Show Start Button if Host and Everyone Ready
            const allReady = state.players.length > 0 && state.players.every(p => p.isReady);
            btnStart.style.display = (isHost && allReady) ? 'block' : 'none';

        // --- PHASE 2: PLAYING ---
        } else if (state.phase === 'PLAYING') {
            menu.style.display = 'none';
            lobbyScreen.style.display = 'none';
            gameUi.style.display = 'block';

            lobbyDisplay.innerText = currentLobbyCode;
            roundDisplay.innerText = state.round.toString();

            // Render HUD Player List WITH TICKETS
            playerList.innerHTML = ''; 
            state.players.forEach((p: Player) => {
                const container = document.createElement('div');
                const color = p.role === 'MR_X' ? '#aaaaaa' : '#4299e1'; 
                
                const isTurn = state.turn === p.id;
                const isMe = p.id === myId ? " (YOU)" : "";
                
                container.style.color = color;
                container.style.padding = '8px';
                container.style.marginBottom = '5px';
                container.style.backgroundColor = isTurn ? 'rgba(255,255,255,0.1)' : 'transparent';
                container.style.borderLeft = isTurn ? `4px solid ${color}` : '4px solid transparent';
                
                // Name Line
                const nameDiv = document.createElement('div');
                nameDiv.style.fontWeight = 'bold';
                nameDiv.style.fontSize = '20px';
                nameDiv.innerText = `${p.role}${isMe} (Node ${p.position > 0 ? p.position : '???'})`;
                
                // Tickets Line
                const ticketDiv = document.createElement('div');
                ticketDiv.style.fontSize = '20px';
                ticketDiv.style.marginTop = '2px';
                ticketDiv.style.color = '#ddd';
                ticketDiv.innerText = formatTickets(p.tickets);

                container.appendChild(nameDiv);
                container.appendChild(ticketDiv);
                playerList.appendChild(container);
            });

            const scene = game.scene.getScene('GameScene') as GameScene;
            if (scene) {
                scene.setMyId(network.getID());
                scene.updateGameState(state);
            }
        }
    };

    const network = new Network(onGameStateUpdate);

    // --- EVENT LISTENERS ---
    btnCreate.onclick = () => network.createGame();
    btnJoin.onclick = () => network.joinGame(inputCode.value.toUpperCase());
    btnReady.onclick = () => network.toggleReady();
    btnStart.onclick = () => network.startGame();
    btnClaimMrX.onclick = () => network.claimMrX();

    // Settings Listener (Host Only)
    const handleSettingsChange = () => {
        network.updateSettings({
            infiniteTickets: settingInfinite.checked,
            detectiveStartTickets: {
                taxi: parseInt(inputs.detTaxi.value) || 0,
                bus: parseInt(inputs.detBus.value) || 0,
                underground: parseInt(inputs.detUnd.value) || 0,
                water: 0
            },
            mrXStartTickets: {
                taxi: parseInt(inputs.mrxTaxi.value) || 0,
                bus: parseInt(inputs.mrxBus.value) || 0,
                underground: parseInt(inputs.mrxUnd.value) || 0,
                water: 5 // Default water for Mr X
            }
        });
    };

    // Attach listeners to all inputs
    settingInfinite.onchange = handleSettingsChange;
    Object.values(inputs).forEach(input => input.onchange = handleSettingsChange);

    game.events.on('request_move', (data: any) => {
        network.sendMove(data.toNode, data.transport);
    });
});