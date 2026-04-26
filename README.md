# AirSentinel AI

AirSentinel AI is an aviation intelligence dashboard for tracking live aircraft, surfacing flight anomalies, browsing aviation incident reports, and experimenting with AI-assisted aviation analysis.

The current project goal is honesty over polish theater: every feature should make clear whether it is using live data, archive data, ASRS data, demo data, or unavailable services.

## Current Status

Last updated: April 26, 2026.

| Area | Status | Notes |
| --- | --- | --- |
| Flight tracking | Live when OpenSky is reachable | Uses OpenSky state data and local anomaly detection. Shows unavailable instead of fake counts when no aircraft are returned. |
| Anomaly detection | Local engine | Detects emergency squawks, rapid descent, altitude drops, holding patterns, unusual speeds, go-arounds, route deviations, and diversions from aircraft state data. |
| Incidents | ASRS archive plus user reports | Main now serves ASRS historical incident data through the Hugging Face datasets client and keeps user-submitted reports separate. |
| Dashboard source badges | Implemented | Dashboard stats expose `live`, `unavailable`, `asrs`, `archive`, and `demo` source states. |
| AI inference | Live with `HUGGINGFACE_API_KEY`, demo without it | The app shows demo-mode indicators when AI responses are mocked. |
| ATC feed | Open PR | PR #3 replaces hardcoded ATC messages with archive/demo-aware transcript data and removes fake "live" labeling. Until PR #3 is merged, `main` may still differ from that ATC behavior. |
| Persistence | Local JSON-backed stores | User incidents and anomalies are persisted under backend data storage. Postgres/Redis are present for future production work but are not the primary data layer yet. |

## What Works Today

- React dashboard with overview, flights, anomalies, incidents, imagery, ATC, query, and datasets views.
- Bun/Hono backend API.
- Shared TypeScript types between frontend and backend.
- OpenSky-based flight queries.
- Local anomaly detection and anomaly persistence.
- ASRS incident browsing and mapping into the app's incident shape.
- Hugging Face dataset integration for aircraft metadata, ASRS incidents, and ATC dataset access.
- Hugging Face inference integration with demo-mode fallback.
- Source badges and capability endpoints so the UI does not present demo/archive data as live.
- Backend regression tests for API response shape, ASRS incident behavior, anomaly detection, and persistence. PR #3 adds ATC payload metadata coverage.

## Important Limitations

- This is not a certified aviation safety system.
- Live ATC streaming is not integrated yet. ATC transcript work is archive/demo-oriented unless PR #3 has been merged and deployed.
- AI output is advisory only and can be mocked in demo mode.
- OpenSky availability and rate limits affect live flight/anomaly data.
- Docker support exists, but day-to-day local development currently uses Bun directly.
- Some production infrastructure variables exist before the app fully uses those systems.

## Architecture

```text
airsentinel/
  backend/
    src/
      config/          Environment parsing and feature flags
      services/
        ai-inference.ts         Hugging Face inference and demo fallbacks
        anomaly-detection.ts    Local flight anomaly rules
        hf-datasets.ts          Hugging Face datasets client
        opensky.ts              OpenSky flight state client
        persistence.ts          Local persisted incident/anomaly stores
      index.ts         Hono API server and route definitions
  frontend/
    src/
      api/             TanStack Query hooks
      components/      Reusable dashboard panels/cards
      pages/           Main application views
      utils/           Formatting and display helpers
  shared/
    types.ts           Shared API/domain types
```

## Tech Stack

| Layer | Tools |
| --- | --- |
| Backend | Bun, Hono, TypeScript, Zod |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, TanStack Query |
| Data sources | OpenSky Network, Hugging Face datasets, ASRS-derived archive data |
| AI | Hugging Face Inference API with demo fallbacks |
| Testing | Bun test, TypeScript build checks |
| Optional services | Docker, Redis, PostgreSQL/PostGIS |

## Data Sources and Modes

AirSentinel intentionally labels data provenance:

