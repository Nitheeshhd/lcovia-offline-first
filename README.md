 Alcovia Offline-First

An offline-first study app for grades 6-12 with focus sessions, syllabus tracking, and real-time sync across multiple devices.

## Live Demo

- **Frontend:** https://lcovia-offline-first.vercel.app/
- **Backend:** https://lcovia-offline-first.onrender.com
- **GitHub:** https://github.com/Nitheeshhd/lcovia-offline-first

## Stack

- **Frontend:** React Native (Expo Web), IndexedDB
- **Backend:** Express, TypeScript, SQLite
- **Automation:** n8n Cloud
- **Sync:** Custom operation-based sync with Lamport clocks

## How to Run Locally

### 1. Clone the repo
```bash
git clone https://github.com/Nitheeshhd/lcovia-offline-first.git
cd lcovia-offline-first
```

### 2. Start the backend
```bash
cd server
npm install
npm run dev
```
Server runs on `http://localhost:3001`

### 3. Start the frontend
```bash
cd client
npx expo start --web
```
App runs on `http://localhost:8082`

### 4. Simulate two devices
Open two browser tabs:
- Tab 1 = Device A (default)
- Tab 2 = Device B (change DEVICE_ID to 'device-B' in screens)

## How to Demo the Sync

1. Open Dev Panel tab
2. Click "Go Offline" on Device A
3. Go to Tasks tab — change a task status
4. Go back to Dev Panel — Server state unchanged
5. Click "Go Online"
6. Click "Refresh All States"
7. Server and Device A show same state ✅

## How to Demo Conflict Resolution

1. Click "Simulate Conflict" in Dev Panel
2. Device A sets task → DONE (lamport: 100)
3. Device B sets same task → IN_PROGRESS (lamport: 80)
4. After sync → DONE wins (higher lamport) ✅

## How to Demo Idempotency

1. Click "Simulate Duplicate Sync" in Dev Panel
2. Same operation sent twice
3. Server applies it only once ✅

## n8n Workflow

### Import
1. Go to `https://alcovia-study-sync.app.n8n.cloud`
2. Create new workflow
3. Import from file: `n8n/n8n-workflow.json`
4. Publish the workflow

### How it works
1. Backend fires webhook to n8n on successful focus session
2. n8n checks if `eventId` was already processed
3. If new → sends notification + saves eventId
4. If duplicate → skips silently

### Webhook URL
https://alcovia-study-sync.app.n8n.cloud/webhook/focus-success

## Conflict Cases Handled

| Scenario | Resolution |
|---|---|
| Same task edited on both devices | Higher Lamport clock wins |
| Tie in Lamport clock | Higher deviceId wins (alphabetic) |
| Task deleted on one, edited on other | Higher Lamport wins |
| Same sync message arrives twice | Ignored via operationId dedup |
| Same focus session syncs from both devices | Rewarded once via processed_sessions table |
| Same n8n webhook fires twice | Notification sent once via eventId dedup |

## What I Left Out

- Real WhatsApp delivery (using mock HTTP sink instead)
- 3+ device support (designed for 2)
- Efficient delta sync (currently sends full operation log)
- Persistent Lamport clock across app restarts

## What I'd Do Next

- Add vector clocks for more precise conflict detection
- Implement efficient sync (send only operations since last sync)
- Add user authentication
- Persist Lamport clock to AsyncStorage
- Add property-based tests for convergence guarantees
