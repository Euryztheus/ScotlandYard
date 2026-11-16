import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECONNECT_GRACE_MS } from '../../shared/src/constants.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

const reconnectGrace = Number(process.env.RECONNECT_GRACE_MS ?? RECONNECT_GRACE_MS);
const sweepInterval = Number(process.env.RECONNECT_SWEEP_MS ?? 10_000);

export const config = {
    port: Number(process.env.PORT ?? 3000),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    clientDist: process.env.CLIENT_DIST ?? path.resolve(here, '../../client/dist'),
    reconnectGraceMs:
        Number.isFinite(reconnectGrace) && reconnectGrace >= 1000
            ? reconnectGrace
            : RECONNECT_GRACE_MS,
    reconnectSweepMs:
        Number.isFinite(sweepInterval) && sweepInterval >= 200 ? sweepInterval : 10_000
} as const;
