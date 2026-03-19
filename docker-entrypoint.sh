#!/bin/sh
# Generates trailforkd-config.js from environment variables at container start.
# Set these in your compose file or Dockge UI:
#   CESIUM_ION_TOKEN  - optional, for Cesium World Terrain / Google 3D Tiles
#   TERRAIN_URL       - URL of your terrain tile server, e.g. "http://truenas.local:8082"
#   HEXAGON_URL       - UGRC 15cm imagery base URL, e.g. "https://discover.agrc.utah.gov/login/path/your-key/wmts"

cat > /usr/share/nginx/html/trailforkd-config.js <<EOF
window.CESIUM_CONFIG = {
  ionToken: "${CESIUM_ION_TOKEN:-}",
  terrainUrl: "${TERRAIN_URL:-}",
  hexagonUrl: "${HEXAGON_URL:-}",
};
EOF

exec nginx -g 'daemon off;'
