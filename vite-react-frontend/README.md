# firecasting (frontend)

Vite + React frontend for Firecasting.

## Local development

- `npm ci`
- `npm run dev`

## Advanced-mode form schemas

The advanced-mode UI fetches its JSON form schema from the backend (`/api/forms/{id}`), e.g. `advanced-simulation`.
To avoid drift, the frontend does not keep a copy of that schema under `public/forms/`.
