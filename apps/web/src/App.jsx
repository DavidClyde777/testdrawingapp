import React, { useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import debounce from "lodash.debounce";

const qs = new URLSearchParams(location.search);
const canvasId  = qs.get("canvasId")  || "";
// accept Softr's recordId or projectId
const projectId = qs.get("projectId") || qs.get("recordId") || "";

// Build API base URL from env
const RAW_HOST = import.meta.env.VITE_API_HOST || "";
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_HOST = RAW_BASE || RAW_HOST; // prefer explicit base, else host
const API_BASE = API_HOST ? (API_HOST.startsWith("http") ? API_HOST : `https://${API_HOST}`) : "";

// Auth header (baked at build time)
const API_SECRET = import.meta.env.VITE_API_SECRET_KEY || "";
const authHeaders = API_SECRET ? { Authorization: `Bearer ${API_SECRET}` } : {};

export default function App() {
  const ref = useRef(null);

  const [initialData, setInitialData] = useState(null);
  const [error, setError] = useState("");

  // Guards to prevent saving empties / before load finishes
  const hasAppliedInitial = useRef(false);
  const hasSavedNonEmpty  = useRef(false);

  // Load existing JSON
  useEffect(() => {
    (async () => {
      if (!canvasId) return;
      if (!API_BASE) { setError("Missing API base URL"); return; }
      try {
        const r = await fetch(
          `${API_BASE}/canvas?canvasId=${encodeURIComponent(canvasId)}`,
          { headers: { ...authHeaders } }
        );
        if (!r.ok) throw new Error(`GET /canvas ${r.status}`);
        const json = await r.json();
        setInitialData(json?.data || null);

        // mark as applied on next tick so Excalidraw has mounted with it
        requestAnimationFrame(() => { hasAppliedInitial.current = true; });
      } catch (e) {
        console.error(e);
        setError("Failed to load canvas.");
      }
    })();
  }, [canvasId, API_BASE, API_SECRET]);

  // Debounced save
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
          console.error("Save failed:", e);
        }
      }, 1000),
    [API_BASE, canvasId, projectId, API_SECRET]
  );

  // Only save when there is actual content; never overwrite with empties
  const handleChange = (elements, appState, files) => {
    // Ignore early onChange events fired during initial mount/load
    if (!hasAppliedInitial.current) return;

    // elements can be undefined on first paint; guard it
    const els = Array.isArray(elements) ? elements : [];
    const nonDeleted = els.filter((e) => !e?.isDeleted);

    const fileMap = files || {};
    const hasFiles = Object.keys(fileMap).length > 0;
    const hasContent = nonDeleted.length > 0 || hasFiles;

    // If there is no content AND we've never saved content before, skip
    if (!hasContent && !hasSavedNonEmpty.current) return;

    // If content exists, remember that we have a non-empty state saved at least once
    if (hasContent) hasSavedNonEmpty.current = true;

    // Persist full payload so images survive reloads
    const payload = { elements: els, appState, files: fileMap };
    saveDebounced(payload);
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
        // If you add a /canvas/thumbnail endpoint, POST the blob here
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
