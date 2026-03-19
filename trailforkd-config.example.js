// Copy this file to trailforkd-config.js and fill in your values.
// trailforkd-config.js is gitignored; never commit real tokens.
window.CESIUM_CONFIG = {
  ionToken: "",       // https://ion.cesium.com - Access Tokens (optional)
  terrainUrl: "",     // URL of your terrain tile server, e.g. "http://truenas.local:8082"
                      // Leave blank to disable local terrain (falls back to ellipsoid)
  hexagonUrl: "",     // UGRC 15cm Hexagon imagery base URL, e.g. "https://discover.agrc.utah.gov/login/path/your-key-here/wmts"
                      // Get a key at https://gis.utah.gov/products/sgid/aerial-photography/
};
