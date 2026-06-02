const express = require("express");
const fetch   = require("node-fetch");
const cors    = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

const API_KEY  = "b83cfe0351d50b47ac263390b267da3c484f8d9258bcafdea622b0b20a217b5f";
const API_BASE = "http://211.237.50.150:7080/openapi/service/json/Grid_20240625000000000654_1";

app.use(cors());
app.use(express.json());

function getKST(offsetDays = 0) {
  const kst = new Date(Date.now() + (9 + offsetDays * 24) * 3600000);
  return kst.getUTCFullYear()
    + String(kst.getUTCMonth() + 1).padStart(2, "0")
    + String(kst.getUTCDate()).padStart(2, "0");
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "농작교 서버 정상 가동 중", today: getKST() });
});

app.get("/api/realtime", async (req, res) => {
  try {
    const date = req.query.date ? req.query.date.replace(/-/g,"") : getKST();
    const url = `${API_BASE}/1/1000?API_KEY=${API_KEY}&SALEDATE=${date}`;
    console.log("[API]", url);
    const r = await fetch(url, { timeout: 15000 });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(502).json({ ok:false, error:"JSON 파싱 실패", raw: text.slice(0,300) }); }
    const rows = data.Grid_20240625000000000654_1 || data.row || data.rows || [];
    res.json({ ok: true, date, rows, total: rows.length });
  } catch(e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.get("/api/both", async (req, res) => {
  try {
    const date = req.query.date ? req.query.date.replace(/-/g,"") : getKST();
    const url = `${API_BASE}/1/1000?API_KEY=${API_KEY}&SALEDATE=${date}`;
    const r = await fetch(url, { timeout: 15000 });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(502).json({ ok:false, error:"JSON 파싱 실패", raw: text.slice(0,300) }); }
    const rows = data.Grid_20240625000000000654_1 || data.row || data.rows || [];
    res.json({ ok: true, date, realtime: { rows }, settlement: null });
  } catch(e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌿 농작교 서버 시작 | 포트: ${PORT} | 오늘: ${getKST()}`);
});
