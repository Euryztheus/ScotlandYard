import { createServer } from 'node:http';
import { config } from './config.ts';
import { createApp } from './http/app.ts';
import { createSocketServer } from './realtime/io.ts';

const app = createApp();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

httpServer.listen(config.port, () => {
    console.log(`[server] listening on port ${config.port} (${config.nodeEnv})`);
});

let shuttingDown = false;

function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, shutting down`);

    io.close(() => {
        httpServer.close(() => {
            process.exit(0);
        });
    });

    // Do not hang forever if a client keeps a connection open.
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