- `live`: currently fetched from a live external service.
- `unavailable`: live source could not return usable data.
- `asrs`: historical aviation safety reports from ASRS archive data.
- `archive`: non-live dataset/archive content.
- `demo`: mocked fallback data or mocked AI responses.

The backend also exposes `/api/capabilities` so the frontend can show current capability status instead of guessing.

## Local Development

### Prerequisites

- Bun 1.1 or newer.
- Node.js 18 or newer is useful for compatibility, but Bun is the primary runtime.
- Optional: Hugging Face API key for live AI inference.
- Optional: OpenSky credentials for authenticated flight data access.

### Install

```bash
cd backend
bun install

cd ../frontend
bun install
```

### Environment

Create or update `backend/.env`:

```env
PORT=3000
NODE_ENV=development

# Optional. Without this, AI features run in demo mode.
HUGGINGFACE_API_KEY=

# Optional. OpenSky can be used without credentials, but rate limits may apply.
OPENSKY_USERNAME=
OPENSKY_PASSWORD=
OPENSKY_CLIENT_ID=
OPENSKY_CLIENT_SECRET=

# Dataset and polling behavior.
ENABLE_HF_DATASETS=true
HF_INCIDENT_SEED_COUNT=200
HF_DATASETS_RATE_LIMIT_MS=500
OPENSKY_RATE_LIMIT_MS=10000
```

### Run

Terminal 1:

```bash
cd backend
bun run dev
```

Terminal 2:

```bash
cd frontend
bun run dev
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## Verification

Backend:

```bash
cd backend
bun test
bunx tsc --noEmit
```

Frontend:

```bash
cd frontend
bun run build
```

Recent verification from PR #3 work:

- Backend tests passed: 8 tests.
- Frontend production build passed.

## API Overview

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/flights` | GET | Current tracked aircraft and related anomalies. |
| `/api/flights/area` | GET | Aircraft inside a bounding box. |
| `/api/flights/radius` | GET | Aircraft near a point. |
| `/api/flights/:icao24` | GET | Specific aircraft by ICAO24. |
| `/api/flights/:icao24/track` | GET | Flight track history when available. |
| `/api/anomalies` | GET | Recent detected anomalies. |
| `/api/anomalies/:id` | GET | Single anomaly. |
| `/api/anomalies/:id/analyze` | POST | AI/demo analysis for an anomaly. |
| `/api/incidents` | GET | ASRS/user incident list with filters and pagination. |
| `/api/incidents/:id` | GET | Single incident. |
| `/api/incidents/:id/briefing` | POST | AI/demo incident briefing. |
| `/api/incidents` | POST | Create a user-submitted incident. |
| `/api/atc/transcribe` | POST | Transcribe uploaded ATC audio. |
| `/api/atc/live` | GET | ATC feed endpoint. See current branch/PR status for live vs archive behavior. |
| `/api/query` | POST | Natural language query endpoint. |
| `/api/images/analyze` | POST | Analyze uploaded image. |
| `/api/images/analyze-url` | POST | Analyze image by URL. |
| `/api/datasets/status` | GET | Dataset service health and counts. |
| `/api/capabilities` | GET | Current capability/source status. |

## Docker

The repository includes `docker-compose.yml`, `backend/Dockerfile`, and `frontend/Dockerfile`.

```bash
docker compose up --build
```

Use direct Bun development first if you are actively changing code. Docker is better for a production-like smoke test.

## Roadmap

Near-term:

- Merge PR #3 so ATC no longer presents hardcoded messages as live communications.
- Add end-to-end smoke tests around source badges and demo/archive/live states.
- Improve README/API docs after PR #3 lands on `main`.
- Add clearer local setup scripts for starting frontend and backend together.

Later:

- Real LiveATC or licensed ATC audio integration.
- Authenticated OpenSky OAuth flow if needed.
- Database-backed persistence for incidents, anomalies, and user activity.
- Production deployment guide.
- More robust observability and error reporting.

## Product Principle

AirSentinel should be something worth showing, but it should never overstate what it knows. If a feature is archive-backed, mocked, unavailable, or experimental, the product should say that clearly in the UI and API.
