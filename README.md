# trailforkd

Trailforkd is a self-hosted Utah trail planning web app (Phase 1 scaffold).

## Getting Started (Phase 1)

### 1) Install dependencies

```bash
cd frontend
npm install
```

### 2) Run the frontend (dev)

```bash
npm run dev
```

The app will be available at https://localhost:5173.

### 3) Run via Docker Compose (dev)

```bash
docker compose up --build
```

The app will be available at https://localhost:5173.

---

## Self-hosting terrain (no Cesium Ion)

This project can run entirely self-hosted by serving your own Cesium quantized-mesh terrain tiles.

### 1) Generate terrain tiles

Create quantized-mesh tiles using a DEM (e.g., Utah 10m) and `ctb-tile`:

```bash
ctb-tile -f Mesh -C -N -o data/terrain-tiles /path/to/utah_dem_10m.tif
```

You must end up with `data/terrain-tiles/layer.json` and `*.terrain` files.

### 2) Run the terrain tile server

The repo includes a minimal nginx service that serves `data/terrain-tiles` on port 8082.

If you use Docker Compose (recommended):

```bash
docker compose up --build
```

### 3) Configure the frontend

Set the terrain URL in `.env`:

```env
VITE_TERRAIN_URL=http://localhost:8082
```

Restart the frontend dev server after changing `.env`.

### 4) Performance tuning (when terrain is loaded)

- The viewer is configured to enable `requestRenderMode` and a higher `maximumScreenSpaceError` for smoother performance.
- If you still see slow rendering, try lowering the tile `maximumScreenSpaceError` in `frontend/src/components/CesiumViewer.tsx`.
