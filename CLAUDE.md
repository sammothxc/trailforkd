# CLAUDE.md — trailforkd

## Project Overview

trailforkd is a self-hosted, open-source web application for planning hiking trips in Utah with full 3D topographic terrain rendering in the browser. Free alternative to Trailforks' paid 3D route planning features, scoped to Utah.

Runs on a personal homelab (TrueNAS Scale with Dockge/Docker) and exposed via Cloudflare tunnel.

## Current Architecture

```
trailforkd/
├── trailforkd.html              ← single-page app entry point
├── trailforkd.js                ← all viewer logic (vanilla JS, Cesium CDN global)
├── trailforkd-config.example.js ← config template (commit this)
├── trailforkd-config.js         ← real config with secrets (gitignored)
├── Dockerfile                   ← nginx:alpine serving the static files
├── docker-entrypoint.sh         ← generates trailforkd-config.js from env vars at startup
├── docker-compose.yml           ← trailforkd viewer + terrain-server
├── nginx/
│   └── terrain.conf             ← CORS-enabled nginx config for terrain tile server
└── data/
    └── terrain-tiles/           ← gitignored; quantized mesh tiles go here
```

### Docker services

| Service | Port | Purpose |
|---|---|---|
| `trailforkd` | 8080 | nginx serving `trailforkd.html` + JS |
| `terrain-server` | 8082 | nginx serving quantized mesh terrain tiles from `data/terrain-tiles/` |

### Environment variables (set in Dockge or `.env`)

| Variable | Purpose |
|---|---|
| `CESIUM_ION_TOKEN` | Optional. Enables "Cesium World Terrain" in the terrain dropdown. |
| `TERRAIN_URL` | URL of the terrain tile server as seen by the browser, e.g. `http://truenas.local:8082`. |

## Tech Stack

### Frontend (current)
- **Vanilla HTML + JavaScript** — no build step, no framework
- **CesiumJS 1.113** loaded from CDN (`cesium.com/downloads/...`)
- Imagery: ESRI World Imagery, ESRI Topo, OSM, OpenTopoMap (all free, no key required)
- Terrain: local `CesiumTerrainProvider` or Cesium World Terrain (Ion) or ellipsoid fallback

### Planned (future phases)
- Backend: Node.js + Express + PostGIS for trail/land data
- Routing: OSRM with Utah foot profile
- Trail overlay: OSM + UGRC data as GeoJSON polylines on terrain

## Data Sources

### Elevation / DEM
- **UGRC 10m DEM (statewide):** https://gis.utah.gov/products/sgid/elevation/
  - Format: GeoTIFF, ~2-3 GB raw
- **Dev fallback:** Cesium World Terrain via Ion token (75k requests/month free)

### Terrain Tile Generation
- Tool: [cesium-terrain-builder Docker](https://github.com/tum-gis/cesium-terrain-builder-docker)
- ctb-tile requires GDAL 2.x — use the Docker image, don't build from source
```bash
ctb-tile -f Mesh -C -N -o /data/terrain-tiles /data/utah_dem_10m.tif
ctb-tile -f Mesh -C -N -l -o /data/terrain-tiles /data/utah_dem_10m.tif
```
- Output: ~1 GB of `.terrain` files + `layer.json`
- `layer.json` must exist at the root of the tile directory or CesiumJS won't load tiles

### Trail Data (future)
- OSM Utah extract: https://download.geofabrik.de/north-america/us/utah.html
- UGRC Trails: https://gis.utah.gov/products/sgid/recreation/trails/

### Land Ownership (future)
- UGRC Land Ownership: https://gis.utah.gov/products/sgid/cadastre/land-ownership/

## Development Workflow

### Local dev (no Docker)
```bash
# Just open the file — no build step
open trailforkd.html

# Or serve with any static server
npx serve .
```

### Config
```bash
cp trailforkd-config.example.js trailforkd-config.js
# Edit trailforkd-config.js with your Ion token and terrain URL
```

### Build and deploy
```bash
docker build -t youruser/trailforkd:latest .
docker push youruser/trailforkd:latest
# Then pull & restart in Dockge
```

## Utah Bounding Box
```
West:  -114.053
East:  -109.041
South:  36.998
North:  42.001
```

## Phase Plan

### Phase 1 — Terrain Viewer ✓
- [x] Standalone HTML/JS viewer with CesiumJS from CDN
- [x] ESRI Satellite imagery default with imagery switcher
- [x] Terrain provider selector (local server, Cesium Ion, ellipsoid fallback)
- [x] Utah location presets (Zion, Arches, Bryce, SLC, Provo Peak, etc.)
- [x] Lighting and fog toggles
- [x] Docker image with env-var config injection
- [x] Deployed to TrueNAS via Dockge

### Phase 2 — Trail Overlay
- [ ] PostGIS setup with trail data imported from OSM
- [ ] Backend API: `GET /api/trails?bbox=...` returning GeoJSON
- [ ] Fetch trails on camera move, render as clamped polylines on terrain
- [ ] Trail popup on click (name, difficulty, surface)

### Phase 3 — Route Planning
- [ ] OSRM with Utah foot profile
- [ ] Click-to-add-waypoint on map
- [ ] Backend route endpoint calling OSRM
- [ ] Highlighted routed polyline
- [ ] Elevation profile chart
- [ ] GPX export

### Phase 4 — Land Ownership + Polish
- [ ] UGRC land ownership overlay (BLM, USFS, NPS, SITLA, private)
- [ ] Color-coded translucent polygons with legend
- [ ] Layer toggles
- [ ] GPX import and 3D visualization
- [ ] Geocoding search (Nominatim)

### Phase 5 — Hardening
- [ ] Mobile responsive layout
- [ ] Cloudflare tunnel deployment config
- [ ] Rate limiting
- [ ] Automated OSM data refresh (monthly)

## Known Gotchas

1. **`imageryProvider` in Viewer constructor is deprecated (Cesium 1.101+).** Add imagery layers explicitly with `viewer.imageryLayers.addImageryProvider()` after construction, or the globe will be solid blue.

2. **ctb-tile requires GDAL 2.x.** Building from source against GDAL 3.x fails. Always use the `tum-gis/cesium-terrain-builder-docker` image.

3. **`layer.json` is required.** Run ctb-tile twice: once for tiles, once with `-l` flag for the layer descriptor. CesiumJS will silently fail to load any terrain without it.

4. **Terrain tile CORS.** `nginx/terrain.conf` already sets `Access-Control-Allow-Origin: *`. Don't remove it — CesiumJS will silently fail to fetch tiles without it.

5. **`TERRAIN_URL` is resolved by the browser, not the server.** It must be an address reachable from the user's browser, not from inside Docker. Use your TrueNAS hostname/IP, not `localhost`.

6. **UGRC data downloads** sometimes require agreeing to terms on their website. Direct download links may change — check https://gis.utah.gov/ if scripts fail.

7. **CesiumJS entity count.** Don't load 50k trail segments at once. Debounce camera-move events and only fetch trails within the current view with a minimum zoom threshold.
