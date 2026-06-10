const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

const SHEET_ID_AUCTION = "1K41TJcxgJdttUCaDsiqTBB7aoJWtdQkJre5RC2vlUZc";
const SHEET_ID_TRADE   = "12hoIYD09CXIGW7nWIwhUQG8-EozrYrGjvJVW2kl8C_U";
const GID_AUCTION = "0";
const GID_TRADE   = "802017948";

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
  let text = await r.text();
  // BOM 제거
  text = text.replace(/^\uFEFF/, "");
  return text;
}

// CSV → JSON 파싱 (서버에서 처리)
function parseAuctionCSV(csv) {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  // 헤더 파싱 - 보이지 않는 문자 전부 제거
  const headers = lines[0].split(",").map(h =>
    h.replace(/[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FFa-zA-Z0-9]/g, "").trim()
  );

  console.log("[경락] 정제된 헤더:", headers.join(","));

  const 경매일시Idx = headers.indexOf("경매일시");
  const 도매시장Idx = headers.indexOf("도매시장");
  const 법인Idx    = headers.indexOf("법인");
  const 품목Idx    = headers.indexOf("품목");
  const 품종Idx    = headers.indexOf("품종");
  const 산지Idx    = headers.indexOf("산지");
  const 수량Idx    = headers.indexOf("수량");
  const 단위Idx    = headers.indexOf("단위");
  const 경락가Idx  = headers.indexOf("경락가");

  console.log("[경락] 경락가 인덱스:", 경락가Idx);

  // 인덱스 못 찾으면 고정값 폴백
  const IDX = {
    경매일시: 경매일시Idx >= 0 ? 경매일시Idx : 0,
    도매시장: 도매시장Idx >= 0 ? 도매시장Idx : 1,
    법인:     법인Idx    >= 0 ? 법인Idx    : 2,
    품목:     품목Idx    >= 0 ? 품목Idx    : 3,
    품종:     품종Idx    >= 0 ? 품종Idx    : 4,
    산지:     산지Idx    >= 0 ? 산지Idx    : 5,
    수량:     수량Idx    >= 0 ? 수량Idx    : 6,
    단위:     단위Idx    >= 0 ? 단위Idx    : 7,
    경락가:   경락가Idx  >= 0 ? 경락가Idx  : 8,
  };

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = [];
    let cur = "", inQ = false;
    for (let j = 0; j < lines[i].length; j++) {
      const ch = lines[i][j];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur.trim());

    const itemName = (cols[IDX.품목] || "").trim();
    const priceStr = (cols[IDX.경락가] || "").replace(/,/g, "").trim();
    const price    = parseInt(priceStr) || 0;

    // 경락가 5000원 미만은 이상한 값으로 제외
    if (!itemName || !price || price < 5000) continue;

    // 2행 첫 파싱 시 로그
    if (i === 1) {
      console.log("[경락] 1번 데이터행 경락가 raw:", JSON.stringify(cols[IDX.경락가]), "→ parsed:", price);
    }

    records.push({
      경매일시: (cols[IDX.경매일시] || "").split(" ")[0],
      도매시장: (cols[IDX.도매시장] || "").trim(),
      법인:     (cols[IDX.법인]    || "").trim(),
      품목:     itemName,
      품종:     (cols[IDX.품종]    || "").trim(),
      산지:     (cols[IDX.산지]    || "").trim(),
      수량:     parseInt((cols[IDX.수량] || "0").replace(/,/g, "")) || 0,
      단위:     (cols[IDX.단위]    || "").trim(),
      경락가:   price,
    });
  }

  console.log("[경락] 파싱 완료:", records.length, "건, 샘플 경락가:", records[0] ? records[0].경락가 : "없음");
  return records;
}

