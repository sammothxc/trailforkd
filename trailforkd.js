// TrailForkd terrain explorer
// Adapted from Cesium Sandcastle terrain example — Sandcastle replaced with vanilla DOM.
// Tries local terrain server (localhost:8082) first, falls back to ellipsoid.

// Config loaded from trailforkd-config.js (gitignored — copy from trailforkd-config.example.js)
const ionToken = window.CESIUM_CONFIG?.ionToken;
const LOCAL_TERRAIN_URL = window.CESIUM_CONFIG?.terrainUrl || "";
const HEXAGON_URL = window.CESIUM_CONFIG?.hexagonUrl || "";

if (ionToken) {
  Cesium.Ion.defaultAccessToken = ionToken;
}

const statusEl = document.getElementById("status");
const loadingEl = document.getElementById("loadingOverlay");

function setStatus(msg) {
  statusEl.textContent = "terrain: " + msg;
}

// --- Viewer setup ---

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: new Cesium.EllipsoidTerrainProvider(), // overridden below
  baseLayer: false, // imagery added explicitly below — prevents default Ion request
  animation: false,
  timeline: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  infoBox: false,
  scene3DOnly: true,
});

// --- Imagery selector ---

function setImagery(provider) {
  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(provider);
}

const imageryOptions = [
  {
    text: "ESRI Satellite",
    onselect() {
      setImagery(new Cesium.UrlTemplateImageryProvider({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        credit: "Esri, Maxar, Earthstar Geographics",
      }));
    },
  },
  {
    text: "ESRI Topo",
    onselect() {
      setImagery(new Cesium.UrlTemplateImageryProvider({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        credit: "Esri, HERE, Garmin, FAO, USGS",
      }));
    },
  },
  {
    text: "OpenStreetMap",
    onselect() {
      setImagery(new Cesium.UrlTemplateImageryProvider({
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        subdomains: ["a", "b", "c"],
        credit: "© OpenStreetMap contributors",
      }));
    },
  },
  {
    text: "OpenTopoMap",
    onselect() {
      setImagery(new Cesium.UrlTemplateImageryProvider({
        url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        subdomains: ["a", "b", "c"],
        credit: "© OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap",
      }));
    },
  },
  {
    text: "Cesium Ion Imagery (requires token)",
    onselect() {
      Cesium.createWorldImageryAsync()
        .then((p) => { viewer.imageryLayers.removeAll(); viewer.imageryLayers.addImageryProvider(p); })
        .catch(() => { alert("Cesium Ion imagery failed — set ionToken in trailforkd-config.js"); });
    },
  },
  ...(HEXAGON_URL ? [{
    text: "Utah 15cm Hexagon Imagery",
    onselect() {
      setImagery(new Cesium.WebMapTileServiceImageryProvider({
        url: HEXAGON_URL,
        layer: "15cm_hexagon_utah",
        style: "default",
        format: "image/png",
        tileMatrixSetID: "0to20",
        maximumLevel: 20,
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        credit: "Utah AGRC (Hexagon)"
      }));
    },
  }] : [])
];

const imageryMenu = document.getElementById("imageryMenu");
imageryOptions.forEach((opt, i) => {
  const el = document.createElement("option");
  el.value = String(i);
  el.textContent = opt.text;
  imageryMenu.appendChild(el);
});
imageryMenu.addEventListener("change", () => {
  imageryOptions[Number(imageryMenu.value)].onselect();
});

// Start with ESRI Satellite
imageryOptions[0].onselect();

viewer.scene.globe.enableLighting = true;
viewer.scene.globe.depthTestAgainstTerrain = true;
viewer.scene.globe.maximumScreenSpaceError = 2;

// Midday summer light over Utah
viewer.clock.currentTime = Cesium.JulianDate.fromIso8601("2024-07-04T20:00:00Z");

// Hide loading overlay once the globe tiles settle
viewer.scene.globe.tileLoadProgressEvent.addEventListener((count) => {
  if (count === 0) {
    loadingEl.style.opacity = "0";
    setTimeout(() => { loadingEl.style.display = "none"; }, 600);
  }
});

// --- Initial camera: Utah overview ---

function flyToUtah(duration = 0) {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-111.65, 39.32, 350000),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-45),
      roll: 0,
    },
    duration,
  });
}

flyToUtah(0); // instant on load

// --- Try local terrain server, fall back to ellipsoid ---

if (LOCAL_TERRAIN_URL) {
  setStatus("connecting to " + LOCAL_TERRAIN_URL + "\u2026");
  Cesium.CesiumTerrainProvider.fromUrl(LOCAL_TERRAIN_URL, { requestVertexNormals: true })
    .then((provider) => {
      viewer.terrainProvider = provider;
      setStatus(LOCAL_TERRAIN_URL + " \u2713");
    })
    .catch(() => {
      setStatus(LOCAL_TERRAIN_URL + " unavailable \u2014 ellipsoid fallback");
    });
} else {
  setStatus("no terrain URL configured \u2014 ellipsoid fallback (set terrainUrl in trailforkd-config.js)");
}

