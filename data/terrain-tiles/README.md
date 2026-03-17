# Terrain Tiles (Quantized Mesh)

This directory is intended to hold Cesium quantized-mesh terrain tiles (```.terrain``` files) and a corresponding ``layer.json``.

## Generating Terrain Tiles (Recommended)

This project is designed to be self-hosted, which means you should generate your own terrain tiles from DEM data and serve them locally.

A standard workflow (outside the scope of this repo) is:

1. Download a DEM for Utah (e.g., UGRC 10m DEM GeoTIFF).
2. Use `ctb-tile` (Cesium Terrain Builder) to generate quantized mesh tiles:

```bash
ctb-tile -f Mesh -C -N -o /path/to/terrain-tiles /path/to/utah_dem_10m.tif
```

3. Copy the contents into this directory (`data/terrain-tiles/`).

The tile server in `docker-compose.yml` serves this directory at port 8082.

## Notes

- Cesium expects a `layer.json` file at the root of the terrain tile directory.
- If you do not have terrain tiles, the app will fall back to a flat ellipsoid.
