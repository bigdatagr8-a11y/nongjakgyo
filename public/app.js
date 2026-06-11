var { useState, useEffect, useRef } = React;

// ── 설정 ──
var CSV_URL = "/api/sheet";

function getKST(offset) {
  var kst = new Date(new Date().getTime() + (9 + offset * 24) * 3600000);
  return kst.getUTCFullYear() + "-" + String(kst.getUTCMonth()+1).padStart(2,"0") + "-" + String(kst.getUTCDate()).padStart(2,"0");
}
var TODAY = getKST(0), YESTERDAY = getKST(-1);


// 소수점 불필요한 0 제거 (6.000 → 6, 7.500 → 7.5)
function fmtKg(val) {
  if(!val && val !== 0) return val;
  var s = String(val).replace(/kg.*/i, "").trim();
  var n = parseFloat(s);
  if(isNaN(n)) return val;
  return n % 1 === 0 ? String(Math.round(n)) : String(parseFloat(n.toFixed(2)));
}
function fmtUnit(unit) {
  if(!unit) return unit;
  return unit.replace(/([\d.]+)kg/gi, function(m, num) {
    var n = parseFloat(num);
    if(isNaN(n)) return m;
    var clean = n % 1 === 0 ? String(Math.round(n)) : String(parseFloat(n.toFixed(2)));
    return clean + "kg";
  });
}
var G = {dark:"#0d2b1a",mid:"#1b4332",main:"#2d6a4f",light:"#40916c",pale:"#d1fae5",bg:"#f0fdf4",border:"#bbf7d0"};

// ── 배송비 계산 함수 (출발지 시장 → 도착지 구매자) ──
var SHIPPING_RATES = {
  "CJ대한통운": [{max:1,base:4000},{max:3,base:4500},{max:5,base:5000},{max:10,base:6000},{max:999,base:7500}],
  "로젠택배":   [{max:1,base:3500},{max:3,base:4000},{max:5,base:4500},{max:10,base:5500},{max:999,base:7000}],
  "한진택배":   [{max:1,base:4200},{max:3,base:4700},{max:5,base:5200},{max:10,base:6200},{max:999,base:7700}],
  "우체국택배": [{max:1,base:3000},{max:3,base:3500},{max:5,base:4000},{max:10,base:5000},{max:999,base:6500}],
};
var SIDO_GROUP = {
  "서울":"수도권","경기":"수도권","인천":"수도권",
  "세종":"충청권","대전":"충청권","충남":"충청권","충북":"충청권",
  "부산":"경상권","대구":"경상권","경북":"경상권","경남":"경상권","울산":"경상권",
  "광주":"전라권","전북":"전라권","전남":"전라권",
  "강원":"강원권",
  "제주":"제주",
};
var GROUP_DIST = {
  "수도권-수도권":"같은","수도권-충청권":"인근","수도권-강원권":"인근","수도권-경상권":"먼","수도권-전라권":"먼","수도권-제주":"제주",
  "충청권-충청권":"같은","충청권-수도권":"인근","충청권-전라권":"인근","충청권-경상권":"인근","충청권-강원권":"인근","충청권-제주":"제주",
  "경상권-경상권":"같은","경상권-전라권":"인근","경상권-충청권":"인근","경상권-수도권":"먼","경상권-강원권":"먼","경상권-제주":"제주",
  "전라권-전라권":"같은","전라권-경상권":"인근","전라권-충청권":"인근","전라권-수도권":"먼","전라권-강원권":"먼","전라권-제주":"제주",
  "강원권-강원권":"같은","강원권-수도권":"인근","강원권-충청권":"인근","강원권-경상권":"먼","강원권-전라권":"먼","강원권-제주":"제주",
  "제주-제주":"같은",
};
var ZONE_EXTRA = {"같은":0,"인근":500,"먼":1000,"제주":3000};
var ZONE_LABEL = {"같은":"같은 권역","인근":"인근 지역","먼":"먼 지역","제주":"제주/도서산간"};

var UNIT_RANGES = [
  {label:"5kg 이하",  min:0,  max:5},
  {label:"5~10kg",    min:5,  max:10},
  {label:"10~15kg",   min:10, max:15},
  {label:"15kg 이상", min:15, max:9999},
];
function calcShipping(kg, fromSido, toSido, carrier) {
  carrier = carrier || "CJ대한통운";
  var rates = SHIPPING_RATES[carrier];
  var base = rates[rates.length-1].base;
  for(var i=0;i<rates.length;i++){ if(kg<=rates[i].max){ base=rates[i].base; break; } }
  var fromGroup = SIDO_GROUP[fromSido] || "수도권";
  var toGroup   = SIDO_GROUP[toSido]   || "수도권";
  var zoneKey = fromGroup+"-"+toGroup;
  var zone = GROUP_DIST[zoneKey] || GROUP_DIST[toGroup+"-"+fromGroup] || "먼";
  var extra = ZONE_EXTRA[zone] || 0;
  return {base:base,extra:extra,total:base+extra,zone:zone,zoneLabel:ZONE_LABEL[zone]||zone,carrier:carrier,fromSido:fromSido,toSido:toSido};
}

var EMOJI_MAP = {
  "복숭아":"🍑","토마토":"🍅","수박":"🍉","참외":"🍈","블루베리":"🫐","딸기":"🍓",
  "배":"🍐","사과":"🍎","감귤":"🍊","포도":"🍇","메론":"🍈","바나나":"🍌",
  "오렌지":"🍊","파인애플":"🍍","코코넛":"🥥","망고":"🥭","아보카도":"🥑",
  "키위":"🥝","레몬":"🍋","체리":"🍒","자두":"🍑","무화과":"🌿",
  "호박":"🥬","오이":"🥒","고추":"🌶️","파프리카":"🫑","가지":"🍆",
  "양파":"🧅","마늘":"🧄","파":"🌿","배추":"🥬","무":"🌿","당근":"🥕",
};

var CATEGORY_MAP = {
  "사과":"사과류","배":"배류","감귤":"감귤류","한라봉":"감귤류","천혜향":"감귤류","레드향":"감귤류","청견":"감귤류",
  "딸기":"딸기류","포도":"포도류","복숭아":"핵과류","자두":"핵과류","체리":"핵과류",
  "수박":"과채류","참외":"과채류","메론":"과채류","토마토":"과채류","방울토마토":"과채류","파프리카":"과채류","오이":"과채류","호박":"과채류","가지":"과채류",
  "블루베리":"장과류",
  "배추":"엽채류","양배추":"엽채류","상추":"엽채류","시금치":"엽채류","깻잎":"엽채류","파":"엽채류","부추":"엽채류",
  "무":"근채류","당근":"근채류","양파":"근채류","마늘":"근채류","생강":"근채류",
  "고추":"조미채소류",
  "바나나":"수입과실류","오렌지":"수입과실류","파인애플":"수입과실류","코코넛":"수입과실류","망고":"수입과실류","아보카도":"수입과실류","키위":"수입과실류","레몬":"수입과실류",
};

function getCategory(itemName) {
  var key = Object.keys(CATEGORY_MAP).find(function(k){ return itemName===k || itemName.startsWith(k); });
  return key ? CATEGORY_MAP[key] : "기타";
}
function getEmoji(name) {
  var k = Object.keys(EMOJI_MAP).find(function(k){return name.includes(k);});
  return k ? EMOJI_MAP[k] : "🌿";
}

var MARKETS = [
  {id:1, name:"서울 가락시장",  region:"서울", sheetName:"서울가락",  phone:"02-3435-1000", corp:"서울청과"},
  {id:2, name:"부산 엄궁시장",  region:"부산", sheetName:"부산엄궁",  phone:"051-310-7000", corp:"부산청과"},
  {id:3, name:"대구 북부시장",  region:"대구", sheetName:"대구북부",  phone:"053-350-0800", corp:"대구청과"},
  {id:4, name:"인천 남촌시장",  region:"인천", sheetName:"인천남촌",  phone:"032-880-4000", corp:"인천청과"},
  {id:5, name:"인천 삼산시장",  region:"인천", sheetName:"인천삼산",  phone:"032-510-3000", corp:"삼산청과"},
  {id:6, name:"광주 각화시장",  region:"광주", sheetName:"광주각화",  phone:"062-380-5000", corp:"광주청과"},
  {id:7, name:"대전 오정시장",  region:"대전", sheetName:"대전오정",  phone:"042-580-5000", corp:"대전청과"},
  {id:8, name:"대전 노은시장",  region:"대전", sheetName:"대전노은",  phone:"",             corp:"중부청과"},  // 실제 번호 입력 예정
  {id:9, name:"울산 도매시장",  region:"울산", sheetName:"울산",      phone:"052-229-4000", corp:"울산청과"},
];

function getMarket(sheetName) {
  if(!sheetName) return {id:0, name:"기타", region:"기타", sheetName:"", phone:"", corp:""};
  var clean = sheetName.trim().replace(/\s/g,"");
  var found = MARKETS.find(function(m){
    var ms = m.sheetName.replace(/\s/g,"");
    return clean === ms || clean.includes(ms) || ms.includes(clean);
  });
  return found || {id:0, name:sheetName.trim(), region:"기타", sheetName:sheetName.trim(), phone:"", corp:""};
}

// ── 가상 데이터 생성 (노은시장 제외) ──
// 실제 느낌을 주는 산지 목록
var ORIGINS = {
  "사과": ["경북 청송","경북 영주","경북 안동","충북 충주","강원 영월"],
  "배": ["나주","충남 천안","경기 평택","충북 음성"],
  "감귤": ["제주 서귀포","제주 애월","제주 한림"],
  "딸기": ["충남 논산","경남 진주","전북 담양","경북 상주"],
  "복숭아": ["경북 청도","경북 경산","충북 음성","경기 이천"],
  "포도": ["경북 영천","경북 상주","충북 영동","경남 거창"],
  "수박": ["충남 함양","경남 함안","전북 고창","경기 양주"],
  "참외": ["경북 성주","경북 고령","경북 칠곡"],
  "토마토": ["경남 창녕","전남 화순","충남 부여","강원 철원"],
  "배추": ["강원 평창","강원 태백","강원 정선","충북 괴산"],
  "양파": ["전남 무안","경남 창녕","경북 영천"],
  "마늘": ["전남 고흥","경남 남해","충남 서산"],
  "고추": ["경북 영양","충남 청양","전남 영광"],
  "무": ["제주","전남 해남","강원 평창"],
  "당근": ["제주","경남 밀양","전남 진도"],
  "파": ["전남 진도","충남 아산","경기 여주"],
  "오이": ["경북 경산","전남 담양","충남 논산"],
  "호박": ["경남 거제","전남 해남","충남 부여"],
  "바나나": ["필리핀","에콰도르"],
  "오렌지": ["미국 캘리포니아","호주"],
  "블루베리": ["충남 부여","전남 고흥","미국"],
};

function getRandOrigin(item) {
  var list = ORIGINS[item] || ["국산"];
  return list[Math.floor(Math.random()*list.length)];
}

// 품목별 단가 기준 (원/kg 또는 원/box)
var PRICE_BASE = {
  "사과": {min:25000,max:65000,unit:"box"},
  "배": {min:30000,max:75000,unit:"box"},
  "감귤": {min:15000,max:40000,unit:"box"},
  "딸기": {min:18000,max:45000,unit:"box"},
  "복숭아": {min:20000,max:55000,unit:"box"},
  "포도": {min:20000,max:60000,unit:"box"},
  "수박": {min:12000,max:32000,unit:"개"},
  "참외": {min:15000,max:38000,unit:"box"},
  "토마토": {min:8000,max:25000,unit:"box"},
  "배추": {min:3000,max:10000,unit:"포기"},
  "양파": {min:5000,max:18000,unit:"20kg"},
  "마늘": {min:15000,max:45000,unit:"10kg"},
  "고추": {min:18000,max:55000,unit:"10kg"},
  "무": {min:2000,max:8000,unit:"개"},
  "당근": {min:8000,max:22000,unit:"20kg"},
  "파": {min:4000,max:15000,unit:"단"},
  "오이": {min:8000,max:22000,unit:"box"},
  "호박": {min:5000,max:18000,unit:"개"},
  "블루베리": {min:25000,max:60000,unit:"2kg"},
  "바나나": {min:8000,max:22000,unit:"box"},
  "오렌지": {min:15000,max:38000,unit:"box"},
};

var CORPS_BY_MARKET = {
  1: ["서울청과","한국청과","중앙청과","동화청과"],
  2: ["부산청과","남해청과","동부청과"],
  3: ["대구청과","영남청과","경북청과"],
  4: ["인천청과","경인청과","한강청과"],
  5: ["삼산청과","인천서부청과"],
  6: ["광주청과","전남청과","남도청과"],
  7: ["대전청과","충청청과","중부청과"],
  8: ["중부청과"],
  9: ["울산청과","동울산청과","영남청과"],
};

var VARIETIES = {
  "사과": ["홍로","부사","아리수","감홍","루비에스"],
  "배": ["신고","황금배","원황"],
  "감귤": ["온주밀감","한라봉","천혜향","레드향"],
  "딸기": ["설향","죽향","매향","금실"],
  "포도": ["캠벨얼리","거봉","샤인머스켓","청포도"],
  "복숭아": ["백도","황도","천도"],
  "토마토": ["일반","완숙","방울"],
};

// ── 가상 별점 생성 (3.5~5.0, 0.5 단위) ──
var MOCK_REVIEWS = [
  "신선도가 정말 좋았어요. 다음에도 거래하고 싶습니다.",
  "포장 상태 깔끔하고 품질 우수합니다.",
  "가격 대비 품질 훌륭해요. 재구매 의향 있습니다.",
  "배송 빠르고 상품 상태 양호했습니다.",
  "예상보다 품질이 좋아서 만족합니다.",
  "단골 거래처입니다. 항상 믿을 수 있어요.",
  "크기 균일하고 맛도 좋았습니다.",
  "가격이 저렴한 편인데 품질도 나쁘지 않아요.",
  "이번 거래도 만족스러웠습니다.",
  "신뢰할 수 있는 중도매인입니다. 추천합니다.",
  "처음 거래였는데 기대 이상이었어요.",
  "선별 상태 좋고 불량품 거의 없었습니다.",
];

function getMockRating(seed) {
  // seed 기반으로 고정된 랜덤값 (새로고침마다 바뀌지 않게)
  var v = ((seed * 9301 + 49297) % 233280) / 233280;
  // 3.5, 4.0, 4.5, 5.0 중 하나 (높은 쪽 가중치)
  var steps = [3.5, 4.0, 4.0, 4.5, 4.5, 4.5, 5.0, 5.0];
  return steps[Math.floor(v * steps.length)];
}

function getMockReviewCount(seed) {
  var v = ((seed * 1234 + 5678) % 9999) / 9999;
  return Math.floor(v * 180) + 20; // 20~200건
}

function getMockReviews(seed, count) {
  var reviews = [];
  var reviewCount = Math.min(count, 3); // 최대 3개 미리보기
  for(var i = 0; i < reviewCount; i++) {
    var idx = (seed + i * 7) % MOCK_REVIEWS.length;
    reviews.push(MOCK_REVIEWS[Math.floor(idx)]);
  }
  return reviews;
}

// ── 가상 낙찰자 / 등급 / 출하자 데이터 ──
var MOCK_BIDDERS = [
  "김철수","이영호","박민준","최성진","정재훈","강동원","윤서준","임태양",
  "한상훈","오민석","신현우","황준혁","조성현","배재경","남기훈","류성민",
];
var MOCK_SHIPPERS = [
  {name:"청송농협공선출하회",   phone:"054-873-1234"},
  {name:"논산딸기연합회",       phone:"041-732-5678"},
  {name:"나주배원예농협",       phone:"061-334-2222"},
  {name:"성주참외농협",         phone:"054-931-3333"},
  {name:"제주감귤출하조합",     phone:"064-742-4444"},
  {name:"영천포도연합회",       phone:"054-338-5555"},
  {name:"강원고랭지채소연합회", phone:"033-562-6666"},
  {name:"무안양파농협",         phone:"061-452-7777"},
  {name:"함안수박연합회",       phone:"055-585-8888"},
  {name:"영양고추연합회",       phone:"054-682-9999"},
  {name:"창녕토마토연합회",     phone:"055-533-1010"},
  {name:"해남채소영농조합",     phone:"061-534-2020"},
];
var GRADES = ["특", "상", "보통"];
var GRADE_WEIGHTS = [0.25, 0.50, 0.25]; // 특25% 상50% 보통25%

function pickByWeight(arr, weights, seed) {
  var v = ((seed * 6571 + 31337) % 99991) / 99991;
  var cum = 0;
  for(var i = 0; i < weights.length; i++) {
    cum += weights[i];
    if(v < cum) return arr[i];
  }
  return arr[arr.length-1];
}
function seedPick(arr, seed) {
  return arr[Math.floor(((seed * 2654 + 12345) % 99999) / 99999 * arr.length)];
}

var idCounter = 10000;

