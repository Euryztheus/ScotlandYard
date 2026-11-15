import type { Player } from '../../../../shared/src/types.ts';
import { detectiveColorCss } from '../../game/colors.ts';
import { element } from '../dom.ts';

export class PlayerList {
    readonly root = element('div', 'player-list');

    render(
        players: Player[],
        turn: string,
        myId: string,
        onFocus: (playerId: string) => void
    ): void {
        const detectives = players
            .filter(player => player.role === 'DETECTIVE')
            .sort((a, b) => a.id.localeCompare(b.id));

        this.root.replaceChildren();

        players.forEach(player => {
            const detectiveIndex = detectives.findIndex(candidate => candidate.id === player.id);
            const roleLabel =
                player.role === 'MR_X' ? 'MR.X' : `DET ${detectiveIndex + 1}`;
            const roleColor =
                player.role === 'DETECTIVE'
                    ? detectiveColorCss(player.id, players)
                    : '#ff5c7a';

            const row = element('div', 'player-row');
            row.classList.toggle('active', turn === player.id);
            row.addEventListener('click', () => onFocus(player.id));

            const top = element('div', 'player-row-top');

            const roleTag = element(
                'span',
                `role-tag ${player.role === 'MR_X' ? 'mrx' : 'detective'}`,
                roleLabel
            );
            roleTag.style.background = roleColor;

            const name = element(
                'span',
                'player-name',
                player.id === myId ? 'YOU' : 'PLAYER'
            );

            const nodeTag = element(
                'span',
                'node-tag',
                player.position > 0 ? `N${player.position}` : 'N???'
            );

            const tickets = element('div', 'player-tickets');
            tickets.innerHTML = this.formatTickets(player);

            top.append(roleTag, name, nodeTag);
            row.append(top, tickets);
            this.root.append(row);
        });
    }

    private formatTickets(player: Player): string {
        const tickets = player.tickets;
        let html = `
            <span class="ticket ticket-taxi">T ${tickets.taxi}</span>
            <span class="ticket ticket-bus">B ${tickets.bus}</span>
            <span class="ticket ticket-underground">U ${tickets.underground}</span>
        `;

        if (player.role === 'MR_X') {
            html += `<span class="ticket ticket-black">BLK ${tickets.black}</span>`;
            html += `<span class="double-count">2X ${player.doubleTickets}</span>`;
        }

        return html;
    }
}
