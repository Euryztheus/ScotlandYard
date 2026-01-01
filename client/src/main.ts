import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { Network } from './Network';
import { GameState, Player, Transport } from '../../shared/types'; 
import { REVEAL_ROUNDS } from '../../shared/constants';

// Same Palette as GameScene (Hex Strings)
const DETECTIVE_COLORS_CSS = [
    '#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'
];

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

// --- DRAGGABLE HELPER ---
function makeDraggable(element: HTMLElement, handle?: HTMLElement) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const dragHandle = handle || element;
    
    dragHandle.style.cursor = 'move';

    dragHandle.onmousedown = dragMouseDown;

    function dragMouseDown(e: MouseEvent) {
        e.preventDefault();
        // Get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // Call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e: MouseEvent) {
        e.preventDefault();
        // Calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        // set the element's new position:
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        
        // Important: Remove 'right' positioning if it exists so 'left' takes over
        element.style.right = 'auto';
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- UI ELEMENTS ---
    const getEl = (id: string) => document.getElementById(id);

    const menu = getEl('menu-overlay');
    const btnCreate = getEl('btn-create');
    const btnJoin = getEl('btn-join');
    const inputCode = getEl('input-code') as HTMLInputElement;

    // Game HUD
    const gameUi = getEl('game-ui');
    const lobbyDisplay = getEl('lobby-code-display');
    const playerList = getEl('player-list');
    const roundDisplay = getEl('round-display');
    
    // Make Game HUD Draggable
    if (gameUi) {
        // Try to find the h2 header to use as a handle, otherwise use the whole box
        const header = gameUi.querySelector('h2') as HTMLElement;
        makeDraggable(gameUi, header || gameUi);
    }
    
    // Mr X Controls
    const mrxActions = getEl('mrx-actions');
    const btnUse2x = getEl('btn-use-2x');

    // Lobby Screen
    const lobbyScreen = getEl('lobby-screen');
    const lobbyTitle = getEl('lobby-code-title');
    const lobbyPlayerList = getEl('lobby-player-list');
    const btnReady = getEl('btn-ready');
    const btnStart = getEl('btn-start');
    const btnClaimMrX = getEl('btn-claim-mrx');

    // Settings
    const settingInfinite = getEl('setting-infinite') as HTMLInputElement;
    const inputs = {
        detTaxi: getEl('set-det-taxi') as HTMLInputElement,
        detBus: getEl('set-det-bus') as HTMLInputElement,
        detUnd: getEl('set-det-und') as HTMLInputElement,
        mrxTaxi: getEl('set-mrx-taxi') as HTMLInputElement,
        mrxBus: getEl('set-mrx-bus') as HTMLInputElement,
        mrxUnd: getEl('set-mrx-und') as HTMLInputElement,
        mrxBlack: getEl('set-mrx-black') as HTMLInputElement,
        mrx2x: getEl('set-mrx-2x') as HTMLInputElement, 
    };

    // Tracker Elements
    const trackerContainer = getEl('mrx-tracker');
    const trackerHistory = getEl('tracker-history');
    const trackerIcon = getEl('tracker-icon');
    const nextRevealDisplay = getEl('next-reveal-round');
    const trackerSummary = getEl('tracker-summary');

    if (!menu || !lobbyScreen || !gameUi || !trackerContainer) {
        console.error("UI Elements missing! Check index.html");
        return; 
    }

    let currentLobbyCode = "???";
    let isDoubleMoveActive = false; 

    // --- TRACKER TOGGLE LOGIC ---
    if (trackerContainer && trackerHistory && trackerIcon) {
        trackerContainer.onclick = () => {
            const isHidden = trackerHistory.style.display === 'none';
            trackerHistory.style.display = isHidden ? 'block' : 'none';
            trackerIcon.innerText = isHidden ? '▲' : '▼';
        };
    }

    // --- 2x BUTTON LOGIC ---
    if (btnUse2x) {
        btnUse2x.onclick = () => {
            isDoubleMoveActive = !isDoubleMoveActive;
            update2xButtonVisuals();
        };
    }

    const update2xButtonVisuals = () => {
        if (!btnUse2x) return;
        if (isDoubleMoveActive) {
            btnUse2x.classList.add('active');
            btnUse2x.innerText = "CANCEL 2x";
        } else {
            btnUse2x.classList.remove('active');
            btnUse2x.innerText = "USE 2x TICKET";
        }
    };

    // --- HELPER: Display Tickets ---
    const formatTickets = (player: Player) => {
        const t = player.tickets;
        let html = `🚕${t.taxi} 🚌${t.bus} 🚇${t.underground}`;
        
        if (player.role === 'MR_X') {
            html += ` 🏴${t.black}`;
            html += ` <span style="color: #d69e2e; font-weight: bold; margin-left: 5px;">2x: ${player.doubleTickets}</span>`;
        }
        return html;
    };

    // --- GAME STATE HANDLER ---
    const onGameStateUpdate = (data: any) => {
        let state: GameState = data.gameState || data;
        if (state.lobbyCode) currentLobbyCode = state.lobbyCode;

        const myId = network.getID();
        const me = state.players.find((p: Player) => p.id === myId);

        // --- PHASE 1: LOBBY ---
        if (state.phase === 'LOBBY') {
            menu!.style.display = 'none';
            gameUi!.style.display = 'none';
            lobbyScreen!.style.display = 'block';

            if (lobbyTitle) lobbyTitle.innerText = currentLobbyCode;

            if (lobbyPlayerList) {
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
            }

            if (me && btnReady) {
                btnReady.innerText = me.isReady ? "Ready!" : "Not Ready";
                btnReady.style.backgroundColor = me.isReady ? "#28a745" : "#555";
            }

            // Sync Settings (Host Logic)
            if (state.settings && settingInfinite) {
                if (!me?.isHost || document.activeElement?.tagName !== 'INPUT') {
                    settingInfinite.checked = state.settings.infiniteTickets;
                    if(inputs.detTaxi) inputs.detTaxi.value = state.settings.detectiveStartTickets.taxi.toString();
                    if(inputs.detBus) inputs.detBus.value = state.settings.detectiveStartTickets.bus.toString();
                    if(inputs.detUnd) inputs.detUnd.value = state.settings.detectiveStartTickets.underground.toString();
                    if(inputs.mrxTaxi) inputs.mrxTaxi.value = state.settings.mrXStartTickets.taxi.toString();
                    if(inputs.mrxBus) inputs.mrxBus.value = state.settings.mrXStartTickets.bus.toString();
                    if(inputs.mrxUnd) inputs.mrxUnd.value = state.settings.mrXStartTickets.underground.toString();
                    if(inputs.mrxBlack) inputs.mrxBlack.value = (state.settings.mrXStartTickets.black ?? 0).toString();
                    if(inputs.mrx2x) inputs.mrx2x.value = (state.settings.mrXDoubleTickets ?? 2).toString();
                }
            }
            
            const isHost = me?.isHost || false;
            if(settingInfinite) settingInfinite.disabled = !isHost;
            Object.values(inputs).forEach(input => { if(input) input.disabled = !isHost; });
            
            const allReady = state.players.length > 0 && state.players.every(p => p.isReady);
            if (btnStart) btnStart.style.display = (isHost && allReady) ? 'block' : 'none';

        // --- PHASE 2: PLAYING ---
        } else if (state.phase === 'PLAYING') {
            menu!.style.display = 'none';
            lobbyScreen!.style.display = 'none';
            gameUi!.style.display = 'block';

            if(lobbyDisplay) lobbyDisplay.innerText = currentLobbyCode;
            if(roundDisplay) roundDisplay.innerText = state.round.toString();

            // Render Player List
            if (playerList) {
                playerList.innerHTML = '';
                
                // Sort detectives for consistent coloring
                const detectives = state.players
                    .filter(pl => pl.role === 'DETECTIVE')
                    .sort((a, b) => a.id.localeCompare(b.id));

                state.players.forEach((p: Player) => {
                    const container = document.createElement('div');
                    
                    // Determine Color
                    let color = '#aaaaaa'; // Default Grey (Mr X)
                    if (p.role === 'DETECTIVE') {
                        const idx = detectives.findIndex(d => d.id === p.id);
                        if (idx !== -1) {
                            color = DETECTIVE_COLORS_CSS[idx % DETECTIVE_COLORS_CSS.length];
                        }
                    }

                    const isTurn = state.turn === p.id;
                    const isMe = p.id === myId ? " (YOU)" : "";

                    container.style.color = color;
                    container.style.padding = '8px';
                    container.style.marginBottom = '5px';
                    container.style.backgroundColor = isTurn ? 'rgba(255,255,255,0.1)' : 'transparent';
                    // Use the player's color for the border indicator
                    container.style.borderLeft = isTurn ? `4px solid ${color}` : '4px solid transparent';
                    
                    const nameDiv = document.createElement('div');
                    nameDiv.style.fontWeight = 'bold';
                    nameDiv.innerText = `${p.role}${isMe} (Node ${p.position > 0 ? p.position : '???'})`;
                    
                    const ticketDiv = document.createElement('div');
                    ticketDiv.style.fontSize = '12px';
                    ticketDiv.style.marginTop = '2px';
                    ticketDiv.style.color = '#ddd';
                    ticketDiv.innerHTML = formatTickets(p);

                    container.appendChild(nameDiv);
                    container.appendChild(ticketDiv);
                    playerList.appendChild(container);
                });
            }

            // Show/Hide 2x Button
            if (mrxActions && me?.role === 'MR_X') {
                mrxActions.style.display = (state.turn === myId && !state.pendingDoubleMove) ? 'block' : 'none';
                if(btnUse2x) btnUse2x.disabled = (me.doubleTickets <= 0);
            } else if (mrxActions) {
                mrxActions.style.display = 'none';
            }

            if (state.pendingDoubleMove && me?.role === 'MR_X') {
                if (isDoubleMoveActive) {
                    isDoubleMoveActive = false;
                    update2xButtonVisuals();
                }
            }

            // --- MR X TRACKER UPDATE ---
            if (trackerHistory && nextRevealDisplay && trackerSummary) {
                const nextReveal = REVEAL_ROUNDS.find(r => r > state.round) || "END";
                nextRevealDisplay.innerText = nextReveal.toString();
                trackerSummary.innerText = `Round ${state.round}`;

                trackerHistory.innerHTML = '';
                if (state.moveHistory) {
                    state.moveHistory.forEach((move: any) => {
                        const row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.alignItems = 'center';
                        row.style.marginBottom = '4px';
                        row.style.fontSize = '12px';
                        
                        const roundSpan = document.createElement('span');
                        roundSpan.innerText = `${move.round}.`;
                        roundSpan.style.width = '25px';
                        roundSpan.style.color = '#888';

                        const badge = document.createElement('span');
                        badge.style.padding = '2px 6px';
                        badge.style.borderRadius = '4px';
                        badge.style.color = '#000';
                        badge.style.fontWeight = 'bold';
                        badge.style.marginRight = '8px';
                        badge.style.minWidth = '60px';
                        badge.style.textAlign = 'center';
                        
                        if (move.transport === 'taxi') { badge.style.background = '#f6e05e'; badge.innerText = 'TAXI'; }
                        else if (move.transport === 'bus') { badge.style.background = '#4299e1'; badge.innerText = 'BUS'; }
                        else if (move.transport === 'underground') { badge.style.background = '#f56565'; badge.innerText = 'UND'; }
                        else { badge.style.background = '#000'; badge.style.color = '#fff'; badge.innerText = 'BLACK'; }

                        const posSpan = document.createElement('span');
                        if (move.position) {
                            posSpan.innerText = `at Node ${move.position}`;
                            posSpan.style.color = '#f6e05e';
                            posSpan.style.fontWeight = 'bold';
                        } else {
                            posSpan.innerText = '???';
                            posSpan.style.color = '#555';
                        }
                        
                        if (move.isDoubleMove) {
                             const doubleTag = document.createElement('span');
                             doubleTag.innerText = ' (2x)';
                             doubleTag.style.color = '#d69e2e';
                             doubleTag.style.marginLeft = '5px';
                             posSpan.appendChild(doubleTag);
                        }

                        if (REVEAL_ROUNDS.includes(move.round)) {
                            row.style.borderLeft = '2px solid #f6e05e';
                            row.style.paddingLeft = '5px';
                        }

                        row.appendChild(roundSpan);
                        row.appendChild(badge);
                        row.appendChild(posSpan);
                        trackerHistory.appendChild(row);
                    });
                    trackerHistory.scrollTop = trackerHistory.scrollHeight;
                }
            }

            const scene = game.scene.getScene('GameScene') as GameScene;
            if (scene) {
                scene.setMyId(network.getID());
                scene.updateGameState(state);
            }
        }
    };
    const onGameOver = (data: { winner: string, reason: string }) => {
        setTimeout(() => {
            alert(`GAME OVER!\nWinner: ${data.winner}\nReason: ${data.reason}`);
            window.location.reload();
        }, 100);
    };
    
    const network = new Network(onGameStateUpdate, onGameOver);

    if(btnCreate) btnCreate.onclick = () => network.createGame();
    if(btnJoin) btnJoin.onclick = () => network.joinGame(inputCode.value.toUpperCase());
    if(btnReady) btnReady.onclick = () => network.toggleReady();
    if(btnStart) btnStart.onclick = () => network.startGame();
    if(btnClaimMrX) btnClaimMrX.onclick = () => network.claimMrX();

    const handleSettingsChange = () => {
        network.updateSettings({
            infiniteTickets: settingInfinite.checked,
            detectiveStartTickets: {
                taxi: parseInt(inputs.detTaxi.value) || 0,
                bus: parseInt(inputs.detBus.value) || 0,
                underground: parseInt(inputs.detUnd.value) || 0,
                black: 0
            },
            mrXStartTickets: {
                taxi: parseInt(inputs.mrxTaxi.value) || 0,
                bus: parseInt(inputs.mrxBus.value) || 0,
                underground: parseInt(inputs.mrxUnd.value) || 0,
                black: parseInt(inputs.mrxBlack.value) || 0 
            },
            mrXDoubleTickets: parseInt(inputs.mrx2x.value) || 0 
        });
    };

    if(settingInfinite) settingInfinite.onchange = handleSettingsChange;
    Object.values(inputs).forEach(input => { if(input) input.onchange = handleSettingsChange; });

    game.events.on('request_move', (data: any) => {
        network.sendMove(data.toNode, data.transport, data.useBlackTicket, isDoubleMoveActive);
        
        if (isDoubleMoveActive) {
            isDoubleMoveActive = false;
            update2xButtonVisuals();
        }
    });
});