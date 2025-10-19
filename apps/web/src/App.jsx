import React, { useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import debounce from "lodash.debounce";

const qs = new URLSearchParams(location.search);
const canvasId  = qs.get("canvasId")  || "";
const projectId = qs.get("projectId") || "";
const API_BASE  = import.meta.env.VITE_API_BASE_URL || ""; // Render injects this

export default function App() {
  const ref = useRef(null);
  const [initialData, setInitialData] = useState(null);

  // Load existing JSON
  useEffect(() => {
    (async () => {
      if (!canvasId) return;
      const r = await fetch(`${API_BASE}/canvas?canvasId=${encodeURIComponent(canvasId)}`);
      if (r.ok) setInitialData((await r.json())?.data || null);
    })();
  }, []);

  const saveDebounced = useMemo(
    () => debounce(async (payload) => {
      await fetch(`${API_BASE}/canvas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasId, projectId, data: payload })
      }).catch(() => {});
    }, 1200),
    []
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
          mimeType: "image/png"
        });
        // You can POST this blob to `${API_BASE}/canvas/thumbnail`
      } catch {}
    }, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw ref={ref} initialData={initialData || undefined} onChange={handleChange} />
    </div>
  );
}