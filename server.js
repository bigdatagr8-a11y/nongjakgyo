const express = require("express");
const fetch   = require("node-fetch");
const cors    = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

const API_KEY = "BAD32D8B14BD47599CF0DAB131126502";
const API_URL = "https://at.agromarket.kr/openApi/realtimeInfo.do";

app.use(cors());

function getKST(offset = 0) {
  const kst = new Date(Date.now() + (9 + offset * 24) * 3600000);
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
    const url = `${API_URL}?apiKey=${API_KEY}&pageNo=1&pageSize=1000&saleDate=${date}`;
    console.log("[요청]", url);
    const r = await fetch(url, { timeout: 15000 });
    const text = await r.text();
    console.log("[응답]", text.slice(0, 300));
    res.json({ ok: true, date, raw: text.slice(0, 2000) });
  } catch(e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.get("/api/both", async (req, res) => {
  try {
    const date = req.query.date ? req.query.date.replace(/-/g,"") : getKST();
    const url = `${API_URL}?apiKey=${API_KEY}&pageNo=1&pageSize=1000&saleDate=${date}`;
    const r = await fetch(url, { timeout: 15000 });
    const text = await r.text();
    res.json({ ok: true, date, raw: text.slice(0, 2000) });
  } catch(e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌿 농작교 서버 시작 | 포트: ${PORT}`);
});
