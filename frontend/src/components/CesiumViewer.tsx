import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./CesiumViewer.css";

const UTAH_CENTER = {
  longitude: -111.65,
  latitude: 39.32,
  // Start a bit closer so Utah is clearly visible on load.
  height: 85000,
};

export default function CesiumViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (viewerRef.current) return;

    let viewer: Cesium.Viewer | null = null;

    try {
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
        // Use OSM imagery to avoid requiring a Cesium Ion token.
        imageryProvider: new Cesium.OpenStreetMapImageryProvider({
          url: "https://a.tile.openstreetmap.org/",
        }),
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      });

      // Center camera on Utah
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          UTAH_CENTER.longitude,
          UTAH_CENTER.latitude,
          UTAH_CENTER.height
        ),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
      });

      viewerRef.current = viewer;
    } catch (error: any) {
      console.error("Cesium viewer initialization failed:", error, error?.stack);
    }

    return () => {
      if (viewer) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="cesiumViewer" />;
}
