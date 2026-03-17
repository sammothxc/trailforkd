# CLAUDE.md — Utah Trail Planner (Working Title: "TrailView")

## Project Overview

TrailView is a self-hosted, open-source web application for planning hiking trips in Utah with full 3D topographic terrain rendering in the browser. It is a free alternative to Trailforks' paid 3D route planning features, scoped specifically to the state of Utah.

The app runs entirely on a personal homelab (TrueNAS with Dockge/Docker) and is exposed via Cloudflare tunnel.

## Core Features (MVP)

1. **3D Terrain Viewer** — CesiumJS-powered 3D globe/map scoped to Utah, rendering real elevation data (DEM) as navigable terrain.
2. **Trail Overlay** — Hiking trails sourced from OpenStreetMap and UGRC displayed as polylines draped on the terrain.
3. **Route Planning** — Click waypoints on the map to create a hiking route. Routes snap to known trails using OSRM with a hiking/foot profile.
4. **Elevation Profile** — Given a planned route, display an interactive elevation profile chart (distance vs. elevation).
5. **GPX Import/Export** — Import existing GPX tracks to visualize in 3D. Export planned routes as GPX for use on GPS devices.
6. **Land Ownership Overlay** — Toggle layer showing BLM, USFS, NPS, state, and private land boundaries (critical for Utah backcountry legality).

## Architecture

```
docker-compose.yml
├── frontend/          → React + Vite + CesiumJS (port 5173 dev / 80 prod)
├── backend/           → Node.js (Express) API server (port 3001)
├── terrain-server/    → Static file server for quantized mesh terrain tiles (port 8082)
├── osrm/              → OSRM routing engine with Utah foot profile (port 5000)
├── postgis/           → PostgreSQL + PostGIS for trail/land vector data (port 5432)
└── tile-processing/   → One-shot scripts for DEM → terrain tile conversion
```

All services are containerized with Docker Compose. In production, Caddy or nginx reverse-proxies everything behind a single origin for Cloudflare tunnel.

## Tech Stack

### Frontend
- **React 18+** with Vite
- **CesiumJS** (`cesium` npm package) — 3D terrain rendering engine
  - Use `Cesium.CesiumTerrainProvider` pointed at local terrain-server
  - Use `Cesium.GeoJsonDataSource` for trail overlays
  - Use `Cesium.CallbackProperty` for dynamic route polylines
- **Recharts** or **Chart.js** — elevation profile chart
- **Tailwind CSS** — styling
- TypeScript throughout

### Backend (API Server)
- **Node.js + Express**
- Endpoints:
  - `GET /api/trails?bbox=...` — return trail GeoJSON within bounding box
  - `GET /api/land-ownership?bbox=...` — return land boundary GeoJSON within bounding box
  - `POST /api/route` — accept waypoints, call OSRM, return snapped route with elevation
  - `POST /api/gpx/import` — parse GPX, return GeoJSON + elevation profile data
  - `GET /api/gpx/export?routeId=...` — export route as GPX file
  - `GET /api/elevation-profile` — accept polyline coords, sample DEM, return elevation array
- Connects to PostGIS for vector queries

### Terrain Tile Server
- Static file server (nginx or `serve`) hosting pre-generated Cesium quantized mesh tiles
- Tiles generated offline from UGRC DEM data using `ctb-tile` (Cesium Terrain Builder)
- Directory structure: `/{z}/{x}/{y}.terrain` (quantized mesh format)
- Must serve `layer.json` at root describing tile availability and bounds
- CORS headers required for CesiumJS to fetch tiles

### Routing Engine
- **OSRM (Open Source Routing Machine)**
- Use the official `osrm/osrm-backend` Docker image
- Pre-process Utah OSM extract with **foot profile** (`foot.lua`)
- Provides `/route/v1/foot/{coords}` endpoint for trail-snapped routing
- Utah-only extract keeps the graph small (~200MB)

### Database
- **PostgreSQL 16 + PostGIS 3.4**
- Tables:
  - `trails` — LineString geometries with attributes (name, surface, difficulty/sac_scale, source)
  - `land_ownership` — MultiPolygon geometries with attributes (agency, name, access type)
  - `saved_routes` — User-saved route plans (optional, MVP can skip persistence)
