import { createServer } from 'node:http';
import { config } from './config.ts';
import { createApp } from './http/app.ts';
import { createSocketServer } from './realtime/io.ts';

const app = createApp();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

httpServer.on('error', error => {
    console.error('[server] HTTP server error', error);
    process.exit(1);
});

httpServer.listen(config.port, () => {
    console.log(`[server] listening on port ${config.port} (${config.nodeEnv})`);
});

let shuttingDown = false;

function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, shutting down`);

    io.close(() => {
        process.exit(0);
    });

    // Do not hang forever if a client keeps a connection open.
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Keep a malformed handler from taking every in-memory game down with it.
process.on('uncaughtException', error => {
    console.error('[server] uncaught exception', error);
});
process.on('unhandledRejection', reason => {
    console.error('[server] unhandled rejection', reason);
});
