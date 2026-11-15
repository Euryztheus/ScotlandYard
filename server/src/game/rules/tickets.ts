import type { Player, TicketType } from '../../../../shared/src/types.ts';

export function canAfford(player: Player, type: TicketType): boolean {
    return player.tickets[type] > 0;
}

export function spendTicket(player: Player, type: TicketType): void {
    player.tickets[type] -= 1;
}

export function grantTicket(player: Player, type: TicketType): void {
    player.tickets[type] += 1;
}
