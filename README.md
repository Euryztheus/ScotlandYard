# Scotland Yard 
credits:
map connection: https://github.com/AlexElvers/scotland-yard-data# \
map image: https://boardgamegeek.com/image/407682/scotland-yard

## 🛠 Setup & Run

### 1. Install Dependencies
```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Start the Server

```bash
cd server
npx tsx src/index.ts
# Runs on port 3000
```

### 3. Start the Client

```bash
cd client
npm run dev
# Runs on localhost:5173
```

### 4. Roadmap & Missing Features
**UI:** Fix the `game over` notifications from alert to a proper ui \
**Rejoining:** Save `socket.id` or a custom `sessionId` in `localStorage`. On connect, send this ID. If the server sees it in an active game, reconnect the user instead of making a new player. \
**Spectator Mode:** Add a button in the lobby "Join as Spectator". Spectators receive game updates but have no `player_move` permissions. \
**Turn Timer:** In `server/index.ts`, start a `setTimeout` when a turn begins. If it expires, pick a random move for the player. 