// --- Terrain provider selector ---

const terrainOptions = [
  {
    text: LOCAL_TERRAIN_URL ? "Local Terrain Server (" + LOCAL_TERRAIN_URL + ")" : "Local Terrain Server (not configured)",
    onselect() {
      if (!LOCAL_TERRAIN_URL) { setStatus("no terrain URL \u2014 set terrainUrl in trailforkd-config.js"); return; }
      setStatus("connecting to " + LOCAL_TERRAIN_URL + "\u2026");
      Cesium.CesiumTerrainProvider.fromUrl(LOCAL_TERRAIN_URL, { requestVertexNormals: true })
        .then((p) => { viewer.terrainProvider = p; setStatus(LOCAL_TERRAIN_URL + " \u2713"); })
        .catch(() => { setStatus(LOCAL_TERRAIN_URL + " unavailable"); });
    },
  },
  {
    text: "Cesium World Terrain (requires Ion token)",
    onselect() {
      // Set your Ion token first: Cesium.Ion.defaultAccessToken = "your_token_here"
      Cesium.createWorldTerrainAsync({ requestVertexNormals: true, requestWaterMask: true })
        .then((p) => { viewer.terrainProvider = p; setStatus("Cesium World Terrain \u2713"); })
        .catch(() => { setStatus("Cesium World Terrain failed \u2014 set Ion token first"); });
    },
  },
  {
    text: "Ellipsoid (flat, no elevation)",
    onselect() {
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      setStatus("ellipsoid");
    },
  },
];

const terrainMenu = document.getElementById("terrainMenu");
terrainOptions.forEach((opt, i) => {
  const el = document.createElement("option");
  el.value = String(i);
  el.textContent = opt.text;
  terrainMenu.appendChild(el);
});
terrainMenu.addEventListener("change", () => {
  terrainOptions[Number(terrainMenu.value)].onselect();
});

// --- Zoom presets: Utah locations ---

const zoomPresets = [
  { text: "--- fly to ---", onselect() {} },
  { text: "Utah (overview)", onselect() { flyToUtah(2); } },
  {
    text: "Salt Lake City",
    onselect() {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-111.891, 40.76, 20000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-40), roll: 0 },
        duration: 2,
      });
    },
  },
  {
    text: "Zion Canyon",
    onselect() {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-112.987, 37.29, 7000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-35), roll: 0 },
        duration: 2,
      });
    },
  },
  {
    text: "Arches NP",
    onselect() {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-109.59, 38.68, 10000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-40), roll: 0 },
        duration: 2,
      });
    },
  },
  {
    text: "Bryce Canyon",
    onselect() {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-112.17, 37.64, 8000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-35), roll: 0 },
        duration: 2,
      });
    },
  },
  {
    text: "Canyonlands",
    onselect() {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-109.82, 38.2, 18000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-40), roll: 0 },
        duration: 2,
      });
    },
  },
  {
    text: "Provo Peak",
    onselect() {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-111.571, 40.270, 6000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-35), roll: 0 },
        duration: 2,
      });
    },
  },
  {
    text: "Mount Timpanogos",
    onselect() {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-111.645, 40.39, 8000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-35), roll: 0 },
        duration: 2,
      });
    },
  },
];

const zoomMenu = document.getElementById("zoomMenu");
zoomPresets.forEach((opt, i) => {
  const el = document.createElement("option");
  el.value = String(i);
  el.textContent = opt.text;
  zoomMenu.appendChild(el);
});
zoomMenu.addEventListener("change", () => {
  zoomPresets[Number(zoomMenu.value)].onselect();
  setTimeout(() => { zoomMenu.value = "0"; }, 100);
});

// --- Toggle buttons ---

function addToggle(label, initialState, onChange) {
  const btn = document.createElement("button");
  btn.className = "tb-btn" + (initialState ? " active" : "");
  btn.textContent = label;
  btn.addEventListener("click", () => {
    const next = !btn.classList.contains("active");
    btn.classList.toggle("active", next);
    onChange(next);
  });
  document.getElementById("toggleButtons").appendChild(btn);
}

addToggle("Lighting", viewer.scene.globe.enableLighting, (v) => {
  viewer.scene.globe.enableLighting = v;
});

addToggle("Fog", viewer.scene.fog.enabled, (v) => {
  viewer.scene.fog.enabled = v;
});

// --- Google Photorealistic 3D Tiles ---

let google3DTileset = null;

