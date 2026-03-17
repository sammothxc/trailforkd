import { useEffect, useMemo, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./CesiumViewer.css";

const UTAH_CENTER = {
  longitude: -111.65,
  latitude: 39.32,
};

// Target height (meters) to see terrain detail when zoomed in.
const DEFAULT_CAMERA_HEIGHT = 15000;

const TERRAIN_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN;
const TERRAIN_URL = import.meta.env.VITE_TERRAIN_URL;

export default function CesiumViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [terrainStatus, setTerrainStatus] = useState("Initializing...");

  const hasIonToken = useMemo(() => Boolean(TERRAIN_TOKEN), []);
  const hasTerrainUrl = useMemo(() => Boolean(TERRAIN_URL), []);

  useEffect(() => {
    if (!containerRef.current) return;
    if (viewerRef.current) return;

    let viewer: Cesium.Viewer | null = null;

    try {
      if (hasIonToken) {
        Cesium.Ion.defaultAccessToken = TERRAIN_TOKEN;
      }

      const terrainProvider = hasTerrainUrl
        ? new Cesium.CesiumTerrainProvider({
            url: TERRAIN_URL!,
            requestVertexNormals: true,
          })
        : new Cesium.EllipsoidTerrainProvider();

      viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: true,
        sceneModePicker: false,
        navigationHelpButton: true,
        infoBox: false,
        scene3DOnly: true,
        requestRenderMode: true,
        maximumRenderTimeChange: 0.1,
        // Use OSM imagery to avoid requiring a Cesium Ion token.
        imageryProvider: new Cesium.OpenStreetMapImageryProvider({
          url: "https://a.tile.openstreetmap.org/",
        }),
        terrainProvider,
      });

      // Center camera on Utah and zoom in to show terrain detail.
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          UTAH_CENTER.longitude,
          UTAH_CENTER.latitude,
          DEFAULT_CAMERA_HEIGHT
        ),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
      });

      // Constrain navigation so users remain in the Utah region.
      const controller = viewer.scene.screenSpaceCameraController;
      controller.minimumZoomDistance = 20000; // do not zoom too close
      controller.maximumZoomDistance = 500000; // do not zoom out to full globe
      controller.enableRotate = true;
      controller.enableTranslate = true;
      controller.enableZoom = true;

      // Performance tuning (helps on lower-end GPUs)
      viewer.scene.globe.maximumScreenSpaceError = 16;
      viewer.scene.globe.tileCacheSize = 100;
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.depthTestAgainstTerrain = true;

      viewerRef.current = viewer;

      const terrainProviderName = hasTerrainUrl
        ? "CesiumTerrainProvider"
        : hasIonToken
        ? "CesiumIon WorldTerrain"
        : "EllipsoidTerrainProvider";
      const imageryProviderName = "OpenStreetMapImageryProvider";
      const tokenInfo = hasIonToken ? " (ion token set)" : "";

      if (hasTerrainUrl) {
        setTerrainStatus(`Loading terrain from ${TERRAIN_URL}... | terrain=${terrainProviderName}${tokenInfo} | imagery=${imageryProviderName}`);
        viewer.terrainProvider.readyPromise
          .then(() =>
            setTerrainStatus(`Terrain provider ready | terrain=${terrainProviderName}${tokenInfo} | imagery=${imageryProviderName}`)
          )
          .catch((error) => {
            console.error("Terrain provider failed:", error);
            setTerrainStatus(`Terrain provider failed; falling back to ellipsoid | terrain=EllipsoidTerrainProvider | imagery=${imageryProviderName}`);
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
          });
      } else if (hasIonToken) {
        setTerrainStatus(`Loading Cesium World Terrain… | terrain=${terrainProviderName}${tokenInfo} | imagery=${imageryProviderName}`);
        Cesium.createWorldTerrainAsync({ requestVertexNormals: true })
          .then((terrainProvider) => {
            if (viewer && !viewer.isDestroyed()) {
              viewer.terrainProvider = terrainProvider;
              setTerrainStatus(`Cesium World Terrain loaded | terrain=${terrainProviderName}${tokenInfo} | imagery=${imageryProviderName}`);
            }
          })
          .catch((error) => {
            console.error("Failed to load Cesium World Terrain:", error);
            setTerrainStatus(`Failed to load terrain; using ellipsoid | terrain=EllipsoidTerrainProvider | imagery=${imageryProviderName}`);
          });
      } else {
        setTerrainStatus(`Using ellipsoid (no terrain data) | terrain=${terrainProviderName} | imagery=${imageryProviderName}`);
      }
    } catch (error: any) {
      console.error("Cesium viewer initialization failed:", error, error?.stack);
      setTerrainStatus("Cesium initialization failed");
    }

    return () => {
      if (viewer) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, [hasIonToken]);

  const flyToUtah = () => {
    if (!viewerRef.current) return;
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        UTAH_CENTER.longitude,
        UTAH_CENTER.latitude,
        DEFAULT_CAMERA_HEIGHT
      ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 2.0,
    });
  };

  const flyToCoords = (longitude: number, latitude: number) => {
    if (!viewerRef.current) return;
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, DEFAULT_CAMERA_HEIGHT),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 2.0,
    });
  };

  // Expose a global helper used by SearchBar
  (window as any).__trailforkd_flyTo = flyToCoords;

  return (
    <div className="cesiumViewer">
      <div className="terrainStatus">
        {terrainStatus}
        <button className="terrainButton" onClick={flyToUtah}>
          Zoom to Utah
        </button>
      </div>
      <div ref={containerRef} className="cesiumContainer" />
    </div>
  );
}
