const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json({ limit: "15mb" }));

// CORS: restrict to your Softr + web app origins when you know them
const allow = (origin, cb) => cb(null, true);
app.use(cors({ origin: allow, credentials: false }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// (helper) upsert
async function upsertCanvas({ canvas_id, project_id, data }) {
  return supabase.from("canvases").upsert({
    canvas_id, project_id, data, updated_at: new Date().toISOString()
  });
}

// Create a new canvas id (so you can call this from Softr automation)
app.post("/new-id", async (req, res) => {
  const canvasId = uuidv4();
  // optionally store the empty row now
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
  return res.json(data || { canvas_id: canvasId, data: null });
});

// PUT /canvas  { canvasId, projectId, data }
app.put("/canvas", async (req, res) => {
  const { canvasId, projectId, data } = req.body || {};
  if (!canvasId) return res.status(400).json({ error: "canvasId required" });

  const { error } = await upsertCanvas({
    canvas_id: canvasId,
    project_id: projectId || null,
    data: data || null
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));