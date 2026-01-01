# Scotland Yard 

**Credits:**
* Map Data: https://github.com/AlexElvers/scotland-yard-data
* Map Image: https://boardgamegeek.com/image/407682/scotland-yardd

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
# Runs on port 3000 (you only need to expose the client, server traffic is proxied)
```

### 3. Start the Client

```bash
cd client
npm run dev
# Runs on port 5173
```

### Future Features
**2x Ticket Mechanics:** Implement logic for Mr. X to use "2x tickets," enabling two consecutive moves within a single turn.
**Enhanced Game Over UI:** Replace intrusive browser alerts with a dedicated, styled result summary modal.
**Session Reconnection:** Implement `localStorage`-based session persistence. Allow clients to automatically rejoin their active seat and role upon page reload or reconnection.
**Spectator Mode:** Add a "Join as Spectator" lobby option, allowing users to observe real-time game state without move permissions.
**Turn Timer:** Enforce time limits on server-side turns; automatically execute a random valid move if the timer expires to prevent stalling.
**Simultaneous Detective Phase:** Decouple detective turns to allow all detectives to submit moves asynchronously during their collective phase, rather than sequentially.
**Multi-Agent Control:** Enable support for a single client to control multiple Detective characters from one interface/tab.
**Distinct Detective Visuals:** Assign and render unique colors for each detective token to improve board readability.
**Draggable HUD:** Make the player status overlay draggable to prevent it from permanently obscuring map sectors.
**Connection Visibility:** Improve rendering of adjacent nodes/edges to ensure available transport paths are visible even when a player token is occupying the node.
**Token Collision Handling:** Implement visual offsetting for nodes occupied by multiple players, rendering tokens side-by-side instead of stacking them.
**Map Selection:** Integrate the official board assets and add a lobby setting to toggle between different map visualizations.
**Visual Move History:** Enhance the UI to display a graphical log of Mr. X's moves, clearly indicating used tickets and revealed locations.
**AI Opponents:** Implement bot logic for AI-driven Detectives or Mr. X to support single-player practice modes.
**Reveal Status Context:** Visually indicate the "last revealed" location on Mr. X's own screen to help the player track public knowledge.
**Privacy Mode:** Add a "Hide Position" toggle for Mr. X's local client to prevent physical observers (shoulder surfers) from seeing the current location.
