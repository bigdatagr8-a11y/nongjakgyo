var { useState, useEffect, useRef } = React;

// ── 설정 ──
var CSV_URL = "/api/sheet";

function getKST(offset) {
  var kst = new Date(new Date().getTime() + (9 + offset * 24) * 3600000);
  return kst.getUTCFullYear() + "-" + String(kst.getUTCMonth()+1).padStart(2,"0") + "-" + String(kst.getUTCDate()).padStart(2,"0");
}
var TODAY = getKST(0), YESTERDAY = getKST(-1);

var G = {dark:"#0d2b1a",mid:"#1b4332",main:"#2d6a4f",light:"#40916c",pale:"#d1fae5",bg:"#f0fdf4",border:"#bbf7d0"};

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

function StarRating(props) {
  var rating = props.rating, size = props.size || 12;
  var stars = [];
  for(var i = 1; i <= 5; i++) {
    var filled = i <= Math.floor(rating);
    var half = !filled && i === Math.ceil(rating) && rating % 1 !== 0;
    stars.push(
      <span key={i} style={{color: filled || half ? "#f59e0b" : "#d1d5db", fontSize: size}}>
        {filled ? "★" : half ? "⭐" : "☆"}
      </span>
    );
  }
  return <span>{stars}</span>;
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
function makeMockData() {
  var result = [];
  var itemNames = Object.keys(PRICE_BASE);

  // 노은시장 포함 전체 시장 (노은은 추가정보 빈 틀만)
  var mockMarkets = MARKETS;

  mockMarkets.forEach(function(market) {
    var corps = CORPS_BY_MARKET[market.id] || ["지역청과"];
    // 각 시장마다 품목 랜덤 선택 (8~14개)
    var count = 8 + Math.floor(Math.random()*7);
    var shuffled = itemNames.slice().sort(function(){return Math.random()-0.5;});
    var picked = shuffled.slice(0, count);

    picked.forEach(function(itemName) {
      var base = PRICE_BASE[itemName];
      var price = base.min + Math.floor(Math.random()*(base.max-base.min));
      // 100원 단위 반올림
      price = Math.round(price/100)*100;
      var variety = "";
      if(VARIETIES[itemName]) {
        var vars = VARIETIES[itemName];
        variety = vars[Math.floor(Math.random()*vars.length)];
      }
      var fullName = variety && variety !== itemName ? itemName+"("+variety+")" : itemName;
      var origin = getRandOrigin(itemName);
      var qty = (2 + Math.floor(Math.random()*18)) * 10;
      var corp = corps[Math.floor(Math.random()*corps.length)];
      // 날짜: 오늘 또는 어제 (랜덤)
      var date = Math.random() > 0.3 ? TODAY : YESTERDAY;

      var newId = idCounter++;
      var mockRating = getMockRating(newId);
      var mockReviewCount = getMockReviewCount(newId);
      var isNoeun = market.id === 8;
      var mockShipper = isNoeun ? {name:"", phone:""} : seedPick(MOCK_SHIPPERS, newId);
      result.push({
        id: newId,
        date: date,
        market: market,
        itemName: itemName,
        fullName: fullName,
        variety: variety,
        origin: origin,
        qty: qty,
        unit: base.unit,
        price: price,
        corp: corp,
        emoji: getEmoji(itemName),
        category: getCategory(itemName),
        isMock: isNoeun ? false : true,  // 노은은 실제 데이터 틀로 표시
        isPlaceholder: isNoeun,          // 노은 플레이스홀더 표시
        // 추가 정보: 노은은 빈 틀, 나머지는 가상
        bidder:       isNoeun ? "" : seedPick(MOCK_BIDDERS, newId + 1),
        grade:        isNoeun ? "" : pickByWeight(GRADES, GRADE_WEIGHTS, newId),
        shipperName:  isNoeun ? "" : mockShipper.name,
        shipperPhone: isNoeun ? "" : mockShipper.phone,
        rating:       isNoeun ? null : mockRating,
        reviewCount:  isNoeun ? null : mockReviewCount,
        reviews:      isNoeun ? [] : getMockReviews(newId, 3),
      });
    });
  });

  return result;
}

// CSV 파싱 (노은시장 실제 데이터)
function parseCSV(csvText) {
  // 경락 시트 구조: 경매일시 / 도매시장 / 법인 / 품목 / 품종 / 산지 / 수량 / 단위 / 경락가
  var lines = csvText.trim().split("\n");
  if(lines.length < 2) return [];

  var rawHeaders = lines[0].split(",").map(function(h){ return h.trim().replace(/"/g,""); });
  function col(row, name) {
    var idx = rawHeaders.indexOf(name);
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
  var ms = useState([]); var messages = ms[0]; var setMessages = ms[1];
  var is = useState(false); var isLoading = is[0]; var setIsLoading = is[1];
  var inp = useState(""); var input = inp[0]; var setInput = inp[1];
  var bottomRef = useRef(null);

  var dealerNo = String((tradeRow && tradeRow["낙찰 중도매인"]) || record.bidder || "").trim();
  var dealerLookup = getDealerInfo(dealerNo);
  var bidderName = dealerLookup.name;
  var bidderPhone = (tradeRow && tradeRow["중도매인 연락처"]) || dealerLookup.phone || "";
  var itemName = (tradeRow && tradeRow["품목명"]) || record.fullName || record.itemName;
  var origin = (tradeRow && tradeRow["산지명"]) || record.origin || "";
  var price = parseInt((tradeRow && tradeRow["단가"]) || record.price) || 0;
  var grade = (tradeRow && tradeRow["등급"]) || record.grade || "";
  var qty = (tradeRow && tradeRow["수량"]) || record.qty || "";
  var unit = record.unit || "개";

  // 첫 인사 메시지 - 타입별 분기
  useEffect(function(){
    var initMsg = "";
    if(chatType === "buy") {
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

        {/* 헤더 */}
        <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:"20px 20px 0 0",padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{color:"#4ade80",fontSize:10,fontWeight:700,letterSpacing:2}}>
                {chatType==="buy"?"🛒 구매 문의":chatType==="inquiry"?"❓ 상품 문의":"💬 중도매인 채팅"}
              </div>
              <div style={{color:"#fff",fontWeight:800,fontSize:15,marginTop:2}}>
                {bidderName} <span style={{fontSize:11,color:"rgba(255,255,255,0.6)",fontWeight:400}}>· 대전 노은시장</span>
              </div>
              <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{background:"rgba(74,222,128,0.2)",color:"#4ade80",fontSize:10,borderRadius:20,padding:"2px 8px"}}>{itemName}{grade?" · "+grade+"등급":""}{price?" · "+price.toLocaleString()+"원":""}</span>
                {bidderPhone && <a href={"tel:"+bidderPhone} style={{color:"#86efac",fontSize:10,textDecoration:"none"}}>📞 {bidderPhone}</a>}
                {!bidderPhone && <span style={{color:"rgba(255,255,255,0.4)",fontSize:10}}>📞 연락처 등록 예정</span>}
              </div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:"50%",width:30,height:30,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        </div>

        {/* 메시지 영역 */}
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

        {/* 빠른 질문 */}
        <div style={{padding:"8px 16px",background:"#f0fdf4",display:"flex",gap:6,overflowX:"auto"}}>
          {["가격 협의 가능한가요?","품질 상태는 어떤가요?","최소 구매 수량은?","언제 배송 가능한가요?"].map(function(q){return(
            <button key={q} onClick={function(){setInput(q);}} style={{background:"#fff",border:"1px solid #bbf7d0",borderRadius:20,padding:"5px 12px",fontSize:11,color:G.mid,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{q}</button>
          );})}
        </div>

        {/* 입력창 */}
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
  var isTop = rank === 1;
  var rs = useState(false); var showReviews = rs[0]; var setShowReviews = rs[1];
  var ts = useState(false); var showTrade = ts[0]; var setShowTrade = ts[1];
  var cs = useState(false); var showChat = cs[0]; var setShowChat = cs[1];
  var pm = useState(null); var payModal = pm[0]; var setPayModal = pm[1]; // {dealerNo, tradeRow}
  var pp = useState(false); var payDone = pp[0]; var setPayDone = pp[1];

  // 노은시장 카드일 때 품목명으로 거래실적 매칭
  var matchedTrades = [];
  if(r.market.id === 8 && tradeData.length > 0) {
    // 품목명 유사 매칭 헬퍼 (완숙토마토↔토마토, 대추방울↔방울토마토 등)
    function itemMatch(t품목, cardItem, cardFull) {
      if(!t품목) return false;
      // 소계/합계 제외
      if(t품목.includes("소계") || t품목.includes("합계")) return false;
      // 정확히 포함 관계
      if(t품목.includes(cardItem) || cardItem.includes(t품목)) return true;
      if(cardFull && (t품목.includes(cardFull) || cardFull.includes(t품목))) return true;
      // 토마토 계열: 완숙토마토, 방울토마토, 대추방울 등
      var 토마토류 = ["토마토","완숙토마토","방울토마토","대추방울","대추토마토","스테비아"];
      if(토마토류.some(function(k){return cardItem.includes("토마토")||cardItem.includes("방울");}) &&
         토마토류.some(function(k){return t품목.includes(k);})) return true;
      // 살구 계열
      if(cardItem.includes("살구") && t품목.includes("살구")) return true;
      // 복숭아 계열
      if(cardItem.includes("복숭아") && t품목.includes("복숭아")) return true;
      // 블루베리
      if(cardItem.includes("블루베리") && t품목.includes("블루베리")) return true;
      return false;
    }

    // 시트에서 가장 최신 날짜 추출 (날짜 무관하게 최신 데이터 표시)
    var latestTradeDate = tradeData.reduce(function(latest, t){
      var d = (t["경매일자"]||t["매매일자"]||"").replace(/\./g,"-").trim();
      return d > latest ? d : latest;
    }, "");

    matchedTrades = tradeData.filter(function(t){
      var t품목 = (t["품목명"]||t["품목"]||"").trim();
      var tDate = (t["경매일자"]||t["매매일자"]||"").replace(/\./g,"-").trim();
      // 날짜: 시트 최신 날짜 기준으로 매칭 (가상데이터 날짜 무시)
      var dateOk = !latestTradeDate || !tDate || tDate === latestTradeDate;
      return dateOk && itemMatch(t품목, r.itemName, r.fullName);
    }).slice(0, 30);
  }
  var chatTradeRow = matchedTrades.length > 0 ? matchedTrades[0] : null;

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
                <div style={{fontWeight:800,fontSize:15,color:"#0d1f15"}}>{r.fullName}</div>
                {!r.isMock && <span style={{background:"#ecfdf5",color:"#059669",fontSize:9,fontWeight:700,borderRadius:10,padding:"2px 6px",border:"1px solid #6ee7b7"}}>🔴 LIVE</span>}
              </div>
              <div style={{fontSize:11,color:"#888",marginTop:1}}>
                🏛️ {r.market.name} · {r.market.region}
              </div>
              {/* 별점 */}
              {r.rating && (
                <div style={{display:"flex",alignItems:"center",gap:4,marginTop:3}}>
                  <StarRating rating={r.rating} size={11}/>
                  <span style={{fontSize:11,fontWeight:700,color:"#f59e0b"}}>{r.rating.toFixed(1)}</span>
                  <span style={{fontSize:10,color:"#aaa"}}>({r.reviewCount}건)</span>
                </div>
              )}
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontWeight:900,fontSize:18,color:G.mid}}>{r.price.toLocaleString()}원</div>
            <div style={{fontSize:10,color:"#aaa"}}>/ {r.unit}</div>
          </div>
        </div>

        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          <span style={{background:"#f0fdf4",color:G.mid,fontSize:10,fontWeight:600,borderRadius:20,padding:"3px 10px"}}>📦 {r.qty}{r.unit}</span>
          {r.origin && <span style={{background:"#fffbeb",color:"#92400e",fontSize:10,fontWeight:600,borderRadius:20,padding:"3px 10px"}}>📍 {r.origin}</span>}
          {r.corp && <span style={{background:"#f3f4f6",color:"#555",fontSize:10,borderRadius:20,padding:"3px 10px"}}>🏢 {r.corp}</span>}
          {r.grade && <span style={{background: r.grade==="특"?"#fef9c3": r.grade==="상"?"#dbeafe":"#f3f4f6", color: r.grade==="특"?"#854d0e": r.grade==="상"?"#1e40af":"#555", fontSize:10,fontWeight:700,borderRadius:20,padding:"3px 10px"}}>🏅 {r.grade}등급</span>}
        </div>

        {/* 낙찰자 / 출하자 정보 */}
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

        {/* 리뷰 미리보기 토글 */}
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

        {/* 노은시장 거래실적 연결 - 중도매인별 */}
        {r.market.id === 8 && matchedTrades.length > 0 && (
          <div style={{marginBottom:8}}>
            <button onClick={function(){setShowTrade(!showTrade);}} style={{background:"none",border:"none",padding:0,fontSize:11,color:"#2563eb",fontWeight:700,cursor:"pointer"}}>
              {showTrade ? "▲ 거래실적 접기" : "▼ 오늘 거래실적 보기 ("+matchedTrades.length+"건)"}
            </button>
            {showTrade && (function(){
              // 중도매인별 그룹화
              var dealerGroups = {};
              matchedTrades.forEach(function(t){
                var no = String(t["낙찰 중도매인"]||"").trim();
                if(!dealerGroups[no]) dealerGroups[no] = [];
                dealerGroups[no].push(t);
              });
              return (
                <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:10}}>
                  {Object.keys(dealerGroups).map(function(no){
                    var trades = dealerGroups[no];
                    var info = getDealerInfo(no);
                    var avgPrice = Math.round(trades.reduce(function(s,t){
                      return s+(parseInt((t["단가"]||"").replace(/,/g,""))||0);
                    },0)/trades.length);
                    var totalQty = trades.reduce(function(s,t){
                      return s+(parseInt((t["수량"]||"").replace(/,/g,""))||0);
                    },0);
                    var totalWeight = trades.reduce(function(s,t){
                      var w = parseFloat(t["중량"]||0);
                      var q = parseInt((t["수량"]||"0").replace(/,/g,""))||0;
                      return s + w*q;
                    },0);
                    return (
                      <div key={no} style={{border:"1px solid #bfdbfe",borderRadius:12,overflow:"hidden"}}>
                        {/* 중도매인 헤더 */}
                        <div style={{background:"#1e3a8a",padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <span style={{color:"#fff",fontWeight:700,fontSize:12}}>{info.name}</span>
                            <span style={{color:"#93c5fd",fontSize:10,marginLeft:6}}>#{no}</span>
                            {info.phone && <a href={"tel:"+info.phone} style={{color:"#86efac",fontSize:10,marginLeft:8,textDecoration:"none"}}>📞 {info.phone}</a>}
                          </div>
                          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                            <span style={{color:"#bfdbfe",fontSize:10}}>{trades.length}건 · 평균 {avgPrice.toLocaleString()}원 · {totalQty}개 / {totalWeight>0?totalWeight.toLocaleString()+"kg":"-"}</span>
                            <button onClick={function(){setShowChat(true); window._chatDealer={no:no,tradeRow:trades[0]};}} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:20,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>💬 채팅</button>
                          </div>
                        </div>
                        {/* 거래 내역 */}
                        <div style={{overflowX:"auto"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:480}}>
                            <thead>
                              <tr style={{background:"#1e3a8a"}}>
                                {[
                                  {label:"경매시간", sub:null},
                                  {label:"산지명",   sub:null},
                                  {label:"등급",     sub:null},
                                  {label:"크기",     sub:null},
                                  {label:"중량",     sub:"(박스)"},
                                  {label:"수량",     sub:"(개)"},
                                  {label:"단가",     sub:"(박스)"},
                                  {label:"kg당",     sub:"단가"},
                                  {label:"문의",     sub:null},
                                ].map(function(h){return(
                                  <th key={h.label} style={{padding:"7px 8px",color:"#bfdbfe",fontWeight:700,textAlign:"left",whiteSpace:"nowrap",fontSize:10}}>
                                    {h.label}
                                    {h.sub && <div style={{color:"#93c5fd",fontWeight:400,fontSize:9,marginTop:1}}>{h.sub}</div>}
                                  </th>
                                );})}
                              </tr>
                            </thead>
                            <tbody>
                              {trades.map(function(t,i){
                                // tradeData는 한글 헤더 키로 저장됨
                                var auctionTime = (t["경매시간"]||"").trim();
                                var origin      = (t["산지명"]||"").trim();
                                var grade       = (t["등급"]||"").trim();
                                var size        = (t["크기"]||"").trim();
                                var weight      = (t["중량"]||"").trim();   // 박스당 kg
                                var qty         = (t["수량"]||"").trim();
                                var price       = parseInt((t["단가"]||"").replace(/,/g,""))||0;
                                var amount      = parseInt((t["금액"]||"").replace(/,/g,""))||0;
                                var kgPerBox    = parseFloat(weight)||0;
                                var kgPrice     = (kgPerBox > 0 && price > 0) ? Math.round(price / kgPerBox) : null;
                                var gradeColor  = {
                                  "특": {bg:"#fef9c3",color:"#854d0e"},
                                  "상": {bg:"#dbeafe",color:"#1e40af"},
                                  "보통":{bg:"#f3f4f6",color:"#555"},
                                  "1":  {bg:"#fef9c3",color:"#854d0e"},
                                  "2":  {bg:"#dbeafe",color:"#1e40af"},
                                  "3":  {bg:"#f3f4f6",color:"#555"},
                                  "4":  {bg:"#fce7f3",color:"#9d174d"},
                                  "대": {bg:"#fef9c3",color:"#854d0e"},
                                  "중": {bg:"#dbeafe",color:"#1e40af"},
                                  "소": {bg:"#f3f4f6",color:"#555"},
                                }[grade] || {bg:"#f3f4f6",color:"#555"};
                                return (
                                <tr key={i} style={{background:i%2===0?"#fff":"#f8faff",borderBottom:"1px solid #e8edf8"}}
                                  onMouseEnter={function(e){e.currentTarget.style.background="#eff6ff";}}
                                  onMouseLeave={function(e){e.currentTarget.style.background=i%2===0?"#fff":"#f8faff";}}>
                                  <td style={{padding:"7px 8px",whiteSpace:"nowrap",color:"#64748b",fontSize:10,fontVariantNumeric:"tabular-nums"}}>{auctionTime||"-"}</td>
                                  <td style={{padding:"7px 8px",whiteSpace:"nowrap",color:"#1e293b",fontWeight:500}}>{origin||"-"}</td>
                                  <td style={{padding:"7px 8px",whiteSpace:"nowrap"}}>
                                    {grade
                                      ? <span style={{background:gradeColor.bg,color:gradeColor.color,borderRadius:6,padding:"2px 7px",fontWeight:700,fontSize:10}}>{grade}</span>
                                      : <span style={{color:"#ccc"}}>-</span>}
                                  </td>
                                  <td style={{padding:"7px 8px",whiteSpace:"nowrap",color:"#475569",fontSize:10}}>{size||"-"}</td>
                                  <td style={{padding:"7px 8px",whiteSpace:"nowrap",color:"#1e293b",fontWeight:600}}>{weight ? weight+"kg" : "-"}</td>
                                  <td style={{padding:"7px 8px",whiteSpace:"nowrap",color:"#1e293b"}}>{qty ? qty+"개" : "-"}</td>
                                  <td style={{padding:"7px 8px",whiteSpace:"nowrap"}}>
                                    <span style={{color:G.mid,fontWeight:700}}>{price ? price.toLocaleString()+"원" : "-"}</span>
                                  </td>
                                  <td style={{padding:"7px 8px",whiteSpace:"nowrap"}}>
                                    {kgPrice
                                      ? <span style={{background:"#ecfdf5",color:"#065f46",borderRadius:6,padding:"2px 7px",fontWeight:700,fontSize:10}}>{kgPrice.toLocaleString()}원</span>
                                      : <span style={{color:"#ccc"}}>-</span>}
                                  </td>
                                  <td style={{padding:"6px 7px",whiteSpace:"nowrap"}}>
                                    {(function(){
                                      var itemKey = no+"_"+(auctionTime||i);
                                      var pKey = no+"_"+itemKey;
                                      var isSold = purchases[pKey] && purchases[pKey].status === "완료";
                                      if(isSold) return (
                                        <span style={{background:"#fee2e2",color:"#991b1b",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700}}>판매완료</span>
                                      );
                                      return (
                                        <div style={{display:"flex",gap:3}}>
                                          <button onClick={function(){
                                            setPayModal({no:no, tradeRow:t, itemKey:itemKey});
                                          }} style={{background:"#16a34a",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>🛒 예약</button>
                                          <button onClick={function(){
                                            window._chatDealer={no:no, tradeRow:t, chatType:"inquiry"};
                                            setShowChat(true);
                                          }} style={{background:"#f0fdf4",color:"#166534",border:"1px solid #bbf7d0",borderRadius:6,padding:"4px 8px",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>❓</button>
                                        </div>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              );})}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {r.market.id === 8 && matchedTrades.length === 0 && tradeData.length > 0 && (
          <div style={{marginBottom:8,fontSize:11,color:"#aaa"}}>📋 이 품목의 거래실적 없음</div>
        )}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:10,color:"#aaa"}}>🕐 {r.date}</div>
          <div style={{display:"flex",gap:6}}>
            {r.market.phone
              ? <a href={"tel:"+r.market.phone} style={{background:"#f0fdf4",color:G.mid,border:"1px solid #bbf7d0",borderRadius:9,padding:"6px 13px",fontSize:11,fontWeight:700,textDecoration:"none"}}>📞 {r.market.phone}</a>
              : <span style={{background:"#f3f4f6",color:"#bbb",border:"1px solid #e5e7eb",borderRadius:9,padding:"6px 13px",fontSize:11,fontWeight:700}}>📞 번호 입력 예정</span>
            }
            <button style={{background:G.mid,color:"#fff",border:"none",borderRadius:9,padding:"6px 13px",fontSize:11,fontWeight:700,cursor:"pointer"}} onClick={function(){alert("거래 문의는 해당 도매시장 법인("+r.corp+")에 직접 연락하세요.\n"+(r.market.phone?"📞 "+r.market.phone:"📞 연락처 등록 예정")+"\n🏛️ "+r.market.name);}}>거래하기</button>
          </div>
        </div>

        {showChat && <ChatModal record={r} tradeRow={window._chatDealer ? window._chatDealer.tradeRow : chatTradeRow} onClose={function(){setShowChat(false); window._chatDealer=null;}}/>}
        {payModal && (function(){
          var t = payModal.tradeRow;
          var itemName = (t&&t["품목명"]) || r.itemName;
          var grade = (t&&t["등급"]) || "";
          var price = parseInt((t&&t["단가"])||r.price)||0;
          var qty = (t&&t["수량"]) || r.qty;
          var origin = (t&&t["산지명"]) || r.origin;
          var dealerInfo = getDealerInfo(payModal.no);
          var total = price * (parseInt(qty)||1);
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={function(e){if(e.target===e.currentTarget)setPayModal(null);}}>
              <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:400,overflow:"hidden"}}>
                <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",padding:"16px"}}>
                  <div style={{color:"#4ade80",fontSize:10,fontWeight:700,letterSpacing:2}}>🛒 구매예약</div>
                  <div style={{color:"#fff",fontWeight:800,fontSize:16,marginTop:4}}>{itemName} {grade&&"· "+grade+"등급"}</div>
                  <div style={{color:"rgba(255,255,255,0.6)",fontSize:11,marginTop:2}}>중도매인 {dealerInfo.name} · 대전 노은시장</div>
                </div>
                <div style={{padding:"16px"}}>
                  <div style={{background:"#f8fffe",borderRadius:12,padding:"14px",marginBottom:14}}>
                    {[
                      ["산지",origin||"-"],
                      ["등급",grade||"-"],
                      ["수량",qty+"개"],
                      ["단가",price.toLocaleString()+"원"],
                      ["결제금액",(total).toLocaleString()+"원"],
                    ].map(function(row){return(
                      <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #e5e7eb",fontSize:13}}>
                        <span style={{color:"#888"}}>{row[0]}</span>
                        <span style={{fontWeight:row[0]==="결제금액"?900:500,color:row[0]==="결제금액"?G.mid:"#333",fontSize:row[0]==="결제금액"?15:13}}>{row[1]}</span>
                      </div>
                    );})}
                  </div>
                  <div style={{background:"#fef9c3",borderRadius:10,padding:"10px 12px",fontSize:11,color:"#854d0e",marginBottom:14}}>
                    ⚠️ 예약 완료 후 해당 상품은 판매완료로 표시됩니다. 실제 결제는 중도매인과 직접 진행하세요.
                  </div>
                  {payDone
                    ? <div style={{textAlign:"center",padding:"16px 0"}}>
                        <div style={{fontSize:36,marginBottom:8}}>✅</div>
                        <div style={{fontWeight:800,fontSize:15,color:G.mid}}>구매예약 완료!</div>
                        <div style={{fontSize:12,color:"#888",marginTop:4}}>중도매인에게 연락하여 결제를 진행해주세요</div>
                        {dealerInfo.phone && <a href={"tel:"+dealerInfo.phone} style={{display:"block",marginTop:12,background:G.mid,color:"#fff",borderRadius:12,padding:"12px",textAlign:"center",fontWeight:700,fontSize:13,textDecoration:"none"}}>📞 {dealerInfo.name} 연락하기</a>}
                        <button onClick={function(){setPayModal(null);setPayDone(false);}} style={{width:"100%",marginTop:8,background:"#f3f4f6",color:"#888",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>닫기</button>
                      </div>
                    : <div style={{display:"flex",gap:8}}>
                        <button onClick={function(){setPayModal(null);}} style={{flex:1,background:"#f3f4f6",color:"#888",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>취소</button>
                        <button onClick={async function(){
                          var pKey = payModal.no+"_"+payModal.itemKey;
                          try {
                            var res = await fetch("/api/purchase",{
                              method:"POST",
                              headers:{"Content-Type":"application/json"},
                              body:JSON.stringify({
                                dealerNo:payModal.no, itemKey:payModal.itemKey,
                                buyer:(loginUser&&loginUser.name)||"구매자",
                                itemName:itemName, grade:grade, price:price, qty:qty, unit:"개", origin:origin
                              })
                            });
                            var json = await res.json();
                            if(json.ok || res.status===409){
                              setPurchases(function(prev){var n=Object.assign({},prev); n[pKey]={status:"완료"}; return n;});
                              setPayDone(true);
                            }
                          } catch(e){ alert("오류가 발생했습니다"); }
                        }} style={{flex:2,background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:14,fontWeight:900,cursor:"pointer"}}>구매예약 확정</button>
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

// ── 지도 컴포넌트 ──
function MarketMap(props) {
  var onSelect = props.onSelect, selected = props.selected, data = props.data;
  var ss = useState(null); var hover = ss[0]; var setHover = ss[1];

  var REGION_PATHS = {
    "경기":  "M196,140 C220,130 270,128 295,148 C310,158 315,178 305,198 C290,220 255,228 225,222 C195,216 178,196 180,172 C181,158 188,144 196,140Z",
    "강원":  "M295,118 C325,108 385,112 415,140 C432,155 428,185 410,205 C390,225 355,230 325,218 C298,208 282,185 285,160 C287,145 291,122 295,118Z",
    "충북":  "M248,230 C272,220 310,222 328,242 C340,255 336,278 320,290 C300,304 268,305 250,292 C232,279 228,256 235,242 C238,236 244,232 248,230Z",
    "충남":  "M165,228 C190,215 235,215 255,235 C265,247 262,268 248,280 C230,294 198,296 178,282 C158,268 152,245 160,233 C162,230 164,229 165,228Z",
    "전북":  "M148,302 C170,292 208,290 232,308 C245,318 245,345 232,362 C218,380 188,385 162,375 C138,366 128,342 132,318 C134,308 140,304 148,302Z",
    "전남":  "M130,378 C152,365 195,362 220,378 C235,388 238,415 228,440 C216,462 188,470 160,462 C132,454 112,430 112,404 C112,388 120,380 130,378Z",
    "경북":  "M322,218 C348,208 398,210 425,235 C440,248 440,282 428,312 C415,340 385,352 355,348 C325,344 305,322 302,295 C298,268 305,240 315,228Z",
    "경남":  "M228,365 C255,352 308,350 348,368 C368,378 372,408 358,435 C342,460 308,468 275,462 C245,456 222,435 220,408 C218,388 224,370 228,365Z",
    "서울":  "M210,158 C222,152 242,152 250,162 C256,170 252,184 240,188 C226,192 210,186 206,174 C204,166 206,160 210,158Z",
    "인천":  "M176,172 C188,164 206,164 212,174 C216,182 210,196 198,198 C184,200 172,192 170,182 C169,176 172,174 176,172Z",
    "대전":  "M212,258 C220,252 240,252 248,262 C252,270 248,282 238,285 C226,288 212,282 208,272 C206,265 208,260 212,258Z",
    "광주":  "M168,378 C180,372 198,374 205,384 C210,392 205,405 194,408 C180,412 165,406 162,395 C160,386 164,380 168,378Z",
    "대구":  "M322,285 C338,278 368,278 378,295 C385,308 378,328 362,334 C345,340 322,332 316,318 C310,305 314,290 322,285Z",
    "부산":  "M352,430 C368,418 398,418 412,435 C420,448 414,465 398,470 C380,475 355,466 348,450 C344,440 346,434 352,430Z",
    "울산":  "M392,362 C410,352 435,354 445,372 C452,385 445,405 428,410 C410,415 390,406 384,390 C380,378 384,366 392,362Z",
  };

  var REGION_LABELS = {
    "서울":[232,172],"인천":[190,182],"경기":[245,175],"강원":[355,168],
    "충북":[288,260],"충남":[205,255],"대전":[228,270],"전북":[185,335],
    "전남":[170,415],"광주":[184,392],"경북":[368,280],"대구":[348,308],
    "경남":[290,408],"부산":[378,445],"울산":[412,382],
  };

  var ACTIVE = ["서울","인천","부산","대구","광주","대전","울산"];

  var regionCounts = {};
  (data||[]).forEach(function(r){
    var reg = r.market.region;
    if(reg) regionCounts[reg] = (regionCounts[reg]||0) + 1;
  });

  var ALL_REGIONS = (function(){
    var small=["대전","광주","대구","울산","부산","서울","인천"];
    var keys = Object.keys(REGION_PATHS);
    var big = keys.filter(function(k){return small.indexOf(k)===-1;});
    var sm = keys.filter(function(k){return small.indexOf(k)!==-1;});
    return big.concat(sm);
  })();

  return (
    <div>
      <div style={{background:"#fff",borderRadius:16,padding:"12px 16px",marginBottom:12,border:"1px solid #bbf7d0"}}>
        <div style={{fontWeight:900,fontSize:15,color:G.mid}}>🗺️ 전국 중앙공영도매시장</div>
        <div style={{fontSize:11,color:"#888",marginTop:2}}>9개 시장 · 탭하면 해당 지역 필터</div>
      </div>
      <div style={{background:"#f8fffe",borderRadius:20,padding:10,border:"1px solid #bbf7d0"}}>
        <svg viewBox="90 115 420 395" style={{width:"100%",display:"block"}}>
          {ALL_REGIONS.map(function(r){
            var path = REGION_PATHS[r];
            var lbl = REGION_LABELS[r];
            var isActive = ACTIVE.indexOf(r) !== -1;
            var isSel = selected === r;
            var isHov = hover === r;
            var cnt = regionCounts[r] || 0;
            var fill = isSel ? G.mid : isHov && isActive ? "#40916c" : isActive ? "#d1fae5" : "#e5e7eb";
            var stroke = isSel ? G.mid : isActive ? "#40916c" : "#ccc";
            return (
              <g key={r} onClick={function(){if(isActive) onSelect(isSel ? "" : r);}}
                onMouseEnter={function(){if(isActive)setHover(r);}} onMouseLeave={function(){setHover(null);}}>
                <path d={path} fill={fill} stroke={stroke} strokeWidth={isSel?2:1} style={{cursor:isActive?"pointer":"default",transition:"fill 0.2s"}}/>
                {lbl && <text x={lbl[0]} y={lbl[1]} textAnchor="middle" fontSize={isActive?9:8} fontWeight={isSel||isActive?700:400} fill={isSel?"#fff":isActive?G.mid:"#aaa"}>
                  {r}
                  {isActive && cnt > 0 && <tspan x={lbl[0]} dy={10} fontSize={8} fill={isSel?"#4ade80":"#40916c"}>{cnt}건</tspan>}
                </text>}
              </g>
            );
          })}
        </svg>
      </div>

      {selected && <div style={{marginTop:12}}>
        {MARKETS.filter(function(m){return m.region===selected;}).map(function(m){
          var cnt = (data||[]).filter(function(r){return r.market.id===m.id||r.market.name===m.name;}).length;
          return (
            <div key={m.id} style={{background:"#fff",borderRadius:12,padding:"11px 14px",marginBottom:8,border:"1px solid #bbf7d0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{fontWeight:700,fontSize:13,color:G.mid}}>{m.name}</div>
                  {m.id===8 && <span style={{background:"#ecfdf5",color:"#059669",fontSize:9,fontWeight:700,borderRadius:10,padding:"2px 6px",border:"1px solid #6ee7b7"}}>🔴 LIVE</span>}
                </div>
                <div style={{fontSize:11,color:"#888",marginTop:2}}>{m.region} · 📞 {m.phone}</div>
              </div>
              <span style={{background:"#f0fdf4",color:G.mid,fontSize:12,fontWeight:700,borderRadius:20,padding:"4px 13px"}}>{cnt}건</span>
            </div>
          );
        })}
      </div>}
    </div>
  );
}

// ── 중도매인 번호 → 이름/연락처 매핑 (중앙청과 과일부) ──
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
  return DEALER_INFO[key] || {name:"중도매인 #"+key, phone:""};
}
var ACCOUNTS = {
  buyer:  { pw:"1234", role:"buyer",  name:"김소매",   biz:"소매상회",     bizNo:"123-45-67890", phone:"010-1234-5678" },
  dealer: { pw:"1234", role:"dealer", name:"중도매인",  dealerNo:"45" },
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
          {/* 회원 유형 선택 */}
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
  var ns = useState(_s.name||user.name||""); var name = ns[0]; var setName = ns[1];
  var bs = useState(_s.biz||user.biz||""); var biz = bs[0]; var setBiz = bs[1];
  var bnos = useState(_s.bizNo||user.bizNo||""); var bizNo = bnos[0]; var setBizNo = bnos[1];
  var phs = useState(_s.phone||user.phone||""); var phone = phs[0]; var setPhone = phs[1];
  var ats = useState(_s.alarmSound||"1"); var alarmSound = ats[0]; var setAlarmSound = ats[1];
  var saved = useState(false); var isSaved = saved[0]; var setSaved = saved[1];

  function playPreview(num) {
    try { var names = {"1":"작교1.wav","2":"작교2.wav","3":"작교3.m4a","4":"작교4.m4a"}; var a = new Audio("/sounds/"+names[num]); a.play(); } catch(e){}
  }

  function save() {
    try { localStorage.setItem("agro_buyer_"+user.id, JSON.stringify({name:name,biz:biz,bizNo:bizNo,phone:phone,alarmSound:alarmSound})); } catch(e){}
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
        {[
          ["담당자명","text",name,setName,"홍길동"],
          ["상호","text",biz,setBiz,"소매상회"],
          ["사업자 등록번호","text",bizNo,setBizNo,"123-45-67890"],
          ["연락처","tel",phone,setPhone,"010-0000-0000"],
        ].map(function(f){return(
          <div key={f[0]} style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>{f[0]}</div>
            <input type={f[1]} value={f[2]} onChange={function(e){f[3](e.target.value);}} placeholder={f[4]}
              style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
          </div>
        );})}
        <button onClick={save} style={{width:"100%",background:isSaved?"#059669":"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:14,fontWeight:900,cursor:"pointer",transition:"background 0.3s"}}>
          {isSaved ? "✅ 저장되었습니다" : "저장하기"}
        </button>
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
  var saved = useState(false); var isSaved = saved[0]; var setSaved = saved[1];

  function playPreview(num) {
    try { var names = {"1":"작교1.wav","2":"작교2.wav","3":"작교3.m4a","4":"작교4.m4a"}; var a = new Audio("/sounds/"+names[num]); a.play(); } catch(e){}
  }

  function saveDealer() {
    try { localStorage.setItem("agro_dealer_"+user.id, JSON.stringify({listedMap:listedMap, alarmSound:alarmSound})); } catch(e){}
    setSaved(true);
    setTimeout(function(){setSaved(false);}, 2000);
  }

  // 내 낙찰번호로 거래실적 필터
  var myTrades = tradeData.filter(function(t){
    var no = String(t["낙찰 중도매인"]||"").trim();
    return no === String(user.dealerNo);
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

  return (
    <div>
      <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:20,padding:"20px",marginBottom:14,color:"#fff"}}>
        <div style={{fontSize:10,color:"#52b788",letterSpacing:2,fontWeight:700,marginBottom:4}}>중도매인 마이페이지</div>
        <div style={{fontWeight:900,fontSize:18}}>🏪 중도매인 #{user.dealerNo}</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:4}}>대전 노은시장 · 당일 낙찰 품목</div>
        {listedItems.length > 0 && <div style={{marginTop:8,background:"rgba(74,222,128,0.2)",borderRadius:10,padding:"6px 10px",fontSize:11,color:"#4ade80",fontWeight:700}}>
          📢 {listedItems.length}개 품목 검색 노출 중
        </div>}
      </div>

      {myTrades.length === 0 && (
        <div style={{textAlign:"center",padding:"40px 0",background:"#fff",borderRadius:16,border:"1px solid #e5e7eb"}}>
          <div style={{fontSize:32,marginBottom:10}}>📋</div>
          <div style={{fontSize:13,color:"#888"}}>낙찰번호 #{user.dealerNo}의 거래실적이 없습니다</div>
          <div style={{fontSize:11,color:"#aaa",marginTop:6}}>발표 당일 데이터로 자동 업데이트됩니다</div>
        </div>
      )}

      {Object.keys(grouped).length > 0 && (
        <div>
          <div style={{fontWeight:800,fontSize:14,color:G.mid,marginBottom:10}}>📦 내 낙찰 품목 — 노출 선택</div>
          {Object.keys(grouped).map(function(itemName){
            var trades = grouped[itemName];
            var isOn = !!listedMap[itemName];
            var totalQty = trades.reduce(function(s,t){return s+(parseInt(t["수량"])||0);},0);
            var avgPrice = Math.round(trades.reduce(function(s,t){return s+(parseInt(t["단가"])||0);},0)/trades.length);
            var grade = (trades[0]["등급"]||"").trim();
            return (
              <div key={itemName} style={{background:"#fff",borderRadius:14,padding:"14px",marginBottom:10,border:"2px solid "+(isOn?"#4ade80":"#e5e7eb"),boxShadow:isOn?"0 2px 12px rgba(74,222,128,0.15)":"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:22}}>{getEmoji(itemName)}</span>
                    <div>
                      <div style={{fontWeight:800,fontSize:14,color:"#0d1f15"}}>{itemName}</div>
                      <div style={{fontSize:11,color:"#888"}}>{trades.length}건 · 총 {totalQty}개 · 평균 {avgPrice.toLocaleString()}원</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {grade && <span style={{background:"#fef9c3",color:"#854d0e",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 8px"}}>{grade}등급</span>}
                    <button onClick={function(){toggleListed(itemName);}} style={{background:isOn?"#0d2b1a":"#f3f4f6",color:isOn?"#4ade80":"#888",border:"none",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      {isOn ? "✅ 노출중" : "노출하기"}
                    </button>
                  </div>
                </div>
                {isOn && <div style={{background:"#f0fdf4",borderRadius:8,padding:"6px 10px",fontSize:11,color:G.mid,fontWeight:600}}>
                  🔍 경락 검색에서 이 품목이 상단에 표시됩니다
                </div>}
              </div>
            );
          })}
        </div>
      )}

      {/* 알림음 설정 */}
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

      {/* 저장 버튼 */}
      <button onClick={saveDealer} style={{width:"100%",background:isSaved?"#059669":"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:14,fontWeight:900,cursor:"pointer",transition:"background 0.3s",marginBottom:10}}>
        {isSaved ? "✅ 저장되었습니다" : "저장하기"}
      </button>

      <button onClick={onLogout} style={{width:"100%",background:"#f3f4f6",color:"#888",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer",marginTop:8}}>로그아웃</button>
    </div>
  );
}

// ── 메인 앱 ──
function App() {
  var t1 = useState("search"); var tab = t1[0]; var setTab = t1[1];
  var f1 = useState(""); var filterItem = f1[0]; var setFilterItem = f1[1];
  var f2 = useState(""); var filterRegion = f2[0]; var setFilterRegion = f2[1];
  var f3 = useState(""); var keyword = f3[0]; var setKeyword = f3[1];
  var f4 = useState("price"); var sortBy = f4[0]; var setSortBy = f4[1];
  var f5 = useState(false); var searched = f5[0]; var setSearched = f5[1];
  var f6 = useState(""); var filterCategory = f6[0]; var setFilterCategory = f6[1];
  var f7 = useState(""); var filterMarket = f7[0]; var setFilterMarket = f7[1];
  var f8 = useState("today"); var dateFilter = f8[0]; var setDateFilter = f8[1];

  var d1 = useState([]); var data = d1[0]; var setData = d1[1];
  var d2 = useState("idle"); var status = d2[0]; var setStatus = d2[1];
  var d3 = useState(""); var errMsg = d3[0]; var setErrMsg = d3[1];
  var d4 = useState(null); var lastUpdated = d4[0]; var setLastUpdated = d4[1];
  var d5 = useState(0); var liveCount = d5[0]; var setLiveCount = d5[1];
  var d6 = useState([]); var tradeData = d6[0]; var setTradeData = d6[1];
  var d7 = useState("idle"); var tradeStatus = d7[0]; var setTradeStatus = d7[1];

  var m1 = useState(""); var mapRegion = m1[0]; var setMapRegion = m1[1];
  var l1 = useState(null); var loginUser = l1[0]; var setLoginUser = l1[1];
  var l2 = useState(false); var showLogin = l2[0]; var setShowLogin = l2[1];
  var p1 = useState({}); var purchases = p1[0]; var setPurchases = p1[1];
  var pv1 = useState([]); var prevData = pv1[0]; var setPrevData = pv1[1];

  useEffect(function(){
    var cancelled = false;
    var mockData = makeMockData(); // 노은 플레이스홀더용으로만 사용

    async function load() {
      setStatus("loading");
      setData([]); // 빈 상태로 시작

      try {
        var res = await fetch(CSV_URL);
        if(!res.ok) throw new Error("노은시장 데이터 로드 실패: " + res.status);
        var csv = await res.text();
        if(cancelled) return;
        var liveRows = parseCSV(csv);
        // 전체 시장 데이터 사용 (노은 포함)
        var liveNoeun = liveRows.filter(function(r){ return r.market.id === 8; });
        var mockNoeun = mockData.filter(function(r){ return r.market.id === 8; });
        var noeunRows = liveNoeun.length > 0 ? liveNoeun : mockNoeun;
        var liveOthers = liveRows.filter(function(r){ return r.market.id !== 8; });
        var allRows = noeunRows.concat(liveOthers);
        // 중복 제거: 같은 경매일시+시장+법인+품목+경락가+산지 조합만 제거 (수량 다른 건 별도 행)
        var seen = {};
        var combined = allRows.filter(function(r){
          var key = r.date+"_"+r.market.id+"_"+r.corp+"_"+r.itemName+"_"+r.price+"_"+r.qty+"_"+r.origin;
          if(seen[key]) return false;
          seen[key] = true;
          return true;
        });
        setData(combined);
        setLiveCount(liveNoeun.length);
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
        if(!res.ok) return; // 없으면 그냥 빈 상태 유지
        var csv = await res.text();
        if(cancelled) return;
        var rows = parseCSV(csv);
        var seen = {};
        var deduped = rows.filter(function(r){
          var key = r.market.id+"_"+r.corp+"_"+r.itemName+"_"+r.price+"_"+r.qty+"_"+r.origin+"_"+r.date;
          if(seen[key]) return false;
          seen[key] = true;
          return true;
        });
        setPrevData(deduped);
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
        if(!cancelled) setPurchases(json.purchases || {});
      } catch(e) {}
    }
    loadPurchases();
    var iv3 = setInterval(loadPurchases, 5000); // 5초마다 갱신
    return function(){ cancelled=true; clearInterval(iv3); };
  }, []);

  // 오늘/전일 탭에 따라 데이터 소스 선택
  var activeData = dateFilter === "yesterday" ? prevData : data;
  var allDates = Array.from(new Set(data.map(function(r){return r.date;}).filter(Boolean))).sort();
  var latestDate = allDates[allDates.length-1] || TODAY;
  var prevAllDates = Array.from(new Set(prevData.map(function(r){return r.date;}).filter(Boolean))).sort();
  var prevDate = prevAllDates[prevAllDates.length-1] || YESTERDAY;

  var filtered = activeData.filter(function(r){
    if(filterCategory && r.category !== filterCategory) return false;
    if(filterItem && r.itemName !== filterItem) return false;
    if(filterMarket && r.market.name !== filterMarket) return false;
    if(filterRegion && r.market.region !== filterRegion) return false;
    if(keyword && !r.fullName.includes(keyword) && !r.market.name.includes(keyword) && !r.corp.includes(keyword) && !r.origin.includes(keyword)) return false;
    return true;
  }).sort(function(a,b){
    if(sortBy==="price") return a.price - b.price;
    if(sortBy==="date") return b.date > a.date ? 1 : -1;
    if(sortBy==="qty") return b.qty - a.qty;
    return 0;
  });

  var categoryList = Array.from(new Set(data.map(function(r){return r.category;}))).sort();
  var itemList = Array.from(new Set(
    data.filter(function(r){return !filterCategory||r.category===filterCategory;}).map(function(r){return r.itemName;})
  )).sort();
  // 9개 시장 항상 고정 표시 (데이터 유무 상관없이)
  var marketList = MARKETS.map(function(m){ return m.name; });

  var stats = {
    total: data.length,
    markets: 9, // 전국 9개 중앙공영도매시장 고정
    avgPrice: data.length ? Math.round(data.reduce(function(s,r){return s+r.price;},0)/data.length) : 0,
  };

  return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif"}}>

      {/* 헤더 */}
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
                  {liveCount > 0 && <span style={{background:"rgba(236,253,245,0.15)",color:"#a7f3d0",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px",border:"1px solid rgba(167,243,208,0.3)"}}>
                    🔴 노은 LIVE {liveCount}건
                  </span>}
                  {status==="partial" && <span style={{background:"rgba(234,179,8,0.2)",color:"#fde047",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px"}}>⚠️ 일부 시장 연결 대기</span>}
                </div>}
                {status==="loading" && <div style={{marginTop:6}}>
                  <span style={{background:"rgba(234,179,8,0.2)",color:"#fde047",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px"}}>⏳ 데이터 불러오는 중...</span>
                </div>}
                {status==="error" && <div style={{marginTop:6}}>
                  <span style={{background:"rgba(239,68,68,0.2)",color:"#fca5a5",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px"}}>🔴 연결 오류 · 재시도 중</span>
                </div>}
              </div>
              {/* 로그인 버튼 */}
              <div style={{marginTop:4}}>
                {loginUser
                  ? <button onClick={function(){setTab("mypage");}} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:20,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      {loginUser.role==="dealer"?"🏪":"🛒"} 마이페이지
                    </button>
                  : <button onClick={function(){setShowLogin(true);}} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:20,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      🔐 로그인
                    </button>
                }
              </div>
            </div>
          </div>

          {/* 탭 */}
          <div style={{display:"flex",gap:2,paddingBottom:0}}>
            {[["search","🔍 경락"],["trade","📈 거래실적"],["map","🗺️ 지도"],["guide","📋 안내"],["mypage","👤 MY"]].map(function(t){
              var active = tab===t[0];
              return <button key={t[0]} onClick={function(){setTab(t[0]); if(t[0]==="mypage"&&!loginUser) setShowLogin(true);}} style={{flex:1,padding:"10px 0",border:"none",background:active?"rgba(255,255,255,0.15)":"transparent",color:active?"#fff":"rgba(255,255,255,0.55)",fontWeight:active?800:400,fontSize:10,cursor:"pointer",borderBottom:active?"2px solid #52b788":"2px solid transparent",borderRadius:"6px 6px 0 0"}}>
                {t[1]}
              </button>;
            })}
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div style={{maxWidth:600,margin:"0 auto",padding:"16px"}}>

        {/* 경락 검색 탭 */}
        {tab==="search" && <div>

          {/* 통계 카드 */}
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

          {/* 검색 필터 */}
          <div style={{background:"#fff",borderRadius:16,padding:"16px",marginBottom:14,border:"1px solid #e5e7eb",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{fontWeight:800,fontSize:14,color:G.mid,marginBottom:12}}>🔍 경락가 검색</div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>분류</div>
                <select value={filterCategory} onChange={function(e){setFilterCategory(e.target.value);setFilterItem("");}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"9px 10px",fontSize:13,background:"#f8fffe",outline:"none"}}>
                  <option value="">전체 분류</option>
                  {categoryList.map(function(cat){return <option key={cat} value={cat}>{cat}</option>;})}
                </select>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>품목</div>
                <select value={filterItem} onChange={function(e){setFilterItem(e.target.value);}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"9px 10px",fontSize:13,background:"#f8fffe",outline:"none"}}>
                  <option value="">전체 품목</option>
                  {itemList.map(function(name){return <option key={name} value={name}>{getEmoji(name)+" "+name}</option>;})}
                </select>
              </div>
            </div>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>도매시장</div>
              <select value={filterMarket} onChange={function(e){setFilterMarket(e.target.value);}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"9px 10px",fontSize:13,background:"#f8fffe",outline:"none"}}>
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

          {/* 검색 결과 */}
          {searched && <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontWeight:800,fontSize:14,color:"#0d1f15"}}>
                {filterItem||keyword||filterRegion ? (filterItem||keyword||filterRegion) : "전체 품목"} 검색결과 <span style={{color:G.mid}}>{filtered.length}건</span>
                <span style={{fontSize:11,color:"#aaa",fontWeight:400,marginLeft:6}}>({dateFilter==="yesterday"?(prevDate||"전일 데이터 없음"):latestDate})</span>
              </div>
            </div>

            <div style={{display:"flex",gap:6,marginBottom:12}}>
              {[["price","💰 최저가순"],["date","🕐 최신순"],["qty","📦 수량순"]].map(function(s){return (
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
                    return <RecordCard key={r.id} record={r} rank={idx+1} tradeData={tradeData} purchases={purchases} setPurchases={setPurchases} loginUser={loginUser}/>;
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

        {/* 거래실적 탭 */}
        {tab==="trade" && <div>
          <div style={{background:"#fff",borderRadius:16,padding:"12px 16px",marginBottom:12,border:"1px solid #bfdbfe"}}>
            <div style={{fontWeight:900,fontSize:15,color:"#1e40af"}}>📈 거래실적</div>
            <div style={{fontSize:11,color:"#888",marginTop:2}}>대전 노은시장 · 당일 거래 데이터 · 발표일 데이터로 자동 교체</div>
          </div>

          {tradeStatus==="loading" && <div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{fontSize:32,marginBottom:10}}>⏳</div>
            <div style={{fontSize:13,color:"#888"}}>거래실적 불러오는 중...</div>
          </div>}

          {tradeStatus==="error" && <div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{fontSize:32,marginBottom:10}}>⚠️</div>
            <div style={{fontSize:13,color:"#888"}}>거래실적을 불러오지 못했습니다</div>
          </div>}

          {tradeStatus==="ok" && tradeData.length > 0 && (function(){
            var COLS = ["경매일자","경매시간","출하자","산지명","품목명","등급","수량","단가","금액","낙찰 중도매인"];
            return (
              <div>
                <div style={{fontSize:12,color:"#888",marginBottom:10}}>총 <b style={{color:"#1e40af"}}>{tradeData.length}</b>건</div>
                <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #bfdbfe",boxShadow:"0 2px 8px rgba(30,64,175,0.06)"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:560}}>
                    <thead>
                      <tr style={{background:"#1e3a8a"}}>
                        {COLS.map(function(h){return(
                          <th key={h} style={{padding:"9px 8px",color:"#bfdbfe",fontWeight:700,textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                        );})}
                      </tr>
                    </thead>
                    <tbody>
                      {tradeData.map(function(row,i){return(
                        <tr key={i} style={{background:i%2===0?"#fff":"#eff6ff",borderBottom:"1px solid #e0e7ff"}}>
                          {COLS.map(function(h){
                            var val = (row[h]||"-").trim();
                            var isPrice = h==="단가"||h==="금액";
                            var isGrade = h==="등급";
                            if(isPrice && val!=="-") val = parseInt(val.replace(/,/g,"")).toLocaleString()+"원";
                            return (
                              <td key={h} style={{padding:"7px 8px",whiteSpace:"nowrap",
                                color: isPrice ? G.mid : "#333",
                                fontWeight: isPrice ? 700 : 400}}>
                                {isGrade && val!=="-"
                                  ? <span style={{background:"#fef9c3",color:"#854d0e",borderRadius:6,padding:"1px 6px",fontWeight:700}}>{val}</span>
                                  : val}
                              </td>
                            );
                          })}
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
                <div style={{marginTop:10,fontSize:11,color:"#aaa",textAlign:"center"}}>
                  ※ 낙찰 중도매인 번호는 가번호로 표시됩니다 · 발표일에 실제 데이터로 교체 예정
                </div>
              </div>
            );
          })()}
        </div>}

        {/* 지도 탭 */}
        {tab==="map" && <MarketMap
          data={data}
          selected={mapRegion}
          onSelect={function(r){
            setMapRegion(r);
            if(r){ setFilterRegion(r); setTab("search"); setSearched(true); }
          }}
        />}

        {/* 이용안내 탭 */}
        {tab==="guide" && <div>
          <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:20,padding:"20px",marginBottom:14,color:"#fff"}}>
            <div style={{fontWeight:900,fontSize:17,marginBottom:8}}>🌿 농작교란?</div>
            <div style={{fontSize:13,lineHeight:1.8,color:"rgba(255,255,255,0.85)"}}>
              전국 9개 중앙공영도매시장의 실시간 경락 정보를 제공하는 <b style={{color:"#4ade80"}}>수수료 없는 공영 중계 플랫폼</b>입니다.<br/>
              중도매인과 소매 구매자를 직접 연결해 유통 단계를 줄입니다.
            </div>
          </div>

          {[
            {icon:"🏛️", title:"9개 중앙공영도매시장 통합", desc:"서울가락·부산엄궁·대구북부·인천남촌·인천삼산·광주각화·대전오정·대전노은·울산 — 전국 주요 공영도매시장 경락 데이터를 한 곳에서 조회"},
            {icon:"📡", title:"agromarket.kr 실시간 연동", desc:"전국 9개 시장 모두 agromarket.kr 데이터 기반 실시간 경락 정보 제공 · 1시간마다 자동 업데이트"},
            {icon:"📋", title:"대전 노은시장 상세정보 제공", desc:"노은시장은 기본 경락 정보 외에 낙찰자명·등급(특/상/보통)·출하자명·출하자 연락처까지 추가 제공"},
            {icon:"💰", title:"수수료 없는 공영 중계", desc:"플랫폼 수수료 0원 · 경락 정보를 투명하게 공개해 중도매인과 구매자 간 직접 거래 유도"},
            {icon:"📞", title:"직거래 문의", desc:"각 카드의 전화 버튼으로 해당 도매시장 법인에 직접 연락 · 중간 유통 없는 직거래 지원"},
          ].map(function(item){return (
            <div key={item.title} style={{background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:10,border:"1px solid #e5e7eb",display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{fontSize:24,flexShrink:0}}>{item.icon}</div>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:G.mid,marginBottom:4}}>{item.title}</div>
                <div style={{fontSize:12,color:"#555",lineHeight:1.7}}>{item.desc}</div>
              </div>
            </div>
          );})}

          {/* 데이터 출처 안내 */}
          <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:14,padding:"14px 16px",marginTop:4}}>
            <div style={{fontWeight:700,fontSize:13,color:G.mid,marginBottom:6}}>ℹ️ 데이터 출처</div>
            <div style={{fontSize:12,color:"#555",lineHeight:1.8}}>
              📍 <b>전국 9개 시장</b>: agromarket.kr 실시간 경락 데이터<br/>
              📍 <b>대전 노은시장</b>: 낙찰자·등급·출하자 상세정보 추가 제공<br/>
              <span style={{color:"#888",fontSize:11}}>※ 실제 거래 전 반드시 해당 시장에 확인하세요</span>
            </div>
          </div>
        </div>}

        {/* 마이페이지 탭 */}
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

      {/* 로그인 모달 */}
      {showLogin && <LoginModal
        onLogin={function(user){setLoginUser(user);setShowLogin(false);setTab("mypage");}}
        onClose={function(){setShowLogin(false);}}
      />}

    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
