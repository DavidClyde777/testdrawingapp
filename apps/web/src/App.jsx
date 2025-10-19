import React, { useMemo, useRef, useState } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import debounce from "lodash.debounce";

// ---- Query params ----
const qs = new URLSearchParams(location.search);
const canvasId  = qs.get("canvasId")  || "";
const projectId = qs.get("projectId") || qs.get("recordId") || "";

// ---- API base ----
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = RAW_BASE.startsWith("http") ? RAW_BASE : `https://${RAW_BASE}`;

export default function App() {
  const ref = useRef(null);
  const [error, setError] = useState("");
  const hasSavedNonEmpty = useRef(false);

  // ------- Initial data as a Promise (Excalidraw waits for it) -------
  const initialDataPromise = useMemo(() => {
    if (!canvasId || !API_BASE) {
      if (!API_BASE) setError("Missing API base URL");
      return Promise.resolve({ elements: [], appState: {}, files: {} });
    }
    return (async () => {
      try {
        const r = await fetch(
          `${API_BASE}/canvas?canvasId=${encodeURIComponent(canvasId)}`
        );
        if (!r.ok) throw new Error(`GET /canvas ${r.status}`);
        const row = await r.json();
        const data = (row && typeof row.data === "object") ? row.data : {};
        return {
          elements: Array.isArray(data.elements) ? data.elements : [],
          appState: data.appState || {},
          files: data.files || {},
        };
      } catch (e) {
        console.error(e);
        setError("Failed to load canvas.");
        return { elements: [], appState: {}, files: {} };
      }
    })();
  }, [canvasId, API_BASE]);

  // ------- Debounced save to API -------
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

  // ------- onChange: never overwrite with an empty scene -------
  const handleChange = (elements, appState, files) => {
    const els = Array.isArray(elements) ? elements : [];
    const nonDeleted = els.filter((e) => !e?.isDeleted);
    const fileMap = files || {};
    const hasFiles = Object.keys(fileMap).length > 0;
    const hasContent = nonDeleted.length > 0 || hasFiles;

    if (!hasContent && !hasSavedNonEmpty.current) return;
    if (hasContent) hasSavedNonEmpty.current = true;

    saveDebounced({ elements: els, appState, files: fileMap });
  };

  // optional: thumbnail export interval
  useMemo(() => {
    const id = setInterval(async () => {
      try {
        if (!ref.current) return;
        await exportToBlob({
          elements: ref.current.getSceneElements(),
          appState: ref.current.getAppState(),
          files: ref.current.getFiles(),
          mimeType: "image/png",
        });
      } catch {}
    }, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ height: "100vh" }}>
      {error && (
        <div
          style={{
            padding: 8,
            background: "#fee",
            color: "#900",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {error}
        </div>
      )}
      <Excalidraw
        ref={ref}
        initialData={initialDataPromise}
        onChange={handleChange}
      />
    </div>
  );
}
