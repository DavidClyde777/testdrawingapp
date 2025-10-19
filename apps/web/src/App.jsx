import React, { useMemo, useRef, useState } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import debounce from "lodash.debounce";

const qs = new URLSearchParams(location.search);
const canvasId  = qs.get("canvasId")  || "";
const projectId = qs.get("projectId") || qs.get("recordId") || "";

// Configure on Render > draw-web
// VITE_API_BASE_URL=https://draw-api-xxxxx.onrender.com
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = RAW_BASE.startsWith("http") ? RAW_BASE : `https://${RAW_BASE}`;

// -------- helpers --------
const normalizeForExcalidraw = (rowData) => {
  const data = rowData && typeof rowData === "object" ? rowData : {};
  const elements = Array.isArray(data.elements) ? data.elements : [];
  const files    = data.files || {};
  const appState = { ...(data.appState || {}) };

  // Always give Excalidraw a Map, never a plain object
  appState.collaborators = new Map();

  return { elements, appState, files };
};

const stripNonSerializable = (appState) => {
  const { collaborators, ...rest } = appState || {};
  // collaborators (Map) is non-serializable; exclude it from the payload
  return rest;
};

export default function App() {
  const ref = useRef(null);
  const [error, setError] = useState("");
  const hasSavedNonEmpty = useRef(false);

  // Excalidraw can accept a Promise for initialData; it waits for it
  const initialDataPromise = useMemo(() => {
    if (!canvasId || !API_BASE) {
      if (!API_BASE) setError("Missing API base URL");
      return Promise.resolve(normalizeForExcalidraw({}));
    }
    return (async () => {
      try {
        const r = await fetch(`${API_BASE}/canvas?canvasId=${encodeURIComponent(canvasId)}`);
        if (!r.ok) throw new Error(`GET /canvas ${r.status}`);
        const row = await r.json();
        // row is either { canvas_id, data, ... } or our fallback shape from the server
        return normalizeForExcalidraw(row?.data);
      } catch (e) {
        console.error(e);
        setError("Failed to load canvas.");
        return normalizeForExcalidraw({});
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ canvasId, projectId, data: payload }),
          });
        } catch (e) {
          console.error("Save failed:", e);
        }
      }, 900),
    [API_BASE, canvasId, projectId]
  );

  // Never overwrite with an empty scene; strip collaborators before save
  const handleChange = (elements, appState, files) => {
    const els = Array.isArray(elements) ? elements : [];
    const nonDeleted = els.filter((e) => !e?.isDeleted);
    const fileMap = files || {};
    const hasFiles = Object.keys(fileMap).length > 0;
    const hasContent = nonDeleted.length > 0 || hasFiles;

    if (!hasContent && !hasSavedNonEmpty.current) return;
    if (hasContent) hasSavedNonEmpty.current = true;

    const serializableAppState = stripNonSerializable(appState);
    saveDebounced({ elements: els, appState: serializableAppState, files: fileMap });
  };

  // optional thumbnail heartbeat (no upload yet)
  useMemo(() => {
    const id = setInterval(async () => {
      try {
        if (!ref.current) return;
        await exportToBlob({
          elements: ref.current.getSceneElements(),
          appState: ref.current.getAppState(),
          files:    ref.current.getFiles(),
          mimeType: "image/png",
        });
      } catch {}
    }, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ height: "100vh" }}>
      {error && (
        <div style={{ padding: 8, background: "#fee", color: "#900", fontFamily: "Inter, system-ui, sans-serif" }}>
          {error}
        </div>
      )}
      <Excalidraw initialData={initialDataPromise} onChange={handleChange} ref={ref} />
    </div>
  );
}
