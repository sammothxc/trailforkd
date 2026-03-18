# trailforkd

Self-hosted 3D Utah trail planning app. Free alternative to Trailforks' paid route planning features, scoped to Utah. Runs on a homelab (TrueNAS + Dockge) and exposed via Cloudflare tunnel.

Built on [CesiumJS](https://cesium.com/platform/cesiumjs/) with ESRI satellite imagery and optional self-hosted terrain tiles.

## Current State

Phase 1 complete: 3D terrain viewer with imagery switcher, Utah location presets, and terrain provider selector. No backend or trail data yet.

## Running Locally

No build step. Open `trailforkd.html` directly in a browser, or serve the folder with any static file server:

```bash
npx serve .
```

## Configuration

Copy the example config and fill in your values:

```bash
cp trailforkd-config.example.js trailforkd-config.js
```

```js
// trailforkd-config.js (gitignored)
window.CESIUM_CONFIG = {
  ionToken: "",    // optional — https://ion.cesium.com for Cesium World Terrain
  terrainUrl: "",  // URL of your terrain tile server, e.g. "http://truenas.local:8082"
};
```

## Docker Deployment (TrueNAS / Dockge)

Build and push the image:

```bash
docker build -t youruser/trailforkd:latest .
docker push youruser/trailforkd:latest
```

Dockge compose stack:

```yaml
services:
  trailforkd:
    image: youruser/trailforkd:latest
    ports:
      - "8080:80"
    environment:
      - CESIUM_ION_TOKEN=your_token_here
      - TERRAIN_URL=http://truenas.local:8082
    restart: unless-stopped

  terrain-server:
    image: nginx:alpine
    ports:
      - "8082:80"
    volumes:
      - /path/to/terrain-tiles:/usr/share/nginx/html:ro
      - /path/to/trailforkd/nginx/terrain.conf:/etc/nginx/conf.d/default.conf:ro
    restart: unless-stopped
```

The `terrain-server` is only needed once you have terrain tiles generated (see below). Without it, the viewer falls back to a flat ellipsoid.

## Self-Hosted Terrain Tiles

Terrain tiles are not included — they're generated from UGRC DEM data and can be ~1 GB.

1. Download the Utah 10m DEM from [UGRC](https://gis.utah.gov/products/sgid/elevation/)
2. Generate quantized mesh tiles using [ctb-tile](https://github.com/tum-gis/cesium-terrain-builder-docker):

```bash
ctb-tile -f Mesh -C -N -o /data/terrain-tiles /data/utah_dem_10m.tif
ctb-tile -f Mesh -C -N -l -o /data/terrain-tiles /data/utah_dem_10m.tif
```

3. Point `terrain-server` at the output directory and set `TERRAIN_URL` in your compose stack.
