import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
    port: Number(process.env.PORT ?? 3000),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    clientDist: process.env.CLIENT_DIST ?? path.resolve(here, '../../client/dist')
} as const;

export const isProduction = config.nodeEnv === 'production';