- Spatial indexes (GIST) on all geometry columns
- All queries use `ST_Intersects` with bbox geometry for map-view filtering

## Data Sources & Acquisition

### Elevation / DEM
- **Primary:** UGRC 10-meter DEM (statewide)
  - Download: https://gis.utah.gov/products/sgid/elevation/
  - Format: GeoTIFF
  - Size: ~2-3 GB raw
- **High-res (optional, phase 2):** UGRC 1-meter LiDAR (Wasatch Front coverage)
  - Much larger, selective download by area of interest
- **Fallback for development:** Cesium World Terrain (free tier, 75k requests/month)
  - Use `Cesium.createWorldTerrainAsync()` during dev before local tiles are ready

### Terrain Tile Generation
- Tool: **ctb-tile** (Cesium Terrain Builder)
  - GitHub: https://github.com/geo-data/cesium-terrain-builder
  - Also consider: https://github.com/tum-gis/cesium-terrain-builder-docker
- Process:
  ```bash
  # Convert GeoTIFF to quantized mesh tiles
  ctb-tile -f Mesh -C -N -o /data/terrain-tiles /data/utah_dem_10m.tif
  # Generate layer.json
  ctb-tile -f Mesh -C -N -l -o /data/terrain-tiles /data/utah_dem_10m.tif
  ```
- Output: directory tree of `.terrain` files + `layer.json`
- Expected output size: ~1 GB for 10m statewide

### Trail Data
- **OpenStreetMap (primary):**
  - Utah extract from Geofabrik: https://download.geofabrik.de/north-america/us/utah.html
  - Download the `.osm.pbf` file
  - Extract trails with `osmium` or `ogr2ogr`:
    ```bash
    ogr2ogr -f "PostgreSQL" PG:"dbname=trailview" utah-latest.osm.pbf \
      -sql "SELECT * FROM lines WHERE highway IN ('path','footway','track','bridleway','cycleway') OR route='hiking'" \
      -nln trails -lco GEOMETRY_NAME=geom -lco FID=gid
    ```
  - Key OSM tags to preserve: `name`, `highway`, `surface`, `sac_scale`, `trail_visibility`, `access`, `operator`
- **UGRC Trails (supplemental):**
  - https://gis.utah.gov/products/sgid/recreation/trails/
  - Shapefile format, import with `shp2pgsql` or `ogr2ogr`

### Land Ownership
- **UGRC Land Ownership:**
  - https://gis.utah.gov/products/sgid/cadastre/land-ownership/
  - Contains: BLM, USFS, NPS, SITLA (state trust), tribal, private, etc.
  - Import to PostGIS:
    ```bash
    ogr2ogr -f "PostgreSQL" PG:"dbname=trailview" land_ownership.shp \
      -nln land_ownership -lco GEOMETRY_NAME=geom
    ```

### OSRM Routing Graph
- Download Utah OSM PBF from Geofabrik (same file as trails)
- Process with OSRM:
  ```bash
  # Extract
  osrm-extract -p /opt/foot.lua utah-latest.osm.pbf
  # Partition
  osrm-partition utah-latest.osrm
  # Customize
  osrm-customize utah-latest.osrm
  ```
- Run the OSRM HTTP server:
  ```bash
  osrm-routed --algorithm mld utah-latest.osrm
  ```

## Directory Structure

