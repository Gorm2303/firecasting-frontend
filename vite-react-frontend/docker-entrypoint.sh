#!/bin/sh
set -eu

# If docker-compose provides VITE_* env vars (via .env / env_file),
# write them into a small JS file that the static app reads at runtime.
# This avoids rebuilding the image per environment.

escape_js() {
  # Escape backslashes and double quotes for JS string literal
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

API_BASE="${VITE_API_BASE_URL:-/api/simulation/v3}"

cat > /app/dist/env.js <<EOF
// Generated at container startup
window.__ENV = window.__ENV || {};
window.__ENV.VITE_API_BASE_URL = "$(escape_js "$API_BASE")";
EOF

exec serve -s dist -l 3000
