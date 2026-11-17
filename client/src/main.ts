import './styles/base.css';
import './styles/menu.css';
import './styles/lobby.css';
import './styles/hud.css';
import './styles/confirm.css';
import { GameClient } from './app/GameClient.ts';

const uiRoot = document.getElementById('ui-root');
if (!uiRoot) {
    throw new Error('Missing #ui-root element');
}

new GameClient(uiRoot);
