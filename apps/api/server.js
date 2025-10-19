const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");

const app = express();

// Bigger payloads for images/files
app.use(express.json({ limit: "50mb" }));

// Open CORS (public API). If you want to restrict later, swap to a Set check.
app.use(cors());

// ---- Supabase client (service role; server-side only) ----
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: upsert a canvas row
async function upsertCanvas({ canvas_id, project_id, data }) {
  return supabase
    .from("canvases")
    .upsert({
      canvas_id,
      project_id,
      data,
      updated_at: new Date().toISOString(),
    });
}

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// Create a new canvas id (for Softr automation / Make / Zapier)
app.post("/new-id", async (_req, res) => {
  const canvasId = uuidv4();
  await upsertCanvas({ canvas_id: canvasId, project_id: null, data: null });
  res.json({ canvasId });
});

// GET /canvas?canvasId=...
app.get("/canvas", async (req, res) => {
  const canvasId = req.query.canvasId;
  if (!canvasId) return res.status(400).json({ error: "canvasId required" });

  const { data, error } = await supabase
    .from("canvases")
    .select("*")
    .eq("canvas_id", canvasId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  // Return row if found, else a blank scaffold
  return res.json(
    data || { canvas_id: canvasId, data: { elements: [], appState: {}, files: {} } }
  );
});

// PUT /canvas  { canvasId, projectId, data }
app.put("/canvas", async (req, res) => {
  const { canvasId, projectId, data } = req.body || {};
  if (!canvasId) return res.status(400).json({ error: "canvasId required" });

  const { error } = await upsertCanvas({
    canvas_id: canvasId,
    project_id: projectId || null,
    data: data || { elements: [], appState: {}, files: {} },
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
