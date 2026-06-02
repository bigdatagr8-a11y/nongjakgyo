const express = require("express");
const fetch   = require("node-fetch");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

const SHEET_ID = "1K41TJcxgJdttUCaDsiqTBB7aoJWtdQkJre5RC2vlUZc";
const CSV_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Google Sheets CSV 프록시 ──
// 브라우저에서 직접 Sheets 호출하면 CORS 막힘
// → 서버에서 대신 가져와서 전달
app.get("/api/sheet", async (req, res) => {
  try {
    console.log("[Sheets] 데이터 가져오는 중...");
    const r = await fetch(CSV_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 15000,
      redirect: "follow",
    });
    if(!r.ok) throw new Error("Sheets 응답 오류: " + r.status);
    const csv = await r.text();
    const lines = csv.trim().split("\n").length;
    console.log("[Sheets] 완료:", lines, "행");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300"); // 5분 캐시
    res.send(csv);
  } catch(e) {
    console.error("[Sheets] 오류:", e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ── 서버 상태 확인 ──
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "농작교 서버 정상 가동 중", time: new Date().toISOString() });
});

// ── SPA 폴백 ──
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
🌿 농작교 서버 시작
   포트: ${PORT}
   사이트: https://nongjakgyo.onrender.com
   Sheets API: /api/sheet
  `);
});