// CSV 파싱 (노은시장 실제 데이터)
function parseCSV(csvText) {
  // BOM 제거 + 경락 시트 구조: 경매일시 / 도매시장 / 법인 / 품목 / 품종 / 산지 / 수량 / 단위 / 경락가
  csvText = csvText.replace(/^\uFEFF/, "").replace(/^\xEF\xBB\xBF/, "");
  var lines = csvText.trim().split("\n");
  if(lines.length < 2) return [];

  var rawHeaders = lines[0].split(",").map(function(h){
    return h.trim().replace(/"/g,"").replace(/\uFEFF/g,"").replace(/^\s+|\s+$/g,"");
  });

  // 헤더 매핑 실패 대비: 인덱스 직접 폴백
  // 경락 시트 고정 순서: 0=경매일시, 1=도매시장, 2=법인, 3=품목, 4=품종, 5=산지, 6=수량, 7=단위, 8=경락가
  var IDX = {
    "경매일시": rawHeaders.indexOf("경매일시") >= 0 ? rawHeaders.indexOf("경매일시") : 0,
    "도매시장": rawHeaders.indexOf("도매시장") >= 0 ? rawHeaders.indexOf("도매시장") : 1,
    "법인":     rawHeaders.indexOf("법인")     >= 0 ? rawHeaders.indexOf("법인")     : 2,
    "품목":     rawHeaders.indexOf("품목")     >= 0 ? rawHeaders.indexOf("품목")     : 3,
    "품종":     rawHeaders.indexOf("품종")     >= 0 ? rawHeaders.indexOf("품종")     : 4,
    "산지":     rawHeaders.indexOf("산지")     >= 0 ? rawHeaders.indexOf("산지")     : 5,
    "수량":     rawHeaders.indexOf("수량")     >= 0 ? rawHeaders.indexOf("수량")     : 6,
    "단위":     rawHeaders.indexOf("단위")     >= 0 ? rawHeaders.indexOf("단위")     : 7,
    "경락가":   rawHeaders.indexOf("경락가")   >= 0 ? rawHeaders.indexOf("경락가")   : 8,
  };

  function col(row, name) {
    var idx = IDX[name];
    return idx >= 0 ? (row[idx]||"").trim() : "";
  }

  var records = [];
  for(var i = 1; i < lines.length; i++) {
    var line = lines[i];
    var cols = [];
    var cur = "", inQ = false;
    for(var j = 0; j < line.length; j++) {
      var ch = line[j];
      if(ch==='"') { inQ=!inQ; continue; }
      if(ch===',' && !inQ) { cols.push(cur.trim()); cur=""; continue; }
      cur += ch;
    }
    cols.push(cur.trim());

    var datetimeStr = col(cols, "경매일시");
    var dateStr     = datetimeStr.split(" ")[0];
    var mktName     = col(cols, "도매시장");
    var corpName    = col(cols, "법인");
    var itemName    = col(cols, "품목");
    var variety     = col(cols, "품종");
    var origin      = col(cols, "산지");
    var qty         = parseInt(col(cols, "수량").replace(/,/g,"")) || 0;
    var unit        = col(cols, "단위");
    var price       = parseInt(col(cols, "경락가").replace(/,/g,"")) || 0;

    if(!itemName || !price) continue;

    var market   = getMarket(mktName);
    // 품목명이 "기타과실/기타채소" 등 모호한 경우 품종에서 실제 품목명 추출
    // 예: itemName="기타과실", variety="망고(수입)" → itemName="망고"
    var VAGUE_ITEMS = ["기타과실","기타채소","기타","기타농산물","기타과채","기타화훼"];
    if(VAGUE_ITEMS.indexOf(itemName) !== -1 && variety) {
      var extracted = variety.replace(/\(.*?\)/g,"").trim();
      if(extracted) itemName = extracted;
    }
    var fullName = variety && variety !== itemName ? itemName+"("+variety+")" : itemName;

    records.push({
      id: i,
      date: dateStr,
      market: market,
      itemName: itemName,
      fullName: fullName,
      variety: variety,
      origin: origin,
      qty: qty,
      unit: unit || "개",
      price: price,
      corp: corpName,
      emoji: getEmoji(itemName),
      category: getCategory(itemName),
      isMock: false,
      bidder: "",
      grade: "",
      shipperName: "",
      shipperPhone: "",
    });
  }
  return records;
}

// ── 중도매인 자동 응답 엔진 ──
function generateDealerReply(msg, ctx) {
  var m = msg.replace(/\s/g,"").toLowerCase();
  var item = ctx.itemName || "상품";
  var origin = ctx.origin || "국산";
  var price = ctx.price || 0;
  var grade = ctx.grade || "";
  var qty = ctx.qty || 0;
  var unit = ctx.unit || "개";
  var name = ctx.bidderName || "저";
  var discountPrice = Math.round((price * 0.95) / 100) * 100;
  var minQty = unit==="box" ? 5 : unit==="kg" ? 20 : 10;

  // 키워드 매칭
  if(m.includes("가격") || m.includes("얼마") || m.includes("단가") || m.includes("협의") || m.includes("할인") || m.includes("깎")) {
    var replies = [
      "현재 낙찰가가 "+price.toLocaleString()+"원/"+unit+"인데요, "+minQty+unit+" 이상 구매하시면 "+discountPrice.toLocaleString()+"원으로 드릴 수 있습니다. 대량 구매는 별도 협의 가능해요.",
      "솔직히 말씀드리면 "+price.toLocaleString()+"원이 오늘 경매 최저가 수준이에요. 근데 단골 거래처시면 "+discountPrice.toLocaleString()+"원까지는 조율 가능합니다.",
      "오늘 물량이 많아서 빠른 거래 원하시면 좀 맞춰드릴 수 있어요. 몇 "+unit+" 생각하고 계세요?",
    ];
    return replies[Math.floor(Math.random()*replies.length)];
  }
  if(m.includes("품질") || m.includes("신선") || m.includes("상태") || m.includes("좋아") || m.includes("맛") || m.includes("당도")) {
    var replies = [
      origin+"에서 오늘 새벽 직송 들어온 거라 신선도는 자신 있습니다. "+(grade?"등급은 "+grade+"으로 선별 잘 된 물건이에요.":"선별도 꼼꼼히 했어요.")+' 직접 보시겠어요?',
      "저 "+name+" 이름 걸고 말씀드리는데, 오늘 "+item+" 상태 정말 좋습니다. "+origin+" 산지에서 바로 올라온 거라 신선도 걱정 안 하셔도 돼요.",
      "요즘 "+item+" 시세가 올라서 품질 좋은 게 귀한데, 오늘 물건은 "+(grade||"상품")+" 위주라 소매 내놓기 딱 좋아요. 반품 걱정 없으실 거예요.",
    ];
    return replies[Math.floor(Math.random()*replies.length)];
  }
  if(m.includes("수량") || m.includes("몇") || m.includes("최소") || m.includes("얼마나") || m.includes("박스") || m.includes("키로")) {
    var replies = [
      "최소 "+minQty+unit+"부터 거래 가능하고요, 현재 가용 물량은 "+qty+unit+" 정도 됩니다. 전량 가져가시면 가격 더 맞춰드릴게요.",
      "오늘 총 "+qty+unit+" 확보했는데요, 최소 "+minQty+unit+" 이상이면 거래 가능합니다. 얼마나 필요하세요?",
      "지금 "+qty+unit+" 있어요. 소량도 되는데 "+minQty+unit+" 이하면 단가가 그대로라 사실 "+minQty+unit+" 이상이 이득이에요.",
    ];
    return replies[Math.floor(Math.random()*replies.length)];
  }
  if(m.includes("배송") || m.includes("언제") || m.includes("납품") || m.includes("배달") || m.includes("시간") || m.includes("오늘")) {
    var replies = [
      "오늘 오전 중 결정하시면 내일 새벽 배송 가능합니다. 대전 시내는 당일 오후도 가능해요.",
      "결제 확인 후 익일 새벽 출하 기준이에요. 급하시면 오늘 오후 직접 픽업도 가능하고요.",
      "보통 오전 주문이면 다음날 새벽 시장 시간에 맞춰 납품해 드려요. 위치 어디세요?",
    ];
    return replies[Math.floor(Math.random()*replies.length)];
  }
  if(m.includes("산지") || m.includes("어디") || m.includes("원산지") || m.includes("출하")) {
    var replies = [
      origin+"산입니다. 오늘 새벽 경매 전에 직접 확인한 물건이에요. 원산지 증명서 필요하시면 드릴 수 있어요.",
      ""+origin+" 직출하예요. 중간 유통 없이 바로 올라온 거라 신선도가 달라요.",
      ""+origin+" 농가에서 직접 출하한 물건입니다. 이 산지 "+item+"이 요즘 제일 맛있는 시기예요.",
    ];
    return replies[Math.floor(Math.random()*replies.length)];
  }
  if(m.includes("결제") || m.includes("계좌") || m.includes("입금") || m.includes("현금") || m.includes("카드") || m.includes("세금계산서") || m.includes("세금")) {
    var replies = [
      "현금, 계좌이체 다 됩니다. 세금계산서도 발행 가능하고요. 사업자 등록번호 알려주시면 처리해 드릴게요.",
      "계좌이체 기준이고요, 단골 거래처는 외상도 가능해요. 세금계산서 필요하시면 말씀해 주세요.",
      "결제는 선불 기준인데요, 처음 거래시는 50% 선납 후 잔금 납품 시 지불 방식으로 하고 있어요.",
    ];
    return replies[Math.floor(Math.random()*replies.length)];
  }
  if(m.includes("반품") || m.includes("교환") || m.includes("불량") || m.includes("파손") || m.includes("문제")) {
    var replies = [
      "납품 후 24시간 이내 불량 확인되시면 교환 또는 환불 처리해 드립니다. 사진 찍어서 보내주시면 바로 확인할게요.",
      "물건 상태 자신 있어서 반품 거의 없는데요, 혹시 문제 생기면 책임지고 처리해 드립니다. 걱정 마세요.",
      "도착 즉시 확인해 주세요. 파손이나 불량이 있으면 전화 주시면 바로 처리합니다. 연락처 저장해 두세요.",
    ];
    return replies[Math.floor(Math.random()*replies.length)];
  }
  if(m.includes("처음") || m.includes("처음이") || m.includes("신규") || m.includes("첫") || m.includes("소개")) {
    var replies = [
      "처음 거래시는 샘플 먼저 보내드릴 수 있어요. 한 "+Math.max(1,Math.floor(minQty/2))+unit+" 정도 받아보시고 마음에 드시면 정식 거래 하시죠.",
      "반갑습니다! 저 노은시장 10년째 하고 있어요. 첫 거래라 걱정되시면 소량부터 시작하셔도 됩니다. 신뢰 쌓으면 조건 더 좋게 드릴게요.",
      "처음이시면 일단 "+minQty+unit+" 소량으로 해보시고요, 품질 확인하신 다음에 거래 이어가시면 어떨까요?",
    ];
    return replies[Math.floor(Math.random()*replies.length)];
  }
  if(m.includes("단골") || m.includes("계속") || m.includes("정기") || m.includes("매주") || m.includes("매달")) {
    var replies = [
      "정기 거래면 당연히 가격 조율 가능하죠. 주 단위로 하시면 "+discountPrice.toLocaleString()+"원 고정으로 드릴 수 있어요.",
      "단골 거래처는 다르게 모십니다. 주문량 고정해 주시면 물량 우선 확보해 드리고 가격도 맞춰드려요.",
      "정기 거래 환영합니다! 계약서 쓰는 건 아니고 구두로 하는 거라 편하게 하시면 돼요. 한번 해보시죠.",
    ];
    return replies[Math.floor(Math.random()*replies.length)];
  }
  if(m.includes("경쟁") || m.includes("다른") || m.includes("타업체") || m.includes("싸게") || m.includes("더싸")) {
    var replies = [
      "다른 데서 더 싸게 구하셨으면 거기서 사시는 게 맞죠. 근데 저는 품질로 승부해요. 한번 써보시면 알 거예요.",
      "가격만 보시면 맞추기 어려울 수 있어요. 근데 신선도나 선별 상태 비교해 보시면 왜 이 가격인지 아실 겁니다.",
      "오늘 낙찰가 기준이라 이게 최저예요. 더 낮으면 솔직히 상품 상태를 의심해 보셔야 해요.",
    ];
    return replies[Math.floor(Math.random()*replies.length)];
  }
  if(m.includes("안녕") || m.includes("반가") || m.includes("처음뵙")) {
    return "네 안녕하세요! "+item+" 관심 가져주셔서 감사합니다. "+origin+"산 오늘 경매 물건인데요, 궁금하신 거 편하게 물어보세요.";
  }
  if(m.includes("감사") || m.includes("고마") || m.includes("수고")) {
    return "별말씀을요. 좋은 거래 하시길 바랍니다. 결정되시면 연락 주세요!";
  }
  if(m.includes("알겠") || m.includes("확인") || m.includes("네") || m.includes("좋아요") || m.includes("ㅇㅋ")) {
    return "네, 좋습니다. 추가로 궁금하신 거 있으시면 언제든지 물어보세요. 빠르게 처리해 드릴게요.";
  }
  if(m.includes("생각") || m.includes("고민") || m.includes("알아보고")) {
    return "네, 천천히 생각해 보세요. 오늘 물량 한정이라 결정하시면 빨리 연락 주시고요. 기다리겠습니다.";
  }

  // 기본 응답 (랜덤)
  var defaults = [
    "말씀하신 내용 확인했는데요, 저희 "+item+"은 "+origin+"산 직출하라 믿을 수 있어요. 구체적으로 어떤 부분이 궁금하세요?",
    "네, 지금 "+item+" "+qty+unit+" 보유하고 있고요. 가격이나 조건 더 궁금한 게 있으시면 편하게 물어보세요.",
    "저도 빠른 거래 선호합니다. 오늘 결정하시면 바로 진행 가능해요. 어떻게 생각하세요?",
    ""+item+" 관련해서 더 자세히 말씀드릴까요? 산지, 가격, 배송 중 어떤 부분이 제일 중요하세요?",
    "좋은 물건 소개해 드리고 싶어서요. 한번 시범 거래해 보시면 후회 없으실 거예요.",
  ];
  return defaults[Math.floor(Math.random()*defaults.length)];
}

// ── 중도매인 채팅 모달 ──
function ChatModal(props) {
  var onClose = props.onClose, record = props.record, tradeRow = props.tradeRow;
  var chatType = (window._chatDealer && window._chatDealer.chatType) || "chat";
  var isAnonymous = !!(window._chatDealer && window._chatDealer.anonymous);
  var isAT = !!(window._chatDealer && window._chatDealer.isAT);
  var ms = useState([]); var messages = ms[0]; var setMessages = ms[1];
  var is = useState(false); var isLoading = is[0]; var setIsLoading = is[1];
  var inp = useState(""); var input = inp[0]; var setInput = inp[1];
  var bottomRef = useRef(null);

  var dealerNo = String((tradeRow && tradeRow["낙찰 중도매인"]) || record.bidder || "").trim();
  var dealerLookup = getDealerInfo(dealerNo);
  var bidderName = isAT ? (window._chatDealer&&window._chatDealer.corpName)||record.corp||"법인"
                 : isAnonymous ? "익명 중도매인" : dealerLookup.name;
  var bidderPhone = isAT ? (window._chatDealer&&window._chatDealer.marketPhone)||record.market.phone||""
                  : isAnonymous ? "" : ((tradeRow && tradeRow["중도매인 연락처"]) || dealerLookup.phone || "");
  var itemName = (tradeRow && tradeRow["품목명"]) || record.fullName || record.itemName;
  var origin = (tradeRow && tradeRow["산지명"]) || record.origin || "";
  var price = parseInt((tradeRow && tradeRow["단가"]) || record.price) || 0;
  var grade = (tradeRow && tradeRow["등급"]) || record.grade || "";
  var qty = (tradeRow && tradeRow["수량"]) || record.qty || "";
  var unit = record.unit || "개";

  // 첫 인사 메시지 - 타입별 분기
  useEffect(function(){
    var initMsg = "";
    if(isAT) {
      initMsg = "안녕하세요! "+record.market.name+" "+bidderName+"입니다. "
        +record.itemName+(record.origin?" ("+record.origin+"산)":"")+" 상품 문의 주셨군요! "
        +"구매 수량이나 배송 관련 궁금하신 점 말씀해 주세요.";
    } else if(chatType === "buy") {
      initMsg = "안녕하세요! 저는 대전 노은시장 중도매인 "+bidderName+"입니다. "
        +itemName+(origin?" ("+origin+"산)":"")+" "+grade+"등급 구매 문의 주셨군요! "
        +"오늘 낙찰가는 "+price.toLocaleString()+"원/"+unit+", 수량은 "+qty+unit+" 입니다. "
        +"어느 정도 물량 필요하신가요?";
    } else if(chatType === "inquiry") {
      initMsg = "안녕하세요! 저는 대전 노은시장 중도매인 "+bidderName+"입니다. "
        +itemName+(origin?" ("+origin+"산)":"")+" 상품 문의 주셨군요! "
        +(grade?"현재 등급은 "+grade+"등급이며, ":"")
        +"산지 품질이나 재고 관련해서 궁금하신 점 말씀해 주세요.";
    } else {
      initMsg = "안녕하세요! 저는 대전 노은시장 중도매인 "+bidderName+"입니다. 오늘 "+itemName+(origin?" ("+origin+"산)":"")+" 경매에 참여했습니다. 궁금하신 점 있으시면 말씀해 주세요!";
    }
    setMessages([{role:"assistant", text:initMsg}]);
  }, []);

  useEffect(function(){
    if(bottomRef.current) bottomRef.current.scrollIntoView({behavior:"smooth"});
  }, [messages]);

  function sendMessage() {
    var text = input.trim();
    if(!text || isLoading) return;
    setInput("");
    var newMessages = messages.concat([{role:"user", text:text}]);
    setMessages(newMessages);
    setIsLoading(true);

    // 0.8초 딜레이로 실제 타이핑하는 느낌
    setTimeout(function() {
      var reply = generateDealerReply(text, {
        itemName: itemName, origin: origin, price: price,
        grade: grade, qty: qty, unit: record.unit, bidderName: bidderName,
      });
      setMessages(newMessages.concat([{role:"assistant", text:reply}]));
      setIsLoading(false);
    }, 600 + Math.random()*800);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={function(e){if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:600,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:"20px 20px 0 0",padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{color:"#4ade80",fontSize:10,fontWeight:700,letterSpacing:2}}>
                {chatType==="buy"?"🛒 구매 문의":chatType==="inquiry"?"❓ 상품 문의":"💬 중도매인 채팅"}
              </div>
              <div style={{color:"#fff",fontWeight:800,fontSize:15,marginTop:2}}>
                {bidderName} <span style={{fontSize:11,color:"rgba(255,255,255,0.6)",fontWeight:400}}>· {isAT ? record.market.name : "대전 노은시장"}</span>
              </div>
              <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{background:"rgba(74,222,128,0.2)",color:"#4ade80",fontSize:10,borderRadius:20,padding:"2px 8px"}}>{itemName}{grade?" · "+grade+"등급":""}{price?" · "+price.toLocaleString()+"원":""}</span>
                {!isAnonymous && bidderPhone && <a href={"tel:"+bidderPhone} style={{color:"#86efac",fontSize:10,textDecoration:"none"}}>📞 {bidderPhone}</a>}
                {!isAnonymous && !bidderPhone && <span style={{color:"rgba(255,255,255,0.4)",fontSize:10}}>📞 연락처 등록 예정</span>}
                {isAnonymous && <span style={{color:"rgba(255,255,255,0.4)",fontSize:10}}>🔒 연락처 비공개</span>}
              </div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:"50%",width:30,height:30,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:10,background:"#f8fffe"}}>
          {messages.map(function(m,i){
            var isUser = m.role==="user";
            return (
              <div key={i} style={{display:"flex",justifyContent:isUser?"flex-end":"flex-start"}}>
                {!isUser && <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,marginRight:8,flexShrink:0}}>🌿</div>}
                <div style={{maxWidth:"75%",background:isUser?"#0d2b1a":"#fff",color:isUser?"#fff":"#1a1a1a",borderRadius:isUser?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"9px 13px",fontSize:13,lineHeight:1.6,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
                  {m.text}
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🌿</div>
              <div style={{background:"#fff",borderRadius:"16px 16px 16px 4px",padding:"9px 13px",boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
                <div style={{display:"flex",gap:4}}>
                  {[0,1,2].map(function(i){return <div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#aaa",animation:"bounce 1s infinite",animationDelay:i*0.2+"s"}}/>;}) }
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
        <div style={{padding:"8px 16px",background:"#f0fdf4",display:"flex",gap:6,overflowX:"auto"}}>
          {["가격 협의 가능한가요?","품질 상태는 어떤가요?","최소 구매 수량은?","언제 배송 가능한가요?"].map(function(q){return(
            <button key={q} onClick={function(){setInput(q);}} style={{background:"#fff",border:"1px solid #bbf7d0",borderRadius:20,padding:"5px 12px",fontSize:11,color:G.mid,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{q}</button>
          );})}
        </div>
        <div style={{padding:"10px 16px 20px",background:"#fff",display:"flex",gap:8,borderTop:"1px solid #e5e7eb"}}>
          <input
            value={input}
            onChange={function(e){setInput(e.target.value);}}
            onKeyDown={function(e){if(e.key==="Enter")sendMessage();}}
            placeholder="메시지 입력..."
            style={{flex:1,border:"1.5px solid #bbf7d0",borderRadius:20,padding:"10px 14px",fontSize:13,outline:"none",fontFamily:"inherit"}}
          />
          <button onClick={sendMessage} disabled={!input.trim()||isLoading} style={{background:input.trim()&&!isLoading?G.mid:"#e5e7eb",color:"#fff",border:"none",borderRadius:"50%",width:40,height:40,fontSize:16,cursor:input.trim()&&!isLoading?"pointer":"default",flexShrink:0}}>↑</button>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

// ── 경락 카드 ──
function RecordCard(props) {
  var r = props.record, rank = props.rank, tradeData = props.tradeData || [];
  var purchases = props.purchases || {}, setPurchases = props.setPurchases || function(){};
  var loginUser = props.loginUser;
  var sortBy = props.sortBy || "price";
  var setCartCount = props.setCartCount || function(){};
  var isTop = rank === 1;

  var cs = useState(false); var showChat = cs[0]; var setShowChat = cs[1];
  var pm = useState(null); var payModal = pm[0]; var setPayModal = pm[1];
  var pp = useState(false); var payDone = pp[0]; var setPayDone = pp[1];
  var pmt = useState(""); var payMethod = pmt[0]; var setPayMethod = pmt[1];
  var buyQtyS = useState(1); var buyQty = buyQtyS[0]; var setBuyQty = buyQtyS[1];
  var pku = useState("pickup"); var pickupMethod = pku[0]; var setPickupMethod = pku[1];
  var cms = useState(null); var cartModal = cms[0]; var setCartModal = cms[1];
  var cqty = useState(1); var cartQty = cqty[0]; var setCartQty = cqty[1];

  function addToCart(t, no, itemKey, selectedQty) {
    try {
      var uid = loginUser ? loginUser.id : "guest";
      var cart = JSON.parse(localStorage.getItem("agro_cart_"+uid)||"[]");
      var isAT = cartModal && cartModal.isAT;
      var info = isAT ? {name: cartModal.corpName||"법인", phone:""} : getDealerInfo(no);
      var isAnon = !isAT && (function(){
        var noKey = (function(){ var m = String(no||"").match(/^(\d+)/); return m?String(parseInt(m[1])):String(no||""); })();
        try {
          for(var acc in ACCOUNTS) {
            if(ACCOUNTS[acc].role==="dealer" && String(ACCOUNTS[acc].dealerNo)===noKey) {
              var ds = JSON.parse(localStorage.getItem("agro_dealer_"+acc)||"{}");
              return ds.phonePublic === false;
            }
          }
        } catch(e){}
        return false;
      })();
      var price = parseInt((t["단가"]||"0").replace(/,/g,""))||0;
      var qty = selectedQty || 1;
      var weight = (t["중량"]||"").trim();
      var deposit = Math.round(price * qty * 0.1);
      var exists = cart.find(function(c){ return c.itemKey === itemKey; });
      if(exists){ alert("이미 장바구니에 담긴 상품입니다."); return; }
      cart.push({
        itemKey: itemKey, no: no,
        cardId: cartModal && cartModal.cardId,
        dealerName: isAnon ? "익명 중도매인" : info.name, dealerPhone: isAnon ? "" : (info.phone||""),
        itemName: (t["품목명"]||"").trim(),
        grade: (t["등급"]||"").trim(),
        origin: (t["산지명"]||"").trim(),
        weight: weight, qty: qty, price: price,
        deposit: deposit, total: price * qty,
        addedAt: new Date().toLocaleDateString("ko-KR"),
        market: cartModal && cartModal.market,
      });
      localStorage.setItem("agro_cart_"+uid, JSON.stringify(cart));
      setCartCount(cart.length);
      setCartModal(null);
      alert("🧺 장바구니에 담겼습니다!");
    } catch(e){ alert("오류가 발생했습니다."); }
  }

  // 잔액 읽기/쓰기
  function getBalance(){ try { return parseInt(localStorage.getItem("agro_balance_"+(loginUser&&loginUser.id||"guest"))||"0"); } catch(e){ return 0; } }
  function saveBalance(v){ try { localStorage.setItem("agro_balance_"+(loginUser&&loginUser.id||"guest"), String(v)); } catch(e){} }
  var bals = useState(getBalance()); var curBalance = bals[0]; var setCurBalance = bals[1];

  var displayPrice = r.price;
  var displayUnit  = r.unit;

  return (
    <div style={{background:"#fff",borderRadius:16,border:"2px solid "+(isTop?"#4ade80":"#e5e7eb"),overflow:"hidden",boxShadow:isTop?"0 4px 20px rgba(74,222,128,0.15)":"0 2px 8px rgba(0,0,0,0.05)"}}>
      {isTop && <div style={{background:"linear-gradient(90deg,#0d2b1a,#1b4332)",padding:"4px 14px",fontSize:11,color:"#4ade80",fontWeight:700}}>🏆 최저가</div>}
      {!isTop && rank <= 3 && <div style={{background:"#f9fafb",padding:"4px 14px",fontSize:11,color:"#888",fontWeight:600}}>🥈 {rank}위</div>}

      <div style={{padding:"13px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:28}}>{r.emoji}</span>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{fontWeight:800,fontSize:15,color:"#0d1f15"}}>{r.itemName}</div>
                {!r.isMock && <span style={{background:"#ecfdf5",color:"#059669",fontSize:9,fontWeight:700,borderRadius:10,padding:"2px 6px",border:"1px solid #6ee7b7"}}>🔴 LIVE</span>}
              </div>
              {r.variety && (
                <div style={{fontSize:11,color:"#888",marginTop:1}}>{r.variety}</div>
              )}
              <div style={{fontSize:11,color:"#888",marginTop:1}}>
                🏛️ {r.market.name} · {r.market.region}
              </div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontWeight:900,fontSize:19,color:G.mid}}>{displayPrice.toLocaleString()}<span style={{fontSize:12,fontWeight:500}}>원</span></div>
            <div style={{fontSize:10,color:"#888",marginTop:1,fontWeight:500}}>
              {displayUnit ? "단위 "+fmtUnit(displayUnit)+" · 박스당" : "박스당"}
            </div>
          </div>
        </div>

        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          {r.qty > 0 && (function(){
            var displayQty = (purchases["remainqty_"+r.id] !== undefined) ? purchases["remainqty_"+r.id] : r.qty;
            return <span style={{background:"#f0fdf4",color:G.mid,fontSize:10,fontWeight:600,borderRadius:20,padding:"3px 10px"}}>
              📦 {displayQty}개 {r.unit ? "/ "+fmtUnit(r.unit) : ""}{purchases["remainqty_"+r.id]!==undefined&&<span style={{color:"#f59e0b",marginLeft:3}}>(잔여)</span>}
            </span>;
          })()}
          {r.origin && <span style={{background:"#fffbeb",color:"#92400e",fontSize:10,fontWeight:600,borderRadius:20,padding:"3px 10px"}}>📍 {r.origin}</span>}
          {r.corp && <span style={{background:"#f3f4f6",color:"#555",fontSize:10,borderRadius:20,padding:"3px 10px"}}>🏢 {r.corp}</span>}
          {r.grade && <span style={{background: r.grade==="특"?"#fef9c3": r.grade==="상"?"#dbeafe":"#f3f4f6", color: r.grade==="특"?"#854d0e": r.grade==="상"?"#1e40af":"#555", fontSize:10,fontWeight:700,borderRadius:20,padding:"3px 10px"}}>🏅 {r.grade}등급</span>}
        </div>
        {(r.bidder || r.shipperName) && (
          <div style={{background:"#f8fffe",borderRadius:10,padding:"9px 12px",marginBottom:8,border:"1px solid #e0f7ec"}}>
            <div style={{fontSize:10,fontWeight:700,color:G.mid,marginBottom:6}}>📋 거래 상세정보</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
              <div>
                <div style={{fontSize:9,color:"#aaa",marginBottom:1}}>낙찰자</div>
                <div style={{fontSize:12,fontWeight:700,color:"#1a1a1a"}}>{r.bidder || "-"}</div>
              </div>
              <div>
                <div style={{fontSize:9,color:"#aaa",marginBottom:1}}>등급</div>
                <div style={{fontSize:12,fontWeight:700,color: r.grade==="특"?"#b45309": r.grade==="상"?"#1d4ed8":"#555"}}>{r.grade || "-"}</div>
              </div>
              <div>
                <div style={{fontSize:9,color:"#aaa",marginBottom:1}}>출하자</div>
                <div style={{fontSize:12,fontWeight:600,color:"#1a1a1a"}}>{r.shipperName || "-"}</div>
              </div>
              <div>
                <div style={{fontSize:9,color:"#aaa",marginBottom:1}}>출하자 연락처</div>
                {r.shipperPhone
                  ? <a href={"tel:"+r.shipperPhone} style={{fontSize:12,fontWeight:600,color:G.light,textDecoration:"none"}}>{r.shipperPhone}</a>
                  : <div style={{fontSize:12,color:"#ccc"}}>-</div>
                }
              </div>
            </div>
          </div>
        )}
        {r.reviews && r.reviews.length > 0 && (
          <div style={{marginBottom:8}}>
            <button onClick={function(){setShowReviews(!showReviews);}} style={{background:"none",border:"none",padding:0,fontSize:11,color:G.light,fontWeight:600,cursor:"pointer"}}>
              {showReviews ? "▲ 리뷰 접기" : "▼ 거래후기 보기 ("+r.reviewCount+"건)"}
            </button>
            {showReviews && (
              <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:5}}>
                {r.reviews.map(function(rv, i){
                  return (
                    <div key={i} style={{background:"#f8fffe",borderRadius:8,padding:"7px 10px",fontSize:11,color:"#444",borderLeft:"3px solid #bbf7d0",lineHeight:1.5}}>
                      <StarRating rating={r.rating} size={10}/> <span style={{color:"#888",marginLeft:4}}>{rv}</span>
                    </div>
                  );
                })}
                <div style={{fontSize:10,color:"#bbb",textAlign:"right"}}>외 {r.reviewCount-3}건의 후기 더 보기</div>
              </div>
            )}
          </div>
        )}
        {r.market.id === 8 && (function(){
          // 노은시장: 중도매인 정보 카드로 표시
          var no = r.dealerNo || "";
          var noKey = (function(){ var m = no.match(/^(\d+)/); return m ? String(parseInt(m[1])) : no; })();
          var info = getDealerInfo(no);
          var dealerPrivate = (function(){
            try {
              for(var acc in ACCOUNTS) {
                if(ACCOUNTS[acc].role==="dealer" && String(ACCOUNTS[acc].dealerNo)===noKey) {
                  var ds = JSON.parse(localStorage.getItem("agro_dealer_"+acc)||"{}");
                  return ds.phonePublic === false;
                }
              }
            } catch(e){}
            return false;
          })();
          var itemKey = "noeun_"+no+"_"+(r.auctionTime||r.id);
          var isSold = purchases["soldcard_"+r.id] && purchases["soldcard_"+r.id].status==="완료";
          return (
            <div style={{background:"#f8faff",borderRadius:10,border:"1px solid #bfdbfe",padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{background:dealerPrivate?"#64748b":"#1e3a8a",borderRadius:8,padding:"3px 8px"}}>
                    <span style={{color:"#fff",fontWeight:700,fontSize:11}}>{dealerPrivate ? "익명 중도매인" : info.name}</span>
                    {!dealerPrivate && <span style={{color:"#93c5fd",fontSize:10,marginLeft:4}}>#{noKey}</span>}
                  </div>
                  {!dealerPrivate && info.phone && <a href={"tel:"+info.phone} style={{color:G.light,fontSize:10,textDecoration:"none"}}>📞 {info.phone}</a>}
                  {dealerPrivate && <span style={{fontSize:10,color:"#94a3b8",background:"#f1f5f9",borderRadius:6,padding:"2px 7px"}}>🔒 연락처 비공개</span>}
                </div>
                <span style={{color:"#94a3b8",fontSize:10}}>{r.auctionTime}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:11,color:"#888"}}>{dealerPrivate ? "익명 처리됨" : "낙찰번호 "+noKey}</div>
                <div style={{display:"flex",gap:5}}>
                  {isSold
                    ? <span style={{background:"#fee2e2",color:"#991b1b",borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700}}>판매완료</span>
                    : <>
                        <button onClick={function(){
                          if(!loginUser){ alert("로그인이 필요한 기능입니다.\n로그인 후 이용해주세요."); return; }
                          setBuyQty(1);
                          setPayModal({no:no, tradeRow:{"품목명":r.itemName,"등급":r.grade||"","산지명":r.origin||"","단가":String(r.price||0),"수량":String(r.qty||1),"중량":r.unit||""}, itemKey:itemKey, maxQty:r.qty||1, cardId:r.id});
                        }} style={{background:"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🛒 예약</button>
                        <button onClick={function(){
                          if(!loginUser){ alert("로그인이 필요한 기능입니다.\n로그인 후 이용해주세요."); return; }
                          setCartQty(1);
                          setCartModal({t:{"품목명":r.itemName,"등급":r.grade||"","산지명":r.origin||"","단가":String(r.price||0),"수량":String(r.qty||1),"중량":r.unit||""}, no:no, itemKey:itemKey, maxQty:r.qty||1, cardId:r.id});
                        }} style={{background:"#fff7ed",color:"#c2410c",border:"1px solid #fed7aa",borderRadius:8,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🧺 담기</button>
                        <button onClick={function(){ window._chatDealer={no:dealerPrivate?"익명":no, tradeRow:null, chatType:"inquiry", anonymous:dealerPrivate}; setShowChat(true); }}
                          style={{background:"#fff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:8,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>💬 채팅</button>
                      </>
                  }
                </div>
              </div>
            </div>
          );
        })()}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:10,color:"#aaa"}}>🕐 {r.date}</div>
          <div style={{display:"flex",gap:6}}>
            {r.market.id !== 8 && <>
              <button onClick={function(){
                if(!loginUser){ alert("로그인이 필요한 기능입니다.\n로그인 후 이용해주세요."); return; }
                setBuyQty(1);
                setPayModal({no:"corp", tradeRow:null, itemKey:"at_"+r.id, maxQty:r.qty||1, isAT:true, cardId:r.id});
              }} style={{background:"#16a34a",color:"#fff",border:"none",borderRadius:9,padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🛒 예약</button>
              <button onClick={function(){
                if(!loginUser){ alert("로그인이 필요한 기능입니다.\n로그인 후 이용해주세요."); return; }
                var itemKey = "at_"+r.id;
                try {
                  var c = JSON.parse(localStorage.getItem("agro_cart_"+loginUser.id)||"[]");
                  if(c.find(function(x){return x.itemKey===itemKey;})){
                    alert("이미 장바구니에 담긴 상품입니다."); return;
                  }
                } catch(e){}
                setCartQty(1);
                setCartModal({
                  t:{"품목명":r.itemName,"등급":r.grade||"","산지명":r.origin||"","단가":String(r.price||0),"수량":String(r.qty||1),"중량":r.unit||""},
                  no:"corp", itemKey:itemKey, maxQty:r.qty||1,
                  isAT:true, corpName:r.corp, market:r.market.name, cardId:r.id
                });
              }} style={{background:"#fff7ed",color:"#c2410c",border:"1px solid #fed7aa",borderRadius:9,padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🧺 담기</button>
              <button onClick={function(){
                window._chatDealer={no:"corp", tradeRow:null, chatType:"inquiry", isAT:true, corpName:r.corp, marketPhone:r.market.phone};
                setShowChat(true);
              }} style={{background:"#f0fdf4",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:9,padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>💬 채팅</button>
            </>}
          </div>
        </div>

        {showChat && <ChatModal record={r} tradeRow={window._chatDealer ? window._chatDealer.tradeRow : null} onClose={function(){setShowChat(false); window._chatDealer=null;}}/>}

        {/* 장바구니 수량 선택 모달 */}
        {cartModal && (function(){
          var ct = cartModal.t;
          var cPrice = parseInt((ct["단가"]||"0").replace(/,/g,""))||0;
          var cMaxQty = cartModal.maxQty||1;
          var cSafeQty = Math.max(1, Math.min(cartQty, cMaxQty));
          var cTotal = cPrice * cSafeQty;
          var cDeposit = Math.round(cTotal * 0.1);
          var cInfo = getDealerInfo(cartModal.no);
          var cDealerPrivate = (function(){
            var noKey = (function(){ var m = String(cartModal.no||"").match(/^(\d+)/); return m?String(parseInt(m[1])):String(cartModal.no||""); })();
            try {
              for(var acc in ACCOUNTS) {
                if(ACCOUNTS[acc].role==="dealer" && String(ACCOUNTS[acc].dealerNo)===noKey) {
                  var ds = JSON.parse(localStorage.getItem("agro_dealer_"+acc)||"{}");
                  return ds.phonePublic === false;
                }
              }
            } catch(e){}
            return false;
          })();
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={function(e){if(e.target===e.currentTarget)setCartModal(null);}}>
              <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:380,overflow:"hidden"}}>
                <div style={{background:"linear-gradient(135deg,#9a3412,#c2410c)",padding:"14px 16px"}}>
                  <div style={{color:"#fed7aa",fontSize:10,fontWeight:700,letterSpacing:2}}>🧺 장바구니 담기</div>
                  <div style={{color:"#fff",fontWeight:800,fontSize:15,marginTop:4}}>{(ct["품목명"]||"").trim()} {(ct["등급"]||"")&&"· "+(ct["등급"]||"").trim()+"등급"}</div>
                  <div style={{color:"rgba(255,255,255,0.6)",fontSize:11,marginTop:2}}>중도매인 {cDealerPrivate?"익명":cInfo.name} · 대전 노은시장</div>
                </div>
                <div style={{padding:"16px"}}>
                  <div style={{background:"#f9fafb",borderRadius:12,padding:"14px",marginBottom:14}}>
                    {[["산지",(ct["산지명"]||"").trim()||"-"],["단가",cPrice.toLocaleString()+"원"]].map(function(row){return(
                      <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #e5e7eb",fontSize:13}}>
                        <span style={{color:"#888"}}>{row[0]}</span>
                        <span style={{fontWeight:500}}>{row[1]}</span>
                      </div>
                    );})}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #e5e7eb"}}>
                      <span style={{color:"#888",fontSize:13}}>수량</span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <button onClick={function(){setCartQty(function(q){return Math.max(1,q-1);});}} style={{width:28,height:28,borderRadius:"50%",border:"1.5px solid #d1d5db",background:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                        <input type="number" min="1" max={cMaxQty} value={cSafeQty} onChange={function(e){var v=parseInt(e.target.value)||1; setCartQty(Math.max(1,Math.min(cMaxQty,v)));}} style={{width:52,textAlign:"center",border:"1.5px solid #bbf7d0",borderRadius:8,padding:"4px 0",fontSize:15,fontWeight:700,outline:"none"}}/>
                        <button onClick={function(){setCartQty(function(q){return Math.min(cMaxQty,q+1);});}} style={{width:28,height:28,borderRadius:"50%",border:"1.5px solid #d1d5db",background:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                        <span style={{fontSize:10,color:"#aaa"}}>/ 최대 {cMaxQty}개</span>
                      </div>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",fontSize:13}}>
                      <span style={{color:"#888"}}>총 거래금액</span>
                      <span style={{fontWeight:900,color:"#1e40af",fontSize:14}}>{cTotal.toLocaleString()}원</span>
                    </div>
                  </div>
                  <div style={{background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:12,padding:"12px",marginBottom:14,fontSize:11,color:"#92400e"}}>
                    🧺 장바구니에 담으면 마이페이지에서 한번에 결제할 수 있어요.<br/>
                    보증금 <b style={{color:"#c2410c"}}>{cDeposit.toLocaleString()}원</b>이 결제 시 차감됩니다.
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={function(){setCartModal(null);}} style={{flex:1,background:"#f3f4f6",color:"#888",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>취소</button>
                    <button onClick={function(){addToCart(ct, cartModal.no, cartModal.itemKey, cSafeQty);}} style={{flex:2,background:"linear-gradient(135deg,#9a3412,#c2410c)",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:14,fontWeight:900,cursor:"pointer"}}>🧺 {cSafeQty}개 담기</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        {payModal && (function(){
          var t = payModal.tradeRow;
          var isAT = payModal.isAT;
          var itemName = (t&&t["품목명"]) || r.itemName;
          var grade = (t&&t["등급"]) || r.grade || "";
          var price = parseInt((t&&t["단가"])||r.price)||0;
          var maxQty = payModal.maxQty || parseInt((t&&t["수량"])||r.qty) || 1;
          var origin = (t&&t["산지명"]) || r.origin;
          var dealerInfo = isAT
            ? {name: r.corp || "법인", phone: r.market.phone || ""}
            : getDealerInfo(payModal.no);
          // 익명 설정 확인
          var payDealerPrivate = !isAT && (function(){
            var noKey = (function(){ var m = String(payModal.no||"").match(/^(\d+)/); return m?String(parseInt(m[1])):String(payModal.no||""); })();
            try {
              for(var acc in ACCOUNTS) {
                if(ACCOUNTS[acc].role==="dealer" && String(ACCOUNTS[acc].dealerNo)===noKey) {
                  var ds = JSON.parse(localStorage.getItem("agro_dealer_"+acc)||"{}");
                  return ds.phonePublic === false;
                }
              }
            } catch(e){}
            return false;
          })();
          var safeQty = Math.max(1, Math.min(buyQty, maxQty));
          var total = price * safeQty;
          var deposit = Math.round(total * 0.1);
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={function(e){if(e.target===e.currentTarget)setPayModal(null);}}>
              <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:400,overflow:"hidden",maxHeight:"90vh",overflowY:"auto"}}>
                <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",padding:"16px"}}>
                  <div style={{color:"#4ade80",fontSize:10,fontWeight:700,letterSpacing:2}}>🛒 구매예약 · 보증금 결제</div>
                  <div style={{color:"#fff",fontWeight:800,fontSize:16,marginTop:4}}>{itemName} {grade&&"· "+grade+"등급"}</div>
                  <div style={{color:"rgba(255,255,255,0.6)",fontSize:11,marginTop:2}}>{isAT ? r.market.name+" · "+r.corp : "중도매인 "+(payDealerPrivate?"익명":dealerInfo.name)+" · 대전 노은시장"}</div>
                </div>
                <div style={{padding:"16px"}}>
                  <div style={{background:"#f8fffe",borderRadius:12,padding:"14px",marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:8}}>📦 거래 정보</div>
                    {[
                      ["산지",origin||"-"],
                      ["등급",grade||"-"],
                      ["단가",price.toLocaleString()+"원"],
                    ].map(function(row){return(
                      <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #e5e7eb",fontSize:13}}>
                        <span style={{color:"#888"}}>{row[0]}</span>
                        <span style={{fontWeight:500,color:"#333"}}>{row[1]}</span>
                      </div>
                    );})}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #e5e7eb"}}>
                      <span style={{color:"#888",fontSize:13}}>구매 수량</span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <button onClick={function(){setBuyQty(function(q){return Math.max(1,q-1);});}}
                          style={{width:28,height:28,borderRadius:"50%",border:"1.5px solid #d1d5db",background:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#555"}}>−</button>
                        <input type="number" min="1" max={maxQty} value={safeQty} onChange={function(e){var v=parseInt(e.target.value)||1; setBuyQty(Math.max(1,Math.min(maxQty,v)));}} style={{width:52,textAlign:"center",border:"1.5px solid #bbf7d0",borderRadius:8,padding:"4px 0",fontSize:15,fontWeight:700,outline:"none"}}/>
                        <button onClick={function(){setBuyQty(function(q){return Math.min(maxQty,q+1);});}}
                          style={{width:28,height:28,borderRadius:"50%",border:"1.5px solid #d1d5db",background:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#555"}}>+</button>
                        <span style={{fontSize:10,color:"#aaa"}}>/ 최대 {maxQty}개</span>
                      </div>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",fontSize:13}}>
                      <span style={{color:"#888"}}>총 거래금액</span>
                      <span style={{fontWeight:900,color:"#1e40af",fontSize:14}}>{total.toLocaleString()}원</span>
                    </div>
                  </div>
                  <div style={{background:"linear-gradient(135deg,#ecfdf5,#d1fae5)",border:"1.5px solid #6ee7b7",borderRadius:12,padding:"14px",marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div style={{fontSize:12,fontWeight:700,color:G.mid}}>💳 지금 납부할 보증금 (예치금)</div>
                      <div style={{fontSize:18,fontWeight:900,color:G.dark}}>{deposit.toLocaleString()}원</div>
                    </div>
                    <div style={{fontSize:11,color:"#065f46",lineHeight:1.6}}>
                      총 거래금액의 <b>10%</b>를 보증금으로 선납합니다.<br/>
                      나머지 잔금은 수령 시 중도매인에게 직접 결제합니다.
                    </div>
                  </div>
                  {!payDone && <div style={{background:"#f9fafb",borderRadius:12,padding:"12px",marginBottom:12}}>
                    {/* 수령방법 선택 */}
                    <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:8}}>수령 방법</div>
                    <div style={{display:"flex",gap:8,marginBottom:14}}>
                      {[["pickup","🏃 직접 수령"],["delivery","🚚 배송 요청"]].map(function(opt){
                        var sel = pickupMethod===opt[0];
                        return <button key={opt[0]} onClick={function(){setPickupMethod(opt[0]);}}
                          style={{flex:1,padding:"9px 0",background:sel?"#0d2b1a":"#fff",color:sel?"#4ade80":"#555",border:"1.5px solid "+(sel?"#2d6a4f":"#e5e7eb"),borderRadius:10,fontSize:12,fontWeight:sel?700:400,cursor:"pointer"}}>
                          {opt[1]}
                        </button>;
                      })}
                    </div>
                    {pickupMethod==="delivery" && <div style={{background:"#f0fdf4",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:11,color:"#065f46"}}>
                      📍 배송지: {(function(){ try { var s=JSON.parse(localStorage.getItem("agro_buyer_"+(loginUser&&loginUser.id||"guest"))||"{}"); return s.bizAddr||"마이페이지에서 주소를 입력해주세요"; } catch(e){ return "주소 없음"; } })()}
                    </div>}
                    <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:8}}>결제 수단 선택</div>
                    {[["balance","💰 예치금 결제"],["card","💳 카드결제"],["kakao","🟡 카카오페이"],["transfer","🏦 계좌이체"]].map(function(pm){
                      var selected = payMethod === pm[0];
                      var isBalance = pm[0]==="balance";
                      var notEnough = isBalance && curBalance < deposit;
                      return (
                        <div key={pm[0]}
                          onClick={function(){ if(!notEnough) setPayMethod(pm[0]); }}
                          style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:8,
                            border:"1.5px solid "+(selected?"#40916c":notEnough?"#fca5a5":"#e5e7eb"),
                            marginBottom:6, background:selected?"#f0fdf4":notEnough?"#fff5f5":"#fff",
                            cursor:notEnough?"not-allowed":"pointer",transition:"all 0.15s",opacity:notEnough?0.6:1}}>
                          <span style={{fontSize:18}}>{pm[1].split(" ")[0]}</span>
                          <div style={{flex:1}}>
                            <span style={{fontSize:13,fontWeight:selected?700:500,color:selected?"#065f46":"#333"}}>{pm[1].split(" ").slice(1).join(" ")}</span>
                            {isBalance && <div style={{fontSize:10,color:notEnough?"#ef4444":"#059669",marginTop:1}}>잔액 {curBalance.toLocaleString()}원 {notEnough?"(부족 - 마이페이지에서 충전)":"사용 가능"}</div>}
                          </div>
                          {selected && <span style={{marginLeft:"auto",color:"#40916c",fontWeight:700,fontSize:12}}>✓ 선택됨</span>}
                        </div>
                      );
                    })}
                    {payMethod==="card" && (
                      <div style={{marginTop:10,background:"#fff",borderRadius:10,padding:"14px",border:"1px solid #e5e7eb"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:10}}>카드 정보 입력</div>
                        <div style={{background:"linear-gradient(135deg,#1e3a8a,#2563eb)",borderRadius:12,padding:"16px",marginBottom:12,color:"#fff"}}>
                          <div style={{fontSize:9,opacity:0.7,marginBottom:8}}>CREDIT CARD</div>
                          <div style={{fontSize:14,fontWeight:700,letterSpacing:4,marginBottom:8}}>**** **** **** ****</div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,opacity:0.8}}>
                            <span>카드소유자</span><span>MM/YY</span>
                          </div>
                        </div>
                        <input placeholder="카드번호 (16자리)" maxLength={19}
                          onChange={function(e){
                            var v=e.target.value.replace(/\D/g,"").substring(0,16);
                            e.target.value=v.replace(/(.{4})/g,"$1 ").trim();
                          }}
                          style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,marginBottom:8,outline:"none",boxSizing:"border-box"}}/>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                          <input placeholder="유효기간 MM/YY" maxLength={5}
                            onChange={function(e){
                              var v=e.target.value.replace(/\D/g,"");
                              if(v.length>2) v=v.substring(0,2)+"/"+v.substring(2,4);
                              e.target.value=v;
                            }}
                            style={{border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none"}}/>
                          <input placeholder="CVC" maxLength={3}
                            type="password"
                            style={{border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none"}}/>
                        </div>
                        <input placeholder="카드 비밀번호 앞 2자리" maxLength={2} type="password"
                          style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                      </div>
                    )}
                    {payMethod==="kakao" && (
                      <div style={{marginTop:10,background:"#fff",borderRadius:10,padding:"14px",border:"1px solid #e5e7eb",textAlign:"center"}}>
                        <div style={{background:"#FEE500",borderRadius:12,padding:"16px",marginBottom:12,display:"inline-block",width:"100%",boxSizing:"border-box"}}>
                          <div style={{fontSize:22,fontWeight:900,color:"#3A1D1D"}}>kakao pay</div>
                          <div style={{fontSize:12,color:"#3A1D1D",marginTop:4,opacity:0.7}}>카카오페이로 간편결제</div>
                        </div>
                        <div style={{background:"#f9f9f9",borderRadius:8,padding:"12px",marginBottom:10,textAlign:"center"}}>
                          <div style={{fontSize:10,color:"#888",marginBottom:8}}>QR코드로 결제</div>
                          <div style={{display:"inline-block",background:"#fff",padding:8,borderRadius:8,border:"1px solid #e5e7eb"}}>
                            <svg width="150" height="150" viewBox="0 0 142 142" xmlns="http://www.w3.org/2000/svg">
<rect width="142" height="142" fill="white" rx="4"/>
<rect x="8" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="14" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="26" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="32" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="38" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="62" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="86" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="98" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="104" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="116" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="122" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="8" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="14" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="14" width="5" height="5" fill="#1a1a1a"/>
<rect x="62" y="14" width="5" height="5" fill="#1a1a1a"/>
<rect x="68" y="14" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="14" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="14" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="20" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="20" width="5" height="5" fill="#1a1a1a"/>
<rect x="26" y="20" width="5" height="5" fill="#1a1a1a"/>
<rect x="32" y="20" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="20" width="5" height="5" fill="#1a1a1a"/>
<rect x="68" y="20" width="5" height="5" fill="#1a1a1a"/>
<rect x="86" y="20" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="20" width="5" height="5" fill="#1a1a1a"/>
<rect x="104" y="20" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="20" width="5" height="5" fill="#1a1a1a"/>
<rect x="116" y="20" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="20" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="26" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="32" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="62" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="74" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="80" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="104" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="116" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="26" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="26" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="32" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="62" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="68" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="86" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="104" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="116" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="32" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="38" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="38" width="5" height="5" fill="#1a1a1a"/>
<rect x="80" y="38" width="5" height="5" fill="#1a1a1a"/>
<rect x="86" y="38" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="38" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="38" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="14" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="26" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="32" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="38" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="56" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="68" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="80" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="86" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="98" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="104" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="116" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="122" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="44" width="5" height="5" fill="#1a1a1a"/>
<rect x="62" y="50" width="5" height="5" fill="#1a1a1a"/>
<rect x="68" y="50" width="5" height="5" fill="#1a1a1a"/>
<rect x="74" y="50" width="5" height="5" fill="#1a1a1a"/>
<rect x="86" y="50" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="56" width="5" height="5" fill="#1a1a1a"/>
<rect x="86" y="56" width="5" height="5" fill="#1a1a1a"/>
<rect x="86" y="62" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="62" width="5" height="5" fill="#1a1a1a"/>
<rect x="98" y="62" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="62" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="62" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="68" width="5" height="5" fill="#1a1a1a"/>
<rect x="14" y="68" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="68" width="5" height="5" fill="#1a1a1a"/>
<rect x="26" y="68" width="5" height="5" fill="#1a1a1a"/>
<rect x="32" y="68" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="68" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="68" width="5" height="5" fill="#1a1a1a"/>
<rect x="104" y="68" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="68" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="68" width="5" height="5" fill="#1a1a1a"/>
<rect x="14" y="74" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="74" width="5" height="5" fill="#1a1a1a"/>
<rect x="38" y="74" width="5" height="5" fill="#1a1a1a"/>
<rect x="50" y="74" width="5" height="5" fill="#1a1a1a"/>
<rect x="104" y="74" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="74" width="5" height="5" fill="#1a1a1a"/>
<rect x="116" y="74" width="5" height="5" fill="#1a1a1a"/>
<rect x="122" y="74" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="80" width="5" height="5" fill="#1a1a1a"/>
<rect x="14" y="80" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="80" width="5" height="5" fill="#1a1a1a"/>
<rect x="32" y="80" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="80" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="80" width="5" height="5" fill="#1a1a1a"/>
<rect x="98" y="80" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="80" width="5" height="5" fill="#1a1a1a"/>
<rect x="116" y="80" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="80" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="14" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="50" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="56" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="74" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="80" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="104" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="122" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="86" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="14" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="26" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="32" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="38" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="68" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="86" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="116" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="92" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="98" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="98" width="5" height="5" fill="#1a1a1a"/>
<rect x="80" y="98" width="5" height="5" fill="#1a1a1a"/>
<rect x="104" y="98" width="5" height="5" fill="#1a1a1a"/>
<rect x="116" y="98" width="5" height="5" fill="#1a1a1a"/>
<rect x="122" y="98" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="104" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="104" width="5" height="5" fill="#1a1a1a"/>
<rect x="26" y="104" width="5" height="5" fill="#1a1a1a"/>
<rect x="32" y="104" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="104" width="5" height="5" fill="#1a1a1a"/>
<rect x="68" y="104" width="5" height="5" fill="#1a1a1a"/>
<rect x="86" y="104" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="104" width="5" height="5" fill="#1a1a1a"/>
<rect x="98" y="104" width="5" height="5" fill="#1a1a1a"/>
<rect x="104" y="104" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="104" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="110" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="110" width="5" height="5" fill="#1a1a1a"/>
<rect x="26" y="110" width="5" height="5" fill="#1a1a1a"/>
<rect x="32" y="110" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="110" width="5" height="5" fill="#1a1a1a"/>
<rect x="68" y="110" width="5" height="5" fill="#1a1a1a"/>
<rect x="74" y="110" width="5" height="5" fill="#1a1a1a"/>
<rect x="80" y="110" width="5" height="5" fill="#1a1a1a"/>
<rect x="86" y="110" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="110" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="116" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="116" width="5" height="5" fill="#1a1a1a"/>
<rect x="26" y="116" width="5" height="5" fill="#1a1a1a"/>
<rect x="32" y="116" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="116" width="5" height="5" fill="#1a1a1a"/>
<rect x="80" y="116" width="5" height="5" fill="#1a1a1a"/>
<rect x="92" y="116" width="5" height="5" fill="#1a1a1a"/>
<rect x="98" y="116" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="116" width="5" height="5" fill="#1a1a1a"/>
<rect x="116" y="116" width="5" height="5" fill="#1a1a1a"/>
<rect x="122" y="116" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="116" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="122" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="122" width="5" height="5" fill="#1a1a1a"/>
<rect x="62" y="122" width="5" height="5" fill="#1a1a1a"/>
<rect x="74" y="122" width="5" height="5" fill="#1a1a1a"/>
<rect x="104" y="122" width="5" height="5" fill="#1a1a1a"/>
<rect x="116" y="122" width="5" height="5" fill="#1a1a1a"/>
<rect x="122" y="122" width="5" height="5" fill="#1a1a1a"/>
<rect x="8" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="14" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="20" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="26" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="32" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="38" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="44" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="62" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="68" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="74" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="80" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="98" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="104" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="110" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="116" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="128" y="128" width="5" height="5" fill="#1a1a1a"/>
<rect x="57" y="57" width="28" height="28" rx="4" fill="#FEE500"/>
<text x="71" y="76" textAnchor="middle" fontSize="16" fontWeight="900" fill="#3A1D1D" fontFamily="Arial">K</text>
</svg>
                          </div>
                          <div style={{fontSize:10,color:"#aaa",marginTop:8}}>카카오톡 → 더보기 → 페이 → QR결제</div>
                        </div>
                        <div style={{fontSize:11,color:"#555",background:"#fffde7",borderRadius:8,padding:"8px 12px"}}>
                          결제금액: <b style={{color:"#1a1a1a"}}>{deposit.toLocaleString()}원</b>
                        </div>
                      </div>
                    )}
                    {payMethod==="transfer" && (
                      <div style={{marginTop:10,background:"#fff",borderRadius:10,padding:"14px",border:"1px solid #e5e7eb"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:10}}>입금 계좌 안내</div>
                        <div style={{background:"#f0fdf4",borderRadius:8,padding:"12px",marginBottom:10}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                            <span style={{fontSize:11,color:"#888"}}>은행</span>
                            <span style={{fontSize:12,fontWeight:700,color:"#1a1a1a"}}>농협은행</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                            <span style={{fontSize:11,color:"#888"}}>계좌번호</span>
                            <span style={{fontSize:12,fontWeight:700,color:"#1a1a1a"}}>352-0919-7423-83</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                            <span style={{fontSize:11,color:"#888"}}>예금주</span>
                            <span style={{fontSize:12,fontWeight:700,color:"#1a1a1a"}}>(주)농작교</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between"}}>
                            <span style={{fontSize:11,color:"#888"}}>입금액</span>
                            <span style={{fontSize:13,fontWeight:900,color:"#16a34a"}}>{deposit.toLocaleString()}원</span>
                          </div>
                        </div>
                        <input placeholder="입금자명 (본인 이름 입력)"
                          style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
                        <div style={{fontSize:10,color:"#e55",background:"#fff5f5",borderRadius:6,padding:"6px 10px"}}>
                          ⚠️ 입금 후 확인까지 최대 10분 소요될 수 있습니다
                        </div>
                      </div>
                    )}
                  </div>}
                  <div style={{background:"#fef9c3",borderRadius:10,padding:"10px 12px",fontSize:11,color:"#854d0e",marginBottom:14,lineHeight:1.6}}>
                    ⚠️ 보증금 납부 후 예약이 확정되며, 상품은 판매완료로 표시됩니다.<br/>
                    취소 시 보증금 환불은 중도매인과 협의하세요.
                  </div>
                  {payDone
                    ? <div style={{textAlign:"center",padding:"16px 0"}}>
                        <div style={{fontSize:40,marginBottom:8}}>✅</div>
                        <div style={{fontWeight:800,fontSize:15,color:G.mid}}>보증금 납부 완료!</div>
                        <div style={{fontSize:12,color:"#888",marginTop:4}}>예약이 확정되었습니다</div>
                        <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:"14px",marginTop:12,textAlign:"left"}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                            <span style={{fontSize:12,color:"#888"}}>납부 보증금</span>
                            <span style={{fontSize:16,fontWeight:900,color:G.mid}}>{deposit.toLocaleString()}원</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                            <span style={{fontSize:12,color:"#888"}}>총 거래금액</span>
                            <span style={{fontSize:12,color:"#555"}}>{total.toLocaleString()}원</span>
                          </div>

                        </div>
                        {!payDealerPrivate && dealerInfo.phone && <a href={"tel:"+dealerInfo.phone} style={{display:"block",marginTop:12,background:G.mid,color:"#fff",borderRadius:12,padding:"12px",textAlign:"center",fontWeight:700,fontSize:13,textDecoration:"none"}}>📞 {dealerInfo.name} 연락하기</a>}
                        <button onClick={function(){setPayModal(null);setPayDone(false);}} style={{width:"100%",marginTop:8,background:"#f3f4f6",color:"#888",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>닫기</button>
                      </div>
                    : <div style={{display:"flex",gap:8,flexDirection:"column"}}>
                        {!payMethod && <div style={{textAlign:"center",fontSize:12,color:"#e55",padding:"4px 0"}}>결제 수단을 먼저 선택해주세요</div>}
                        <div style={{display:"flex",gap:8}}>
                        <button onClick={function(){setPayModal(null);setPayMethod("");}} style={{flex:1,background:"#f3f4f6",color:"#888",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>취소</button>
                        <button disabled={!payMethod} onClick={async function(){
                          var pKey = payModal.no+"_"+payModal.itemKey;
                          try {
                            var res = await fetch("/api/purchase",{
                              method:"POST",
                              headers:{"Content-Type":"application/json"},
                              body:JSON.stringify({
                                dealerNo:payModal.no, itemKey:payModal.itemKey,
                                buyer:(loginUser&&loginUser.name)||"구매자",
                                itemName:itemName, grade:grade, price:price, qty:safeQty, unit:"개", origin:origin,
                                deposit:deposit, total:total, payMethod:payMethod
                              })
                            });
                            var json = await res.json();
                            if(json.ok || res.status===409){
                              // 예치금 결제면 잔액 차감
                              if(payMethod==="balance"){
                                var newBal = curBalance - deposit;
                                saveBalance(newBal);
                                setCurBalance(newBal);
                              }
                              setPurchases(function(prev){
                                var n=Object.assign({},prev);
                                n[pKey]={status:"완료",deposit:deposit,total:total,payMethod:payMethod,cardId:payModal.cardId,purchasedQty:safeQty,itemName:itemName};
                                if(payModal.cardId!==undefined&&payModal.cardId!==null){
                                  var prevRemain = prev["remainqty_"+String(payModal.cardId)];
                                  var origQty = prevRemain !== undefined ? prevRemain : maxQty;
                                  var newRemain = origQty - safeQty;
                                  if(newRemain <= 0){
                                    n["soldcard_"+String(payModal.cardId)]={status:"완료"};
                                  } else {
                                    n["remainqty_"+String(payModal.cardId)] = newRemain;
                                  }
                                }
                                try{localStorage.setItem("agro_sold_cards",JSON.stringify(n));}catch(e){}
                                return n;
                              });
                              // localStorage에 구매 내역 저장
                              try {
                                var uid = loginUser ? loginUser.id : "guest";
                                var existing = JSON.parse(localStorage.getItem("agro_purchase_"+uid)||"[]");
                                existing.push({key:pKey, itemName:itemName, grade:grade, origin:origin, price:price, qty:safeQty, deposit:deposit, total:total, payMethod:payMethod, date:new Date().toLocaleDateString("ko-KR"), dealerName:dealerInfo.name, cardId:payModal.cardId, purchasedQty:safeQty});
                                localStorage.setItem("agro_purchase_"+uid, JSON.stringify(existing));
                              } catch(e){}
                              setPayDone(true);
                            }
                          } catch(e){ alert("오류가 발생했습니다"); }
                        }} style={{flex:2,background:payMethod?"linear-gradient(135deg,#0d2b1a,#40916c)":"#d1d5db",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:14,fontWeight:900,cursor:payMethod?"pointer":"not-allowed",opacity:payMethod?1:0.6}}>💳 보증금 {deposit.toLocaleString()}원 결제</button>
                        </div>
                      </div>
                  }
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}


var DEALER_INFO = {
  "11":  {name:"하귀봉", phone:"010-9297-5879"},
  "18":  {name:"홍경희", phone:"010-8809-4956"},
  "23":  {name:"이인희", phone:"010-6647-9790"},
  "52":  {name:"김준선", phone:"010-8458-9007"},
  "55":  {name:"최기원", phone:"010-4812-4151"},
  "65":  {name:"윤영숙", phone:"010-2413-4151"},
  "87":  {name:"배회정", phone:"010-4248-7895"},
  "102": {name:"권용만", phone:"010-9144-3625"},
  "103": {name:"채나온", phone:"010-7172-0607"},
  "109": {name:"이민형", phone:"010-9446-7388"},
  "144": {name:"박윤수", phone:"010-4153-7757"},
  "152": {name:"이종민", phone:"010-4434-9202"},
  "153": {name:"김재성", phone:"010-3451-1969"},
  "154": {name:"김자년", phone:"010-5451-6007"},
  "155": {name:"전협",   phone:"010-3227-7077"},
  "163": {name:"안미숙", phone:"010-5434-1513"},
  "165": {name:"황규석", phone:"010-5453-5380"},
  "166": {name:"차인국", phone:"010-5406-1863"},
  "167": {name:"백은심", phone:"010-5402-1660"},
  "174": {name:"박대영", phone:"010-9401-4381"},
  "176": {name:"정봉규", phone:"010-9411-7211"},
  "177": {name:"김도희", phone:"010-7569-5454"},
  "180": {name:"이진영", phone:"010-7406-4956"},
  "181": {name:"최창식", phone:"010-5433-7185"},
  "182": {name:"한상범", phone:"010-4420-4100"},
  "186": {name:"김은미", phone:"010-6408-4459"},
  "188": {name:"김연풍", phone:"010-2423-7371"},
  "195": {name:"김명용", phone:"010-8818-7416"},
  "197": {name:"문기연", phone:"010-4412-2672"},
  "198": {name:"박미서", phone:"010-7742-0101"},
  "199": {name:"최종철", phone:"010-5406-0952"},
  "200": {name:"김복호", phone:"010-3774-7775"},
  "203": {name:"서종원", phone:"010-6220-4849"},
  "207": {name:"배순심", phone:"010-6624-9106"},
  "209": {name:"김동준", phone:"010-8425-3724"},
  "233": {name:"이청수", phone:"010-5466-9790"},
  "295": {name:"김지원", phone:"010-5530-7744"},
  "300": {name:"권경진", phone:"010-2250-3117"},
  "303": {name:"김은옥", phone:"010-6403-4849"},
  "304": {name:"김종욱", phone:"010-3431-1544"},
  "309": {name:"김선계", phone:"010-8803-3724"},
  "317": {name:"고명노", phone:"010-5423-0260"},
  "342": {name:"박찬웅", phone:"010-4852-2346"},
  "346": {name:"김형규", phone:"010-6342-5608"},
  "351": {name:"이근학", phone:"010-3896-6172"},
  "352": {name:"김철수", phone:"010-5508-9756"},
  "354": {name:"정종헌", phone:"010-7187-6969"},
  "365": {name:"신명숙", phone:"010-9219-8768"},
};

function getDealerInfo(no) {
  var key = String(no||"").trim();
  // "180 이진영" 형식 → 번호만 추출
  var m = key.match(/^(\d+)/);
  if(m) key = String(parseInt(m[1]));
  // 직접 찾기
  var info = DEALER_INFO[key] || DEALER_INFO[key.padStart(3,"0")] || DEALER_INFO[key.padStart(2,"0")] || null;
  if(info) return info;
  // 이름이 같이 온 경우 이름 활용
  var namePart = no ? String(no).replace(/^\d+\s*/, "").trim() : "";
  return {name: namePart || ("중도매인 #"+key), phone:""};
}
var ACCOUNTS = {
  buyer:  { pw:"1234", role:"buyer",  name:"김소매",   biz:"소매상회",     bizNo:"123-45-67890", phone:"010-1234-5678" },
  dealer: { pw:"1234", role:"dealer", name:"중도매인",  dealerNo:"180" },
};

// ── 로그인 모달 ──
function LoginModal(props) {
  var onLogin = props.onLogin, onClose = props.onClose;
  var rs = useState("buyer"); var role = rs[0]; var setRole = rs[1];
  var is = useState(""); var id = is[0]; var setId = is[1];
  var ps = useState(""); var pw = ps[0]; var setPw = ps[1];
  var es = useState(""); var err = es[0]; var setErr = es[1];

  function doLogin() {
    var acc = ACCOUNTS[id];
    if(!acc || acc.pw !== pw) { setErr("아이디 또는 비밀번호가 올바르지 않습니다."); return; }
    if(acc.role !== role) { setErr("선택한 회원 유형과 계정이 맞지 않습니다."); return; }
    onLogin({id:id, ...acc});
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={function(e){if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:360,overflow:"hidden"}}>
        <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",padding:"20px 20px 16px"}}>
          <div style={{color:"#52b788",fontSize:10,letterSpacing:3,fontWeight:700}}>AGRO CONNECT</div>
          <div style={{color:"#fff",fontWeight:900,fontSize:18,marginTop:4}}>농작교 로그인</div>
          <button onClick={onClose} style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:"50%",width:28,height:28,cursor:"pointer",fontSize:14}}>✕</button>
        </div>
        <div style={{padding:"20px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
            {[["buyer","🛒 구매자"],["dealer","🏪 중도매인"]].map(function(r){return(
              <button key={r[0]} onClick={function(){setRole(r[0]);setId("");setPw("");setErr("");}} style={{padding:"10px",border:"2px solid "+(role===r[0]?G.mid:"#e5e7eb"),borderRadius:12,background:role===r[0]?"#f0fdf4":"#fff",color:role===r[0]?G.mid:"#888",fontWeight:role===r[0]?800:400,fontSize:13,cursor:"pointer"}}>
                {r[1]}
              </button>
            );})}
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,color:"#888",marginBottom:4,fontWeight:700}}>아이디</div>
            <input value={id} onChange={function(e){setId(e.target.value);setErr("");}} placeholder={role==="buyer"?"buyer":"dealer"} style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:"#888",marginBottom:4,fontWeight:700}}>비밀번호</div>
            <input type="password" value={pw} onChange={function(e){setPw(e.target.value);setErr("");}} onKeyDown={function(e){if(e.key==="Enter")doLogin();}} placeholder="1234" style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>

          {err && <div style={{background:"#fef2f2",color:"#dc2626",fontSize:12,borderRadius:8,padding:"8px 12px",marginBottom:12}}>{err}</div>}

          <button onClick={doLogin} style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:900,cursor:"pointer"}}>로그인</button>

          <div style={{marginTop:12,padding:"10px 12px",background:"#f8fffe",borderRadius:10,fontSize:11,color:"#888"}}>
            <div>🛒 구매자: <b>buyer</b> / 1234</div>
            <div style={{marginTop:3}}>🏪 중도매인: <b>dealer</b> / 1234</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 구매자 마이페이지 ──
function BuyerMyPage(props) {
  var user = props.user, onLogout = props.onLogout;
  var _s = (function(){ try { return JSON.parse(localStorage.getItem("agro_buyer_"+user.id)||"{}" ); } catch(e){ return {}; } })();
  var ns   = useState(_s.name||user.name||"");   var name   = ns[0];   var setName   = ns[1];
  var bs   = useState(_s.biz||user.biz||"");     var biz    = bs[0];   var setBiz    = bs[1];
  var bnos = useState(_s.bizNo||user.bizNo||""); var bizNo  = bnos[0]; var setBizNo  = bnos[1];
  var phs  = useState(_s.phone||user.phone||""); var phone  = phs[0];  var setPhone  = phs[1];
  var ats  = useState(_s.alarmSound||"1");       var alarmSound = ats[0]; var setAlarmSound = ats[1];
  var addrs = useState(_s.bizAddr||"");          var bizAddr = addrs[0]; var setBizAddr = addrs[1];
  var bizSidos = useState(_s.bizSido||"");       var bizSido = bizSidos[0]; var setBizSido = bizSidos[1];
  var bizLookup = useState(false); var showBizLookup = bizLookup[0]; var setShowBizLookup = bizLookup[1];
  var bizNum  = useState(_s.bizNum||"");         var bizNum_  = bizNum[0]; var setBizNum = bizNum[1];
  var saved = useState(false); var isSaved = saved[0]; var setSaved = saved[1];

  // 잔액 state
  function getBalance(){ try { return parseInt(localStorage.getItem("agro_balance_"+user.id)||"0"); } catch(e){ return 0; } }
  function setBalance(v){ try { localStorage.setItem("agro_balance_"+user.id, String(v)); } catch(e){} }
  var bals = useState(getBalance()); var balance = bals[0]; var setBalanceState = bals[1];
  function updateBalance(v){ setBalance(v); setBalanceState(v); }

  // 예약내역 state (취소 후 재렌더링용)
  var plist = useState(function(){ try { var r=localStorage.getItem("agro_purchase_"+user.id); return r?JSON.parse(r):[]; } catch(e){ return []; } });
  var purchaseList = plist[0]; var setPurchaseList = plist[1];
  function reloadPurchases(){ try { var r=localStorage.getItem("agro_purchase_"+user.id); setPurchaseList(r?JSON.parse(r):[]); } catch(e){ setPurchaseList([]); } }

  // 충전 모달
  var chs  = useState(false); var showCharge  = chs[0];  var setShowCharge  = chs[1];
  var camt = useState("");    var chargeAmt   = camt[0]; var setChargeAmt   = camt[1];
  var cpmt = useState("card"); var chargePay  = cpmt[0]; var setChargePay   = cpmt[1];
  var cdone= useState(false); var chargeDone  = cdone[0];var setChargeDone  = cdone[1];

  // 사업자등록번호 가상 조회 데이터
  var BIZ_LOOKUP = {
    "123-45-67890": {name:"김소매",biz:"소매상회",addr:"대전 유성구 대학로 99",sido:"대전"},
    "234-56-78901": {name:"이과일",biz:"(주)신선유통",addr:"서울 송파구 올림픽로 300",sido:"서울"},
    "345-67-89012": {name:"박도매",biz:"청과유통(주)",addr:"부산 해운대구 센텀중앙로 55",sido:"부산"},
    "456-78-90123": {name:"최신선",biz:"농산물유통센터",addr:"경기 성남시 분당구 판교로 235",sido:"경기"},
    "567-89-01234": {name:"정농부",biz:"직거래농장",addr:"충남 논산시 강경읍 시장3길 12",sido:"충남"},
    "678-90-12345": {name:"한청과",biz:"청과물상회",addr:"광주 북구 첨단과기로 208",sido:"광주"},
  };

  function playPreview(num) {
    try { var names = {"1":"작교1.wav","2":"작교2.wav","3":"작교3.m4a","4":"작교4.m4a"}; var a = new Audio("/sounds/"+names[num]); a.play(); } catch(e){}
  }

  function save() {
    try { localStorage.setItem("agro_buyer_"+user.id, JSON.stringify({name:name,biz:biz,bizNo:bizNo,bizNum:bizNum_,phone:phone,alarmSound:alarmSound,bizAddr:bizAddr,bizSido:bizSido})); } catch(e){}
    setSaved(true);
    setTimeout(function(){setSaved(false);}, 2000);
  }

  return (
    <div>
      <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:20,padding:"20px",marginBottom:14,color:"#fff"}}>
        <div style={{fontSize:10,color:"#52b788",letterSpacing:2,fontWeight:700,marginBottom:4}}>구매자 마이페이지</div>
        <div style={{fontWeight:900,fontSize:18}}>🛒 {name||"구매자"}</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:4}}>농작교 소매 구매자</div>
      </div>

      <div style={{background:"#fff",borderRadius:16,padding:"18px",marginBottom:12,border:"1px solid #e5e7eb"}}>
        <div style={{fontWeight:800,fontSize:14,color:G.mid,marginBottom:14}}>📋 내 정보</div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>사업자등록번호</div>
          <div style={{display:"flex",gap:6}}>
            <input value={bizNum_} onChange={function(e){
              var v = e.target.value.replace(/[^0-9]/g,"");
              if(v.length>3&&v.length<=5) v=v.substring(0,3)+"-"+v.substring(3);
              else if(v.length>5) v=v.substring(0,3)+"-"+v.substring(3,5)+"-"+v.substring(5,10);
              setBizNum(v);
            }} placeholder="000-00-00000" maxLength={12}
              style={{flex:1,border:"1.5px solid #bbf7d0",borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
            <button onClick={function(){
              var found = BIZ_LOOKUP[bizNum_];
              if(found){
                setName(found.name); setBiz(found.biz); setBizAddr(found.addr); setBizSido(found.sido);
                setShowBizLookup(true);
              } else {
                // 미등록도 입력값 유지
                setShowBizLookup(false);
                alert("사업자 정보를 찾을 수 없습니다.\n직접 입력해주세요.");
              }
            }} style={{background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:10,padding:"10px 14px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
              🔍 조회
            </button>
          </div>
          {showBizLookup && BIZ_LOOKUP[bizNum_] && (
            <div style={{marginTop:8,background:"#f0fdf4",borderRadius:10,padding:"12px",border:"1px solid #bbf7d0"}}>
              <div style={{fontSize:11,fontWeight:700,color:G.mid,marginBottom:6}}>✅ 사업자 정보 확인</div>
              {[["상호",BIZ_LOOKUP[bizNum_].biz],["대표자",BIZ_LOOKUP[bizNum_].name],["사업장 주소",BIZ_LOOKUP[bizNum_].addr]].map(function(r){return(
                <div key={r[0]} style={{display:"flex",gap:8,marginBottom:3}}>
                  <span style={{fontSize:11,color:"#888",minWidth:60}}>{r[0]}</span>
                  <span style={{fontSize:11,fontWeight:600,color:"#1a1a1a"}}>{r[1]}</span>
                </div>
              );})}
            </div>
          )}
        </div>

        {[
          ["담당자명","text",name,setName,"홍길동"],
          ["상호","text",biz,setBiz,"소매상회"],
          ["사업자 등록번호 (구분)","text",bizNo,setBizNo,"123-45-67890"],
          ["연락처","tel",phone,setPhone,"010-0000-0000"],
        ].map(function(f){return(
          <div key={f[0]} style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>{f[0]}</div>
            <input type={f[1]} value={f[2]} onChange={function(e){f[3](e.target.value);}} placeholder={f[4]}
              style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
          </div>
        );})}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>사업장 주소 <span style={{color:G.light,fontWeight:400}}>(배송비 계산에 사용)</span></div>
          <input value={bizAddr} onChange={function(e){setBizAddr(e.target.value);}} placeholder="서울 송파구 올림픽로 300"
            style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:6}}/>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["서울","경기","인천","부산","대구","광주","대전","울산","세종","강원","충북","충남","전북","전남","경북","경남","제주"].map(function(s){
              return <button key={s} onClick={function(){setBizSido(s);}} style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid "+(bizSido===s?G.mid:"#e5e7eb"),background:bizSido===s?"#f0fdf4":"#fff",color:bizSido===s?G.mid:"#888",fontSize:11,fontWeight:bizSido===s?700:400,cursor:"pointer"}}>{s}</button>;
            })}
          </div>
          {bizSido && <div style={{marginTop:6,fontSize:11,color:G.mid,fontWeight:600}}>📍 배송 기준 지역: {bizSido}</div>}
        </div>

        <button onClick={save} style={{width:"100%",background:isSaved?"#059669":"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:14,fontWeight:900,cursor:"pointer",transition:"background 0.3s"}}>
          {isSaved ? "✅ 저장되었습니다" : "저장하기"}
        </button>
      </div>

      {/* 장바구니 */}
      {(function(){
        var cart = [];
        try { cart = JSON.parse(localStorage.getItem("agro_cart_"+user.id)||"[]"); } catch(e){}
        var carts = useState(cart); var cartItems = carts[0]; var setCartItems = carts[1];
        var cpay = useState(false); var cartPayDone = cpay[0]; var setCartPayDone = cpay[1];
        var cpmt2 = useState(""); var cartPayMethod = cpmt2[0]; var setCartPayMethod = cpmt2[1];

        var totalDeposit = cartItems.reduce(function(s,c){return s+(c.deposit||0);},0);
        var totalAmount  = cartItems.reduce(function(s,c){return s+(c.total||0);},0);

        function removeFromCart(itemKey) {
          var next = cartItems.filter(function(c){return c.itemKey !== itemKey;});
          setCartItems(next);
          try { localStorage.setItem("agro_cart_"+user.id, JSON.stringify(next)); } catch(e){}
        }

        function checkoutCart() {
          if(!cartPayMethod){ alert("결제 수단을 선택해주세요."); return; }
          if(cartPayMethod==="balance" && balance < totalDeposit){
            alert("예치금이 부족합니다.\n현재 잔액: "+balance.toLocaleString()+"원\n필요 금액: "+totalDeposit.toLocaleString()+"원");
            return;
          }
          // 예치금 차감
          if(cartPayMethod==="balance"){
            var newBal = balance - totalDeposit;
            setBalance(newBal);
            setBalanceState(newBal);
          }
          // 구매 내역 저장
          try {
            var existing = JSON.parse(localStorage.getItem("agro_purchase_"+user.id)||"[]");
            cartItems.forEach(function(c){
              existing.push({key:c.itemKey, itemName:c.itemName, grade:c.grade, origin:c.origin, price:c.price, qty:c.qty, deposit:c.deposit, total:c.total, payMethod:cartPayMethod, date:new Date().toLocaleDateString("ko-KR"), dealerName:c.dealerName, cardId:c.cardId, purchasedQty:c.qty});
            });
            localStorage.setItem("agro_purchase_"+user.id, JSON.stringify(existing));
            setPurchaseList(existing);
          } catch(e){}
          // 장바구니 비우기
          setCartItems([]);
          try { localStorage.setItem("agro_cart_"+user.id, "[]"); } catch(e){}
          setCartPayDone(true);
        }

        if(cartItems.length === 0 && !cartPayDone) return null;

        return (
          <div style={{background:"#fff",borderRadius:16,padding:"18px",marginBottom:12,border:"1px solid #fed7aa"}}>
            <div style={{fontWeight:800,fontSize:14,color:"#c2410c",marginBottom:14}}>🧺 장바구니 {cartItems.length > 0 ? "("+cartItems.length+"건)" : ""}</div>
            {cartPayDone ? (
              <div style={{textAlign:"center",padding:"20px 0"}}>
                <div style={{fontSize:36,marginBottom:8}}>✅</div>
                <div style={{fontWeight:800,fontSize:15,color:G.mid}}>장바구니 결제 완료!</div>
                <div style={{fontSize:12,color:"#888",marginTop:4}}>예약 내역에서 확인하세요</div>
                <button onClick={function(){setCartPayDone(false);}} style={{marginTop:12,background:"#f3f4f6",color:"#555",border:"none",borderRadius:10,padding:"8px 20px",fontSize:12,fontWeight:700,cursor:"pointer"}}>닫기</button>
              </div>
            ) : <>
              {cartItems.map(function(c){
                return (
                  <div key={c.itemKey} style={{background:"#fff7ed",borderRadius:10,padding:"12px",marginBottom:8,border:"1px solid #fed7aa"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div>
                        <span style={{fontWeight:700,fontSize:13}}>{c.itemName}</span>
                        {c.grade && <span style={{background:"#fef9c3",color:"#854d0e",fontSize:10,fontWeight:700,borderRadius:6,padding:"1px 6px",marginLeft:5}}>{c.grade}</span>}
                        <div style={{fontSize:11,color:"#666",marginTop:2}}>{c.origin} · {c.qty}개 · {c.dealerName}</div>
                      </div>
                      <button onClick={function(){removeFromCart(c.itemKey);}} style={{background:"none",border:"none",color:"#aaa",fontSize:16,cursor:"pointer",padding:"0 4px"}}>✕</button>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:12,color:"#888"}}>보증금 <b style={{color:"#c2410c"}}>{(c.deposit||0).toLocaleString()}원</b></span>
                      <span style={{fontSize:11,color:"#aaa"}}>총액 {(c.total||0).toLocaleString()}원</span>
                    </div>
                  </div>
                );
              })}
              <div style={{background:"#fff",borderRadius:10,padding:"12px",marginBottom:10,border:"1px solid #e5e7eb"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:12,color:"#888"}}>총 보증금</span>
                  <span style={{fontSize:14,fontWeight:900,color:"#c2410c"}}>{totalDeposit.toLocaleString()}원</span>
                </div>

              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:6}}>결제 수단</div>
                {[["balance","💰 예치금 결제"],["card","💳 카드"],["kakao","🟡 카카오페이"],["transfer","🏦 계좌이체"]].map(function(pm){
                  var sel = cartPayMethod===pm[0];
                  var notEnough = pm[0]==="balance" && balance < totalDeposit;
                  return <div key={pm[0]} onClick={function(){if(!notEnough)setCartPayMethod(pm[0]);}}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:8,border:"1.5px solid "+(sel?"#c2410c":"#e5e7eb"),marginBottom:6,background:sel?"#fff7ed":"#fff",cursor:notEnough?"not-allowed":"pointer",opacity:notEnough?0.5:1}}>
                    <span style={{fontSize:14}}>{pm[1].split(" ")[0]}</span>
                    <span style={{fontSize:12,fontWeight:sel?700:400,color:sel?"#c2410c":"#333"}}>{pm[1].split(" ").slice(1).join(" ")}</span>
                    {pm[0]==="balance" && <span style={{marginLeft:"auto",fontSize:10,color:notEnough?"#ef4444":"#059669"}}>잔액 {balance.toLocaleString()}원</span>}
                    {sel && pm[0]!=="balance" && <span style={{marginLeft:"auto",color:"#c2410c",fontSize:11,fontWeight:700}}>✓</span>}
                  </div>;
                })}
              </div>
              <button onClick={checkoutCart} disabled={!cartPayMethod||cartItems.length===0}
                style={{width:"100%",background:cartPayMethod?"linear-gradient(135deg,#9a3412,#c2410c)":"#d1d5db",color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:900,cursor:cartPayMethod?"pointer":"not-allowed"}}>
                🧺 장바구니 {cartItems.length}건 일괄 결제 ({totalDeposit.toLocaleString()}원)
              </button>
            </>}
          </div>
        );
      })()}

      {/* 보증금(예치금) 현황 */}
      {(function(){
        var purchases = purchaseList;
        var totalUsed   = purchases.reduce(function(s,p){return s+(p.deposit||0);},0);
        var payMethodLabel = {"card":"💳 카드","kakao":"🟡 카카오페이","transfer":"🏦 계좌이체"};
        var QUICK_AMOUNTS = [10000,30000,50000,100000,300000];
        return (
          <div style={{background:"#fff",borderRadius:16,padding:"18px",marginBottom:12,border:"1px solid #e5e7eb"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontWeight:800,fontSize:14,color:G.mid}}>💰 예치금 현황</div>
              <button onClick={function(){setShowCharge(true);setChargeDone(false);setChargeAmt("");}}
                style={{background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 충전하기</button>
            </div>
            <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:12,padding:"18px",color:"#fff",marginBottom:12}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginBottom:4}}>사용 가능 잔액</div>
              <div style={{fontSize:32,fontWeight:900,color:"#4ade80"}}>{balance.toLocaleString()}<span style={{fontSize:16,fontWeight:500}}>원</span></div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.15)"}}>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>총 사용금액</div><div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{totalUsed.toLocaleString()}원</div></div>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>예약건수</div><div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{purchases.length}건</div></div>
              </div>
            </div>
            {purchases.length > 0 ? (
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:8}}>예약 내역</div>
                {purchases.slice().reverse().map(function(p,i){
                  var realIdx = purchases.length - 1 - i;
                  function cancelPurchase() {
                    if(!window.confirm("예약을 취소하시겠습니까?\n보증금은 환불 처리됩니다.")) return;
                    var refund = p.deposit || 0;
                    var newBal = balance + refund;
                    setBalance(newBal);
                    setBalanceState(newBal);
                    var next = purchases.filter(function(_,idx){ return idx !== realIdx; });
                    try { localStorage.setItem("agro_purchase_"+user.id, JSON.stringify(next)); } catch(e){}
                    var soldCards = {};
                    try { soldCards = JSON.parse(localStorage.getItem("agro_sold_cards")||"{}"); } catch(e){}
                    if(p.key) delete soldCards[p.key];
                    if(p.cardId !== undefined && p.cardId !== null) {
                      var cardKey = String(p.cardId);
                      delete soldCards["soldcard_"+cardKey];
                      var cur = soldCards["remainqty_"+cardKey];
                      if(cur !== undefined) {
                        soldCards["remainqty_"+cardKey] = cur + (p.purchasedQty || p.qty || 1);
                      } else {
                        delete soldCards["remainqty_"+cardKey];
                      }
                    }
                    try { localStorage.setItem("agro_sold_cards", JSON.stringify(soldCards)); } catch(e){}
                    reloadPurchases();
                  }
                  return (
                    <div key={i} style={{background:"#f8fffe",borderRadius:10,padding:"12px",marginBottom:8,border:"1px solid #e0f7ec"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                        <div>
                          <span style={{fontWeight:700,fontSize:13}}>{p.itemName}</span>
                          {p.grade && <span style={{background:"#fef9c3",color:"#854d0e",fontSize:10,fontWeight:700,borderRadius:6,padding:"1px 6px",marginLeft:5}}>{p.grade}</span>}
                        </div>
                        <span style={{fontSize:10,color:"#aaa"}}>{p.date}</span>
                      </div>
                      <div style={{fontSize:11,color:"#666",marginBottom:6}}>{p.origin} · {p.qty}개 · {p.dealerName}</div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <span style={{fontSize:11,color:"#888"}}>보증금 </span>
                          <span style={{fontSize:13,fontWeight:900,color:G.mid}}>{(p.deposit||0).toLocaleString()}원</span>
                          <span style={{fontSize:10,color:"#aaa",marginLeft:4}}>· 잔금 {((p.total||0)-(p.deposit||0)).toLocaleString()}원</span>
                        </div>
                        <button onClick={cancelPurchase} style={{background:"#fef2f2",color:"#dc2626",border:"1px solid #fca5a5",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>취소</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{textAlign:"center",padding:"16px 0",color:"#aaa",fontSize:12}}>아직 예약 내역이 없습니다</div>
            )}
            <div style={{fontSize:11,color:"#888",lineHeight:1.7,marginTop:8,padding:"10px 12px",background:"#f8fffe",borderRadius:8}}>
              💡 예치금으로 보증금(총액의 10%) 결제 시 즉시 차감됩니다. 잔금은 수령 시 중도매인에게 직접 결제하세요.
            </div>
            {showCharge && (
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={function(e){if(e.target===e.currentTarget){setShowCharge(false);setChargeDone(false);}}}>
                <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:380,overflow:"hidden",maxHeight:"90vh",overflowY:"auto"}}>
                  <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",padding:"16px"}}>
                    <div style={{color:"#4ade80",fontSize:10,fontWeight:700,letterSpacing:2}}>💰 예치금 충전</div>
                    <div style={{color:"#fff",fontWeight:800,fontSize:16,marginTop:4}}>농작교 예치금</div>
                    <div style={{color:"rgba(255,255,255,0.6)",fontSize:11,marginTop:2}}>현재 잔액: {balance.toLocaleString()}원</div>
                  </div>
                  <div style={{padding:"16px"}}>
                    {!chargeDone ? <>
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:8}}>충전 금액 선택</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:8}}>
                          {QUICK_AMOUNTS.map(function(amt){
                            var sel = parseInt(chargeAmt)===amt;
                            return <button key={amt} onClick={function(){setChargeAmt(String(amt));}}
                              style={{padding:"8px 4px",border:"1.5px solid "+(sel?"#40916c":"#e5e7eb"),borderRadius:8,background:sel?"#f0fdf4":"#fff",color:sel?"#065f46":"#555",fontSize:11,fontWeight:sel?700:400,cursor:"pointer"}}>
                              {amt>=10000?(amt/10000)+"만":""}원
                            </button>;
                          })}
                        </div>
                        <input type="number" placeholder="직접 입력 (원)" value={chargeAmt} onChange={function(e){setChargeAmt(e.target.value);}}
                          style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"10px 12px",fontSize:14,fontWeight:700,outline:"none",boxSizing:"border-box",textAlign:"right"}}/>
                        {chargeAmt && parseInt(chargeAmt)>0 && <div style={{textAlign:"right",fontSize:12,color:G.mid,fontWeight:700,marginTop:4}}>{parseInt(chargeAmt).toLocaleString()}원 충전</div>}
                      </div>
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:8}}>결제 수단</div>
                        {[["card","💳 카드결제"],["kakao","🟡 카카오페이"],["transfer","🏦 계좌이체"]].map(function(pm){
                          var sel = chargePay===pm[0];
                          return <div key={pm[0]} onClick={function(){setChargePay(pm[0]);}}
                            style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:8,border:"1.5px solid "+(sel?"#40916c":"#e5e7eb"),marginBottom:6,background:sel?"#f0fdf4":"#fff",cursor:"pointer"}}>
                            <span style={{fontSize:16}}>{pm[1].split(" ")[0]}</span>
                            <span style={{fontSize:13,fontWeight:sel?700:400,color:sel?"#065f46":"#333"}}>{pm[1].split(" ").slice(1).join(" ")}</span>
                            {sel && <span style={{marginLeft:"auto",color:"#40916c",fontWeight:700,fontSize:12}}>✓</span>}
                          </div>;
                        })}

                        {chargePay==="card" && <div style={{background:"#f9fafb",borderRadius:10,padding:"12px",marginTop:8}}>
                          <div style={{background:"linear-gradient(135deg,#1e3a8a,#2563eb)",borderRadius:10,padding:"14px",color:"#fff",marginBottom:10}}>
                            <div style={{fontSize:9,opacity:0.7}}>CREDIT CARD</div>
                            <div style={{fontSize:13,fontWeight:700,letterSpacing:3,margin:"6px 0"}}>**** **** **** ****</div>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,opacity:0.8}}><span>카드소유자</span><span>MM/YY</span></div>
                          </div>
                          <input placeholder="카드번호 16자리" onChange={function(e){var v=e.target.value.replace(/\D/g,"").substring(0,16);e.target.value=v.replace(/(.{4})/g,"$1 ").trim();}} style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,marginBottom:6,outline:"none",boxSizing:"border-box"}}/>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                            <input placeholder="MM/YY" maxLength={5} style={{border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none"}}/>
                            <input placeholder="CVC" maxLength={3} type="password" style={{border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none"}}/>
                          </div>
                        </div>}

                        {chargePay==="kakao" && <div style={{background:"#FEE500",borderRadius:10,padding:"14px",marginTop:8,textAlign:"center"}}>
                          <div style={{fontSize:18,fontWeight:900,color:"#3A1D1D"}}>kakao pay</div>
                          <div style={{display:"inline-block",background:"#fff",padding:6,borderRadius:8,margin:"8px auto"}}>
                            <svg width="100" height="100" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
                              <rect width="140" height="140" fill="white"/>
                              <rect x="8" y="8" width="35" height="35" fill="none" stroke="#1a1a1a" strokeWidth="4"/>
                              <rect x="15" y="15" width="21" height="21" fill="#1a1a1a"/>
                              <rect x="97" y="8" width="35" height="35" fill="none" stroke="#1a1a1a" strokeWidth="4"/>
                              <rect x="104" y="15" width="21" height="21" fill="#1a1a1a"/>
                              <rect x="8" y="97" width="35" height="35" fill="none" stroke="#1a1a1a" strokeWidth="4"/>
                              <rect x="15" y="104" width="21" height="21" fill="#1a1a1a"/>
                              <rect x="50" y="8" width="5" height="5" fill="#1a1a1a"/><rect x="60" y="8" width="5" height="5" fill="#1a1a1a"/><rect x="75" y="8" width="5" height="5" fill="#1a1a1a"/><rect x="85" y="8" width="5" height="5" fill="#1a1a1a"/>
                              <rect x="50" y="18" width="5" height="5" fill="#1a1a1a"/><rect x="65" y="18" width="5" height="5" fill="#1a1a1a"/><rect x="80" y="18" width="5" height="5" fill="#1a1a1a"/>
                              <rect x="50" y="28" width="5" height="5" fill="#1a1a1a"/><rect x="60" y="28" width="5" height="5" fill="#1a1a1a"/><rect x="70" y="28" width="5" height="5" fill="#1a1a1a"/><rect x="85" y="28" width="5" height="5" fill="#1a1a1a"/>
                              <rect x="8" y="50" width="5" height="5" fill="#1a1a1a"/><rect x="23" y="50" width="5" height="5" fill="#1a1a1a"/><rect x="50" y="50" width="5" height="5" fill="#1a1a1a"/><rect x="65" y="50" width="5" height="5" fill="#1a1a1a"/><rect x="85" y="50" width="5" height="5" fill="#1a1a1a"/><rect x="110" y="50" width="5" height="5" fill="#1a1a1a"/>
                              <rect x="13" y="60" width="5" height="5" fill="#1a1a1a"/><rect x="38" y="60" width="5" height="5" fill="#1a1a1a"/><rect x="55" y="60" width="5" height="5" fill="#1a1a1a"/><rect x="75" y="60" width="5" height="5" fill="#1a1a1a"/><rect x="100" y="60" width="5" height="5" fill="#1a1a1a"/><rect x="120" y="60" width="5" height="5" fill="#1a1a1a"/>
                              <rect x="8" y="70" width="5" height="5" fill="#1a1a1a"/><rect x="28" y="70" width="5" height="5" fill="#1a1a1a"/><rect x="55" y="70" width="5" height="5" fill="#1a1a1a"/><rect x="80" y="70" width="5" height="5" fill="#1a1a1a"/><rect x="110" y="70" width="5" height="5" fill="#1a1a1a"/>
                              <rect x="50" y="100" width="5" height="5" fill="#1a1a1a"/><rect x="70" y="100" width="5" height="5" fill="#1a1a1a"/><rect x="90" y="100" width="5" height="5" fill="#1a1a1a"/><rect x="115" y="100" width="5" height="5" fill="#1a1a1a"/>
                              <rect x="55" y="115" width="5" height="5" fill="#1a1a1a"/><rect x="80" y="115" width="5" height="5" fill="#1a1a1a"/><rect x="100" y="115" width="5" height="5" fill="#1a1a1a"/><rect x="127" y="115" width="5" height="5" fill="#1a1a1a"/>
                              <rect x="57" y="57" width="26" height="26" rx="4" fill="#FEE500"/>
                              <text x="70" y="75" textAnchor="middle" fontSize="14" fontWeight="900" fill="#3A1D1D">K</text>
                            </svg>
                          </div>
                          <div style={{fontSize:10,color:"#3A1D1D",opacity:0.7}}>카카오톡 → 페이 → QR결제</div>
                        </div>}

                        {chargePay==="transfer" && <div style={{background:"#f0fdf4",borderRadius:10,padding:"12px",marginTop:8}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:"#888"}}>은행</span><span style={{fontSize:12,fontWeight:700}}>농협은행</span></div>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:"#888"}}>계좌번호</span><span style={{fontSize:12,fontWeight:700}}>352-0919-7423-83</span></div>
                          <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:"#888"}}>예금주</span><span style={{fontSize:12,fontWeight:700}}>(주)농작교</span></div>
                        </div>}
                      </div>

                      <button onClick={function(){
                        var amt = parseInt(chargeAmt)||0;
                        if(amt < 1000){ alert("최소 충전금액은 1,000원입니다."); return; }
                        updateBalance(balance + amt);
                        // 충전 내역 저장
                        try {
                          var hist = JSON.parse(localStorage.getItem("agro_charge_"+user.id)||"[]");
                          hist.push({amt:amt,payMethod:chargePay,date:new Date().toLocaleDateString("ko-KR")});
                          localStorage.setItem("agro_charge_"+user.id, JSON.stringify(hist));
                        } catch(e){}
                        setChargeDone(true);
                      }} disabled={!chargeAmt||parseInt(chargeAmt)<1000}
                        style={{width:"100%",background:(chargeAmt&&parseInt(chargeAmt)>=1000)?"linear-gradient(135deg,#0d2b1a,#40916c)":"#d1d5db",color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:900,cursor:(chargeAmt&&parseInt(chargeAmt)>=1000)?"pointer":"not-allowed"}}>
                        {chargeAmt&&parseInt(chargeAmt)>=1000 ? parseInt(chargeAmt).toLocaleString()+"원 충전하기" : "금액을 입력해주세요"}
                      </button>
                    </> : <div style={{textAlign:"center",padding:"24px 0"}}>
                      <div style={{fontSize:48,marginBottom:12}}>✅</div>
                      <div style={{fontWeight:900,fontSize:16,color:G.mid}}>충전 완료!</div>
                      <div style={{fontSize:13,color:"#888",marginTop:4}}>현재 잔액</div>
                      <div style={{fontSize:28,fontWeight:900,color:G.dark,marginTop:4}}>{balance.toLocaleString()}원</div>
                      <button onClick={function(){setShowCharge(false);setChargeDone(false);}} style={{marginTop:16,width:"100%",background:"#f3f4f6",color:"#555",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>닫기</button>
                    </div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div style={{background:"#fff",borderRadius:16,padding:"18px",marginBottom:12,border:"1px solid #e5e7eb"}}>
        <div style={{fontWeight:800,fontSize:14,color:G.mid,marginBottom:14}}>🔔 알림음 설정</div>
        {[
          {num:"1", label:"알림음 1"},
          {num:"2", label:"알림음 2"},
          {num:"3", label:"알림음 3"},
          {num:"4", label:"알림음 4"},
        ].map(function(s){
          var selected = alarmSound === s.num;
          return (
            <div key={s.num} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px",borderRadius:12,border:"2px solid "+(selected?"#40916c":"#e5e7eb"),background:selected?"#f0fdf4":"#fafafa",marginBottom:8,cursor:"pointer"}} onClick={function(){setAlarmSound(s.num);}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:20,height:20,borderRadius:"50%",border:"2px solid "+(selected?"#40916c":"#ccc"),background:selected?"#40916c":"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {selected && <div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}></div>}
                </div>
                <span style={{fontSize:13,fontWeight:selected?700:400,color:selected?"#1b4332":"#555"}}>{s.label}</span>
              </div>
              <button onClick={function(e){e.stopPropagation();playPreview(s.num);}} style={{background:"#e8f5e9",color:"#2d6a4f",border:"none",borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>▶ 미리듣기</button>
            </div>
          );
        })}
        <div style={{fontSize:10,color:"#aaa",marginTop:4}}>* 저장하기 버튼을 눌러야 설정이 유지됩니다</div>
      </div>

      <button onClick={onLogout} style={{width:"100%",background:"#f3f4f6",color:"#888",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>로그아웃</button>
    </div>
  );
}

// ── 중도매인 마이페이지 ──
function DealerMyPage(props) {
  var user = props.user, tradeData = props.tradeData, onLogout = props.onLogout;
  var _ds = (function(){ try { return JSON.parse(localStorage.getItem("agro_dealer_"+user.id)||"{}"); } catch(e){ return {}; } })();
  var listed = useState(_ds.listedMap||{}); var listedMap = listed[0]; var setListedMap = listed[1];
  var ats = useState(_ds.alarmSound||"1"); var alarmSound = ats[0]; var setAlarmSound = ats[1];
  var pubs = useState(_ds.phonePublic!==undefined?_ds.phonePublic:false); var phonePublic = pubs[0]; var setPhonePublic = pubs[1];
  var saved = useState(false); var isSaved = saved[0]; var setSaved = saved[1];
  var dtab = useState("items"); var dealerTab = dtab[0]; var setDealerTab = dtab[1];

  // 개별 거래건 공개/비공개 (tradeKey별)
  var hiddenTrades = useState(_ds.hiddenTrades||{}); var hiddenMap = hiddenTrades[0]; var setHiddenMap = hiddenTrades[1];

  function playPreview(num) {
    try { var names = {"1":"작교1.wav","2":"작교2.wav","3":"작교3.m4a","4":"작교4.m4a"}; var a = new Audio("/sounds/"+names[num]); a.play(); } catch(e){}
  }

  function saveDealer() {
    try { localStorage.setItem("agro_dealer_"+user.id, JSON.stringify({listedMap:listedMap, alarmSound:alarmSound, phonePublic:phonePublic, hiddenTrades:hiddenMap})); } catch(e){}
    setSaved(true);
    setTimeout(function(){setSaved(false);}, 2000);
  }

  function toggleHidden(key) {
    var next = Object.assign({}, hiddenMap);
    next[key] = !next[key];
    setHiddenMap(next);
    // 즉시 저장
    try { localStorage.setItem("agro_dealer_"+user.id, JSON.stringify({listedMap:listedMap, alarmSound:alarmSound, phonePublic:phonePublic, hiddenTrades:next})); } catch(e){}
  }

  // 내 낙찰번호로 거래실적 필터
  var myTrades = tradeData.filter(function(t){
    var raw = String(t["낙찰 중도매인"]||"").trim();
    var m = raw.match(/^(\d+)/);
    var no = m ? String(parseInt(m[1])) : raw;
    return no === String(user.dealerNo) || raw === String(user.dealerNo);
  });

  // 품목별 그룹
  var grouped = {};
  myTrades.forEach(function(t){
    var key = (t["품목명"]||t["품목"]||"").trim();
    if(!key) return;
    if(!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  function toggleListed(key) {
    var next = Object.assign({}, listedMap);
    next[key] = !next[key];
    setListedMap(next);
  }

  var listedItems = Object.keys(listedMap).filter(function(k){return listedMap[k];});
  var hiddenCount = Object.keys(hiddenMap).filter(function(k){return hiddenMap[k];}).length;

  return (
    <div>
      <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:20,padding:"20px",marginBottom:14,color:"#fff"}}>
        <div style={{fontSize:10,color:"#52b788",letterSpacing:2,fontWeight:700,marginBottom:4}}>중도매인 마이페이지</div>
        <div style={{fontWeight:900,fontSize:18}}>🏪 중도매인 #{user.dealerNo}</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:4}}>대전 노은시장 · 당일 낙찰 품목</div>
        {listedItems.length > 0 && <div style={{marginTop:8,background:"rgba(74,222,128,0.2)",borderRadius:10,padding:"6px 10px",fontSize:11,color:"#4ade80",fontWeight:700}}>
          📢 {listedItems.length}개 품목 노출 중 {hiddenCount > 0 ? "· "+hiddenCount+"건 비공개" : ""}
        </div>}
      </div>

      {/* 탭 */}
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[["items","📦 오늘 경매 상품"],["settings","⚙️ 설정"]].map(function(t){
          var on = dealerTab===t[0];
          return <button key={t[0]} onClick={function(){setDealerTab(t[0]);}}
            style={{flex:1,padding:"10px 0",background:on?"linear-gradient(135deg,#0d2b1a,#40916c)":"#fff",color:on?"#fff":"#555",border:"1.5px solid "+(on?"#2d6a4f":"#e5e7eb"),borderRadius:12,fontSize:13,fontWeight:on?700:400,cursor:"pointer"}}>
            {t[1]}
          </button>;
        })}
      </div>

      {/* 오늘 경매 상품 탭 */}
      {dealerTab==="items" && <div>
        {myTrades.length === 0 && (
          <div style={{textAlign:"center",padding:"40px 0",background:"#fff",borderRadius:16,border:"1px solid #e5e7eb"}}>
            <div style={{fontSize:32,marginBottom:10}}>📋</div>
            <div style={{fontSize:13,color:"#888"}}>낙찰번호 #{user.dealerNo}의 거래실적이 없습니다</div>
          </div>
        )}

        {Object.keys(grouped).length > 0 && <div>
          <div style={{fontWeight:800,fontSize:14,color:G.mid,marginBottom:10}}>📦 오늘 낙찰 상품 — 건별 공개 설정</div>
          <div style={{fontSize:11,color:"#888",marginBottom:12}}>각 거래건을 구매자에게 공개할지 선택하세요</div>
          {Object.keys(grouped).map(function(itemName){
            var trades = grouped[itemName];
            var isItemOn = !!listedMap[itemName];
            return (
              <div key={itemName} style={{background:"#fff",borderRadius:14,marginBottom:12,border:"1px solid #e5e7eb",overflow:"hidden"}}>
                {/* 품목 헤더 */}
                <div style={{background:isItemOn?"linear-gradient(135deg,#0d2b1a,#1b4332)":"#f8fffe",padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:20}}>{getEmoji(itemName)}</span>
                    <div>
                      <div style={{fontWeight:800,fontSize:13,color:isItemOn?"#fff":"#0d1f15"}}>{itemName}</div>
                      <div style={{fontSize:10,color:isItemOn?"rgba(255,255,255,0.6)":"#888"}}>{trades.length}건</div>
                    </div>
                  </div>
                  <button onClick={function(){toggleListed(itemName);}}
                    style={{background:isItemOn?"rgba(74,222,128,0.2)":"#f3f4f6",color:isItemOn?"#4ade80":"#888",border:"none",borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                    {isItemOn ? "✅ 품목 노출중" : "품목 노출하기"}
                  </button>
                </div>
                {/* 개별 거래건 */}
                {trades.map(function(t, i){
                  var tradeKey = itemName+"_"+(t["경매시간"]||i);
                  var isHidden = !!hiddenMap[tradeKey];
                  var grade = (t["등급"]||"").trim();
                  var price = parseInt((t["단가"]||"0").replace(/,/g,""))||0;
                  var qty = (t["수량"]||"").trim();
                  var origin = (t["산지명"]||"").trim();
                  var weight = (t["중량"]||"").trim();
                  var time = (t["경매시간"]||"").trim();
                  return (
                    <div key={i} style={{padding:"10px 14px",borderTop:"1px solid #f0f0f0",background:isHidden?"#fef2f2":"#fff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>
                          {grade && <span style={{background:"#fef9c3",color:"#854d0e",fontSize:10,fontWeight:700,borderRadius:6,padding:"1px 7px"}}>{grade}등급</span>}
                          {origin && <span style={{background:"#fffbeb",color:"#92400e",fontSize:10,borderRadius:6,padding:"1px 7px"}}>📍{origin}</span>}
                          {weight && <span style={{background:"#f0fdf4",color:G.mid,fontSize:10,borderRadius:6,padding:"1px 7px"}}>📦{fmtKg(weight)}kg</span>}
                          <span style={{background:"#f3f4f6",color:"#555",fontSize:10,borderRadius:6,padding:"1px 7px"}}>{qty}개</span>
                        </div>
                        <div style={{fontSize:12,fontWeight:700,color:G.mid}}>{price.toLocaleString()}원 <span style={{fontSize:10,color:"#aaa",fontWeight:400}}>· {time}</span></div>
                      </div>
                      <button onClick={function(){toggleHidden(tradeKey);}}
                        style={{background:isHidden?"#fee2e2":"#f0fdf4",color:isHidden?"#991b1b":"#166534",border:"none",borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                        {isHidden ? "🔒 비공개" : "🟢 공개"}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <button onClick={saveDealer} style={{width:"100%",background:isSaved?"#059669":"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:14,fontWeight:900,cursor:"pointer",marginBottom:12}}>
            {isSaved ? "✅ 저장되었습니다" : "설정 저장하기"}
          </button>
        </div>}
      </div>}

      {/* 설정 탭 */}
      {dealerTab==="settings" && <div>
        <div style={{background:"#fff",borderRadius:16,padding:"18px",marginBottom:12,border:"1px solid #e5e7eb"}}>
          <div style={{fontWeight:800,fontSize:14,color:G.mid,marginBottom:4}}>📞 연락처 공개 설정</div>
          <div style={{fontSize:11,color:"#888",marginBottom:14}}>구매자가 경락 카드에서 내 전화번호를 볼 수 있도록 허용합니다</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px",borderRadius:12,border:"2px solid "+(phonePublic?"#4ade80":"#e5e7eb"),background:phonePublic?"#f0fdf4":"#f9fafb",cursor:"pointer"}} onClick={function(){setPhonePublic(!phonePublic);}}>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:phonePublic?"#065f46":"#555"}}>{phonePublic?"🟢 공개 중":"🔴 비공개"}</div>
              <div style={{fontSize:11,color:"#888",marginTop:2}}>{phonePublic?"구매자가 내 연락처를 볼 수 있습니다":"연락처가 구매자에게 표시되지 않습니다"}</div>
            </div>
            <div style={{width:44,height:24,borderRadius:12,background:phonePublic?"#40916c":"#d1d5db",position:"relative",transition:"background 0.2s",flexShrink:0}}>
              <div style={{position:"absolute",top:2,left:phonePublic?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",transition:"left 0.2s"}}></div>
            </div>
          </div>
          {phonePublic && (function(){
            var info = getDealerInfo(user.dealerNo);
            return info.phone ? (
              <div style={{marginTop:10,background:"#ecfdf5",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#065f46"}}>
                📞 공개될 연락처: <b>{info.phone}</b> ({info.name})
              </div>
            ) : (
              <div style={{marginTop:10,background:"#fef9c3",borderRadius:10,padding:"10px 12px",fontSize:11,color:"#854d0e"}}>
                ⚠️ 등록된 연락처가 없습니다. 관리자에게 문의하세요.
              </div>
            );
          })()}
        </div>
        <div style={{background:"#fff",borderRadius:16,padding:"18px",marginBottom:12,border:"1px solid #e5e7eb"}}>
          <div style={{fontWeight:800,fontSize:14,color:G.mid,marginBottom:14}}>🔔 알림음 설정</div>
          {[
            {num:"1", label:"알림음 1"},
            {num:"2", label:"알림음 2"},
            {num:"3", label:"알림음 3"},
            {num:"4", label:"알림음 4"},
          ].map(function(s){
            var selected = alarmSound === s.num;
            return (
              <div key={s.num} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px",borderRadius:12,border:"2px solid "+(selected?"#40916c":"#e5e7eb"),background:selected?"#f0fdf4":"#fafafa",marginBottom:8,cursor:"pointer"}} onClick={function(){setAlarmSound(s.num);}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:20,height:20,borderRadius:"50%",border:"2px solid "+(selected?"#40916c":"#ccc"),background:selected?"#40916c":"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {selected && <div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}></div>}
                  </div>
                  <span style={{fontSize:13,fontWeight:selected?700:400,color:selected?"#1b4332":"#555"}}>{s.label}</span>
                </div>
                <button onClick={function(e){e.stopPropagation();playPreview(s.num);}} style={{background:"#e8f5e9",color:"#2d6a4f",border:"none",borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>▶ 미리듣기</button>
              </div>
            );
          })}
          <div style={{fontSize:10,color:"#aaa",marginTop:4}}>* 저장하기 버튼을 눌러야 설정이 유지됩니다</div>
        </div>
        <button onClick={saveDealer} style={{width:"100%",background:isSaved?"#059669":"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:14,fontWeight:900,cursor:"pointer",transition:"background 0.3s",marginBottom:10}}>
          {isSaved ? "✅ 저장되었습니다" : "저장하기"}
        </button>
        <button onClick={onLogout} style={{width:"100%",background:"#f3f4f6",color:"#888",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>로그아웃</button>
      </div>}

      {dealerTab === "items" && <button onClick={onLogout} style={{width:"100%",background:"#f3f4f6",color:"#888",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer",marginTop:8}}>로그아웃</button>}
    </div>
  );
}

// ── 품목별 기본 단중 (개/통당 kg) ──
var ITEM_KG = {
  "수박":9,"메론":2,"참외":0.45,"호박":0.8,"오이":0.2,"토마토":0.18,"방울토마토":0.5,"파프리카":0.2,"가지":0.2,
  "사과":0.3,"배":0.4,"감귤":0.12,"딸기":0.5,"포도":0.55,"복숭아":0.25,"자두":0.08,"체리":0.015,"블루베리":0.12,
  "배추":3,"양배추":1.5,"상추":0.03,"시금치":0.3,"파":0.1,"부추":0.1,"깻잎":0.02,
  "양파":0.2,"마늘":0.05,"무":1.5,"당근":0.15,"생강":0.05,
  "고추":0.1,"바나나":0.15,"오렌지":0.25,"레몬":0.1,"파인애플":0.9,"망고":0.4,
};

var ITEM_UNITS = {
  "수박":"통","메론":"통","참외":"개","호박":"개","오이":"개","토마토":"개","방울토마토":"팩(500g)","파프리카":"개","가지":"개",
  "사과":"개","배":"개","감귤":"개","딸기":"팩(500g)","포도":"송이","복숭아":"개","자두":"개","체리":"팩(15g)","블루베리":"팩(120g)",
  "배추":"포기","양배추":"통","상추":"봉(30g)","시금치":"단(300g)","파":"단(100g)","부추":"단(100g)","깻잎":"봉(20g)",
  "양파":"개","마늘":"통","무":"개","당근":"개","생강":"개","고추":"개",
  "바나나":"개","오렌지":"개","레몬":"개","파인애플":"개","망고":"개",
};

var SIDO_LIST = ["서울","경기","인천","대전","세종","충남","충북","부산","대구","경북","경남","울산","광주","전북","전남","강원","제주"];
var CARRIER_ORDER = ["CJ대한통운","로젠택배","한진택배","우체국택배"];
var BOX_MAX_KG = 15;

var PARCEL_CONTACTS = [
  {name:"CJ대한통운", phone:"1588-1255", url:"https://www.cjlogistics.com", desc:"전국 당일·익일 배송"},
  {name:"로젠택배",   phone:"1588-9988", url:"https://www.logen.co.kr",    desc:"합리적인 농산물 배송"},
  {name:"한진택배",   phone:"1588-0011", url:"https://www.hanjin.com",      desc:"신속·안전 배송"},
  {name:"우체국택배", phone:"1588-1300", url:"https://parcel.epost.go.kr",  desc:"전국 도서산간 포함"},
];
var FREIGHT_CONTACTS = [
  {name:"화물맨",    phone:"1666-0027", url:"https://www.hwamulman.com",    desc:"화물 중개 플랫폼 · 앱 운영"},
  {name:"고고씽",    phone:"1588-4700", url:"https://www.gogosing.com",     desc:"퀵·소형 화물 전문"},
  {name:"바로고",    phone:"1522-0110", url:"https://www.barogo.com",       desc:"당일 배송 전문"},
  {name:"용달119",   phone:"1588-0119", url:"https://www.yongdal119.co.kr", desc:"1톤 용달·화물차 연결"},
];

var MARKET_KM = {
  "123-45-67890": {1:160, 2:250, 3:140, 4:165, 5:165, 6:170, 7:8.5, 8:3.5, 9:240},
  "234-56-78901": {1:4,   2:390, 3:280, 4:55,  5:45,  6:310, 7:160, 8:165, 9:380},
  "345-67-89012": {1:380, 2:15,  3:130, 4:400, 5:395, 6:270, 7:250, 8:255, 9:80},
  "456-78-90123": {1:30,  2:370, 3:230, 4:60,  5:50,  6:260, 7:120, 8:125, 9:330},
  "567-89-01234": {1:170, 2:290, 3:190, 4:180, 5:175, 6:90,  7:55,  8:60,  9:280},
  "678-90-12345": {1:300, 2:270, 3:220, 4:330, 5:325, 6:10,  7:170, 8:175, 9:280},
};

function parcelCostPerBox(kg, km, carrier) {
  var rates = SHIPPING_RATES[carrier||"CJ대한통운"];
  var base = rates[rates.length-1].base;
  for(var i=0;i<rates.length;i++){ if(kg<=rates[i].max){ base=rates[i].base; break; } }
  var extra = km<=30 ? 0 : km<=100 ? 500 : km<=200 ? 1000 : km<=300 ? 1500 : 2000;
  return base + extra;
}

function freightCostByKm(totalKg, km) {
  var cost = 60000;
  if(km <= 100)      cost += km * 800;
  else if(km <= 300) cost += 100*800 + (km-100)*600;
  else               cost += 100*800 + 200*600 + (km-300)*400;
  if(totalKg > 500)  cost += Math.ceil((totalKg-500)/500)*50000;
  return Math.round(cost/1000)*1000;
}

function ShippingCalcTab(props) {
  var loginUser = props.loginUser;
  var auctionData = props.auctionData || [];

  var _saved = {};
  try { _saved = JSON.parse(localStorage.getItem("agro_buyer_"+(loginUser&&loginUser.id||"guest"))||"{}"); } catch(e){}
  var bizAddr = _saved.bizAddr || "";
  var bizSido = _saved.bizSido || "";
  var bizNum  = _saved.bizNum  || "";
  var distMap = MARKET_KM[bizNum] || null;

  var s1=useState([]); var items=s1[0]; var setItems=s1[1];
  var s2=useState({name:"",qty:"",kgEach:""}); var draft=s2[0]; var setDraft=s2[1];
  var s3=useState(null); var result=s3[0]; var setResult=s3[1];
  var s4=useState(bizSido||""); var fallbackSido=s4[0]; var setFallbackSido=s4[1];
  var s5=useState("parcel"); var contactTab=s5[0]; var setContactTab=s5[1];

  var isLoggedIn = !!loginUser;
  var effectiveSido = bizSido || fallbackSido;

  var itemOptions = (function() {
    if(auctionData.length > 0) {
      var seen = {};
      auctionData.forEach(function(r){ if(r.itemName) seen[r.itemName]=true; });
      return Object.keys(seen).sort();
    }
    return Object.keys(ITEM_KG).sort();
  })();

  function onDraftName(name) {
    setDraft(function(d){ return Object.assign({},d,{name:name}); });
  }
  function addItem() {
    var qty = parseFloat(draft.qty);
    var kgEach = parseFloat(draft.kgEach);
    if(!draft.name.trim() || !qty || qty<=0 || !kgEach || kgEach<=0) return;
    var totalKg = Math.round(qty*kgEach*100)/100;
    setItems(function(p){ return p.concat([{id:Date.now(),name:draft.name.trim(),qty:qty,kgEach:kgEach,totalKg:totalKg}]); });
    setDraft({name:"",qty:"",kgEach:""});
    setResult(null);
  }
  function removeItem(id) { setItems(function(p){ return p.filter(function(i){ return i.id!==id; }); }); setResult(null); }

  var totalKg = Math.round(items.reduce(function(s,i){ return s+i.totalKg; },0)*100)/100;

  function getKmForMarket(market) {
    if(distMap && distMap[market.id]) return distMap[market.id];
    var REG_KM = {
      "서울":  {서울:10,경기:45,인천:30,대전:160,충남:180,충북:130,부산:400,대구:290,경북:310,경남:380,울산:385,광주:310,전북:240,전남:300,강원:175,제주:500},
      "경기":  {서울:40,경기:30,인천:50,대전:130,충남:150,충북:110,부산:380,대구:270,경북:290,경남:360,울산:365,광주:295,전북:230,전남:290,강원:150,제주:480},
      "인천":  {서울:30,경기:40,인천:10,대전:150,충남:165,충북:130,부산:400,대구:300,경북:320,경남:390,울산:395,광주:320,전북:250,전남:315,강원:200,제주:500},
      "대전":  {서울:160,경기:130,인천:150,대전:15,충남:55,충북:50,부산:250,대구:140,경북:180,경남:230,울산:240,광주:165,전북:100,전남:155,강원:175,제주:430},
      "충남":  {서울:170,경기:145,인천:165,대전:55,충남:40,충북:80,부산:280,대구:175,경북:205,경남:260,울산:270,광주:165,전북:90,전남:155,강원:210,제주:445},
      "광주":  {서울:310,경기:295,인천:325,대전:165,충남:165,충북:195,부산:270,대구:220,경북:255,경남:245,울산:280,광주:10,전북:70,전남:60,강원:385,제주:300},
      "부산":  {서울:390,경기:375,인천:400,대전:250,충남:285,충북:275,부산:15,대구:100,경북:120,경남:60,울산:80,광주:270,전북:245,전남:275,강원:385,제주:440},
      "대구":  {서울:290,경기:270,인천:300,대전:140,충남:175,충북:135,부산:100,대구:15,경북:50,경남:90,울산:110,광주:220,전북:180,전남:215,강원:255,제주:400},
      "울산":  {서울:385,경기:365,인천:395,대전:240,충남:275,충북:260,부산:80,대구:110,경북:70,경남:80,울산:15,광주:280,전북:245,전남:280,강원:345,제주:430},
    };
    var row = REG_KM[market.region];
    if(row && row[effectiveSido]) return row[effectiveSido];
    return 200;
  }

  function calculate() {
    if(items.length===0||!effectiveSido) return;
    var markets = MARKETS.map(function(market) {
      var km = getKmForMarket(market);
      var parcel = {};
      CARRIER_ORDER.forEach(function(carrier) {
        var total = 0;
        items.forEach(function(item) {
          total += item.qty * parcelCostPerBox(item.kgEach, km, carrier);
        });
        parcel[carrier] = total;
      });
      var cheapParcel = Math.min.apply(null, Object.values(parcel));
      var freight = freightCostByKm(totalKg, km);
      return {market:market, km:km, parcel:parcel, cheapParcel:cheapParcel, freight:freight};
    });
    markets.sort(function(a,b){ return a.cheapParcel - b.cheapParcel; });
    setResult({markets:markets, totalKg:totalKg, bizAddr:bizAddr, toSido:effectiveSido, isRealDist:!!distMap});
  }

  var canCalc = items.length>0 && !!effectiveSido;

  return (
    <div>
      <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:20,padding:"20px",marginBottom:14,color:"#fff",position:"relative"}}>
        <div style={{fontWeight:900,fontSize:17,marginBottom:4}}>🚚 배송 견적 계산기</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.75)"}}>전국 도매시장 → 내 사업장까지 택배·화물 견적 비교</div>
        {(items.length>0||result||fallbackSido) && <button onClick={function(){
          setItems([]); setDraft({name:"",qty:"",kgEach:""}); setResult(null); setFallbackSido("");
        }} style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,0.2)",color:"#fff",border:"1px solid rgba(255,255,255,0.4)",borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
          🔄 초기화
        </button>}
      </div>

      {isLoggedIn && bizAddr
        ? <div style={{background:"#f0fdf4",borderRadius:14,padding:"12px 14px",border:"1px solid #d1fae5",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>📍</span>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:"#888",marginBottom:2}}>도착지 (자동 설정 — MY 탭)</div>
              <div style={{fontWeight:700,fontSize:13,color:"#1a1a1a"}}>{bizAddr}</div>
              {!distMap && <div style={{fontSize:10,color:"#d97706",marginTop:2}}>* 현재 주소는 권역 기반 거리로 추정됩니다</div>}
            </div>
          </div>
        : <div style={{background:"#fff",borderRadius:14,padding:"14px",border:"1px solid #e5e7eb",marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:13,color:G.mid,marginBottom:8}}>
              📍 도착지 선택
              {isLoggedIn && <span style={{fontSize:11,fontWeight:400,color:"#aaa",marginLeft:6}}>— MY 탭에서 주소 저장 시 자동 설정</span>}
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {SIDO_LIST.map(function(s){
                var on = fallbackSido===s;
                return <button key={s} onClick={function(){setFallbackSido(s);setResult(null);}} style={{padding:"5px 11px",borderRadius:20,border:"1.5px solid "+(on?G.mid:"#e5e7eb"),background:on?"#f0fdf4":"#fff",color:on?G.mid:"#888",fontSize:11,fontWeight:on?700:400,cursor:"pointer"}}>{s}</button>;
              })}
            </div>
          </div>
      }

      <div style={{background:"#fff",borderRadius:16,padding:16,border:"1px solid #e5e7eb",marginBottom:12}}>
        <div style={{fontWeight:800,fontSize:13,color:G.mid,marginBottom:12}}>🛒 구매 상품 목록</div>
        <div style={{background:"#f8fffe",borderRadius:12,padding:"12px",border:"1px solid #d1fae5",marginBottom:12}}>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:"#888",marginBottom:3}}>품목</div>
            <input list="ship-datalist" value={draft.name} onChange={function(e){onDraftName(e.target.value);}} placeholder="수박, 사과, 참외..." style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:8,padding:"8px 9px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
            <datalist id="ship-datalist">{itemOptions.map(function(k){ return <option key={k} value={k}/>; })}</datalist>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"#888",marginBottom:3}}>수량 (박스)</div>
              <input type="number" value={draft.qty} min="1" placeholder="예: 5" onChange={function(e){setDraft(function(d){return Object.assign({},d,{qty:e.target.value});});}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:8,padding:"8px 9px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"#888",marginBottom:3}}>박스당 중량 (kg)</div>
              <input type="number" value={draft.kgEach} step="0.1" min="0.1" placeholder="예: 10" onChange={function(e){setDraft(function(d){return Object.assign({},d,{kgEach:e.target.value});});}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:8,padding:"8px 9px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            {(draft.qty&&draft.kgEach)
              ? <div style={{fontSize:11,color:G.light}}>합계 중량: {Math.round(parseFloat(draft.qty)*parseFloat(draft.kgEach)*10)/10}kg</div>
              : <div/>
            }
            <button onClick={addItem} style={{padding:"9px 20px",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"}}>+ 추가</button>
          </div>
        </div>
        {items.length===0
          ? <div style={{textAlign:"center",padding:"18px 0",color:"#ccc",fontSize:13}}>상품을 추가해 주세요</div>
          : <div>
              {items.map(function(item){
                return (
                  <div key={item.id} style={{display:"flex",alignItems:"center",padding:"9px 12px",borderRadius:10,background:"#f0fdf4",border:"1px solid #d1fae5",marginBottom:6}}>
                    <div style={{flex:1}}>
                      <span style={{fontWeight:700,fontSize:13}}>{getEmoji(item.name)} {item.name}</span>
                      <span style={{fontSize:11,color:"#666",marginLeft:8}}>{item.qty}박스</span>
                    </div>
                    <div style={{textAlign:"right",marginRight:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:G.mid}}>{item.totalKg}kg</div>
                      <div style={{fontSize:10,color:"#aaa"}}>{item.kgEach}kg/박스</div>
                    </div>
                    <button onClick={function(){removeItem(item.id);}} style={{background:"none",border:"none",color:"#f87171",fontSize:18,cursor:"pointer",padding:"0 4px"}}>×</button>
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderRadius:10,background:"#0d2b1a",color:"#fff",marginTop:6}}>
                <span style={{fontWeight:700,fontSize:13}}>총 {items.length}개 품목</span>
                <span style={{fontWeight:900,fontSize:15}}>합계 {totalKg}kg</span>
              </div>
            </div>
        }
      </div>

      <button onClick={calculate} disabled={!canCalc} style={{width:"100%",background:canCalc?"linear-gradient(135deg,#0d2b1a,#40916c)":"#e5e7eb",color:canCalc?"#fff":"#aaa",border:"none",borderRadius:14,padding:"15px 0",fontSize:15,fontWeight:900,cursor:canCalc?"pointer":"not-allowed",marginBottom:14}}>
        🧮 전체 시장 배송비 비교
      </button>

      {result && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontWeight:800,fontSize:14,color:G.mid}}>📊 시장별 배송비 비교</div>
            <div style={{fontSize:11,color:"#888"}}>→ {result.toSido} · {totalKg}kg</div>
          </div>
          {!result.isRealDist && <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"8px 12px",fontSize:11,color:"#92400e",marginBottom:10}}>* 실측 거리 미등록 주소 — 권역 기반 추정거리로 계산됨</div>}

          {result.markets.map(function(m, idx) {
            var isBest = idx===0;
            var boxes = items.reduce(function(s,i){ return s+i.qty; }, 0);
            var recommend = m.cheapParcel <= m.freight ? "parcel" : "freight";
            return (
              <div key={m.market.id} style={{background:"#fff",borderRadius:14,padding:"14px",border:"2px solid "+(isBest?"#4ade80":"#f3f4f6"),marginBottom:8,position:"relative"}}>
                {isBest && <div style={{position:"absolute",top:-1,right:12,background:"#16a34a",color:"#fff",fontSize:10,fontWeight:700,padding:"2px 9px",borderRadius:"0 0 8px 8px"}}>택배 최저</div>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#1a1a1a"}}>{m.market.name}</div>
                  <div style={{fontSize:11,color:"#888",background:"#f3f4f6",borderRadius:20,padding:"2px 9px"}}>🚗 약 {m.km}km</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div style={{background:recommend==="parcel"?"#f0fdf4":"#f9fafb",borderRadius:10,padding:"10px",textAlign:"center",border:"1.5px solid "+(recommend==="parcel"?"#86efac":"#f3f4f6")}}>
                    <div style={{fontSize:10,color:"#888",marginBottom:3}}>📦 택배 {recommend==="parcel"&&<span style={{color:"#16a34a",fontWeight:700}}>추천</span>}</div>
                    <div style={{fontWeight:900,fontSize:15,color:recommend==="parcel"?G.mid:"#555"}}>{m.cheapParcel.toLocaleString()}원</div>
                    <div style={{fontSize:9,color:"#aaa",marginTop:2}}>{boxes}박스 · 최저가 기준</div>
                  </div>
                  <div style={{background:recommend==="freight"?"#f0f4ff":"#f9fafb",borderRadius:10,padding:"10px",textAlign:"center",border:"1.5px solid "+(recommend==="freight"?"#a5b4fc":"#f3f4f6")}}>
                    <div style={{fontSize:10,color:"#888",marginBottom:3}}>🚛 화물 {recommend==="freight"&&<span style={{color:"#6366f1",fontWeight:700}}>추천</span>}</div>
                    <div style={{fontWeight:900,fontSize:15,color:recommend==="freight"?"#6366f1":"#555"}}>{m.freight.toLocaleString()}원~</div>
                    <div style={{fontSize:9,color:"#aaa",marginTop:2}}>1톤 트럭 기준</div>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{background:"#f1f5f9",borderRadius:12,padding:"10px 12px",fontSize:11,color:"#64748b",lineHeight:1.7,marginTop:4}}>
            ⚠️ 실제 운임은 운송사·차량 크기·성수기에 따라 다를 수 있습니다.
          </div>

          <div style={{background:"#fff",borderRadius:16,padding:16,border:"1px solid #e5e7eb",marginTop:12}}>
            <div style={{fontWeight:800,fontSize:13,color:G.mid,marginBottom:12}}>📞 배송 문의하기</div>
            <div style={{display:"flex",gap:6,marginBottom:14}}>
              {[["parcel","📦 택배사"],["freight","🚛 화물운송"]].map(function(t){
                var on = contactTab===t[0];
                return <button key={t[0]} onClick={function(){setContactTab(t[0]);}} style={{flex:1,padding:"9px 0",background:on?"linear-gradient(135deg,#0d2b1a,#40916c)":"#f3f4f6",color:on?"#fff":"#555",border:"none",borderRadius:10,fontSize:12,fontWeight:on?700:400,cursor:"pointer"}}>{t[1]}</button>;
              })}
            </div>
            {contactTab==="parcel" && (
              <div>
                <div style={{fontSize:11,color:"#888",marginBottom:10}}>택배사에 직접 집화 신청하거나 홈페이지에서 접수하세요.</div>
                {PARCEL_CONTACTS.map(function(c){
                  return (
                    <div key={c.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 12px",borderRadius:12,background:"#f8fffe",border:"1px solid #e5e7eb",marginBottom:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13,color:"#1a1a1a",marginBottom:2}}>{c.name}</div>
                        <div style={{fontSize:11,color:"#888"}}>{c.desc}</div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <a href={"tel:"+c.phone} style={{display:"flex",alignItems:"center",gap:4,background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:20,padding:"6px 12px",textDecoration:"none",color:G.mid,fontSize:12,fontWeight:700}}>📱 {c.phone}</a>
                        <a href={c.url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",background:G.mid,borderRadius:20,padding:"6px 12px",textDecoration:"none",color:"#fff",fontSize:12,fontWeight:700}}>🌐</a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {contactTab==="freight" && (
              <div>
                <div style={{fontSize:11,color:"#888",marginBottom:10}}>화물 중개 플랫폼에 의뢰하거나 앱에서 실시간 차량을 배정받으세요.</div>
                {FREIGHT_CONTACTS.map(function(c){
                  return (
                    <div key={c.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 12px",borderRadius:12,background:"#f8faff",border:"1px solid #e5e7eb",marginBottom:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13,color:"#1a1a1a",marginBottom:2}}>{c.name}</div>
                        <div style={{fontSize:11,color:"#888"}}>{c.desc}</div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <a href={"tel:"+c.phone} style={{display:"flex",alignItems:"center",gap:4,background:"#f0f4ff",border:"1.5px solid #a5b4fc",borderRadius:20,padding:"6px 12px",textDecoration:"none",color:"#6366f1",fontSize:12,fontWeight:700}}>📱 {c.phone}</a>
                        <a href={c.url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",background:"#6366f1",borderRadius:20,padding:"6px 12px",textDecoration:"none",color:"#fff",fontSize:12,fontWeight:700}}>🌐</a>
                      </div>
                    </div>
                  );
                })}
                <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:10,padding:"10px 12px",marginTop:4,fontSize:11,color:"#92400e",lineHeight:1.8}}>
                  💡 앱스토어·플레이스토어에서 각 업체명 검색 시 실시간 차량 배정 앱을 이용할 수 있습니다.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 앱 ──
function App() {
  var t1 = useState("search"); var tab = t1[0]; var setTab = t1[1];
  var f1 = useState(""); var filterItem = f1[0]; var setFilterItem = f1[1];
  var f1b = useState(""); var filterGrade = f1b[0]; var setFilterGrade = f1b[1];
  var f1c = useState(""); var filterUnit = f1c[0]; var setFilterUnit = f1c[1];
  var f1d = useState(""); var filterSubItem = f1d[0]; var setFilterSubItem = f1d[1];
  var f2 = useState(""); var filterRegion = f2[0]; var setFilterRegion = f2[1];
  var f3 = useState(""); var keyword = f3[0]; var setKeyword = f3[1];
  var f4 = useState("price"); var sortBy = f4[0]; var setSortBy = f4[1];
  var f5 = useState(false); var searched = f5[0]; var setSearched = f5[1];
  var f6 = useState(""); var filterCategory = f6[0]; var setFilterCategory = f6[1];
  var f7 = useState(""); var filterMarket = f7[0]; var setFilterMarket = f7[1];
  var f8 = useState("today"); var dateFilter = f8[0]; var setDateFilter = f8[1];

  var d1 = useState([]); var data = d1[0]; var setData = d1[1];
  var d1b = useState([]); var noeunCards = d1b[0]; var setNoeunCards = d1b[1];
  var d2 = useState("idle"); var status = d2[0]; var setStatus = d2[1];
  var d3 = useState(""); var errMsg = d3[0]; var setErrMsg = d3[1];
  var d4 = useState(null); var lastUpdated = d4[0]; var setLastUpdated = d4[1];
  var d5 = useState(0); var liveCount = d5[0]; var setLiveCount = d5[1];
  var d6 = useState([]); var tradeData = d6[0]; var setTradeData = d6[1];
  var d7 = useState("idle"); var tradeStatus = d7[0]; var setTradeStatus = d7[1];

  var m1 = useState(""); var mapRegion = m1[0]; var setMapRegion = m1[1];
  var l1 = useState(function(){ try { var s=localStorage.getItem("agro_login"); return s?JSON.parse(s):null; } catch(e){ return null; } }); var loginUser = l1[0]; var _setLoginUser = l1[1];
  function setLoginUser(user){ _setLoginUser(user); try{ if(user){ localStorage.setItem("agro_login",JSON.stringify(user)); } else { localStorage.removeItem("agro_login"); } }catch(e){} }
  var l2 = useState(false); var showLogin = l2[0]; var setShowLogin = l2[1];
  var l3 = useState(false); var showCart = l3[0]; var setShowCart = l3[1];
  // 장바구니 모달 state (App 최상단에 있어야 React 규칙 준수)
  var cl1 = useState([]); var cartList = cl1[0]; var setCartList = cl1[1];
  var cl2 = useState(""); var cartPM = cl2[0]; var setCartPM = cl2[1];
  var cl3 = useState(false); var cartDone = cl3[0]; var setCartDone = cl3[1];
  var cl4 = useState(0); var cartCount = cl4[0]; var setCartCount = cl4[1];
  var cl5 = useState("pickup"); var cartPickup = cl5[0]; var setCartPickup = cl5[1];
  var p1 = useState(function(){ try { return JSON.parse(localStorage.getItem("agro_sold_cards")||"{}"); } catch(e){ return {}; } }); var purchases = p1[0]; var setPurchases = p1[1];
  var pv1 = useState([]); var prevData = pv1[0]; var setPrevData = pv1[1];

  // 장바구니 결제 함수 - setPurchases 이후 정의 (참조 보장)
  function cartCheckout() {
    if(!cartPM){ alert("결제 수단을 선택해주세요."); return; }
    if(!loginUser){ return; }
    var currentCart = [];
    try { currentCart = JSON.parse(localStorage.getItem("agro_cart_"+loginUser.id)||"[]"); } catch(e){}
    if(currentCart.length === 0){ alert("장바구니가 비어있습니다."); return; }
    var bal = parseInt(localStorage.getItem("agro_balance_"+loginUser.id)||"0");
    var dep = currentCart.reduce(function(s,c){return s+(c.deposit||0);},0);
    if(cartPM==="balance" && bal < dep){
      alert("예치금 부족\n잔액: "+bal.toLocaleString()+"원\n필요: "+dep.toLocaleString()+"원"); return;
    }
    if(cartPM==="balance"){
      try{ localStorage.setItem("agro_balance_"+loginUser.id, String(bal-dep)); }catch(e){}
    }
    try{
      var existing = JSON.parse(localStorage.getItem("agro_purchase_"+loginUser.id)||"[]");
      currentCart.forEach(function(c){
        existing.push({key:c.itemKey,itemName:c.itemName,grade:c.grade,origin:c.origin,price:c.price,qty:c.qty,deposit:c.deposit,total:c.total,payMethod:cartPM,date:new Date().toLocaleDateString("ko-KR"),dealerName:c.dealerName,cardId:c.cardId,purchasedQty:c.qty});
      });
      localStorage.setItem("agro_purchase_"+loginUser.id, JSON.stringify(existing));
    }catch(e){}
    var soldCards = {};
    try { soldCards = JSON.parse(localStorage.getItem("agro_sold_cards")||"{}"); } catch(e){}
    currentCart.forEach(function(c){
      soldCards[c.itemKey] = {status:"완료", deposit:c.deposit, total:c.total, payMethod:cartPM, cardId:c.cardId, purchasedQty:c.qty, itemName:c.itemName};
      if(c.cardId !== undefined && c.cardId !== null) {
        var prevRemain = soldCards["remainqty_"+String(c.cardId)];
        var origQty = prevRemain !== undefined ? prevRemain : (c.maxQty || c.qty);
        var newRemain = origQty - c.qty;
        if(newRemain <= 0){
          soldCards["soldcard_"+String(c.cardId)] = {status:"완료"};
          delete soldCards["remainqty_"+String(c.cardId)];
        } else {
          soldCards["remainqty_"+String(c.cardId)] = newRemain;
        }
      }
    });
    try { localStorage.setItem("agro_sold_cards", JSON.stringify(soldCards)); } catch(e){}
    setPurchases(soldCards);
    setCartList([]);
    setCartCount(0);
    try{ localStorage.setItem("agro_cart_"+loginUser.id, "[]"); }catch(e){}
    setCartDone(true);
  }

  useEffect(function(){
    var cancelled = false;

    async function load() {
      setStatus("loading");
      setData([]);

      try {
        var res = await fetch(CSV_URL);
        if(!res.ok) throw new Error("경락 데이터 로드 실패: " + res.status);
        // 서버가 JSON으로 파싱해서 반환
        var json = await res.json();
        if(cancelled) return;

        // JSON → 카드 데이터 변환
        var liveRows = json.map(function(r, i){
          var market = getMarket(r["도매시장"] || "");
          var itemName = (r["품목"] || "").trim();
          var variety  = (r["품종"] || "").trim();
          var fullName = variety && variety !== itemName ? itemName+"("+variety+")" : itemName;
          return {
            id: i,
            date: r["경매일시"] || "",
            market: market,
            itemName: itemName,
            fullName: fullName,
            variety: variety,
            origin: r["산지"] || "",
            qty: r["수량"] || 0,
            unit: r["단위"] || "개",
            price: r["경락가"] || 0,
            corp: r["법인"] || "",
            emoji: getEmoji(itemName),
            category: getCategory(itemName),
            isMock: false,
            bidder: "", grade: "", shipperName: "", shipperPhone: "",
          };
        }).filter(function(r){ return r.itemName && r.price >= 5000; });

        // 완전히 동일한 행만 제거
        var seen = {};
        var combined = liveRows.filter(function(r){
          // 노은시장은 AT데이터 제외 (거래실적 데이터만 사용)
          if(r.market.id === 8) return false;
          var key = r.date+"_"+r.market.id+"_"+r.corp+"_"+r.itemName+"_"+r.variety+"_"+r.origin+"_"+r.qty+"_"+r.unit+"_"+r.price;
          if(seen[key]) return false;
          seen[key] = true;
          return true;
        });

        setData(combined);
        setLiveCount(0);
        setStatus("ok");
        setLastUpdated(new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}));
      } catch(e) {
        if(!cancelled) {
          setStatus("partial");
          setErrMsg(e.message);
        }
      }
    }
    load();
    var iv = setInterval(load, 60*60*1000);
    return function(){ cancelled=true; clearInterval(iv); };
  }, []);

  // ── 전일 경락 fetch ──
  useEffect(function(){
    var cancelled = false;
    async function loadPrev() {
      try {
        var res = await fetch("/api/sheet/prev");
        if(!res.ok) return;
        var json = await res.json();
        if(cancelled) return;
        if(!Array.isArray(json)) return;
        var rows = json.map(function(r, i){
          var market = getMarket(r["도매시장"] || "");
          var itemName = (r["품목"] || "").trim();
          var variety  = (r["품종"] || "").trim();
          var fullName = variety && variety !== itemName ? itemName+"("+variety+")" : itemName;
          return {
            id: i, date: r["경매일시"] || "", market: market,
            itemName: itemName, fullName: fullName, variety: variety,
            origin: r["산지"] || "", qty: r["수량"] || 0,
            unit: r["단위"] || "개", price: r["경락가"] || 0,
            corp: r["법인"] || "", emoji: getEmoji(itemName),
            category: getCategory(itemName), isMock: false,
            bidder: "", grade: "", shipperName: "", shipperPhone: "",
          };
        }).filter(function(r){ return r.itemName && r.price > 0; });
        var seen = {};
        var deduped = rows.filter(function(r){
          if(r.market.id === 8) return false;
          var key = r.market.id+"_"+r.corp+"_"+r.itemName+"_"+r.price+"_"+r.qty+"_"+r.origin+"_"+r.date;
          if(seen[key]) return false;
          seen[key] = true;
          return true;
        });
        setPrevData(function(prev){
          // 기존 노은 전일 카드(noeunprev_) 보존하고 AT 전일 데이터 합치기
          var noeunPrev = prev.filter(function(r){ return r.market && r.market.id === 8; });
          return deduped.concat(noeunPrev);
        });
      } catch(e) {}
    }
    loadPrev();
    var ivP = setInterval(loadPrev, 60*60*1000);
    return function(){ cancelled=true; clearInterval(ivP); };
  }, []);

  // ── 거래실적 fetch ──
  useEffect(function(){
    var cancelled = false;
    async function loadTrade() {
      setTradeStatus("loading");
      try {
        var res = await fetch("/api/trade");
        if(!res.ok) throw new Error("거래실적 로드 실패: " + res.status);
        var csv = await res.text();
        if(cancelled) return;
        var lines = csv.trim().split("\n");
        if(lines.length < 2) { setTradeStatus("empty"); return; }
        var headers = lines[0].split(",").map(function(h){ return h.trim().replace(/"/g,""); });
        var rows = [];
        for(var i = 1; i < lines.length; i++) {
          var cols = [];
          var cur = "", inQ = false;
          for(var j = 0; j < lines[i].length; j++) {
            var ch = lines[i][j];
            if(ch==='"'){ inQ=!inQ; continue; }
            if(ch===','&&!inQ){ cols.push(cur.trim()); cur=""; continue; }
            cur += ch;
          }
          cols.push(cur.trim());
          if(cols.every(function(c){return !c;})) continue;
          var row = {};
          headers.forEach(function(h,idx){ row[h] = (cols[idx]||"").trim(); });
          // 소계/합계 행 제외
          var 품목명 = row["품목명"]||row["품목"]||"";
          if(품목명.includes("소계")||품목명.includes("합계")||!품목명) continue;
          // 품목명 공백 제거
          row["품목명"] = 품목명.trim();
          row["품목"] = (row["품목"]||"").trim();
          rows.push(row);
        }
        setTradeData(rows);
        setTradeStatus("ok");

        // 거래실적 데이터로 노은시장 경락 카드 생성 (가장 최신 날짜만)
        var NOEUN_MARKET = {id:8, name:"대전 노은시장", region:"대전", sheetName:"대전노은", phone:"", corp:"중부청과"};

        // 날짜 정규화: 2026.06.10 → 2026-06-10
        function normDate(d){ return (d||"").split(" ")[0].replace(/\./g,"-").trim(); }

        // 가장 최신 날짜 추출
        var allTradeDates = rows.map(function(r){ return normDate(r["경매일자"]||r["매매일자"]||""); }).filter(Boolean);
        var latestTradeDate = allTradeDates.sort().pop() || "";

        // 최신 날짜 행만 필터 — 오늘(TODAY)과 일치할 때만 오늘 탭에 표시
        var todayRows = (latestTradeDate && latestTradeDate === TODAY)
          ? rows.filter(function(r){ return normDate(r["경매일자"]||r["매매일자"]||"") === latestTradeDate; })
          : [];

        // 개별 거래 행 → 독립 카드 (AT카드와 동일 구조)
        var noeunCards = todayRows.map(function(row, i){
          var itemName = (row["품목명"]||row["품목"]||"").trim();
          var price    = parseInt((row["단가"]||"0").replace(/,/g,""))||0;
          var qty      = parseInt((row["수량"]||"0").replace(/,/g,""))||0;
          var weight   = (row["중량"]||"").trim();
          var grade    = (row["등급"]||"").trim();
          var origin   = (row["산지명"]||"").trim();
          var no       = String(row["낙찰 중도매인"]||"").trim();
          var auctionTime = (row["경매시간"]||"").trim();
          var info     = getDealerInfo(no);
          return {
            id: "noeun_"+i+"_"+auctionTime,
            date: latestTradeDate,
            market: NOEUN_MARKET,
            itemName: itemName,
            fullName: itemName,
            variety: grade ? grade+"등급" : "",
            origin: origin,
            qty: qty,
            unit: weight ? weight+"kg" : "박스",
            price: price,
            corp: info.name || "중부청과",
            grade: grade,
            emoji: getEmoji(itemName),
            category: getCategory(itemName),
            isMock: false,
            dealerNo: no,
            auctionTime: auctionTime,
            bidder: "", shipperName: "", shipperPhone: "",
          };
        }).filter(function(r){ return r.itemName && r.price > 0; });

        // 노은 카드 별도 state로 저장
        setNoeunCards(noeunCards);
        setLiveCount(noeunCards.length);

        // ── 전일 노은 카드 생성 → prevData에 합치기 ──
        var prevTradeDate = YESTERDAY;
        if(prevTradeDate) {
          var prevRows = rows.filter(function(r){ return normDate(r["경매일자"]||r["매매일자"]||"") === prevTradeDate; });
          var prevNoeunCards = prevRows.map(function(row, i){
            var itemName = (row["품목명"]||row["품목"]||"").trim();
            var price    = parseInt((row["단가"]||"0").replace(/,/g,""))||0;
            var qty      = parseInt((row["수량"]||"0").replace(/,/g,""))||0;
            var weight   = (row["중량"]||"").trim();
            var grade    = (row["등급"]||"").trim();
            var origin   = (row["산지명"]||"").trim();
            var no       = String(row["낙찰 중도매인"]||"").trim();
            var auctionTime = (row["경매시간"]||"").trim();
            var info     = getDealerInfo(no);
            return {
              id: "noeunprev_"+i+"_"+auctionTime,
              date: prevTradeDate,
              market: NOEUN_MARKET,
              itemName: itemName,
              fullName: itemName,
              variety: grade ? grade+"등급" : "",
              origin: origin,
              qty: qty,
              unit: weight ? weight+"kg" : "박스",
              price: price,
              corp: info.name || "중부청과",
              grade: grade,
              emoji: getEmoji(itemName),
              category: getCategory(itemName),
              isMock: false,
              dealerNo: no,
              auctionTime: auctionTime,
              bidder: "", shipperName: "", shipperPhone: "",
            };
          }).filter(function(r){ return r.itemName && r.price > 0; });
          // prevData(AT 전일)에 노은 전일 카드 추가
          setPrevData(function(prev){ return prev.concat(prevNoeunCards); });
        }

      } catch(e) {
        if(!cancelled) setTradeStatus("error");
      }
    }
    loadTrade();
    var iv2 = setInterval(loadTrade, 60*60*1000);
    return function(){ cancelled=true; clearInterval(iv2); };
  }, []);

  // ── 구매 상태 폴링 ──
  useEffect(function(){
    var cancelled = false;
    async function loadPurchases() {
      try {
        var res = await fetch("/api/purchases");
        if(!res.ok) return;
        var json = await res.json();
        if(!cancelled) { var soldCards={}; try{soldCards=JSON.parse(localStorage.getItem("agro_sold_cards")||"{}");}catch(e){} setPurchases(Object.assign({}, json.purchases||{}, soldCards)); }
      } catch(e) {}
    }
    loadPurchases();
    var iv3 = setInterval(loadPurchases, 5000); // 5초마다 갱신
    return function(){ cancelled=true; clearInterval(iv3); };
  }, []);

  // 오늘/전일 탭에 따라 데이터 소스 선택
  var activeData = dateFilter === "yesterday" ? prevData : data.concat(noeunCards);
  var allDates = Array.from(new Set(data.map(function(r){return r.date;}).filter(Boolean))).sort();
  var latestDate = allDates[allDates.length-1] || TODAY;
  var prevAllDates = Array.from(new Set(prevData.map(function(r){return r.date;}).filter(Boolean))).sort();
  var prevDate = prevAllDates[prevAllDates.length-1] || YESTERDAY;
  // 품목 대분류 매핑 (거래실적 + AT 데이터 전체)
  var ITEM_GROUP_MAP = {
    "수박":"수박","수박일반":"수박","애플수박":"수박","흑수박":"수박","꿀수박":"수박",
    "복숭아":"복숭아","신선":"복숭아","신비":"복숭아","천도":"복숭아","미시마":"복숭아","황도":"복숭아","백도":"복숭아",
    "살구":"살구","하코트":"살구","산형3호":"살구",
    "완숙토마토":"토마토","대추방울":"토마토","방울토마토":"토마토","토마토":"토마토","스테비아":"토마토",
    "딸기":"딸기","산딸기":"딸기",
    "블루베리":"블루베리",
    "오디":"오디",
    "보리수":"보리수",
    "청매실":"매실","홍매실":"매실","매실":"매실",
    "참외":"참외",
    "머스크":"멜론","멜론":"멜론",
    "포도":"포도","거봉":"포도","델라웨어":"포도","켐벨얼리":"포도","캠벨":"포도","청포도":"포도","크림슨":"포도","레드글로브":"포도",
    "사과":"사과","후지":"사과","홍로":"사과","부사":"사과",
    "배":"배","신고":"배","원황":"배",
    "감귤":"감귤","하우스감귤":"감귤","귤":"감귤","한라봉":"감귤","천혜향":"감귤","황금향":"감귤","레드향":"감귤",
    "바나나":"바나나","수입바나나":"바나나",
    "자두":"자두",
    "자몽":"자몽","수입자몽":"자몽",
    "레몬":"레몬","수입레몬":"레몬","오렌지":"오렌지","체리":"체리",
    "망고":"망고","파인애플":"파인애플","키위":"키위","참다래":"키위",
    "아보카도":"아보카도","아보카드":"아보카도","용과":"용과","무화과":"무화과",
  };
  function getRepItem(name) {
    if(!name) return name;
    // 1. 직접 매핑
    if(ITEM_GROUP_MAP[name]) return ITEM_GROUP_MAP[name];
    // 2. 괄호/수식어 제거 후 매핑
    var base = name.replace(/\(.*?\)/g,"").replace(/일반|BOX|box|꼭지절단|수입/g,"").trim();
    if(ITEM_GROUP_MAP[base]) return ITEM_GROUP_MAP[base];
    // 3. 부분 매칭
    for(var key in ITEM_GROUP_MAP) {
      if(name.includes(key)) return ITEM_GROUP_MAP[key];
    }
    // 4. 매핑 없으면 원래 이름 그대로 (0611 새 품목 대비)
    return base || name;
  }

  var filtered = activeData.filter(function(r){
    // 결제 완료(전량)된 카드는 검색 결과에서 제외
    if(purchases["soldcard_"+r.id] && purchases["soldcard_"+r.id].status==="완료") return false;
    // 잔여수량 0이면 제외
    if(purchases["remainqty_"+r.id] !== undefined && purchases["remainqty_"+r.id] <= 0) return false;
    // 대분류 품목 매칭
    if(filterItem && getRepItem(r.itemName) !== filterItem) return false;
    // 소분류 품목 매칭
    if(filterSubItem && r.itemName !== filterSubItem) return false;
    if(filterGrade && r.grade !== filterGrade) return false;
    // 단위: 구간으로 매칭
    if(filterUnit) {
      var range = UNIT_RANGES.find(function(u){ return u.label === filterUnit; });
      if(range) {
        var kg = parseFloat((r.unit||"").replace(/kg.*/i,""))||0;
        if(kg <= range.min || kg > range.max) return false;
      }
    }
    if(filterMarket && r.market.name !== filterMarket) return false;
    if(filterRegion && r.market.region !== filterRegion) return false;
    if(keyword && !r.fullName.includes(keyword) && !r.market.name.includes(keyword) && !r.corp.includes(keyword) && !r.origin.includes(keyword)) return false;
    return true;
  }).sort(function(a,b){
    if(sortBy==="price") return a.price - b.price;
    if(sortBy==="qty") return b.qty - a.qty;
    return 0;
  });

  // 대분류 품목 리스트 (중복 제거 + 정렬)
  var itemList = Array.from(new Set(activeData.map(function(r){ return getRepItem(r.itemName); }).filter(Boolean))).sort();

  // 품목 선택 시 해당 소분류 리스트
  var subItemList = filterItem
    ? Array.from(new Set(
        activeData
          .filter(function(r){ return getRepItem(r.itemName) === filterItem; })
          .map(function(r){ return r.itemName; })
      )).sort()
    : [];

  var VALID_GRADES = ["왕특","특","특등","상","상등","보통"];
  var gradeList = Array.from(new Set(activeData.map(function(r){return r.grade||"";}).filter(function(g){ return VALID_GRADES.indexOf(g) !== -1; }))).sort(function(a,b){ return VALID_GRADES.indexOf(a) - VALID_GRADES.indexOf(b); });

  // 단위 구간화
  var unitList = UNIT_RANGES.map(function(r){ return r.label; });

  // 9개 시장 항상 고정 표시
  var marketList = MARKETS.map(function(m){ return m.name; });

  var stats = {
    total: data.length,
    markets: 9, // 전국 9개 중앙공영도매시장 고정
    avgPrice: data.length ? Math.round(data.reduce(function(s,r){return s+r.price;},0)/data.length) : 0,
  };

  return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif"}}>
      <div style={{background:"linear-gradient(160deg,#0d2b1a 0%,#1b4332 55%,#2d6a4f 100%)"}}>
        <div style={{maxWidth:600,margin:"0 auto",padding:"0 16px"}}>
          <div style={{padding:"16px 0 12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{color:"#52b788",fontSize:10,letterSpacing:3,fontWeight:700}}>AGRO CONNECT</div>
                <div style={{color:"#fff",fontWeight:900,fontSize:20,marginTop:2}}>농작교</div>
                <div style={{color:"rgba(255,255,255,0.6)",fontSize:10,marginTop:2}}>전국 9개 중앙공영도매시장 · 수수료 없는 공영 중계</div>
                {(status==="ok"||status==="partial") && <div style={{marginTop:6,display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span style={{background:"rgba(74,222,128,0.2)",color:"#4ade80",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px",border:"1px solid rgba(74,222,128,0.3)"}}>
                    🟢 전국 {stats.total}건 · {lastUpdated} 기준
                  </span>
                  {status==="partial" && <span style={{background:"rgba(234,179,8,0.2)",color:"#fde047",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px"}}>⚠️ 일부 시장 연결 대기</span>}
                </div>}
                {status==="loading" && <div style={{marginTop:6}}>
                  <span style={{background:"rgba(234,179,8,0.2)",color:"#fde047",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px"}}>⏳ 데이터 불러오는 중...</span>
                </div>}
                {status==="error" && <div style={{marginTop:6}}>
                  <span style={{background:"rgba(239,68,68,0.2)",color:"#fca5a5",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px"}}>🔴 연결 오류 · 재시도 중</span>
                </div>}
              </div>
              <div style={{marginTop:4,display:"flex",gap:6,alignItems:"center"}}>
                {loginUser
                  ? <button onClick={function(){setTab("mypage");setShowCart(false);}} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:20,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      {loginUser.role==="dealer"?"🏪":"🛒"} 마이페이지
                    </button>
                  : <button onClick={function(){setShowLogin(true);}} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:20,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      🔐 로그인
                    </button>
                }
                {loginUser && loginUser.role==="buyer" && (function(){
                  var cartCount = 0;
                  try { cartCount = JSON.parse(localStorage.getItem("agro_cart_"+loginUser.id)||"[]").length; } catch(e){}
                  return (
                    <button onClick={function(){
                      // 열 때마다 localStorage 동기화
                      try {
                        var c = JSON.parse(localStorage.getItem("agro_cart_"+loginUser.id)||"[]");
                        setCartList(c);
                      } catch(e){}
                      setCartPM("");
                      setCartDone(false);
                      setShowCart(true);
                    }} style={{background:showCart?"#FEE500":"rgba(255,165,0,0.25)",border:"1px solid rgba(255,165,0,0.5)",color:showCart?"#3A1D1D":"#fed7aa",borderRadius:20,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                      🧺
                      {cartCount > 0 && <span style={{background:"#c2410c",color:"#fff",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900}}>{cartCount}</span>}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:2,paddingBottom:0}}>
            {[["search","🔍 경락"],["ship","🚚 배송"],["guide","📋 안내"],["mypage","👤 MY"]].map(function(t){
              var active = tab===t[0];
              return <button key={t[0]} onClick={function(){setTab(t[0]); if(t[0]==="mypage"&&!loginUser) setShowLogin(true);}} style={{flex:1,padding:"10px 0",border:"none",background:active?"rgba(255,255,255,0.15)":"transparent",color:active?"#fff":"rgba(255,255,255,0.55)",fontWeight:active?800:400,fontSize:10,cursor:"pointer",borderBottom:active?"2px solid #52b788":"2px solid transparent",borderRadius:"6px 6px 0 0"}}>
                {t[1]}
              </button>;
            })}
          </div>
        </div>
      </div>
      <div style={{maxWidth:600,margin:"0 auto",padding:"16px"}}>
        {tab==="search" && <div>
          {(status==="ok"||status==="partial"||data.length>0) && <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
            {[
              ["📊","오늘 경락",stats.total+"건"],
              ["🏛️","참여 시장",stats.markets+"개소"],
              ["💰","평균 경락가",stats.avgPrice.toLocaleString()+"원"],
            ].map(function(r){return (
              <div key={r[1]} style={{background:"#fff",borderRadius:14,padding:"12px 10px",textAlign:"center",border:"1px solid #e5e7eb",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
                <div style={{fontSize:20,marginBottom:4}}>{r[0]}</div>
                <div style={{fontSize:9,color:"#aaa",marginBottom:3}}>{r[1]}</div>
                <div style={{fontSize:13,fontWeight:900,color:G.mid}}>{r[2]}</div>
              </div>
            );})}
          </div>}
          <div style={{background:"#fff",borderRadius:16,padding:"16px",marginBottom:14,border:"1px solid #e5e7eb",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{fontWeight:800,fontSize:14,color:G.mid,marginBottom:12}}>🔍 경락가 검색</div>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>품목</div>
              <select value={filterItem} onChange={function(e){setFilterItem(e.target.value); setFilterSubItem(""); setFilterGrade(""); setFilterUnit("");}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"9px 10px",fontSize:13,background:"#f8fffe",outline:"none"}}>
                <option value="">전체 품목</option>
                {itemList.map(function(name){return <option key={name} value={name}>{getEmoji(name)+" "+name}</option>;})}
              </select>
            </div>
            {filterItem && subItemList.length > 1 && (
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>품목 상세</div>
                <select value={filterSubItem} onChange={function(e){setFilterSubItem(e.target.value);}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"9px 10px",fontSize:13,background:"#f8fffe",outline:"none"}}>
                  <option value="">전체 ({subItemList.length}종)</option>
                  {subItemList.map(function(name){return <option key={name} value={name}>{name}</option>;})}
                </select>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>
                  등급 {filterMarket !== "대전 노은시장" && <span style={{fontSize:10,fontWeight:400,color:"#bbb"}}>(노은시장 전용)</span>}
                </div>
                <select value={filterGrade} onChange={function(e){setFilterGrade(e.target.value);}} disabled={filterMarket !== "대전 노은시장"} style={{width:"100%",border:"1.5px solid "+(filterMarket==="대전 노은시장"?"#bbf7d0":"#e5e7eb"),borderRadius:10,padding:"9px 10px",fontSize:13,background:filterMarket==="대전 노은시장"?"#f8fffe":"#f3f4f6",outline:"none",color:filterMarket==="대전 노은시장"?"#1a1a1a":"#aaa",cursor:filterMarket==="대전 노은시장"?"pointer":"not-allowed"}}>
                  <option value="">전체 등급</option>
                  {gradeList.map(function(g){return <option key={g} value={g}>{g}</option>;})}
                </select>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>단위</div>
                <select value={filterUnit} onChange={function(e){setFilterUnit(e.target.value);}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"9px 10px",fontSize:13,background:"#f8fffe",outline:"none"}}>
                  <option value="">전체 단위</option>
                  {unitList.map(function(u){return <option key={u} value={u}>{u}</option>;})}
                </select>
              </div>
            </div>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>도매시장</div>
              <select value={filterMarket} onChange={function(e){setFilterMarket(e.target.value); if(e.target.value !== "대전 노은시장") setFilterGrade("");}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"9px 10px",fontSize:13,background:"#f8fffe",outline:"none"}}>
                <option value="">전체 시장</option>
                {marketList.map(function(m){return <option key={m} value={m}>{m}</option>;})}
              </select>
            </div>

            <div style={{marginBottom:10}}>
              <input value={keyword} onChange={function(e){setKeyword(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")setSearched(true);}} placeholder="품목명, 시장명, 산지, 법인명 검색..." style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"10px 13px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
            </div>

            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {[["today","📅 오늘 경락가"],["yesterday","📋 전일 경락가"]].map(function(d){
                var on = dateFilter===d[0];
                return <button key={d[0]} onClick={function(){setDateFilter(d[0]); setSearched(true);}} style={{flex:1,padding:"10px 0",background:on?"linear-gradient(135deg,#0d2b1a,#40916c)":"#fff",color:on?"#fff":"#555",border:"1.5px solid "+(on?"#2d6a4f":"#d1fae5"),borderRadius:12,fontSize:13,fontWeight:on?900:500,cursor:"pointer"}}>{d[1]}</button>;
              })}
            </div>
            <button onClick={function(){setSearched(true);}} style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontSize:14,fontWeight:900,cursor:"pointer"}}>
              🔍 전국 경락가 검색
            </button>
          </div>
          {searched && <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontWeight:800,fontSize:14,color:"#0d1f15"}}>
                {filterItem||keyword||filterRegion ? (filterItem||keyword||filterRegion) : "전체 품목"} 검색결과 <span style={{color:G.mid}}>{filtered.length}건</span>
                <span style={{fontSize:11,color:"#aaa",fontWeight:400,marginLeft:6}}>({dateFilter==="yesterday"?(prevDate||"전일 데이터 없음"):latestDate})</span>
              </div>
              <button onClick={function(){
                setFilterItem(""); setFilterGrade(""); setFilterUnit(""); setFilterSubItem("");
                setFilterRegion(""); setFilterMarket(""); setFilterCategory(""); setKeyword(""); setSortBy("price");
              }} style={{background:"#f3f4f6",color:"#555",border:"1px solid #e5e7eb",borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                🔄 필터 초기화
              </button>
            </div>

            <div style={{display:"flex",gap:6,marginBottom:12}}>
              {[["price","💰 최저가순"],["qty","📦 수량순"]].map(function(s){return (
                <button key={s[0]} onClick={function(){setSortBy(s[0]);}} style={{flex:1,padding:"8px 0",background:sortBy===s[0]?G.mid:"#fff",color:sortBy===s[0]?"#fff":"#666",border:"1px solid "+(sortBy===s[0]?G.mid:"#e5e7eb"),borderRadius:20,fontSize:11,fontWeight:sortBy===s[0]?700:400,cursor:"pointer"}}>{s[1]}</button>
              );})}
            </div>

            {filtered.length===0
              ? <div style={{textAlign:"center",padding:"40px 0"}}>
                  <div style={{fontSize:40,marginBottom:10}}>🔍</div>
                  <div style={{fontWeight:700,fontSize:14,color:"#888"}}>검색 결과가 없습니다</div>
                  <div style={{fontSize:12,color:"#aaa",marginTop:6}}>다른 품목이나 지역으로 검색해보세요</div>
                </div>
              : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {filtered.slice(0, 100).map(function(r, idx){
                    return <RecordCard key={r.id} record={r} rank={idx+1} tradeData={tradeData} purchases={purchases} setPurchases={setPurchases} loginUser={loginUser} sortBy={sortBy} setCartCount={setCartCount}/>;
                  })}
                  {filtered.length > 100 && <div style={{textAlign:"center",padding:"12px",fontSize:12,color:"#888"}}>상위 100건 표시 중 · 검색어로 필터링하세요</div>}
                </div>
            }
          </div>}

          {!searched && data.length>0 && <div style={{textAlign:"center",padding:"30px 0"}}>
            <div style={{fontSize:40,marginBottom:10}}>🌿</div>
            <div style={{fontWeight:700,fontSize:14,color:"#555",marginBottom:6}}>품목 또는 시장을 선택하고</div>
            <div style={{fontSize:13,color:"#888"}}>전국 경락가 검색 버튼을 눌러주세요</div>
          </div>}

          {!searched && data.length===0 && <div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{fontSize:36,marginBottom:10}}>⏳</div>
            <div style={{fontSize:13,color:"#888"}}>실시간 경락 데이터 불러오는 중...</div>
          </div>}

        </div>}
        {tab==="ship" && <ShippingCalcTab loginUser={loginUser} auctionData={data} />}
        {tab==="map" && <MarketMap
          data={data}
          selected={mapRegion}
          onSelect={function(r){
            setMapRegion(r);
            if(r){ setFilterRegion(r); setTab("search"); setSearched(true); }
          }}
        />}
        {tab==="guide" && <div>
          <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:20,padding:"20px",marginBottom:14,color:"#fff"}}>
            <div style={{fontWeight:900,fontSize:17,marginBottom:8}}>🌿 농작교란?</div>
            <div style={{fontSize:13,lineHeight:1.8,color:"rgba(255,255,255,0.85)"}}>
              관심있는 상품이 있을 시 중도매인과 문의 혹은 <b style={{color:"#4ade80"}}>구매/예약 확정이 가능한 직거래 플랫폼</b>입니다.<br/>
              전국 9개 중앙공영도매시장 실시간 경락가를 기반으로 중도매인과 소매 구매자를 직접 연결합니다.
            </div>
          </div>

          {[
            {icon:"🏛️", title:"9개 중앙공영도매시장 통합", desc:"서울가락·부산엄궁·대구북부·인천남촌·인천삼산·광주각화·대전오정·대전노은·울산 — 전국 주요 공영도매시장 경락 데이터를 한 곳에서 조회"},
            {icon:"📡", title:"agromarket.kr 실시간 연동", desc:"전국 9개 시장 모두 agromarket.kr 데이터 기반 실시간 경락 정보 제공 · 1시간마다 자동 업데이트"},
            {icon:"📋", title:"대전 노은시장 상세정보 제공", desc:"노은시장은 기본 경락 정보 외에 낙찰자명·등급(특/상/보통)·출하자명·출하자 연락처까지 추가 제공"},
            {icon:"💰", title:"수수료 없는 공영 중계", desc:"플랫폼 수수료 0원 · 경락 정보를 투명하게 공개해 중도매인과 구매자 간 직접 거래 유도"},
            {icon:"📞", title:"직거래 문의 · 구매예약", desc:"관심있는 상품의 중도매인에게 직접 문의하거나, 보증금 납부 후 구매/예약 확정 · 중간 유통 없는 직거래 지원"},
          ].map(function(item){return (
            <div key={item.title} style={{background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:10,border:"1px solid #e5e7eb",display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{fontSize:24,flexShrink:0}}>{item.icon}</div>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:G.mid,marginBottom:4}}>{item.title}</div>
                <div style={{fontSize:12,color:"#555",lineHeight:1.7}}>{item.desc}</div>
              </div>
            </div>
          );})}
          <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:14,padding:"14px 16px",marginTop:4}}>
            <div style={{fontWeight:700,fontSize:13,color:G.mid,marginBottom:6}}>ℹ️ 데이터 출처</div>
            <div style={{fontSize:12,color:"#555",lineHeight:1.8}}>
              📍 <b>전국 9개 시장</b>: agromarket.kr 실시간 경락 데이터<br/>
              📍 <b>대전 노은시장</b>: 낙찰자·등급·출하자 상세정보 추가 제공<br/>
              <span style={{color:"#888",fontSize:11}}>※ 실제 거래 전 반드시 해당 시장에 확인하세요</span>
            </div>
          </div>
        </div>}
        {tab==="mypage" && (
          loginUser
            ? loginUser.role==="buyer"
              ? <BuyerMyPage user={loginUser} onLogout={function(){setLoginUser(null);setTab("search");}}/>
              : <DealerMyPage user={loginUser} tradeData={tradeData} onLogout={function(){setLoginUser(null);setTab("search");}}/>
            : <div style={{textAlign:"center",padding:"60px 0"}}>
                <div style={{fontSize:40,marginBottom:12}}>🔐</div>
                <div style={{fontWeight:700,fontSize:15,color:"#555",marginBottom:8}}>로그인이 필요합니다</div>
                <button onClick={function(){setShowLogin(true);}} style={{background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:12,padding:"12px 28px",fontSize:14,fontWeight:900,cursor:"pointer"}}>로그인하기</button>
              </div>
        )}

      </div>
      {showCart && loginUser && loginUser.role==="buyer" && (function(){
        var currentCart = [];
        try { currentCart = JSON.parse(localStorage.getItem("agro_cart_"+loginUser.id)||"[]"); } catch(e){}
        var bal = parseInt(localStorage.getItem("agro_balance_"+loginUser.id)||"0");
        var totalDep = currentCart.reduce(function(s,c){return s+(c.deposit||0);},0);
        var totalAmt = currentCart.reduce(function(s,c){return s+(c.total||0);},0);

        function removeItem(key){
          var next = currentCart.filter(function(c){return c.itemKey!==key;});
          setCartList(next);
          setCartCount(next.length);
          try { localStorage.setItem("agro_cart_"+loginUser.id, JSON.stringify(next)); } catch(e){}
        }

        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={function(e){if(e.target===e.currentTarget)setShowCart(false);}}>
            <div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:600,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
              <div style={{background:"linear-gradient(135deg,#9a3412,#c2410c)",borderRadius:"20px 20px 0 0",padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{color:"#fed7aa",fontSize:10,fontWeight:700,letterSpacing:2}}>🧺 장바구니</div>
                  <div style={{color:"#fff",fontWeight:800,fontSize:15,marginTop:2}}>{currentCart.length}개 상품</div>
                </div>
                <button onClick={function(){setShowCart(false);}} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:"50%",width:30,height:30,fontSize:16,cursor:"pointer"}}>✕</button>
              </div>
              <div style={{overflowY:"auto",padding:"16px",flex:1}}>
                {cartDone ? (
                  <div style={{textAlign:"center",padding:"40px 0"}}>
                    <div style={{fontSize:48,marginBottom:12}}>✅</div>
                    <div style={{fontWeight:800,fontSize:16,color:"#c2410c"}}>결제 완료!</div>
                    <div style={{fontSize:12,color:"#888",marginTop:4}}>마이페이지에서 예약 내역을 확인하세요</div>
                    <button onClick={function(){setShowCart(false);setCartDone(false);}} style={{marginTop:16,background:"#f3f4f6",color:"#555",border:"none",borderRadius:12,padding:"10px 24px",fontSize:13,fontWeight:700,cursor:"pointer"}}>닫기</button>
                  </div>
                ) : currentCart.length === 0 ? (
                  <div style={{textAlign:"center",padding:"40px 0"}}>
                    <div style={{fontSize:48,marginBottom:12}}>🧺</div>
                    <div style={{fontSize:14,color:"#888"}}>장바구니가 비어있습니다</div>
                  </div>
                ) : <>
                  {currentCart.map(function(c){
                    return (
                      <div key={c.itemKey} style={{background:"#fff7ed",borderRadius:12,padding:"12px",marginBottom:8,border:"1px solid #fed7aa"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                          <div>
                            <span style={{fontWeight:700,fontSize:13}}>{c.itemName}</span>
                            {c.grade && <span style={{background:"#fef9c3",color:"#854d0e",fontSize:10,fontWeight:700,borderRadius:6,padding:"1px 6px",marginLeft:5}}>{c.grade}</span>}
                          </div>
                          <button onClick={function(){removeItem(c.itemKey);}} style={{background:"none",border:"none",color:"#aaa",fontSize:18,cursor:"pointer",lineHeight:1}}>✕</button>
                        </div>
                        <div style={{fontSize:11,color:"#666",marginBottom:6}}>{c.origin} · {c.qty}개 · {c.dealerName}{c.market?" · "+c.market:""}</div>
                        <div style={{display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontSize:12,color:"#888"}}>보증금 <b style={{color:"#c2410c"}}>{(c.deposit||0).toLocaleString()}원</b></span>
                          <span style={{fontSize:11,color:"#aaa"}}>총 {(c.total||0).toLocaleString()}원</span>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{background:"#f9fafb",borderRadius:12,padding:"14px",marginBottom:12,border:"1px solid #e5e7eb"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:13,color:"#555"}}>총 보증금</span>
                      <span style={{fontSize:16,fontWeight:900,color:"#c2410c"}}>{totalDep.toLocaleString()}원</span>
                    </div>

                  </div>
                  <div style={{marginBottom:12}}>
                    {/* 수령방법 */}
                    <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:8}}>수령 방법</div>
                    <div style={{display:"flex",gap:8,marginBottom:12}}>
                      {[["pickup","🏃 직접 수령"],["delivery","🚚 배송 요청"]].map(function(opt){
                        var sel = cartPickup===opt[0];
                        return <button key={opt[0]} onClick={function(){setCartPickup(opt[0]);}}
                          style={{flex:1,padding:"9px 0",background:sel?"#0d2b1a":"#fff",color:sel?"#4ade80":"#555",border:"1.5px solid "+(sel?"#2d6a4f":"#e5e7eb"),borderRadius:10,fontSize:12,fontWeight:sel?700:400,cursor:"pointer"}}>
                          {opt[1]}
                        </button>;
                      })}
                    </div>
                    {cartPickup==="delivery" && <div style={{background:"#f0fdf4",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:11,color:"#065f46"}}>
                      📍 배송지: {(function(){ try { var s=JSON.parse(localStorage.getItem("agro_buyer_"+(loginUser&&loginUser.id||"guest"))||"{}"); return s.bizAddr||"마이페이지에서 주소를 입력해주세요"; } catch(e){ return "주소 없음"; } })()}
                    </div>}
                    <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:8}}>결제 수단</div>
                    {[["balance","💰 예치금 결제"],["card","💳 카드결제"],["kakao","🟡 카카오페이"],["transfer","🏦 계좌이체"]].map(function(pm){
                      var sel = cartPM===pm[0];
                      var notEnough = pm[0]==="balance" && bal<totalDep;
                      return <div key={pm[0]} onClick={function(){if(!notEnough)setCartPM(pm[0]);}}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:8,border:"1.5px solid "+(sel?"#c2410c":"#e5e7eb"),marginBottom:6,background:sel?"#fff7ed":"#fff",cursor:notEnough?"not-allowed":"pointer",opacity:notEnough?0.5:1}}>
                        <span style={{fontSize:16}}>{pm[1].split(" ")[0]}</span>
                        <span style={{fontSize:13,fontWeight:sel?700:400,color:sel?"#c2410c":"#333"}}>{pm[1].split(" ").slice(1).join(" ")}</span>
                        {pm[0]==="balance" && <span style={{marginLeft:"auto",fontSize:10,color:notEnough?"#ef4444":"#059669"}}>잔액 {bal.toLocaleString()}원</span>}
                        {sel && pm[0]!=="balance" && <span style={{marginLeft:"auto",color:"#c2410c",fontWeight:700,fontSize:12}}>✓</span>}
                      </div>;
                    })}

                    {/* 카드 세부 입력 */}
                    {cartPM==="card" && (
                      <div style={{background:"#f9fafb",borderRadius:10,padding:"14px",marginTop:8,border:"1px solid #e5e7eb"}}>
                        <div style={{background:"linear-gradient(135deg,#1e3a8a,#2563eb)",borderRadius:10,padding:"14px",color:"#fff",marginBottom:10}}>
                          <div style={{fontSize:9,opacity:0.7}}>CREDIT CARD</div>
                          <div style={{fontSize:13,fontWeight:700,letterSpacing:3,margin:"6px 0"}}>**** **** **** ****</div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,opacity:0.8}}><span>카드소유자</span><span>MM/YY</span></div>
                        </div>
                        <input placeholder="카드번호 16자리" onChange={function(e){var v=e.target.value.replace(/\D/g,"").substring(0,16);e.target.value=v.replace(/(.{4})/g,"$1 ").trim();}} style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,marginBottom:6,outline:"none",boxSizing:"border-box"}}/>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                          <input placeholder="MM/YY" maxLength={5} style={{border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none"}}/>
                          <input placeholder="CVC" maxLength={3} type="password" style={{border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none"}}/>
                        </div>
                        <input placeholder="카드 비밀번호 앞 2자리" maxLength={2} type="password" style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                      </div>
                    )}

                    {/* 카카오페이 */}
                    {cartPM==="kakao" && (
                      <div style={{background:"#FEE500",borderRadius:10,padding:"14px",marginTop:8,textAlign:"center"}}>
                        <div style={{fontSize:18,fontWeight:900,color:"#3A1D1D"}}>kakao pay</div>
                        <div style={{display:"inline-block",background:"#fff",padding:6,borderRadius:8,margin:"8px auto"}}>
                          <svg width="90" height="90" viewBox="0 0 142 142" xmlns="http://www.w3.org/2000/svg">
                            <rect width="142" height="142" fill="white"/>
                            <rect x="8" y="8" width="35" height="35" fill="none" stroke="#1a1a1a" strokeWidth="4"/><rect x="15" y="15" width="21" height="21" fill="#1a1a1a"/>
                            <rect x="97" y="8" width="35" height="35" fill="none" stroke="#1a1a1a" strokeWidth="4"/><rect x="104" y="15" width="21" height="21" fill="#1a1a1a"/>
                            <rect x="8" y="97" width="35" height="35" fill="none" stroke="#1a1a1a" strokeWidth="4"/><rect x="15" y="104" width="21" height="21" fill="#1a1a1a"/>
                            <rect x="50" y="8" width="5" height="5" fill="#1a1a1a"/><rect x="60" y="8" width="5" height="5" fill="#1a1a1a"/><rect x="75" y="8" width="5" height="5" fill="#1a1a1a"/><rect x="85" y="8" width="5" height="5" fill="#1a1a1a"/>
                            <rect x="50" y="18" width="5" height="5" fill="#1a1a1a"/><rect x="65" y="18" width="5" height="5" fill="#1a1a1a"/><rect x="80" y="18" width="5" height="5" fill="#1a1a1a"/>
                            <rect x="8" y="50" width="5" height="5" fill="#1a1a1a"/><rect x="23" y="50" width="5" height="5" fill="#1a1a1a"/><rect x="50" y="50" width="5" height="5" fill="#1a1a1a"/><rect x="65" y="50" width="5" height="5" fill="#1a1a1a"/><rect x="85" y="50" width="5" height="5" fill="#1a1a1a"/>
                            <rect x="13" y="60" width="5" height="5" fill="#1a1a1a"/><rect x="38" y="60" width="5" height="5" fill="#1a1a1a"/><rect x="55" y="60" width="5" height="5" fill="#1a1a1a"/><rect x="75" y="60" width="5" height="5" fill="#1a1a1a"/><rect x="100" y="60" width="5" height="5" fill="#1a1a1a"/>
                            <rect x="8" y="70" width="5" height="5" fill="#1a1a1a"/><rect x="28" y="70" width="5" height="5" fill="#1a1a1a"/><rect x="55" y="70" width="5" height="5" fill="#1a1a1a"/><rect x="80" y="70" width="5" height="5" fill="#1a1a1a"/>
                            <rect x="50" y="100" width="5" height="5" fill="#1a1a1a"/><rect x="70" y="100" width="5" height="5" fill="#1a1a1a"/><rect x="90" y="100" width="5" height="5" fill="#1a1a1a"/>
                            <rect x="55" y="115" width="5" height="5" fill="#1a1a1a"/><rect x="80" y="115" width="5" height="5" fill="#1a1a1a"/><rect x="100" y="115" width="5" height="5" fill="#1a1a1a"/>
                            <rect x="57" y="57" width="28" height="28" rx="4" fill="#FEE500"/>
                            <text x="71" y="76" textAnchor="middle" fontSize="16" fontWeight="900" fill="#3A1D1D" fontFamily="Arial">K</text>
                          </svg>
                        </div>
                        <div style={{fontSize:11,color:"#3A1D1D",opacity:0.75}}>카카오톡 → 더보기 → 페이 → QR결제</div>
                        <div style={{fontSize:12,fontWeight:700,color:"#3A1D1D",marginTop:6}}>결제금액: {totalDep.toLocaleString()}원</div>
                      </div>
                    )}

                    {/* 계좌이체 */}
                    {cartPM==="transfer" && (
                      <div style={{background:"#f0fdf4",borderRadius:10,padding:"12px",marginTop:8,border:"1px solid #bbf7d0"}}>
                        <div style={{fontSize:11,fontWeight:700,color:G.mid,marginBottom:8}}>입금 계좌 안내</div>
                        {[["은행","농협은행"],["계좌번호","352-0919-7423-83"],["예금주","(주)농작교"],["입금액",totalDep.toLocaleString()+"원"]].map(function(r){return(
                          <div key={r[0]} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                            <span style={{fontSize:11,color:"#888"}}>{r[0]}</span>
                            <span style={{fontSize:12,fontWeight:r[0]==="입금액"?900:700,color:r[0]==="입금액"?"#16a34a":"#1a1a1a"}}>{r[1]}</span>
                          </div>
                        );})}
                        <input placeholder="입금자명 (본인 이름)" style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box",marginTop:6}}/>
                        <div style={{fontSize:10,color:"#e55",marginTop:6}}>⚠️ 입금 후 확인까지 최대 10분 소요됩니다</div>
                      </div>
                    )}
                  </div>
                  <button onClick={cartCheckout}
                    style={{width:"100%",background:"linear-gradient(135deg,#9a3412,#c2410c)",color:"#fff",border:"none",borderRadius:12,padding:"14px",fontSize:14,fontWeight:900,cursor:"pointer",opacity:cartPM?1:0.5}}>
                    🧺 {currentCart.length}건 일괄 결제 ({totalDep.toLocaleString()}원)
                  </button>
                </>}
              </div>
            </div>
          </div>
        );
      })()}

      {showLogin && <LoginModal
        onLogin={function(user){setLoginUser(user);setShowLogin(false);setTab("mypage");}}
        onClose={function(){setShowLogin(false);}}
      />}

    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