```
trailview/
├── CLAUDE.md                    ← this file
├── docker-compose.yml
├── docker-compose.dev.yml       ← dev overrides (hot reload, etc.)
├── .env.example
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   │   └── cesium/              ← CesiumJS static assets (Workers, etc.)
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── CesiumViewer.tsx      ← main 3D map component
│       │   ├── TrailLayer.tsx        ← trail polyline overlay
│       │   ├── LandOwnership.tsx     ← land boundary overlay
│       │   ├── RoutePlanner.tsx      ← waypoint click + route display
│       │   ├── ElevationProfile.tsx  ← chart component
│       │   ├── GPXPanel.tsx          ← import/export UI
│       │   ├── LayerControls.tsx     ← toggle overlays on/off
│       │   └── SearchBar.tsx         ← search for trailheads/places
│       ├── hooks/
│       │   ├── useCesium.ts
│       │   ├── useTrails.ts
│       │   └── useRoute.ts
│       ├── services/
│       │   ├── api.ts               ← backend API client
│       │   └── gpx.ts               ← GPX parsing/generation (client-side)
│       ├── types/
│       │   └── index.ts
│       └── utils/
│           ├── cesiumHelpers.ts
│           └── elevation.ts
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 ← Express app entry
│       ├── routes/
│       │   ├── trails.ts
│       │   ├── landOwnership.ts
│       │   ├── route.ts
│       │   ├── gpx.ts
│       │   └── elevation.ts
│       ├── services/
│       │   ├── osrm.ts              ← OSRM client
│       │   ├── postgis.ts           ← PostGIS query helpers
│       │   └── dem.ts               ← DEM sampling for elevation profiles
│       └── db/
│           ├── pool.ts              ← pg connection pool
│           └── migrations/          ← SQL migration files
│
├── data/                            ← gitignored, large data files
│   ├── dem/                         ← raw GeoTIFF DEMs
│   ├── terrain-tiles/               ← generated quantized mesh tiles
│   ├── osm/                         ← Utah OSM PBF extract
│   ├── osrm/                        ← processed OSRM graph files
│   └── shapefiles/                  ← UGRC shapefiles
│
├── scripts/
│   ├── download-data.sh             ← fetch all required datasets
│   ├── generate-terrain-tiles.sh    ← DEM → quantized mesh pipeline
│   ├── import-trails.sh             ← OSM → PostGIS
│   ├── import-land-ownership.sh     ← Shapefile → PostGIS
│   ├── build-osrm.sh               ← OSM → OSRM routing graph
│   └── seed-db.sh                   ← create tables, run migrations
│
├── nginx/
│   └── default.conf                 ← reverse proxy config
│
└── osrm/
    └── foot.lua                     ← OSRM foot/hiking profile (customize penalties)
```

## Development Workflow

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (for local frontend dev outside container)
- GDAL tools (`gdal_translate`, `gdalinfo`) for inspecting DEMs
- ~15 GB free disk for data

### Getting Started (First Time)
```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with paths, ports, Cesium Ion token (for dev fallback)

# 2. Download all data
./scripts/download-data.sh

# 3. Generate terrain tiles (long — hours for 10m statewide)
./scripts/generate-terrain-tiles.sh

# 4. Start database
docker compose up -d postgis

# 5. Import vector data
./scripts/seed-db.sh
./scripts/import-trails.sh
./scripts/import-land-ownership.sh

# 6. Build OSRM routing graph
./scripts/build-osrm.sh

# 7. Start everything
docker compose up -d
```

### Day-to-Day Dev
```bash
# Start backend services
docker compose up -d postgis osrm terrain-server

# Run backend with hot reload
cd backend && npm run dev

# Run frontend with hot reload
cd frontend && npm run dev
```

### Key Environment Variables
```
# .env
CESIUM_ION_TOKEN=              # optional, for dev fallback terrain
TERRAIN_TILES_PATH=./data/terrain-tiles
POSTGRES_DB=trailview
POSTGRES_USER=trailview
POSTGRES_PASSWORD=<generate>
OSRM_HOST=http://localhost:5000
BACKEND_PORT=3001
FRONTEND_PORT=5173
```

## CesiumJS Integration Notes

### Vite + Cesium Setup
CesiumJS requires special Vite configuration because it uses Web Workers and has large static assets. Use `vite-plugin-cesium` or manually configure:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [react(), cesium()],
});
```

### Terrain Provider (Local Tiles)
```ts
const terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(
  'http://localhost:8082',  // local terrain tile server
  {
    requestVertexNormals: true,  // smooth lighting
  }
);
viewer.terrainProvider = terrainProvider;
```

### Camera Initialization (Utah)
```ts
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(-111.65, 39.32, 300000), // center of Utah
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-45),
    roll: 0,
  },
});
```

### Utah Bounding Box (for clipping/scoping)
```
West:  -114.053
East:  -109.041
South:  36.998
North:  42.001
```

## Coding Standards

- **TypeScript** everywhere (frontend and backend). No `any` types unless absolutely unavoidable.
- **Functional React** components with hooks. No class components.
- **Named exports** for components, default exports only for pages/routes.
- **Error handling:** All API calls wrapped in try/catch. All Express routes use async error middleware.
- **SQL injection prevention:** Always use parameterized queries with `pg` library. Never interpolate user input into SQL.
- **Spatial queries:** Always use spatial indexes. Always include a bounding box filter to prevent full-table scans.
- **No secrets in code.** All credentials, tokens, and connection strings come from `.env`.
- **Git:** Commit often with conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`). The `data/` directory is in `.gitignore`.

