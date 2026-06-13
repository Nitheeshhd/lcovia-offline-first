# DECISIONS.md — Alcovia Offline-First

## Data Model

Every action in the app creates an **Operation** — an immutable record with:
- `operationId` — unique UUID (idempotency key)
- `deviceId` — which device created it
- `type` — what happened (TASK_STATUS_CHANGED, FOCUS_SESSION_COMPLETED, etc.)
- `payload` — the data
- `lamport` — logical clock value
- `createdAt` — timestamp

Operations are stored locally in IndexedDB and synced to the server when online.

## Sync Model

We use **Operation-Based Sync**:
1. Every action creates an operation and saves it to a local pending queue
2. When online, the client POSTs all pending operations to `/sync`
3. The server applies each operation (skipping duplicates by `operationId`)
4. The server returns all operations the client hasn't seen yet
5. The client applies those incoming operations locally

This means every device eventually sees the same operation log — and therefore reaches the same final state.

## Conflict Resolution

We use **Lamport Clocks** instead of wall-clock timestamps because device clocks disagree.

Each device maintains a counter. Every operation increments it. When receiving an incoming operation, the counter updates to `max(local, incoming) + 1`.

**Resolution rules:**
- Higher Lamport clock wins
- Tie → higher deviceId wins (deterministic alphabetic ordering)

Example:
- Phone marks task DONE with lamport=10
- Laptop marks same task IN_PROGRESS with lamport=8
- Server applies DONE (higher lamport wins)
- Both devices converge to DONE after sync

**Deleted vs Edited conflict:**
- Deletes are soft deletes (`isDeleted=1`) with a Lamport clock
- If delete has higher lamport than edit → delete wins
- If edit has higher lamport → edit wins, task stays alive

**Duplicate sync messages:**
- Every operation has a unique `operationId`
- Server checks `processed_operations` table before applying
- Duplicate operations are silently ignored

## Why Two Devices Always End Up Identical

1. Every operation has a globally unique `operationId`
2. All operations are replicated to the server and pulled by all clients
3. All devices apply the same conflict resolution rules (Lamport + deviceId)
4. Same rules + same operations = same final state on every device

This is eventual consistency via operation log replication.

## Idempotency

**Sync layer:** `operationId` prevents the same operation being applied twice on the server.

**Reward layer:** `processed_sessions` table stores every rewarded `sessionId`. Before awarding coins, server checks this table. If already present → skip. This guarantees coins and streak are updated exactly once even if the same session syncs from both devices.

**n8n notification layer:** The n8n workflow maintains a `processedEvents` store keyed by `eventId` (format: `focus-success-{sessionId}`). Before sending a notification, it checks if the eventId was already processed. If yes → skip. This guarantees the WhatsApp/notification fires exactly once per successful session.

## Tradeoff

I chose **Lamport Clocks** over CRDTs (Conflict-free Replicated Data Types).

CRDTs provide mathematically guaranteed convergence without a central server, but add significant implementation complexity — especially for the task status use case which only has three states.

Lamport clocks are simpler to implement, easy to reason about, and sufficient for the conflicts this app encounters. The tradeoff is that Lamport clocks require a server to act as the source of truth for operation ordering, whereas CRDTs could work fully peer-to-peer.

For a school study app where students always eventually reconnect to a server, Lamport clocks are the right choice.

## What Could Still Break

1. If a device is offline for a very long time and accumulates thousands of operations, the sync batch could be very large
2. The Lamport clock is stored in memory — an app restart resets it to 0, which could cause ordering issues with very old cached operations
3. n8n's `processedEvents` uses workflow static data — this resets if the workflow is redeployed
4. Two devices completing a focus session at the exact same Lamport value would use deviceId as tiebreaker — this is deterministic but arbitrary