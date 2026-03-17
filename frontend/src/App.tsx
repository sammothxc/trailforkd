import React from "react";
import CesiumViewer from "./components/CesiumViewer";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <header className="appHeader">
        <h1>Trailforkd</h1>
        <p className="subtitle">Utah terrain viewer (Phase 1)</p>
      </header>
      <main className="viewer">
        <CesiumViewer />
      </main>
    </div>
  );
}
