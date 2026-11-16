import { randomInt } from 'node:crypto';

const LOBBY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateLobbyCode(length = 5): string {
    let code = '';
    for (let index = 0; index < length; index += 1) {
        code += LOBBY_CODE_ALPHABET[randomInt(LOBBY_CODE_ALPHABET.length)];
    }
    return code;
}
