import type { GameUserView, Player } from '../../../../shared/src/types.ts';
import { detectiveColorCss } from '../../game/colors.ts';
import { element } from '../dom.ts';

export class PlayerList {
    readonly root = element('div', 'player-list');

    render(
        players: Player[],
        users: GameUserView[],
        turn: string,
        ownerId: string,
        onFocus: (playerId: string) => void
    ): void {
        const usersById = new Map(users.map(user => [user.id, user]));
        this.root.replaceChildren();

        players.forEach(player => {
            const user = usersById.get(player.ownerId);
            const roleLabel = player.role === 'MR_X' ? 'MR.X' : `DET ${player.seat}`;
            const roleColor =
                player.role === 'DETECTIVE' ? detectiveColorCss(player.seat) : '#ff5c7a';

            const row = element('div', 'player-row');
            row.classList.toggle('active', turn === player.id);
            row.classList.toggle('offline', Boolean(user && !user.connected));
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
                player.ownerId === ownerId ? 'YOU' : `P${user?.number ?? '?'}`
            );

            if (user && !user.connected) {
                name.append(element('span', 'offline-tag', 'OFFLINE'));
            }

            const nodeTag = element(
                'span',
                'node-tag',
                player.position > 0 ? `N${player.position}` : 'N???'
            );

            const tickets = element('div', 'player-tickets');
            tickets.append(
                element('span', 'ticket ticket-taxi', `T ${player.tickets.taxi}`),
                element('span', 'ticket ticket-bus', `B ${player.tickets.bus}`),
                element(
                    'span',
                    'ticket ticket-underground',
                    `U ${player.tickets.underground}`
                )
            );

            if (player.role === 'MR_X') {
                tickets.append(
                    element('span', 'ticket ticket-black', `BLK ${player.tickets.black}`),
                    element('span', 'double-count', `2X ${player.doubleTickets}`)
                );
            }

            top.append(roleTag, name, nodeTag);
            row.append(top, tickets);
            this.root.append(row);
        });
    }
}
