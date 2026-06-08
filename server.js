const express = require("express");
const fetch   = require("node-fetch");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

const SHEET_ID    = "1ZgzcDBY3RIaBO5p2riY7EPAiM_ULhWhugUw3Ax2jAB0";
const GID_AUCTION = "0";         // 실시간 경매정보 (경락가)
const GID_TRADE   = "68871300";  // 거래실적 (거래실적_0608)

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function fetchSheet(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}&exportFormat=csv`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/csv,text/plain,*/*",
    },
    timeout: 30000,
    redirect: "follow",
  });
  if (!r.ok) throw new Error("Sheets 응답 오류: " + r.status);
  return await r.text();
}

// ── 실시간 경매정보 (경락가) ──
app.get("/api/sheet", async (req, res) => {
  try {
    console.log("[경락] 데이터 가져오는 중...");
    const csv = await fetchSheet(GID_AUCTION);
    console.log("[경락] 완료:", csv.trim().split("\n").length, "행");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(csv);
  } catch (e) {
    console.error("[경락] 오류:", e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ── 거래실적 ──
app.get("/api/trade", async (req, res) => {
  try {
    console.log("[거래실적] 데이터 가져오는 중...");
    const csv = await fetchSheet(GID_TRADE);
    console.log("[거래실적] 완료:", csv.trim().split("\n").length, "행");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(csv);
  } catch (e) {
    console.error("[거래실적] 오류:", e.message);
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
