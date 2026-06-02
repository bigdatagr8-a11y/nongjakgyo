const express = require("express");
const fetch   = require("node-fetch");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

const SHEET_ID = "1K41TJcxgJdttUCaDsiqTBB7aoJWtdQkJre5RC2vlUZc";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Google Sheets 전체 데이터 가져오기 ──
// CSV export는 행 제한이 없음 (전체 시트)
app.get("/api/sheet", async (req, res) => {
  try {
    console.log("[Sheets] 전체 데이터 가져오는 중...");

    // gid=0 은 첫번째 시트, 전체 행 가져오기
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0&exportFormat=csv`;

    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/csv,text/plain,*/*",
      },
      timeout: 30000,
      redirect: "follow",
    });

    if(!r.ok) throw new Error("Sheets 응답 오류: " + r.status);

    const csv = await r.text();
    const lines = csv.trim().split("\n").length;
    console.log("[Sheets] 완료:", lines, "행");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(csv);

  } catch(e) {
    console.error("[Sheets] 오류:", e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ── 행 수 확인용 ──
app.get("/api/sheet/count", async (req, res) => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
    const r = await fetch(url, { headers: {"User-Agent":"Mozilla/5.0"}, timeout: 30000, redirect: "follow" });
    const csv = await r.text();
    const lines = csv.trim().split("\n").length - 1; // 헤더 제외
    res.json({ ok: true, rows: lines });
  } catch(e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ── 서버 상태 ──
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "농작교 서버 정상 가동 중", time: new Date().toISOString() });
});

// ── SPA 폴백 ──
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌿 농작교 서버 시작 | 포트: ${PORT}`);
});
