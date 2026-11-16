import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import { config } from '../config.ts';

export function createApp(): Express {
    const app = express();
    app.disable('x-powered-by');

    app.get('/healthz', (_req: Request, res: Response) => {
        res.json({ status: 'ok' });
    });

    if (fs.existsSync(config.clientDist)) {
        app.use(express.static(config.clientDist));

        // SPA fallback for client-side routes. Assets with an extension are
        // allowed to 404 instead of silently returning HTML.
        app.use((req: Request, res: Response, next: NextFunction) => {
            if (
                req.method !== 'GET' ||
                req.path.startsWith('/socket.io') ||
                path.extname(req.path)
            ) {
                return next();
            }
            res.sendFile(path.join(config.clientDist, 'index.html'));
        });
    }

    return app;
}
