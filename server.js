const express = require("express");
const fetch   = require("node-fetch");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

const SHEET_ID_AUCTION = "1K41TJcxgJdttUCaDsiqTBB7aoJWtdQkJre5RC2vlUZc"; // 경락 데이터
const SHEET_ID_TRADE   = "1ZgzcDBY3RIaBO5p2riY7EPAiM_ULhWhugUw3Ax2jAB0"; // 거래실적
const GID_AUCTION = "0";
const GID_TRADE   = "68871300";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function fetchSheet(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}&exportFormat=csv`;
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
    const csv = await fetchSheet(SHEET_ID_AUCTION, GID_AUCTION);
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
    const csv = await fetchSheet(SHEET_ID_TRADE, GID_TRADE);
    console.log("[거래실적] 완료:", csv.trim().split("\n").length, "행");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(csv);
  } catch (e) {
    console.error("[거래실적] 오류:", e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ── Claude API 프록시 (채팅용) ──
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, system } = req.body;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: system,
        messages: messages,
      }),
    });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── 구매예약 메모리 저장소 ──
const purchases = {}; // key: "dealerNo_itemKey", value: {buyer, item, price, time, status}

// 구매예약 등록
app.post("/api/purchase", (req, res) => {
  const { dealerNo, itemKey, buyer, itemName, grade, price, qty, unit, origin } = req.body;
  if (!dealerNo || !itemKey) return res.status(400).json({ ok: false, error: "필수값 누락" });
  const key = dealerNo + "_" + itemKey;
  if (purchases[key] && purchases[key].status === "완료") {
    return res.status(409).json({ ok: false, error: "이미 판매완료된 상품입니다" });
  }
  purchases[key] = {
    dealerNo, itemKey, buyer: buyer || "구매자",
    itemName, grade, price, qty, unit, origin,
    time: new Date().toISOString(),
    status: "완료"
  };
  console.log("[구매] 완료:", key, itemName, price);
  res.json({ ok: true, key });
});

// 구매상태 조회
app.get("/api/purchases", (req, res) => {
  res.json({ ok: true, purchases });
});

// 구매 취소 (초기화용)
app.delete("/api/purchase/:key", (req, res) => {
  delete purchases[req.params.key];
  res.json({ ok: true });
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
