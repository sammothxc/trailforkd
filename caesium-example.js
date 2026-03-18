// TrailForkd terrain explorer
// Adapted from Cesium Sandcastle terrain example — Sandcastle replaced with vanilla DOM.
// Tries local terrain server (localhost:8082) first, falls back to ellipsoid.

const LOCAL_TERRAIN_URL = "http://localhost:8082";

// Ion token loaded from cesium-config.js (gitignored — copy from cesium-config.example.js)
const ionToken = window.CESIUM_CONFIG?.ionToken;
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
        .catch(() => { alert("Cesium Ion imagery failed — set ionToken in cesium-config.js"); });
    },
  },
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

setStatus("connecting to localhost:8082\u2026");

Cesium.CesiumTerrainProvider.fromUrl(LOCAL_TERRAIN_URL, {
  requestVertexNormals: true,
})
  .then((provider) => {
    viewer.terrainProvider = provider;
    setStatus("localhost:8082 \u2713");
  })
  .catch(() => {
    setStatus("localhost:8082 unavailable \u2014 ellipsoid fallback (generate terrain tiles to enable)");
  });

// --- Terrain provider selector ---

const terrainOptions = [
  {
    text: "Local Terrain Server (localhost:8082)",
    onselect() {
      setStatus("connecting to localhost:8082\u2026");
      Cesium.CesiumTerrainProvider.fromUrl(LOCAL_TERRAIN_URL, { requestVertexNormals: true })
        .then((p) => { viewer.terrainProvider = p; setStatus("localhost:8082 \u2713"); })
        .catch(() => { setStatus("localhost:8082 unavailable"); });
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
