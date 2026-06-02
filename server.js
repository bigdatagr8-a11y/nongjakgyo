const express = require("express");
const fetch   = require("node-fetch");
const cors    = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

const API_KEY  = "BAD32D8B14BD47599CF0DAB131126502";
const AGRO_BASE = "https://at.agromarket.kr/openApi";

app.use(cors());
app.use(express.json());

function getKST(offsetDays = 0) {
  const kst = new Date(Date.now() + (9 + offsetDays * 24) * 3600000);
  return kst.getUTCFullYear()
    + "-" + String(kst.getUTCMonth() + 1).padStart(2, "0")
    + "-" + String(kst.getUTCDate()).padStart(2, "0");
}

async function callAgro(endpoint, params = {}) {
  const qs = new URLSearchParams({
    apiKey: API_KEY,
    pageNo: 1,
    pageSize: 1000,
    ...params,
  });
  const url = `${AGRO_BASE}/${endpoint}?${qs}`;
  console.log("[AGRO]", url);
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "AgroConnect/1.0" },
    timeout: 12000,
  });
  if (!res.ok) throw new Error(`agromarket.kr ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) {
    const txt = await res.text();
    throw new Error("JSON 아님: " + txt.slice(0, 120));
  }
  return res.json();
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "농작교 서버 정상 가동 중", time: new Date().toISOString(), today: getKST() });
});

app.get("/api/realtime", async (req, res) => {
  try {
    const date = (req.query.date || getKST()).replace(/-/g, "");
    const data = await callAgro("realtimeInfo.do", { saleDate: date });
    res.json({ ok: true, date, data });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.get("/api/settlement", async (req, res) => {
  try {
    const date = (req.query.date || getKST()).replace(/-/g, "");
    const data = await callAgro("sangjungInfo.do", { saleDate: date });
    res.json({ ok: true, date, data });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.get("/api/both", async (req, res) => {
  const date = (req.query.date || getKST()).replace(/-/g, "");
  const [rt, st] = await Promise.allSettled([
    callAgro("realtimeInfo.do", { saleDate: date }),
    callAgro("sangjungInfo.do", { saleDate: date }),
  ]);
  res.json({
    ok: true, date,
    realtime:   rt.status === "fulfilled" ? rt.value : null,
    settlement: st.status === "fulfilled" ? st.value : null,
    errors: {
      realtime:   rt.status === "rejected" ? rt.reason.message : null,
      settlement: st.status === "rejected" ? st.reason.message : null,
    },
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌿 농작교 서버 시작 | 포트: ${PORT} | 오늘: ${getKST()}`);
});
