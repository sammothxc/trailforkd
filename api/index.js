const express = require("express");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();

app.get("/trails", async (req, res) => {
  const { west, south, east, north } = req.query;

  if (!west || !south || !east || !north) {
    return res.status(400).json({ error: "bbox required: ?west=&south=&east=&north=" });
  }

  try {
    const result = await pool.query(
      `SELECT
        ST_AsGeoJSON(ST_Transform(way, 4326))::json AS geometry,
        name,
        highway,
        route,
        surface,
        sac_scale,
        trail_visibility,
        tags->'difficulty' AS difficulty
       FROM planet_osm_line
       WHERE ST_Intersects(way, ST_Transform(ST_MakeEnvelope($1, $2, $3, $4, 4326), 3857))
         AND (
           highway IN ('path', 'footway', 'track', 'bridleway', 'steps')
           OR route IN ('hiking', 'foot')
         )
       LIMIT 500`,
      [west, south, east, north]
    );

    res.json({
      type: "FeatureCollection",
      features: result.rows.map((row) => ({
        type: "Feature",
        geometry: row.geometry,
        properties: {
          name: row.name,
          highway: row.highway,
          surface: row.surface,
          sac_scale: row.sac_scale,
          trail_visibility: row.trail_visibility,
          difficulty: row.difficulty,
        },
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`trailforkd-api listening on :${PORT}`));
