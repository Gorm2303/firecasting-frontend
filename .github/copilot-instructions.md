# Copilot instructions – firecasting-frontend

## Project layout
- React 19 + TypeScript + Vite (build tool)
- Entry: `src/main.tsx`, app shell: `src/App.tsx`
- Static site built to `dist/`, served by Node `serve` or Nginx
- Vite + Vitest for testing, ESLint for linting

## Build & run
- **Install:** `npm ci` (uses lockfile)
- **Dev server:** `npm run dev` — Vite dev server on port 5173 with HMR
  - Requires `VITE_API_BASE_URL` env var (e.g., `http://localhost:8080/api/simulation`)
- **Test:** `npm run test` — runs Vitest in jsdom environment
- **Build:** `npm run build` — TypeScript check + Vite bundle to `dist/`
- **Preview:** `npm run preview` — serve built dist/ locally
- **Docker:** multi-stage build, stage 2 runs Node `serve` + startup script

## Runtime config (crucial design)
- **Build-time:** Vite substitutes `import.meta.env.VITE_API_BASE_URL` during build
- **Runtime (production):** `docker-entrypoint.sh` writes `dist/env.js` with `window.__ENV.VITE_API_BASE_URL`
  - Allows env-per-container without rebuilding image
  - Falls back to baked value if env var not set
  - See `getApiBaseUrl()` in `src/config/runtimeEnv.ts` (tries runtime first, then import.meta.env)
- **Convention:** `VITE_API_BASE_URL` must already include the `/api/simulation` prefix
  - Dev compose: `https://api.local.test/api/simulation`
  - Prod compose: `https://${API_HOST}/api/simulation`

## Backend integration
- **Form schemas:** fetched from backend at `/api/forms/{id}` (e.g., `advanced-simulation`)
  - NOT cached in repo under `public/`
  - Fetched at component mount in `AdvancedInputForm.tsx`
  - Schema defines UI structure, validation rules, defaults
- **API calls:** simple `fetch()` wrapper in `src/api/simulation.tsx`
  - `startSimulation(req: SimulationRequest)` → POST `/start` → returns id
  - `exportSimulationCsv()` → GET `/export` → blob download
- **Error parsing:** backend returns `{ message, details[] }`
  - Frontend extracts field-level errors from `details` array

## SSE client contract (SimulationProgress.tsx)
- Component opens `EventSource` to `/api/simulation/progress/{simulationId}`
- **Event names:**
  - `queued`: payload `"position:N"` (0-based, e.g., "position:5") or plain `"queued"`
  - `started`: payload `"running"`
  - `progress`: payload human string (e.g., "Completed 100/1000 runs" or "Calculate 50/100 summaries")
  - `heartbeat`: keep-alive (no UI update)
  - `completed`: payload is JSON array of YearlySummary objects (final results)
  - `open`: initial connection confirmation
- Fallback: if payload starts with `[`, treat as JSON array (legacy behavior)

## Key dependencies
- React 19, React Router 7.9.5, React DOM 19
- Recharts 2.15.2 (charting)
- Vite 7.1.4, Vitest 3.2.4 (build & test)
- TypeScript 5.7.2
- ESLint 9 + typescript-eslint 8
- Testing Library (React, Jest DOM)
- vite-plugin-pwa (PWA manifest, auto-update)

## Code structure
- `src/components/` — reusable React components
  - `SimulationProgress.tsx` — SSE listener, progress UI
  - `advancedMode/AdvancedInputForm.tsx` — form schema fetcher, validation, submission
- `src/api/simulation.tsx` — fetch wrapper for backend endpoints
- `src/config/runtimeEnv.ts` — runtime env injection logic
- `src/models/` — TypeScript types (YearlySummary, SimulationRequest, etc.)
- `public/` — static assets (no form schemas here; fetched from backend)

## Environment variables
- **Dev:** set in shell or `.env.local` before `npm run dev`
  - `VITE_API_BASE_URL=http://localhost:8080/api/simulation`
- **Build:** Vite sees build-time env
- **Runtime (container):** Docker entrypoint reads `VITE_API_BASE_URL` env var, writes to `dist/env.js`
