import React, { useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import debounce from "lodash.debounce";

const qs = new URLSearchParams(location.search);
const canvasId  = qs.get("canvasId")  || "";
const projectId = qs.get("projectId") || "";

// Build API base URL from env
const RAW_HOST  = import.meta.env.VITE_API_HOST || "";
const RAW_BASE  = import.meta.env.VITE_API_BASE_URL || "";
const API_HOST  = RAW_BASE || RAW_HOST; // prefer explicit base, else host
const API_BASE  = API_HOST
  ? (API_HOST.startsWith("http") ? API_HOST : `https://${API_HOST}`)
  : "";

// Auth header (baked at build time)
const API_SECRET = import.meta.env.VITE_API_SECRET_KEY || "";

// Common headers (add Authorization when we have a secret)
const authHeaders = API_SECRET
  ? { Authorization: `Bearer ${API_SECRET}` }
  : {};

export default function App() {
  const ref = useRef(null);
  const [initialData, setInitialData] = useState(null);
  const [error, setError] = useState("");

  // Load existing JSON
  useEffect(() => {
    (async () => {
      if (!canvasId) return; // nothing to load yet
      if (!API_BASE) { setError("Missing API base URL"); return; }

      try {
        const r = await fetch(
          `${API_BASE}/canvas?canvasId=${encodeURIComponent(canvasId)}`,
          { headers: { ...authHeaders } }
        );
        if (!r.ok) throw new Error(`GET /canvas ${r.status}`);
        const json = await r.json();
        setInitialData(json?.data || null);
      } catch (e) {
        console.error(e);
        setError("Failed to load canvas.");
      }
    })();
  }, [canvasId, API_BASE]);

  const saveDebounced = useMemo(
    () =>
      debounce(async (payload) => {
        if (!API_BASE || !canvasId) return;
        try {
          await fetch(`${API_BASE}/canvas`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ canvasId, projectId, data: payload }),
          });
        } catch (e) {
          // swallow to avoid UI spam; logs are still useful
          console.error("Save failed:", e);
        }
      }, 1200),
    [API_BASE, canvasId, projectId, API_SECRET]
  );

  const handleChange = (elements, appState, files) => {
    if (!elements) return; // ignore initial mounts
    saveDebounced({ elements, appState, files: {} });
  };

  // (optional) save a thumbnail every 15s
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        if (!ref.current) return;
        await exportToBlob({
          elements: ref.current.getSceneElements(),
          appState: ref.current.getAppState(),
          files: ref.current.getFiles(),
          mimeType: "image/png",
        });
        // POST the blob if/when you add a /canvas/thumbnail endpoint
        // await fetch(`${API_BASE}/canvas/thumbnail`, { method: "PUT", headers: { ...authHeaders }, body: blob });
      } catch {}
    }, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ height: "100vh" }}>
      {error && (
        <div style={{ padding: 8, background: "#fee", color: "#900", fontFamily: "sans-serif" }}>
          {error}
        </div>
      )}
      <Excalidraw
        ref={ref}
        initialData={initialData || undefined}
        onChange={handleChange}
      />
    </div>
  );
}
