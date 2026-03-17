import React, { useCallback } from "react";
import CesiumViewer from "./components/CesiumViewer";
import SearchBar from "./components/SearchBar";
import "./App.css";

export default function App() {
  const handleSearchSelect = useCallback((lat: number, lon: number, label: string) => {
    // eslint-disable-next-line no-console
    console.log("Search select:", label, lat, lon);
    // This currently uses a global that the viewer exposes to avoid prop drilling.
    // In future this could be improved with context or a shared state store.
    (window as any).__trailforkd_flyTo?.(lon, lat);
  }, []);

  return (
    <div className="app">
      <header className="appHeader">
        <h1>Trailforkd</h1>
        <p className="subtitle">Utah terrain viewer (Phase 1)</p>
        <SearchBar onSelect={handleSearchSelect} />
      </header>
      <main className="viewer">
        <CesiumViewer />
      </main>
    </div>
  );
}