// ── 실시간 경매정보 → JSON으로 반환 ──
app.get("/api/sheet", async (req, res) => {
  try {
    console.log("[경락] 데이터 가져오는 중...");
    const csv = await fetchAuctionWithBackup();
    const records = parseAuctionCSV(csv);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(records);
  } catch (e) {
    console.error("[경락] 오류:", e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ── 전일 경락가 (파일 기반 영구 저장) ──
app.get("/api/sheet/prev", async (req, res) => {
  const fs = require("fs");
  const prevPath = path.join(__dirname, "public", "cache_prev.json");

  // 메모리에 있으면 메모리 우선
  if (auctionPrevCache.records && auctionPrevCache.records.length > 0) {
    // 파일에도 저장해두기
    try { fs.writeFileSync(prevPath, JSON.stringify(auctionPrevCache.records)); } catch(e){}
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.json(auctionPrevCache.records);
  }

  // 메모리 없으면 파일에서 복구 (서버 재시작 후에도 유지)
  if (fs.existsSync(prevPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(prevPath, "utf-8"));
      console.log("[전일경락] 파일에서 복구:", data.length, "건");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.json(data);
    } catch(e) {
      console.error("[전일경락] 파일 복구 실패:", e.message);
    }
  }

  res.status(404).json({ ok: false, error: "전일 데이터 없음" });
});

// ── 거래실적 (로컬 엑셀 데이터 - 구글시트 연동 해제) ──
app.get("/api/trade", async (req, res) => {
  try {
    const fs = require("fs");
    const csvPath = path.join(__dirname, "public", "noeun_trade.csv");
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ ok: false, error: "거래실적 파일 없음" });
    }
    const csv = fs.readFileSync(csvPath, "utf-8").replace(/^\uFEFF/, "");
    console.log("[거래실적] 로컬 CSV 서빙:", csv.trim().split("\n").length, "행");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(csv);
  } catch (e) {
    console.error("[거래실적] 오류:", e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ── Claude API 프록시 ──
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

// ── 전일 경락 백업 ──
let auctionCache     = { date: "", csv: "", records: [] };
let auctionPrevCache = { date: "", csv: "", records: [] };

async function fetchAuctionWithBackup() {
  const fs = require("fs");
  const csv = await fetchSheet(SHEET_ID_AUCTION, GID_AUCTION);
  const lines = csv.trim().split("\n");
  const today = lines.length > 1 ? (lines[1].split(",")[0] || "").split(" ")[0].trim() : "";

  if (today && auctionCache.date && today !== auctionCache.date) {
    auctionPrevCache = { ...auctionCache };
    console.log("[경락] 전일 백업:", auctionCache.date, "→ 오늘:", today);
    // 전일 데이터 파일로 영구 저장
    try {
      const prevPath = path.join(__dirname, "public", "cache_prev.json");
      fs.writeFileSync(prevPath, JSON.stringify(auctionCache.records || []));
      console.log("[경락] 전일 파일 저장 완료:", auctionCache.date, auctionCache.records.length+"건");
    } catch(e) {
      console.error("[경락] 전일 파일 저장 실패:", e.message);
    }
  }
  if (today) {
    auctionCache = { date: today, csv };
  }
  return csv;
}

// ── 구매예약 ──
const purchases = {};

app.post("/api/purchase", (req, res) => {
  const { dealerNo, itemKey, buyer, itemName, grade, price, qty, unit, origin } = req.body;
  if (!dealerNo || !itemKey) return res.status(400).json({ ok: false, error: "필수값 누락" });
  const key = dealerNo + "_" + itemKey;
  if (purchases[key] && purchases[key].status === "완료") {
    return res.status(409).json({ ok: false, error: "이미 판매완료된 상품입니다" });
  }
  purchases[key] = { dealerNo, itemKey, buyer: buyer || "구매자", itemName, grade, price, qty, unit, origin, time: new Date().toISOString(), status: "완료" };
  console.log("[구매] 완료:", key, itemName, price);
  res.json({ ok: true, key });
});

app.get("/api/purchases", (req, res) => res.json({ ok: true, purchases }));
app.delete("/api/purchase/:key", (req, res) => { delete purchases[req.params.key]; res.json({ ok: true }); });

app.get("/api/health", (req, res) => res.json({ ok: true, message: "농작교 서버 정상 가동 중", time: new Date().toISOString() }));

// ── 수동 전일 백업 (오늘 0610 데이터를 전일 파일로 저장) ──
app.post("/api/backup-today", async (req, res) => {
  try {
    const fs = require("fs");
    const csv = await fetchSheet(SHEET_ID_AUCTION, GID_AUCTION);
    const records = parseAuctionCSV(csv);
    const prevPath = path.join(__dirname, "public", "cache_prev.json");
    fs.writeFileSync(prevPath, JSON.stringify(records));
    console.log("[백업] 수동 전일 백업 완료:", records.length, "건");
    res.json({ ok: true, count: records.length, message: "전일 데이터 백업 완료" });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, "0.0.0.0", () => console.log(`🌿 농작교 서버 시작 | 포트: ${PORT}`));
