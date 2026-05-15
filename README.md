# trailforkd

Self-hosted 3D Utah trail planning Docker app. Free alternative to Trailforks' paid route planning features, scoped to Utah.

Built on [CesiumJS](https://cesium.com/platform/cesiumjs/) with ESRI satellite imagery and optional self-hosted terrain tiles.

## Running Locally

No build step. Open `trailforkd.html` directly in a browser.

## Docker Deployment

Dockge compose stack:

```yaml
services:
  trailforkd:
    container_name: trailforkd
    image: ghcr.io/sammothxc/trailforkd
    restart: unless-stopped
    ports:
      - 8080:80
    environment:
      - CESIUM_ION_TOKEN=${CESIUM_ION_TOKEN}
      - TERRAIN_URL=${TERRAIN_URL}
      - HEXAGON_URL=${HEXAGON_URL}
      - DATABASE_URL=postgres://trailforkd:trailforkd@postgres/trailforkd
    networks:
      - internal

  terrain-server:
    container_name: terrain-server
    image: nginx:alpine
    restart: unless-stopped
    volumes:
      - ./data/terrain-tiles:/usr/share/nginx/html:ro
    networks:
      - internal

  postgres:
    container_name: trailforkd_postgres
    image: postgis/postgis:15-3.4-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=trailforkd
      - POSTGRES_USER=trailforkd
      - POSTGRES_PASSWORD=trailforkd
    volumes:
      - ./data/postgres-data:/var/lib/postgresql/data
      - ./data/initdb:/docker-entrypoint-initdb.d:ro
    networks:
      - internal

networks:
  internal:

volumes:
  postgres-data:
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
