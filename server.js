const express = require("express");
const fetch   = require("node-fetch");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

const API_KEY = "BAD32D8B14BD47599CF0DAB131126502";
const API_URL = "https://at.agromarket.kr/openApi/realtimeInfo.do";

app.use(cors());
app.use(express.json());

// ── 정적 파일 서빙 (라이브 사이트) ──
app.use(express.static(path.join(__dirname, "public")));

function getKST(offset = 0) {
  const kst = new Date(Date.now() + (9 + offset * 24) * 3600000);
  return kst.getUTCFullYear()
    + String(kst.getUTCMonth() + 1).padStart(2, "0")
    + String(kst.getUTCDate()).padStart(2, "0");
}

// ── API 상태 확인 ──
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "농작교 서버 정상 가동 중", today: getKST() });
});

// ── 실시간 경락 ──
app.get("/api/realtime", async (req, res) => {
  try {
    const date = req.query.date ? req.query.date.replace(/-/g,"") : getKST();
    const url = `${API_URL}?apiKey=${API_KEY}&pageNo=1&pageSize=1000&saleDate=${date}`;
    const r = await fetch(url, { timeout: 15000 });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(502).json({ ok:false, error:"파싱 실패", raw: text.slice(0,200) }); }
    const rows = data.list || data.data || data.items || [];
    res.json({ ok: true, date, rows, total: rows.length });
  } catch(e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ── SPA 폴백 ──
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
🌿 농작교 서버 시작
   포트: ${PORT}
   사이트: http://localhost:${PORT}
   API: http://localhost:${PORT}/api/health
  `);
});
