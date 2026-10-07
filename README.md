# ShopOnGo

ShopOnGo is a frontend-only, deterministic simulation of intelligent scan-and-go verification. It keeps mobile declarations, simulated computer-vision observations, and simulated shelf evidence separate until a typed reconciliation engine produces a neutral, inspectable outcome.

> This prototype does not claim to detect real theft, uses no facial recognition, and does not process real payments.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The app is configured to bind to `0.0.0.0` for hosted previews.

Production build:

```bash
npm run build
npm run preview
```

Tests:

```bash
npm test
```

No environment variables are required.

## Routes

- `/` — landing page and product overview
- `/dashboard` — live monitor and idle state
- `/simulator` — scenario library
- `/simulation/:scenarioId` — active 3D simulation workspace
- `/events` — searchable event ledger
- `/analytics` — simulation-only metrics and charts
- `/architecture` — provider/fusion architecture map
- `/limitations` — limitations, privacy notes, and safe-failure assumptions

## Implemented scenarios

1. Normal purchase
2. Pick without scan
3. Scan without physical pick
4. Concealment simulation
5. Product swap
6. Return after scan
7. Wrong-shelf return
8. Multiple-item mismatch
9. Group handoff
10. Camera occlusion
11. Sensor failure
12. Delayed / out-of-order events
13. Duplicate scan

Each journey is deterministic, replayable, and emits immutable timestamped events. The simulation controls support start, pause, resume, restart, stop, single-step, and 0.5x / 1x / 2x / 4x / 8x speed.

## Architecture

- `src/types.ts` — typed events, products, shelves, sessions, cart state, and reconciliation results.
- `src/data/` — product catalog, shelf map, cameras, scenario definitions, metrics, architecture copy, and limitation copy.
- `src/providers/providers.ts` — provider interfaces plus local simulated adapters and future replacement boundaries.
- `src/stores/simulationStore.ts` — deterministic timeline runtime, session state, provider event ingestion, playback controls, local scenario history.
- `src/fusion/reconciliationEngine.ts` — UI-independent evidence fusion rules.
- `src/scene/StoreScene.tsx` — procedural low-poly React Three Fiber store, interactive shelves, products, customer, cameras, bag zone, and exit gate.
- `src/components/` — responsive control-room UI, camera feed, shelf sensors, virtual cart, event timeline, controls, and report modal.
- `src/simulation/validation.ts` — scenario validation helper.

The browser never makes a payment decision from a visual component. The fusion engine derives an explicit `ReconciliationResult`; the UI only presents it.

## Adding a scenario

Add a `Scenario` object to `src/data/scenarios.ts`:

1. Give it an id, description, category, risk label, duration, and expected outcome.
2. Add deterministic `ScenarioStep` objects in ascending `delayMs` order.
3. Reference only ids in `src/data/products.ts` and `src/data/shelves.ts`.
4. Use an existing typed `EventType` and `EventSource` where possible.
5. Run `validateScenario` / `validateAllScenarios` and add a reconciliation test for any new rule.
6. The scenario selector, playback, event ledger, cart, 3D path, report, and analytics surfaces consume the same object automatically.

## Future OpenCV connection

Implement `OpenCVVisionProvider` against the `VisionProvider` interface in `src/providers/providers.ts`. It should normalize backend detections into `VisionFrame` or `SimulationEvent` objects, preserving:

- timestamp
- camera id
- track id
- zone
- action
- product confidence
- interaction confidence
- uncertainty states

The camera panel and fusion engine do not need to know whether the source was the current deterministic simulator, OpenCV, YOLO, WebRTC, or a FastAPI WebSocket adapter.

## Future hardware connection

Implement `HardwareShelfProvider` against `ShelfSensorProvider`. An ESP32/HX711/RFID or other adapter can emit normalized shelf events with baseline weight, current weight, delta, health, and confidence. The fusion engine treats shelf state as supporting evidence; it does not infer intent from weight alone.

A future `FastAPIWebSocketEventBus` can replace local provider subscriptions at the same boundary. A future payment adapter can replace `MockPaymentProvider`, but the first version intentionally never calls a real payment API.

## Developer mode

Enable it from the scenario library or the workspace header. It exposes raw IDs, confidence values, manual low-confidence / sensor-failure / delayed-event triggers, and event JSON copy. Settings for reduced motion and low-performance mode persist to localStorage.

Scenario history and settings are stored locally in the browser. The event ledger and report can be exported as JSON.

## Known limitations

- The procedural customer is not a physical or behavioral model.
- The camera feed is a visual representation of future CV output, not real OpenCV.
- Shelf readings are software values, not load-cell or RFID data.
- Reconciliation is deterministic rule logic, not a production loss-prevention model.
- There is no authentication, durable backend, real payment, or real inventory system.
- Browser previews may not load the optional Google Fonts import; the UI falls back to system fonts.
- The production bundle includes Three.js and Recharts in one main chunk; code splitting would be a next optimization step.