const google3DBtn = document.createElement("button");
google3DBtn.className = "tb-btn";
google3DBtn.textContent = "Google 3D Tiles";
google3DBtn.addEventListener("click", async () => {
  if (!ionToken) {
    alert("Google Photorealistic 3D Tiles requires a Cesium Ion token — set ionToken in trailforkd-config.js");
    return;
  }
  const enabling = !google3DBtn.classList.contains("active");
  if (enabling) {
    try {
      google3DTileset = await Cesium.createGooglePhotorealistic3DTileset();
      viewer.scene.primitives.add(google3DTileset);
      viewer.scene.globe.show = false;
      google3DBtn.classList.add("active");
    } catch (e) {
      alert("Google 3D Tiles failed: " + e.message);
    }
  } else {
    if (google3DTileset) {
      viewer.scene.primitives.remove(google3DTileset);
      google3DTileset = null;
    }
    viewer.scene.globe.show = true;
    google3DBtn.classList.remove("active");
  }
});
document.getElementById("toggleButtons").appendChild(google3DBtn);

// --- Trail overlay (Overpass API) ---

const TRAIL_MAX_HEIGHT = 50000; // don't fetch when camera is above this (metres)
const TRAIL_COLORS = {
  path:    Cesium.Color.ORANGE,
  footway: Cesium.Color.YELLOW,
  track:   Cesium.Color.fromCssColorString("#c8a96e"),
};

let trailEntities = [];
let trailDebounce = null;
let trailController = null;
let trailsEnabled = true;

const trailStatusEl = document.createElement("div");
trailStatusEl.id = "trailStatus";
trailStatusEl.style.cssText = "position:absolute;bottom:28px;left:8px;background:rgba(20,24,40,.75);color:#aaa;font-size:11px;font-family:monospace;padding:4px 8px;border-radius:3px;z-index:100;";
document.body.appendChild(trailStatusEl);

function setTrailStatus(msg) {
  trailStatusEl.textContent = msg ? "trails: " + msg : "";
}

function clearTrails() {
  trailEntities.forEach(e => viewer.entities.remove(e));
  trailEntities = [];
}

async function fetchTrails() {
  if (!trailsEnabled) return;

  const height = viewer.camera.positionCartographic.height;
  if (height > TRAIL_MAX_HEIGHT) {
    clearTrails();
    setTrailStatus("zoom in to load trails");
    return;
  }

  const rect = viewer.camera.computeViewRectangle();
  if (!rect) return;

  const s = Cesium.Math.toDegrees(rect.south).toFixed(5);
  const w = Cesium.Math.toDegrees(rect.west).toFixed(5);
  const n = Cesium.Math.toDegrees(rect.north).toFixed(5);
  const e = Cesium.Math.toDegrees(rect.east).toFixed(5);

  const query = `[out:json][timeout:25];(way["highway"~"^(path|footway|track)$"]["foot"!="no"](${s},${w},${n},${e}););out geom;`;

  if (trailController) trailController.abort();
  trailController = new AbortController();

  setTrailStatus("loading…");
  try {
    const res = await fetch(
      "https://overpass-api.de/api/interpreter",
      { method: "POST", body: query, signal: trailController.signal }
    );
    const data = await res.json();

    clearTrails();
    data.elements.forEach(way => {
      if (!way.geometry || way.geometry.length < 2) return;
      const positions = way.geometry.map(pt =>
        Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat)
      );
      const highway = way.tags?.highway || "path";
      const color = TRAIL_COLORS[highway] || Cesium.Color.ORANGE;
      const name = way.tags?.name || way.tags?.["name:en"] || null;

      const entity = viewer.entities.add({
        name,
        polyline: {
          positions,
          width: 2,
          clampToGround: true,
          material: color,
        },
      });
      trailEntities.push(entity);
    });

    setTrailStatus(trailEntities.length + " trails loaded");
  } catch (err) {
    if (err.name !== "AbortError") setTrailStatus("fetch failed");
  }
}

viewer.camera.moveEnd.addEventListener(() => {
  clearTimeout(trailDebounce);
  trailDebounce = setTimeout(fetchTrails, 800);
});

// Trail toggle button
const trailBtn = document.createElement("button");
trailBtn.className = "tb-btn active";
trailBtn.textContent = "Trails";
trailBtn.addEventListener("click", () => {
  trailsEnabled = !trailsEnabled;
  trailBtn.classList.toggle("active", trailsEnabled);
  if (trailsEnabled) {
    fetchTrails();
  } else {
    if (trailController) trailController.abort();
    clearTrails();
    setTrailStatus("disabled");
  }
});
document.getElementById("toggleButtons").appendChild(trailBtn);

// Click a trail to show its name
const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
clickHandler.setInputAction(click => {
  const picked = viewer.scene.pick(click.position);
  if (Cesium.defined(picked) && picked.id?.name) {
    setTrailStatus('selected: "' + picked.id.name + '"');
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// Initial load
fetchTrails();