## Phase Plan

### Phase 1 — Terrain Viewer (Week 1)
- [ ] Project scaffolding (Vite + React + CesiumJS + Docker Compose)
- [ ] CesiumJS viewer component rendering Utah with Cesium World Terrain (free fallback)
- [ ] Camera constrained to Utah bounding box
- [ ] Basic UI shell (sidebar + map layout)

### Phase 2 — Trail Overlay (Week 2)
- [ ] PostGIS setup with trail data imported from OSM
- [ ] Backend API: `GET /api/trails?bbox=...` returning GeoJSON
- [ ] Frontend: fetch trails on camera move, render as clamped polylines on terrain
- [ ] Trail popup on click (name, difficulty, surface)

### Phase 3 — Route Planning (Weeks 3–4)
- [ ] OSRM setup with Utah foot profile
- [ ] Click-to-add-waypoint on map
- [ ] Backend route endpoint calling OSRM
- [ ] Display routed path as highlighted polyline
- [ ] Elevation profile chart from route geometry
- [ ] GPX export of planned route

### Phase 4 — Land Ownership + Polish (Week 5)
- [ ] Import UGRC land ownership to PostGIS
- [ ] Land ownership overlay with color-coded polygons (translucent)
- [ ] Legend for land types
- [ ] Layer toggle controls (trails, land, imagery type)
- [ ] GPX import and 3D visualization
- [ ] Search bar (geocoding via Nominatim)

### Phase 5 — Self-Hosted Terrain (Week 6)
- [ ] Download UGRC 10m DEM
- [ ] Generate quantized mesh tiles with ctb-tile
- [ ] Terrain tile server (nginx serving static files)
- [ ] Switch CesiumJS from World Terrain to local terrain provider
- [ ] Verify visual quality and performance

### Phase 6 — Hardening (Ongoing)
- [ ] Error boundaries in React
- [ ] Loading states and skeleton UI
- [ ] Mobile responsive layout
- [ ] Rate limiting on backend
- [ ] Cloudflare tunnel deployment config
- [ ] Automated data update script (refresh OSM monthly)

## Known Gotchas & Tips

1. **CesiumJS is huge.** The npm package is ~60MB. Vite's tree shaking helps but the Web Workers are still large. Use `vite-plugin-cesium` to handle the static asset copying.

2. **ctb-tile is old and finicky.** The Docker image from `tum-gis/cesium-terrain-builder-docker` is the most reliable way to run it. Building from source requires GDAL 2.x (not 3.x).

3. **OSRM foot profile doesn't know about trails by default.** The default `foot.lua` only handles roads and sidewalks well. You'll want to customize it to give proper weights to `highway=path`, `sac_scale=hiking/mountain_hiking`, etc. See: https://github.com/Project-OSRM/osrm-backend/blob/master/profiles/foot.lua

4. **PostGIS bbox queries:** Always transform to the same SRID. Store everything in EPSG:4326 (WGS84) since that's what CesiumJS and OSM use natively.

5. **CesiumJS entity count:** Don't load 50,000 trail segments at once. Use a debounced camera-move listener and only fetch trails within the current view, with a minimum zoom threshold.

6. **Terrain tile CORS:** The terrain tile server MUST set `Access-Control-Allow-Origin: *` headers or CesiumJS will silently fail to load tiles.

7. **UGRC data downloads** sometimes require agreeing to terms on their website. The direct download links may change. Check https://gis.utah.gov/ if scripts fail.

8. **Cesium Ion token** is needed for the default imagery (Bing Maps). For fully self-hosted, switch to OpenStreetMap imagery tiles or UGRC aerial imagery to remove all external dependencies.