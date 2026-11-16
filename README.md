# Scotland Yard

A real-time multiplayer implementation of the Scotland Yard board game.

Two players can play as Mr. X and a team of up to five detectives, or one
player can control several detective pawns from a single tab. Seats are held
for five minutes after a disconnect, so a reload or a closed tab can reclaim
the same game.

**Credits:**

- Map Data: https://github.com/AlexElvers/scotland-yard-data
- Map Image: https://boardgamegeek.com/image/407682/scotland-yardd

## Features

- **Multi-seat detectives:** one user can add up to five detective pawns; each
  seat keeps its own position and tickets. A typical 1-v-4 game is one Mr. X
  plus four detectives controlled from one tab.
- **Reconnects:** the browser stores an opaque client id and the last lobby
  code in `localStorage`. Reloading or reopening the tab reattaches to the
  same seats. Disconnected seats are held for five minutes; after that they are
  removed.
- **Session takeover:** opening the same game in another tab takes over the
  user and tells the old tab that the session was replaced. Use one tab per
  player; use an incognito window or another browser if two people share a
  machine.
- **Validated realtime boundary:** malformed moves, injected settings and
  invalid lobby codes are rejected before they reach the game engine.
- **Hidden information:** detective clients receive Mr. X's position as `0`;
  the server projects each user's state separately.

## Stack

- **client** — Vite + TypeScript + Phaser, vanilla DOM for the HUD
- **server** — Express + Socket.IO, in-memory game state
- **shared** — domain types, Socket.IO event contracts, map data and helpers

The server is a modular monolith. The game engine (`server/src/game/rules`) is
pure TypeScript and can be tested without sockets. The HTTP/Socket.IO layers are
adapters around it.

## Development

Install dependencies once from the repository root (Node 24+):

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
npm run lint
npm test
npm run build
```

The tests cover the game rules, turn/round handling, multi-seat setup,
projection of hidden state, socket payload validation, rate limiting and the
disconnect lifecycle.

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

Game state is held in memory. A full server/container restart still ends active
games; reconnection only covers a browser tab closing, a reload, or a short
network interruption.

On disconnect, a user's seats stay in the game and are marked offline. The
default grace period is **five minutes**. Reconnecting restores the same seats
and, when a full round has been played, the same tickets. If the grace period
expires:

- Mr. X disappears in the lobby: the lobby waits for a new user, who joins as
  Mr. X.
- Mr. X disappears during play: the detectives win by forfeit.
- All detectives disappear: Mr. X wins by forfeit.
- The host disappears: the host role moves to a connected user.

The grace and sweep intervals can be overridden for local testing:

```bash
RECONNECT_GRACE_MS=1000 RECONNECT_SWEEP_MS=250 npm run dev:server
```

### Multi-seat rules

One user can control several detectives. In the lobby:

- Mr. X is always one seat.
- A non-Mr. X user starts with one detective and can use **ADD DETECTIVE** /
  **REMOVE DETECTIVE** to control up to five.
- **READY** toggles all of that user's seats.
- Claiming Mr. X is only allowed while the requester and the current Mr. X each
  control exactly one seat; roles and positions are swapped.

Detective seats act in seat order (DET 1, DET 2, …), not in arbitrary order.
A double move is two moves in the same round and is logged twice; on a reveal
round only the intermediate position of the first leg is shown, matching the
board game rule. Mr. X starts with five black tickets, and the game ends after
the detectives' final move in round 24. Starting stations are spaced so that
Mr. X cannot be caught in the first round.

Detectives (and Mr. X) cannot move onto a station occupied by another visible
pawn. A detective may move onto Mr. X's station to capture him. Mr. X may not
move onto a detective; if every possible move is blocked or unaffordable, the
detectives win.

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
  realtime/       Socket.IO setup, session attach/reconnect, handlers, broadcasts
  realtime/lifecycle.ts  reconnect grace + user/seat removal
  realtime/validation.ts move/settings payload validation
  realtime/rateLimit.ts  per-socket action throttling
  game/           store, session, factory, engine, rules, state projection
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
