# Scotland Yard

A real-time multiplayer implementation of the Scotland Yard board game.

**Credits:**

- Map Data: https://github.com/AlexElvers/scotland-yard-data
- Map Image: https://boardgamegeek.com/image/407682/scotland-yardd

## Stack

- **client** — Vite + TypeScript + Phaser, vanilla DOM for the HUD
- **server** — Express + Socket.IO, in-memory game state
- **shared** — domain types, Socket.IO event contracts, map data and helpers

The server is a modular monolith. The game engine (`server/src/game/rules`) is
pure TypeScript and can be tested without sockets. The HTTP/Socket.IO layers are
adapters around it.

## Development

Install dependencies once from the repository root:

```bash
npm install
```

Start the server:

```bash
npm run dev:server
# http://localhost:3000
```

Start the client in another terminal:

```bash
npm run dev:client
# http://localhost:5173
```

Vite proxies `/socket.io` to the server, so the client always connects
same-origin.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Production with Docker

The image builds the client and server, and the server serves both the static
client and Socket.IO on one port. This keeps the deployment to a single
container and avoids CORS/proxy configuration inside the app.

```bash
docker compose up -d --build
```

The container listens on `127.0.0.1:3000`. Put your existing nginx in front of it
for TLS:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl;
    server_name yard.example.com;

    # ssl_certificate / ssl_certificate_key ...

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 3600s;
    }
}
```

`restart: unless-stopped` restarts the container after a crash and after a VPS
reboot. Make sure the Docker daemon is enabled on boot:

```bash
sudo systemctl enable --now docker
```

Useful commands:

```bash
docker compose logs -f
docker compose up -d --build   # rebuild and restart after a code change
docker compose restart
```

The server exposes `GET /healthz` for Docker and uptime checks.

### State and restarts

Game state is currently held in memory. Restarting the container, deploying, or
rebooting the VPS ends active games. Reconnection and persistence are follow-up
features; they are intentionally out of scope for the current refactor.

## Project layout

```text
shared/src/
  types.ts        domain model
  events.ts       typed Socket.IO contracts
  constants.ts    defaults and reveal rounds
  map.ts          typed map access + move helpers
  mapData.json    generated map data

server/src/
  index.ts        bootstrap + graceful shutdown
  config.ts       environment configuration
  http/app.ts     Express, static client, /healthz
  realtime/       Socket.IO setup, handlers, broadcasts
  game/           store, factory, engine, rules, state projection
  util/           lobby code generation

client/src/
  main.ts         bootstrap
  app/            GameClient coordinator
  network/        typed socket wrapper
  ui/             screens and components
  game/           Phaser scene, map, tokens, transport menu, camera
  styles/         CSS
```

## Map tooling

The root-level Python scripts generate `shared/src/mapData.json` from
`stations.txt`, `connections.txt` and `node_positions.json`.
