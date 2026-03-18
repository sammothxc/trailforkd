#!/bin/sh
# Generates trailforkd-config.js from environment variables at container start.
# Set these in your compose file or Dockge UI:
#   CESIUM_ION_TOKEN  - optional, for Cesium World Terrain
#   TERRAIN_URL       - URL of your terrain tile server, e.g. "http://truenas.local:8082"

cat > /usr/share/nginx/html/trailforkd-config.js <<EOF
window.CESIUM_CONFIG = {
  ionToken: "${CESIUM_ION_TOKEN:-}",
  terrainUrl: "${TERRAIN_URL:-}",
};
EOF

exec nginx -g 'daemon off;'
