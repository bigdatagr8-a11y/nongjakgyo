var { useState, useEffect, useRef } = React;

// ── Google Sheets 실시간 데이터 연동 ──
// 시트 ID
var SHEET_ID = "1K41TJcxgJdttUCaDsiqTBB7aoJWtdQkJre5RC2vlUZc";
var CSV_URL = "https://docs.google.com/..."; // 서버 프록시 경유 (CORS 해결)

// CSV → 경락 레코드 변환
function parseSheetRows(csvText, marketsMap) {
  var lines = csvText.trim().split("\n");
  if(lines.length < 2) return [];
  // 헤더: 경매일시,도매시장,법인,품목,품종,산지,수량,단위,경락가
  var records = [];
  var EMOJI_MAP = {"복숭아":"🍑","토마토":"🍅","수박":"🍉","참외":"🍈","블루베리":"🫐","딸기":"🍓","배":"🍐","사과":"🍎","감귤":"🍊","포도":"🍇","메론":"🍈","바나나":"🍌","오렌지":"🍊","파인애플":"🍍","코코넛":"🥥","망고":"🥭"};
  function getEmoji(name){
    var k = Object.keys(EMOJI_MAP).find(function(k){return name.includes(k);});
    return k ? EMOJI_MAP[k] : "🌿";
  }
  var MARKET_NAME_MAP = {
    "서울가락": MARKETS[0], "부산엄궁": MARKETS[1], "대구북부": MARKETS[2],
    "인천남촌": MARKETS[3], "인천삼산": MARKETS[4], "광주각화": MARKETS[5],
    "대전오정": MARKETS[6], "대전노은": MARKETS[7], "울산": MARKETS[8],
  };

  for(var i = 1; i < lines.length; i++) {
    var cols = lines[i].split(",");
    if(cols.length < 9) continue;
    var dateStr  = (cols[0]||"").replace(/"/g,"").trim();
    var mktName  = (cols[1]||"").replace(/"/g,"").trim();
    var corpName = (cols[2]||"").replace(/"/g,"").trim();
    var itemName = (cols[3]||"").replace(/"/g,"").trim();
    var variety  = (cols[4]||"").replace(/"/g,"").trim();
    var origin   = (cols[5]||"").replace(/"/g,"").trim();
    var qty      = parseInt((cols[6]||"0").replace(/"/g,"")) || 0;
    var unit     = (cols[7]||"").replace(/"/g,"").trim();
    var price    = parseInt((cols[8]||"0").replace(/"/g,"")) || 0;

    if(!itemName || !price) continue;

    var market = MARKET_NAME_MAP[mktName] || MARKETS[0];
    var fullName = variety && variety !== itemName ? itemName+"("+variety+")" : itemName;
    var item = {
      cat: itemName, name: fullName, unit: unit, emoji: getEmoji(itemName),
      base: price, grades: ["특","상","보통"], qtyDesc: unit+" 단위"
    };
    var seed = i * 777 + price;
    var seller = makeSeller(seed, {});

    records.push({
      id: i, _fromSheet: true,
      date: dateStr,
      market: market,
      item: item,
      grade: "상",
      qty: qty,
      price: price,
      seller: seller,
      available: true,
      remainQty: Math.max(1, Math.floor(qty * 0.6)),
      origin: origin,
    });
  }
  return records;
}

function getKST(offset) {
  var kst = new Date(new Date().getTime() + (9 + offset * 24) * 3600000);
  return kst.getUTCFullYear() + "-" + String(kst.getUTCMonth()+1).padStart(2,"0") + "-" + String(kst.getUTCDate()).padStart(2,"0");
}
var TODAY = getKST(0), YESTERDAY = getKST(-1);

var SELLER_INTROS = [
  "경락 당일 출하 원칙 · 신선도 자신있습니다 · 정기거래 단가 협의 가능",
  "산지 직거래 네트워크 보유 · 등급 선별 철저 · 소량 주문도 환영",
  "20년 경력 베테랑 · 가락시장 상위 출하량 · 재거래율 자랑합니다",
  "냉장 보관 철저 · 당일 경락 당일 출고 · 전국 납품 경험 다수",
  "정직한 등급 표기 · 포장 꼼꼼히 · 단골 거래처 우대 단가 적용",
  "공판장 직접 경락 · 중간 유통 없음 · 신선도 최우선",
  "수도권 새벽 납품 특화 · 물량 조율 유연 · 긴급 주문 대응 가능",
  "특등급 위주 선별 · 납품처 클레임 ZERO 목표 · 장기 계약 환영",
  "30년 전통 청과 전문 · 시장 내 신뢰도 최상위 · 정기 예약 가능",
  "소규모 맞춤 납품 · 5box부터 성심성의 · 첫 거래 샘플 제공",
  "직접 경락 직접 배송 · 가격 투명 공개 · 에스크로 적극 권장",
  "납품 일정 100% 준수 · 출고 전 사진 필수 전송 · 소통 빠릅니다",
  "경북 사과 전문 15년 · 출하량 상위권 · 정기 거래 단가 우대",
  "전남 딸기 직경락 전문 · 당도 보장 · 소매점·카페 납품 다수",
  "가락시장 메인 출하 · 특등급 선별 자신 · 재거래율 90%↑",
  "제철 품목 집중 운영 · 품질 편차 최소화 · 빠른 채팅 응대",
  "냉장 차량 자체 보유 · 도착 시간 정확 · 파손 사고 없습니다",
  "공영도매시장 20년 · 바이어 요청 맞춤 등급 제공 · 협의 환영",
  "산지 농가 직계약 · 원물 품질 검증 · 합리적 경락가 자신",
  "5box 소량부터 200box 대량까지 · 수량 무관 품질 동일",
];

var MARKET_SELLERS = {
  1: [
    {name:"동양물산",owner:"장○○",phone:"01-****-6901",career:11,deals:445,canContact:false,introIdx:2},
    {name:"태양농업",owner:"황○○",phone:"02-****-1198",career:19,deals:467,canContact:false,introIdx:12},
    {name:"전국농업",owner:"김○○",phone:"01-****-6368",career:8,deals:735,canContact:true,introIdx:1},
    {name:"제일과일",owner:"권○○",phone:"01-****-9970",career:19,deals:200,canContact:false,introIdx:9},
  ],
  2: [
    {name:"한라상회",owner:"홍○○",phone:"01-****-1373",career:15,deals:396,canContact:false,introIdx:9},
    {name:"으뜸상회",owner:"류○○",phone:"01-****-1427",career:7,deals:479,canContact:true,introIdx:16},
    {name:"경북농산",owner:"송○○",phone:"02-****-8969",career:10,deals:261,canContact:true,introIdx:12},
    {name:"금강농업",owner:"홍○○",phone:"01-****-5466",career:25,deals:631,canContact:false,introIdx:15},
  ],
  3: [
    {name:"한라청과",owner:"류○○",phone:"01-****-9327",career:24,deals:736,canContact:false,introIdx:1},
    {name:"참신선청과",owner:"한○○",phone:"02-****-5998",career:21,deals:566,canContact:false,introIdx:7},
    {name:"황금농업",owner:"류○○",phone:"02-****-7735",career:22,deals:700,canContact:true,introIdx:6},
    {name:"태양물산",owner:"임○○",phone:"02-****-9704",career:25,deals:618,canContact:true,introIdx:7},
    {name:"부산농산",owner:"홍○○",phone:"01-****-3828",career:15,deals:255,canContact:true,introIdx:2},
  ],
  4: [
    {name:"자연마트",owner:"안○○",phone:"02-****-8789",career:9,deals:254,canContact:true,introIdx:8},
    {name:"태양과일",owner:"윤○○",phone:"02-****-5889",career:23,deals:305,canContact:false,introIdx:10},
    {name:"반여유통",owner:"윤○○",phone:"02-****-8323",career:9,deals:189,canContact:true,introIdx:10},
    {name:"하늘물산",owner:"류○○",phone:"01-****-1497",career:17,deals:119,canContact:false,introIdx:11},
  ],
  5: [
    {name:"정직농산",owner:"이○○",phone:"01-****-9105",career:13,deals:474,canContact:false,introIdx:13},
    {name:"충청농산",owner:"장○○",phone:"01-****-8144",career:12,deals:748,canContact:false,introIdx:5},
    {name:"전국청과",owner:"송○○",phone:"02-****-1949",career:28,deals:558,canContact:true,introIdx:18},
    {name:"청정직송",owner:"송○○",phone:"01-****-8683",career:13,deals:365,canContact:true,introIdx:14},
  ],
  6: [
    {name:"가락통상",owner:"홍○○",phone:"02-****-9621",career:16,deals:372,canContact:true,introIdx:3},
    {name:"참청과",owner:"송○○",phone:"01-****-8662",career:14,deals:328,canContact:false,introIdx:6},
    {name:"미래마트",owner:"조○○",phone:"02-****-7644",career:21,deals:544,canContact:true,introIdx:15},
    {name:"부산농업",owner:"신○○",phone:"02-****-5736",career:15,deals:698,canContact:true,introIdx:3},
  ],
  7: [
    {name:"최고직송",owner:"최○○",phone:"02-****-3373",career:24,deals:273,canContact:true,introIdx:3},
    {name:"한국직송",owner:"서○○",phone:"02-****-9987",career:28,deals:710,canContact:true,introIdx:17},
    {name:"행복청과",owner:"송○○",phone:"02-****-2300",career:16,deals:683,canContact:true,introIdx:16},
    {name:"금강직송",owner:"윤○○",phone:"02-****-8908",career:17,deals:222,canContact:true,introIdx:13},
  ],
  8: [
    {name:"강원유통",owner:"임○○",phone:"02-****-2732",career:20,deals:225,canContact:false,introIdx:5},
    {name:"한마음농산",owner:"안○○",phone:"01-****-8666",career:9,deals:725,canContact:true,introIdx:19},
    {name:"으뜸농산",owner:"오○○",phone:"02-****-4849",career:28,deals:249,canContact:true,introIdx:4},
    {name:"한라통상",owner:"박○○",phone:"02-****-1891",career:17,deals:468,canContact:false,introIdx:12},
  ],
  9: [
    {name:"백두직송",owner:"장○○",phone:"02-****-7773",career:17,deals:394,canContact:false,introIdx:17},
    {name:"백두청과",owner:"홍○○",phone:"02-****-5997",career:13,deals:659,canContact:false,introIdx:3},
    {name:"참과일",owner:"홍○○",phone:"02-****-4757",career:9,deals:542,canContact:false,introIdx:9},
    {name:"전남통상",owner:"서○○",phone:"01-****-3441",career:13,deals:410,canContact:false,introIdx:7},
    {name:"전국상회",owner:"이○○",phone:"01-****-6319",career:12,deals:631,canContact:true,introIdx:11},
  ],
  10: [
    {name:"수도농업",owner:"송○○",phone:"01-****-7485",career:28,deals:452,canContact:false,introIdx:1},
    {name:"녹색청과",owner:"김○○",phone:"02-****-5306",career:27,deals:166,canContact:true,introIdx:3},
    {name:"전북과일",owner:"한○○",phone:"01-****-1608",career:18,deals:331,canContact:false,introIdx:3},
    {name:"참농산",owner:"한○○",phone:"02-****-5497",career:20,deals:258,canContact:true,introIdx:18},
  ],
  11: [
    {name:"제일농산",owner:"최○○",phone:"02-****-5448",career:23,deals:115,canContact:false,introIdx:6},
    {name:"정직농업",owner:"최○○",phone:"01-****-7515",career:10,deals:412,canContact:true,introIdx:4},
    {name:"한국마트",owner:"이○○",phone:"02-****-8826",career:28,deals:315,canContact:false,introIdx:1},
  ],
  12: [
    {name:"청정농업",owner:"강○○",phone:"01-****-9641",career:17,deals:442,canContact:true,introIdx:11},
    {name:"자연농산",owner:"홍○○",phone:"01-****-7311",career:9,deals:256,canContact:true,introIdx:12},
    {name:"경북농업",owner:"한○○",phone:"02-****-2594",career:17,deals:239,canContact:true,introIdx:18},
    {name:"영농물산",owner:"이○○",phone:"02-****-4085",career:28,deals:558,canContact:true,introIdx:15},
    {name:"금강통상",owner:"최○○",phone:"01-****-5770",career:17,deals:502,canContact:true,introIdx:1},
  ],
  13: [
    {name:"영농직송",owner:"신○○",phone:"01-****-4097",career:28,deals:522,canContact:true,introIdx:13},
    {name:"가락물산",owner:"장○○",phone:"01-****-1940",career:10,deals:459,canContact:true,introIdx:13},
    {name:"녹색물산",owner:"조○○",phone:"01-****-7328",career:28,deals:667,canContact:false,introIdx:1},
    {name:"동양상회",owner:"류○○",phone:"02-****-7222",career:14,deals:617,canContact:true,introIdx:0},
  ],
  14: [
    {name:"정직직송",owner:"박○○",phone:"02-****-1302",career:18,deals:642,canContact:false,introIdx:1},
    {name:"한마음직송",owner:"황○○",phone:"02-****-9759",career:12,deals:108,canContact:true,introIdx:1},
    {name:"경남통상",owner:"박○○",phone:"01-****-1719",career:5,deals:213,canContact:true,introIdx:19},
  ],
  15: [
    {name:"동양과일",owner:"강○○",phone:"02-****-6103",career:10,deals:225,canContact:true,introIdx:17},
    {name:"한빛직송",owner:"장○○",phone:"01-****-3374",career:28,deals:400,canContact:true,introIdx:5},
    {name:"부산상회",owner:"장○○",phone:"02-****-1135",career:24,deals:564,canContact:true,introIdx:10},
  ],
  16: [
    {name:"백두상회",owner:"신○○",phone:"01-****-1470",career:17,deals:383,canContact:false,introIdx:10},
    {name:"강원농산",owner:"오○○",phone:"01-****-4255",career:18,deals:127,canContact:true,introIdx:7},
    {name:"참신선상회",owner:"윤○○",phone:"01-****-7723",career:22,deals:526,canContact:true,introIdx:8},
  ],
  17: [
    {name:"참상회",owner:"조○○",phone:"02-****-5301",career:6,deals:186,canContact:true,introIdx:8},
    {name:"한빛유통",owner:"서○○",phone:"01-****-6657",career:25,deals:194,canContact:true,introIdx:1},
    {name:"부산물산",owner:"서○○",phone:"01-****-6524",career:16,deals:730,canContact:true,introIdx:18},
    {name:"한빛과일",owner:"권○○",phone:"02-****-6026",career:28,deals:388,canContact:true,introIdx:11},
    {name:"전국직송",owner:"정○○",phone:"02-****-1871",career:12,deals:496,canContact:false,introIdx:11},
  ],
  18: [
    {name:"한마음통상",owner:"장○○",phone:"02-****-9959",career:28,deals:540,canContact:false,introIdx:0},
    {name:"한라직송",owner:"박○○",phone:"01-****-9495",career:17,deals:281,canContact:true,introIdx:3},
    {name:"제일통상",owner:"서○○",phone:"02-****-4884",career:24,deals:116,canContact:true,introIdx:18},
    {name:"산지통상",owner:"윤○○",phone:"01-****-2409",career:24,deals:217,canContact:false,introIdx:11},
  ],
  19: [
    {name:"하나농산",owner:"최○○",phone:"01-****-2918",career:11,deals:716,canContact:true,introIdx:9},
    {name:"전남유통",owner:"임○○",phone:"01-****-6872",career:5,deals:572,canContact:true,introIdx:12},
    {name:"경남유통",owner:"이○○",phone:"02-****-6138",career:15,deals:231,canContact:true,introIdx:10},
  ],
  20: [
    {name:"전남직송",owner:"윤○○",phone:"01-****-5473",career:22,deals:436,canContact:false,introIdx:4},
    {name:"최고마트",owner:"강○○",phone:"02-****-5433",career:14,deals:338,canContact:true,introIdx:9},
    {name:"으뜸마트",owner:"홍○○",phone:"02-****-6048",career:23,deals:398,canContact:false,introIdx:4},
    {name:"녹색통상",owner:"최○○",phone:"01-****-2826",career:17,deals:366,canContact:true,introIdx:10},
    {name:"경남농업",owner:"최○○",phone:"02-****-3962",career:22,deals:356,canContact:true,introIdx:5},
  ],
  21: [
    {name:"반여농업",owner:"권○○",phone:"01-****-6729",career:14,deals:744,canContact:false,introIdx:11},
    {name:"한라농산",owner:"이○○",phone:"02-****-7296",career:27,deals:380,canContact:false,introIdx:6},
    {name:"하늘상회",owner:"김○○",phone:"01-****-2651",career:9,deals:344,canContact:true,introIdx:3},
    {name:"금강농산",owner:"이○○",phone:"02-****-6104",career:26,deals:170,canContact:true,introIdx:18},
  ],
  22: [
    {name:"황금유통",owner:"서○○",phone:"02-****-9186",career:21,deals:108,canContact:true,introIdx:4},
    {name:"으뜸통상",owner:"송○○",phone:"02-****-2707",career:7,deals:711,canContact:true,introIdx:11},
    {name:"부산통상",owner:"권○○",phone:"02-****-9506",career:25,deals:484,canContact:true,introIdx:17},
    {name:"전북직송",owner:"황○○",phone:"01-****-2507",career:10,deals:567,canContact:false,introIdx:5},
    {name:"영농유통",owner:"김○○",phone:"02-****-2415",career:23,deals:656,canContact:false,introIdx:19},
  ],
  23: [
    {name:"영농상회",owner:"서○○",phone:"01-****-9353",career:26,deals:268,canContact:false,introIdx:12},
    {name:"서울농산",owner:"황○○",phone:"02-****-9418",career:9,deals:617,canContact:false,introIdx:13},
    {name:"자연청과",owner:"서○○",phone:"01-****-9141",career:22,deals:663,canContact:true,introIdx:1},
    {name:"제일유통",owner:"임○○",phone:"02-****-7490",career:6,deals:167,canContact:true,introIdx:11},
    {name:"충청농업",owner:"강○○",phone:"02-****-5605",career:27,deals:195,canContact:true,introIdx:15},
  ],
  24: [
    {name:"으뜸유통",owner:"박○○",phone:"01-****-9367",career:22,deals:375,canContact:false,introIdx:18},
    {name:"부산마트",owner:"강○○",phone:"02-****-2237",career:11,deals:175,canContact:true,introIdx:8},
    {name:"수도직송",owner:"강○○",phone:"02-****-8119",career:27,deals:602,canContact:false,introIdx:12},
    {name:"충청유통",owner:"이○○",phone:"01-****-3365",career:22,deals:366,canContact:false,introIdx:19},
  ],
  25: [
    {name:"행복농산",owner:"오○○",phone:"01-****-3909",career:19,deals:474,canContact:false,introIdx:4},
    {name:"황금직송",owner:"송○○",phone:"01-****-4849",career:24,deals:299,canContact:true,introIdx:12},
    {name:"자연물산",owner:"박○○",phone:"02-****-2650",career:8,deals:118,canContact:true,introIdx:9},
  ],
  26: [
    {name:"녹색농업",owner:"임○○",phone:"01-****-2610",career:22,deals:304,canContact:true,introIdx:3},
    {name:"서울청과",owner:"강○○",phone:"01-****-5679",career:22,deals:253,canContact:false,introIdx:10},
    {name:"으뜸직송",owner:"김○○",phone:"02-****-3363",career:18,deals:677,canContact:true,introIdx:3},
    {name:"가락마트",owner:"송○○",phone:"02-****-4946",career:25,deals:524,canContact:true,introIdx:17},
    {name:"으뜸농업",owner:"권○○",phone:"01-****-8924",career:18,deals:103,canContact:true,introIdx:8},
  ],
  27: [
    {name:"한라물산",owner:"황○○",phone:"02-****-7567",career:6,deals:304,canContact:false,introIdx:1},
    {name:"서울과일",owner:"권○○",phone:"01-****-2137",career:7,deals:301,canContact:true,introIdx:6},
    {name:"자연상회",owner:"송○○",phone:"01-****-4911",career:16,deals:466,canContact:false,introIdx:18},
  ],
  28: [
    {name:"반여마트",owner:"안○○",phone:"01-****-2153",career:7,deals:339,canContact:false,introIdx:10},
    {name:"산지상회",owner:"권○○",phone:"01-****-2602",career:7,deals:287,canContact:true,introIdx:19},
    {name:"참신선유통",owner:"조○○",phone:"02-****-9287",career:18,deals:648,canContact:true,introIdx:15},
    {name:"대한통상",owner:"정○○",phone:"02-****-5663",career:25,deals:746,canContact:false,introIdx:5},
    {name:"경북과일",owner:"권○○",phone:"02-****-3635",career:12,deals:546,canContact:false,introIdx:5},
  ],
  29: [
    {name:"경북상회",owner:"윤○○",phone:"02-****-8560",career:27,deals:176,canContact:true,introIdx:18},
    {name:"황금과일",owner:"윤○○",phone:"02-****-7219",career:14,deals:538,canContact:true,introIdx:1},
    {name:"한라유통",owner:"황○○",phone:"01-****-1461",career:7,deals:176,canContact:false,introIdx:9},
  ],
  30: [
    {name:"참신선과일",owner:"조○○",phone:"01-****-8662",career:27,deals:450,canContact:true,introIdx:1},
    {name:"동양청과",owner:"한○○",phone:"01-****-1578",career:26,deals:470,canContact:true,introIdx:9},
    {name:"자연과일",owner:"오○○",phone:"01-****-7440",career:5,deals:290,canContact:true,introIdx:17},
    {name:"풍성유통",owner:"류○○",phone:"02-****-1375",career:19,deals:639,canContact:true,introIdx:13},
    {name:"제일농업",owner:"김○○",phone:"01-****-8370",career:14,deals:462,canContact:true,introIdx:2},
  ],
  31: [
    {name:"전남마트",owner:"홍○○",phone:"02-****-3625",career:6,deals:587,canContact:true,introIdx:17},
    {name:"정직마트",owner:"한○○",phone:"02-****-3836",career:24,deals:363,canContact:true,introIdx:3},
    {name:"수도물산",owner:"홍○○",phone:"01-****-7525",career:11,deals:523,canContact:true,introIdx:0},
  ],
  32: [
    {name:"반여상회",owner:"송○○",phone:"01-****-5241",career:10,deals:180,canContact:true,introIdx:19},
    {name:"청정유통",owner:"홍○○",phone:"02-****-8042",career:13,deals:350,canContact:true,introIdx:4},
    {name:"풍성직송",owner:"박○○",phone:"02-****-1214",career:18,deals:366,canContact:true,introIdx:4},
    {name:"산지직송",owner:"권○○",phone:"02-****-6076",career:17,deals:335,canContact:false,introIdx:17},
    {name:"충청청과",owner:"오○○",phone:"02-****-8138",career:5,deals:713,canContact:false,introIdx:1},
  ],
  33: [
    {name:"수도농산",owner:"박○○",phone:"01-****-5067",career:21,deals:623,canContact:true,introIdx:19},
    {name:"태양직송",owner:"정○○",phone:"01-****-2308",career:7,deals:118,canContact:true,introIdx:14},
    {name:"금강과일",owner:"윤○○",phone:"01-****-2249",career:26,deals:282,canContact:true,introIdx:6},
  ],
};

var MARKETS = [
  {id:1, name:"서울 가락시장",   region:"서울", addr:"서울특별시 송파구 양재대로 932",
   auctionTimes:[
     {session:"새벽 경매", time:"02:30 ~ 04:00", items:"포도·복숭아·감귤·딸기·참외·수박 등 대부분 과일류"},
     {session:"아침 경매", time:"08:30 ~",        items:"사과·배·단감·수입 과실류 등"},
   ]},
  {id:2, name:"부산 엄궁시장",   region:"부산", addr:"부산광역시 사상구 농산물시장로 9",
   auctionTimes:[
     {session:"경매",     time:"04:00 ~ 08:00", items:"동절기 04:30 시작"},
   ]},
  {id:3, name:"대구 북부시장",   region:"대구", addr:"대구광역시 북구 매천로 18길 45",
   auctionTimes:[
     {session:"경매",     time:"06:00 ~",       items:"하절기(6~9월) 05:30 시작"},
   ]},
  {id:4, name:"인천 남촌시장",   region:"인천", addr:"인천광역시 남동구 남동대로 671",
   auctionTimes:[
     {session:"경매",     time:"03:00 ~ 경매 종료 시까지", items:"남촌 농산물도매시장"},
   ]},
  {id:5, name:"인천 삼산시장",   region:"인천", addr:"인천광역시 부평구 영성동로 46",
   auctionTimes:[
     {session:"경매",     time:"03:00 ~ 경매 종료 시까지", items:"삼산 농산물도매시장"},
   ]},
  {id:6, name:"광주 각화시장",   region:"광주", addr:"광주광역시 북구 동문로 260",
   auctionTimes:[
     {session:"경매",     time:"07:00 ~ 10:00", items:""},
   ]},
  {id:7, name:"대전 오정시장",   region:"대전", addr:"대전광역시 대덕구 한밭대로 987",
   auctionTimes:[
     {session:"경매",     time:"05:00 ~",       items:""},
   ]},
  {id:8, name:"대전 노은시장",   region:"대전", addr:"대전광역시 유성구 노은동로 33",
   auctionTimes:[
     {session:"대전중앙청과",    time:"04:30 ~", items:""},
     {session:"딸기",            time:"04:30 ~", items:"대전원예농업협동조합"},
     {session:"잡과(기타)",      time:"04:40 ~", items:""},
     {session:"토마토·메론·배", time:"05:00 ~", items:""},
     {session:"감",              time:"05:30 ~", items:""},
     {session:"사과·포도",       time:"06:00 ~", items:""},
     {session:"감귤류",          time:"06:30 ~", items:""},
   ]},
  {id:9, name:"울산 도매시장",   region:"울산", addr:"울산광역시 남구 삼산로 324",
   auctionTimes:[
     {session:"울산중앙청과",           time:"04:45 ~", items:""},
     {session:"울산원예농업협동조합",   time:"05:00 ~", items:""},
   ]},
];

// ── 정밀 물류 테이블 (출발지 region → 도착지 region, 단위: 시간, 소수점 포함) ──
// 동일 권역은 1~2h, 인접권역 2~3h, 원거리 5~7h
var LOGI = {
  "서울":{  "서울":1.5,"경기":2,  "인천":2,  "강원":3.5,"충북":3,  "충남":3,  "전북":4,  "전남":5,  "광주":5,  "대전":3,  "경북":5,  "대구":5,  "경남":6,  "부산":6,  "울산":6  },
  "경기":{  "서울":2,  "경기":1.5,"인천":1.5,"강원":3,  "충북":2.5,"충남":2.5,"전북":3.5,"전남":5,  "광주":5,  "대전":3,  "경북":5,  "대구":4.5,"경남":6,  "부산":6,  "울산":6  },
  "인천":{  "서울":2,  "경기":1.5,"인천":1.5,"강원":3.5,"충북":3,  "충남":3,  "전북":4,  "전남":5,  "광주":5,  "대전":3.5,"경북":5.5,"대구":5,  "경남":6.5,"부산":6.5,"울산":7  },
  "부산":{  "서울":6,  "경기":6,  "인천":6.5,"강원":7,  "충북":5.5,"충남":5.5,"전북":4.5,"전남":4,  "광주":4,  "대전":4,  "경북":3,  "대구":2.5,"경남":2,  "부산":1,  "울산":1.5},
  "대구":{  "서울":5,  "경기":4.5,"인천":5,  "강원":4.5,"충북":3.5,"충남":4,  "전북":3.5,"전남":4.5,"광주":5,  "대전":3,  "경북":2,  "대구":1,  "경남":2.5,"부산":2.5,"울산":2.5},
  "광주":{  "서울":5,  "경기":5,  "인천":5.5,"강원":6,  "충북":4,  "충남":3.5,"전북":2,  "전남":1.5,"광주":1,  "대전":3,  "경북":5,  "대구":4.5,"경남":3.5,"부산":4,  "울산":4.5},
  "대전":{  "서울":2.5,"경기":2.5,"인천":3,  "강원":3.5,"충북":2,  "충남":2,  "전북":2.5,"전남":3.5,"광주":3.5,"대전":1,  "경북":3.5,"대구":3,  "경남":4,  "부산":4,  "울산":4  },
  "울산":{  "서울":6,  "경기":6,  "인천":6.5,"강원":6,  "충북":5,  "충남":5.5,"전북":5,  "전남":5,  "광주":5,  "대전":4,  "경북":2.5,"대구":2.5,"경남":1.5,"부산":1.5,"울산":1  },
  "강원":{  "서울":3,  "경기":2.5,"인천":3,  "강원":1.5,"충북":2.5,"충남":3.5,"전북":4.5,"전남":5.5,"광주":5.5,"대전":3.5,"경북":3.5,"대구":4,  "경남":6,  "부산":5.5,"울산":5  },
  "충북":{  "서울":2.5,"경기":2.5,"인천":3,  "강원":2.5,"충북":1,  "충남":2,  "전북":2.5,"전남":3.5,"광주":3.5,"대전":2,  "경북":3,  "대구":2.5,"경남":4,  "부산":4,  "울산":3.5},
  "충남":{  "서울":2.5,"경기":2.5,"인천":3,  "강원":3.5,"충북":2,  "충남":1,  "전북":2.5,"전남":3.5,"광주":3,  "대전":2,  "경북":4,  "대구":3.5,"경남":4.5,"부산":5,  "울산":5  },
  "전북":{  "서울":4,  "경기":4,  "인천":4.5,"강원":5,  "충북":3,  "충남":2.5,"전북":1,  "전남":1.5,"광주":2,  "대전":2.5,"경북":4,  "대구":3.5,"경남":3.5,"부산":4,  "울산":4.5},
  "전남":{  "서울":5,  "경기":5,  "인천":5.5,"강원":6,  "충북":4,  "충남":3.5,"전북":1.5,"전남":1,  "광주":1.5,"대전":3,  "경북":5,  "대구":4.5,"경남":3.5,"부산":4,  "울산":4.5},
  "경북":{  "서울":5,  "경기":5,  "인천":5.5,"강원":4,  "충북":3,  "충남":4,  "전북":4,  "전남":5,  "광주":5,  "대전":3.5,"경북":1,  "대구":1.5,"경남":3,  "부산":3,  "울산":2.5},
  "경남":{  "서울":6,  "경기":6,  "인천":6.5,"강원":7,  "충북":5,  "충남":5,  "전북":3.5,"전남":3,  "광주":3,  "대전":4,  "경북":3,  "대구":2.5,"경남":1.5,"부산":2,  "울산":2  },
};

// 제휴 택배사 (플랫폼 공통)
var CARRIERS = [
  {id:"cj",    name:"CJ대한통운 로킷",  logo:"🚛", discount:0.28, perBox:{s5:7500, s30:5200, s100:3800}, desc:"냉장전용 · 전국익일"},
  {id:"hanjin",name:"한진 냉장특송",    logo:"🚚", discount:0.22, perBox:{s5:8000, s30:5500, s100:4000}, desc:"5box↑ · 새벽도착"},
  {id:"lotte", name:"롯데글로벌로지스", logo:"🏎️", discount:0.18, perBox:{s5:8500, s30:5800, s100:4200}, desc:"10box↑ · 온도관리"},
];
var FREIGHT_BASE = {near:{s5:10500,s30:7200,s100:5200}, mid:{s5:14000,s30:9500,s100:6800}, far:{s5:18000,s30:12000,s100:8500}};

function calcLogistics(from, to, boxes, carrierId) {
  var rawH = (LOGI[from] && LOGI[from][to]) != null ? LOGI[from][to] : 5;
  var tier = rawH <= 2 ? "near" : rawH <= 4 ? "mid" : "far";
  var carrier = carrierId ? CARRIERS.find(function(c){ return c.id === carrierId; }) : null;
  // 거리(tier)별 기본 운임
  var baseRate = boxes>=100 ? FREIGHT_BASE[tier].s100 : boxes>=30 ? FREIGHT_BASE[tier].s30 : FREIGHT_BASE[tier].s5;
  // 제휴 택배사: 거리 반영된 기본 운임에 할인율 적용 → 거리별 차등 유지
  var ratePerBox = carrier
    ? Math.round(baseRate * (1 - carrier.discount) / 100) * 100
    : baseRate;
  // 택배사별 출발 시각 차이
  // CJ 로킷: 오전 5시 출고, 일반 운임과 동일
  // 한진 냉장특송: 새벽 3시 출고 (새벽배송 특화)
  // 롯데글로벌: 오전 6시 출고
  var departH = carrierId==="hanjin" ? 3 : carrierId==="lotte" ? 6 : 5;
  var arrH = departH + rawH;
  var ah = Math.round(arrH);
  // 날짜 계산
  var now = new Date();
  var kstNow = new Date(now.getTime() + 9*3600000);
  var departDate = new Date(kstNow);
  departDate.setUTCHours(departH,0,0,0);
  // 출고 시간이 이미 지났으면 다음날 출고
  if(kstNow.getUTCHours() >= departH) departDate.setUTCDate(departDate.getUTCDate()+1);
  var arriveDate = new Date(departDate.getTime() + rawH*3600000);
  var mm = arriveDate.getUTCMonth()+1;
  var dd = arriveDate.getUTCDate();
  var days=["일","월","화","수","목","금","토"];
  var dow = days[arriveDate.getUTCDay()];
  var arriveH = arriveDate.getUTCHours();
  var timeStr = arriveH<12 ? "오전 "+arriveH+"시" : arriveH===12 ? "오후 12시" : "오후 "+(arriveH-12)+"시";
  var arrStr = mm+"/"+dd+"("+dow+") "+timeStr;
  return { hours: rawH, arriveStr: arrStr, ratePerBox: ratePerBox, totalFreight: ratePerBox * boxes, carrierId: carrierId, departH: departH };
}

var ITEMS = [
  {cat:"사과류",   name:"사과(후지)",       unit:"10kg", emoji:"🍎", base:38000, grades:["특","상","보통"], qtyDesc:"10kg 박스·라벨 확인"},
  {cat:"사과류",   name:"사과(홍로)",       unit:"10kg", emoji:"🍎", base:42000, grades:["특","상","보통"], qtyDesc:"10kg 박스·라벨 확인"},
  {cat:"사과류",   name:"사과(부사)",       unit:"10kg", emoji:"🍎", base:36000, grades:["특","상","보통"], qtyDesc:"10kg 박스·라벨 확인"},
  {cat:"배류",     name:"배(신고)",         unit:"15kg", emoji:"🍐", base:55000, grades:["특","상","보통"], qtyDesc:"15kg 박스·개수 라벨"},
  {cat:"배류",     name:"배(원황)",         unit:"15kg", emoji:"🍐", base:48000, grades:["특","상","보통"], qtyDesc:"15kg 박스·개수 라벨"},
  {cat:"감귤류",   name:"감귤(노지)",       unit:"10kg", emoji:"🍊", base:18000, grades:["특","상","보통"], qtyDesc:"10kg 망포장·중량 확인"},
  {cat:"감귤류",   name:"한라봉",           unit:"5kg",  emoji:"🍊", base:32000, grades:["특","상","보통"], qtyDesc:"5kg 박스·개수 표시"},
  {cat:"감귤류",   name:"천혜향",           unit:"5kg",  emoji:"🍊", base:35000, grades:["특","상"],         qtyDesc:"5kg 박스·개수 표시"},
  {cat:"딸기류",   name:"딸기(설향)",       unit:"2kg",  emoji:"🍓", base:22000, grades:["특","상","보통"], qtyDesc:"2kg 팩 단위·팩수 라벨"},
  {cat:"딸기류",   name:"딸기(죠향)",       unit:"2kg",  emoji:"🍓", base:26000, grades:["특","상","보통"], qtyDesc:"2kg 팩 단위·팩수 라벨"},
  {cat:"포도류",   name:"포도(샤인머스켓)", unit:"2kg",  emoji:"🍇", base:28000, grades:["특","상","보통"], qtyDesc:"2kg 비닐포장·송이수"},
  {cat:"포도류",   name:"포도(캠벨)",       unit:"5kg",  emoji:"🍇", base:15000, grades:["특","상","보통"], qtyDesc:"5kg 박스·송이수 확인"},
  {cat:"포도류",   name:"포도(거봉)",       unit:"4kg",  emoji:"🍇", base:20000, grades:["특","상","보통"], qtyDesc:"4kg 박스·송이수 확인"},
  {cat:"복숭아류", name:"복숭아(백도)",     unit:"4kg",  emoji:"🍑", base:26000, grades:["특","상","보통"], qtyDesc:"4kg 박스·개수 라벨"},
  {cat:"복숭아류", name:"복숭아(황도)",     unit:"4kg",  emoji:"🍑", base:22000, grades:["특","상","보통"], qtyDesc:"4kg 박스·개수 라벨"},
  {cat:"수박류",   name:"수박",             unit:"개",   emoji:"🍉", base:24000, grades:["특","상","보통"], qtyDesc:"개수·중량 스티커 확인"},
  {cat:"참외류",   name:"참외",             unit:"10kg", emoji:"🍈", base:30000, grades:["특","상","보통"], qtyDesc:"10kg 박스·라벨 확인"},
  {cat:"채소류",   name:"토마토",           unit:"5kg",  emoji:"🍅", base:20000, grades:["특","상","보통"], qtyDesc:"5kg 박스·중량 확인"},
  {cat:"채소류",   name:"방울토마토",       unit:"3kg",  emoji:"🍅", base:18000, grades:["특","상","보통"], qtyDesc:"3kg 팩 단위·팩수 라벨"},
  {cat:"채소류",   name:"오이",             unit:"20개", emoji:"🥒", base:12000, grades:["특","상","보통"], qtyDesc:"20개 단위·개수 확인"},
  {cat:"채소류",   name:"홍고추",           unit:"10kg", emoji:"🌶️", base:45000, grades:["특","상","보통"], qtyDesc:"10kg 박스·중량 확인"},
];

function sr(s){ var x=Math.abs(s%2147483647)+1; x=(x*16807)%2147483647; return (x-1)/2147483646; }

var CO=["한국청과","신선유통","으뜸과일","한마음청과","대한농산","제일청과","하나농산","태양과일","황금청과","미래마트","행복청과","청정유통","자연청과","풍성농산","정직농산","참신선","영농유통","산지직송","한빛청과","하늘청과","녹색유통","전국청과","참청과","대성유통","경북청과","남도농산","서해청과","동부유통","가락청과","중앙농산","삼성청과","제이청과","K청과"];
var SN=["김","이","박","최","정","강","조","윤","장","임","오","한","서","신","권"];
// 무하자 업체용 리뷰 (하자 없음, 4~5점 위주)
var RC_CLEAN=[
  {score:5, text:"처음 거래였는데 신선도가 정말 달랐어요. 경락 당일 출하라 상품 상태가 너무 좋았고 연락도 빠르게 주셔서 신뢰가 갔습니다. 재거래 의사 100%입니다."},
  {score:5, text:"포장이 정말 꼼꼼하게 되어 있었어요. 특등급 주문했는데 등급 그대로 왔고, 크기도 균일해서 납품처에서도 칭찬받았습니다."},
  {score:5, text:"납품 일정 정확하게 지켜주시고 사전에 출고 사진도 보내주셔서 너무 좋았어요. 앞으로도 계속 거래하고 싶습니다."},
  {score:5, text:"정기 거래 3개월째인데 한 번도 실망시킨 적이 없어요. 수량 조율도 유연하게 해주시고 갑자기 추가 주문해도 빠르게 대응해 주십니다."},
  {score:5, text:"출하 영상까지 보내주시는 꼼꼼함에 감동받았어요. 가락시장 직경락이라 중간 유통 없이 바로 오는 게 품질에서 확실히 느껴졌습니다."},
  {score:5, text:"수도권까지 새벽 배송인데 오전 9시에 이미 도착해 있었어요. 냉장 차량이라 신선도 걱정도 없었고 응대도 친절하셨습니다."},
  {score:5, text:"특등급 샤인머스켓 50box 주문했는데 모두 상태가 완벽했어요. 납품처에서 어디서 구했냐고 물어볼 정도였습니다."},
  {score:5, text:"경력 20년 베테랑이라 그런지 상품 선별 눈이 다르더라고요. 같은 등급이어도 정말 좋은 것만 골라주시는 느낌입니다."},
  {score:5, text:"10년 넘게 이쪽 업계에 있었는데 이런 플랫폼이 생긴 게 정말 편해요. 경락가 비교, 채팅 협의, 에스크로까지. 이제 여기서만 삽니다."},
  {score:4, text:"상품 자체는 만족스러웠는데 배송이 예정보다 2시간 정도 늦게 도착했어요. 그래도 신선도엔 문제없었고 품질은 좋았습니다."},
  {score:4, text:"처음엔 반신반의하고 소량 주문했는데 품질이 너무 좋아서 바로 정기 거래로 전환했어요. 에스크로 덕에 믿고 거래할 수 있었습니다."},
  {score:4, text:"전반적으로 만족스럽습니다. 가격도 합리적이고 품질도 좋아요. 성수기엔 재고가 빠르게 소진되니 미리 예약하는 걸 추천드립니다."},
  {score:4, text:"처음 주문이라 걱정했는데 친절하게 설명해 주시고 사진도 보내주셔서 안심됐어요. 품질도 좋고 만족합니다."},
  {score:5, text:"포항에서 서울까지 오는데 신선도가 전혀 떨어지지 않았어요. 냉장 차량 관리가 철저한 것 같습니다. 가격도 경쟁력 있고 재거래 확정입니다."},
  {score:4, text:"전체적으로 좋았습니다. 박스 겉면이 조금 찌그러져 왔는데 내용물은 이상 없었습니다. 품질과 신선도는 훌륭했어요."},
  {score:5, text:"가격 대비 품질이 압도적으로 좋아요. 같은 등급 다른 업체보다 10% 이상 저렴한데 품질은 오히려 더 좋았습니다. 강력 추천!"},
  {score:5, text:"채팅 응대가 정말 빠르고 친절해요. 궁금한 점 물어보면 바로 답변 주시고, 출고 사진까지 보내주셔서 믿고 기다릴 수 있었습니다."},
  {score:4, text:"오전에 채팅했는데 당일 오후 바로 확정하고 다음날 새벽 출고됐어요. 납품 일정이 촉박했는데 딱 맞게 받았습니다."},
];

// 일반 업체용 리뷰 (다양한 점수, 하자 리뷰 포함)
var RC_NORMAL=[
  {score:5, text:"처음 거래였는데 신선도가 정말 달랐어요. 경락 당일 출하라 상품 상태가 너무 좋았고 연락도 빠르게 주셔서 신뢰가 갔습니다. 재거래 의사 100%입니다."},
  {score:5, text:"납품 일정 정확하게 지켜주시고 사전에 출고 사진도 보내주셔서 너무 좋았어요."},
  {score:4, text:"상품 자체는 만족스러웠는데 배송이 예정보다 2시간 정도 늦게 도착했어요. 그래도 신선도엔 문제없었고 품질은 좋았습니다."},
  {score:5, text:"가격 대비 품질이 압도적으로 좋아요. 같은 등급 다른 업체보다 10% 이상 저렴한데 품질은 오히려 더 좋았습니다. 강력 추천합니다."},
  {score:3, text:"상등급 주문했는데 일부 박스에 크기 편차가 좀 있었어요. 상품 자체는 신선했지만 등급 기준이 조금 아쉬웠습니다."},
  {score:5, text:"정기 거래 3개월째인데 한 번도 실망시킨 적이 없어요. 수량 조율도 유연하게 해주시고 빠르게 대응해 주셔서 감사합니다."},
  {score:4, text:"처음엔 반신반의하고 소량 주문했는데 품질이 너무 좋아서 바로 정기 거래로 전환했어요."},
  {score:5, text:"출하 영상까지 보내주시는 꼼꼼함에 감동받았어요. 직경락이라 중간 유통 없이 바로 오는 게 품질에서 확실히 느껴졌습니다."},
  {score:2, text:"납품받은 딸기 중 일부에 물러진 게 섞여 있었어요. 하자신고 후 빠르게 환불 처리해 주셔서 마무리는 깔끔했지만 아쉬웠습니다."},
  {score:5, text:"수도권까지 새벽 배송인데 오전 9시에 이미 도착해 있었어요. 냉장 차량이라 신선도 걱정도 없었고 응대도 친절하셨습니다."},
  {score:4, text:"전반적으로 만족스럽습니다. 성수기엔 재고가 빠르게 소진되니 미리 연락해서 예약하는 걸 추천드립니다."},
  {score:5, text:"10년 넘게 이쪽 업계에 있었는데 이런 플랫폼이 생긴 게 정말 편해요. 이제 여기서만 삽니다."},
  {score:3, text:"상품은 괜찮았는데 초기 연락이 좀 늦었어요. 채팅 보내고 1시간 넘게 기다렸습니다. 이후엔 빠르게 처리해 주셨어요."},
  {score:5, text:"특등급 샤인머스켓 50box 주문했는데 모두 상태가 완벽했어요. 앞으로 계속 이용할게요."},
  {score:4, text:"처음 주문이라 걱정했는데 친절하게 설명해 주시고 사진도 보내주셔서 안심됐어요."},
  {score:5, text:"포항에서 서울까지 오는데 신선도가 전혀 떨어지지 않았어요. 재거래 확정입니다."},
  {score:1, text:"주문한 수량보다 2박스 부족하게 왔어요. 하자신고 했고 에스크로 덕분에 차액은 돌려받았지만 납품 당일 당황스러웠습니다."},
  {score:5, text:"경력 20년 베테랑이라 그런지 상품 선별 눈이 다르더라고요. 같은 등급이어도 정말 좋은 것만 골라주시는 느낌입니다."},
  {score:4, text:"전체적으로 좋았습니다. 박스 겉면이 조금 찌그러져 왔는데 내용물은 이상 없었습니다."},
  {score:2, text:"상등급 주문했는데 보통등급 수준의 상품이 일부 섞여 있었어요. 환불 협의는 됐지만 처음부터 꼼꼼히 확인하고 주문하는 게 좋을 것 같습니다."},
  {score:5, text:"채팅 응대가 정말 빠르고 친절해요. 출고 사진까지 보내주셔서 믿고 기다릴 수 있었습니다."},
  {score:3, text:"처음 거래라 소량 주문했는데 포장이 좀 아쉬웠어요. 상품 자체는 신선했지만 박스 고정이 허술해서 일부 눌린 흔적이 있었습니다."},
];

function makeSeller(seed, baseData) {
  if(!baseData)baseData={};
  var claimRand=sr(seed*89);
  var claimCnt=claimRand<0.78?0:claimRand<0.93?1:2;
  var rcPool = claimCnt===0 ? RC_CLEAN : RC_NORMAL;
  var rc=3+Math.floor(sr(seed*17)*9), reviews=[];
  // seed 기반으로 리뷰 인덱스 선택 (중복 최소화)
  var usedIdx=[];
  for(var i=0;i<rc;i++){
    var idx=(seed*7+i*13+seed%rcPool.length)%rcPool.length;
    // 중복 방지: 이미 쓴 인덱스면 다음 인덱스
    var tries=0;
    while(usedIdx.indexOf(idx)!==-1 && tries<rcPool.length){idx=(idx+1)%rcPool.length;tries++;}
    usedIdx.push(idx);
    var rcItem=rcPool[idx];
    // 날짜 다양화
    // 각 리뷰마다 독립적 날짜: prime number 곱으로 충분한 분산
    var p1=sr((seed+1)*(i+1)*7+i*53+3);
    var p2=sr((seed+3)*(i+2)*11+i*79+17);
    var mOff=Math.floor(p1*16); // 0~15 → 2025-01 ~ 2026-04
    var rYr=mOff>=12?2026:2025;
    var rMo=mOff>=12?(mOff-11):(mOff+1);
    var rDy=Math.floor(p2*27)+1;
    reviews.push({score:rcItem.score, text:rcItem.text, date:rYr+"-"+String(rMo).padStart(2,"0")+"-"+String(rDy).padStart(2,"0")});
  }
  // 최신순 정렬
  reviews.sort(function(a,b){return b.date>a.date?1:b.date<a.date?-1:0;});
  var avgScore=reviews.length?Math.round(reviews.reduce(function(s,r){return s+r.score;},0)/reviews.length*10)/10:4.5;
  // 재거래율: 하자 없고 별점 높을수록 높게
  var reorderBase = claimCnt===0 ? 0.78 : claimCnt===1 ? 0.62 : 0.45;
  var reorderRate = Math.min(98, Math.round((reorderBase + sr(seed*101)*0.20)*100));
  // 구매자 평가 태그 (판매자가 구매자를 평가하는 항목)
  var buyerTags = ["대금 신속", "소통 원활", "재거래 의향", "정확한 주문"];
  var introIdx = baseData.introIdx!=null ? baseData.introIdx : Math.floor(sr(seed*137+19)*20);
  return {
    name:baseData.name||CO[Math.floor(sr(seed*31+7)*CO.length)],
    intro:SELLER_INTROS[introIdx],
    owner:baseData.owner||(SN[Math.floor(sr(seed*13+3)*SN.length)]+"○○"),
    phone:baseData.phone||("0"+(Math.floor(sr(seed*97+11)*2)+1)+"-****-"+String(Math.floor(sr(seed*53+19)*9000)+1000)),
    canContact:baseData.canContact!=null?baseData.canContact:sr(seed*71+41)>0.35,
    rating:String(avgScore),
    deals:baseData.deals||Math.floor(80+sr(seed*61)*600),
    career:baseData.career||Math.floor(5+sr(seed*43)*20),
    mainItems:[],
    bizCert:true,
    escrow:true,
    claimCount:claimCnt,
    reviews:reviews,
    reorderRate:reorderRate,
    buyerTags:buyerTags,
  };
}

function buildRecords(dateStr, offset) {
  var list=[], idx=0;
  MARKETS.forEach(function(market) {
    ITEMS.forEach(function(item) {
      item.grades.forEach(function(grade) {
        var rc=1+Math.floor(sr(market.id*7+item.base+grade.charCodeAt(0)+offset)*2);
        for(var r=0;r<rc;r++){
          var seed=market.id*100000+item.base*10+grade.charCodeAt(0)*100+r*777+offset*9999+idx;
          var msList=MARKET_SELLERS[market.id]||[];
          var msIdx=(r+Math.floor(seed%msList.length))%Math.max(1,msList.length);
          var msBase=msList[msIdx]||msList[0];
          var seller=makeSeller(seed+idx*13,msBase); seller.mainItems=[item.name];
          var price=Math.round((item.base*(0.78+sr(seed+2)*0.44))/100)*100;
          var hour=4+Math.floor(sr(seed+4)*5), min=Math.floor(sr(seed+5)*60);
          list.push({
            id:idx,
            date:dateStr+" "+String(hour).padStart(2,"0")+":"+String(min).padStart(2,"0"),
            market, item, grade,
            qty:5+Math.floor(sr(seed+6)*200),
            price, seller,
            available:true,
            remainQty:5+Math.floor(sr(seed+8)*100),
          });
          idx++;
        }
      });
    });
  });
  return list.sort(function(a,b){ return a.price-b.price; });
}

var REC_TODAY=buildRecords(TODAY,1), REC_YEST=buildRecords(YESTERDAY,2);
var ALL_REC={}; ALL_REC[TODAY]=REC_TODAY; ALL_REC[YESTERDAY]=REC_YEST;
var REGIONS=["전체"].concat(Array.from(new Set(MARKETS.map(function(m){return m.region;}))));
var CATEGORIES=["전체"].concat(Array.from(new Set(ITEMS.map(function(i){return i.cat;}))));
var DEST_REGIONS=["서울","경기","인천","강원","충북","충남","전북","전남","광주","대전","경북","대구","경남","부산","울산"];

var G={dark:"#0d2b1a",mid:"#1b4332",main:"#2d6a4f",light:"#40916c",pale:"#d1fae5",bg:"#f0fdf4",border:"#bbf7d0"};

// ── 사진 뷰어 모달 ──
function PhotoModal(props) {
  var record=props.record, onClose=props.onClose;
  var item=record.item, grade=record.grade, seller=record.seller, market=record.market;
  var tabs=[
    {key:"front",  label:"포장 전면", icon:"📦", desc:"출하 박스 전면. 등급 라벨·도매시장 검인 확인 가능"},
    {key:"side",   label:"측면·등급", icon:"🏷️", desc:"등급 스티커 및 원산지 표시. 경락일자·낙찰번호 인쇄"},
    {key:"qty",    label:"수량 확인", icon:"🔢", desc:item.qtyDesc+". 팩·박스 개수 및 중량 라벨 촬영"},
    {key:"video",  label:"영상",      icon:"🎥", desc:"출하 직전 영상. 실시간 신선도·포장 상태 확인"},
  ];
  var s1=useState("front"); var activeTab=s1[0]; var setActiveTab=s1[1];
  var cur=tabs.find(function(t){return t.key===activeTab;});

  var contentBg = activeTab==="video" ? "#0d1117" : "#f0fdf4";
  var contentColor = activeTab==="video" ? "#fff" : "#1b4332";

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:22,maxWidth:420,width:"100%",overflow:"hidden",boxShadow:"0 32px 80px rgba(0,0,0,0.5)",maxHeight:"88vh",overflowY:"auto"}} onClick={function(e){e.stopPropagation();}}>
        {/* 헤더 */}
        <div style={{background:"linear-gradient(135deg,#0d2b1a,#2d6a4f)",padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{color:"#fff",fontWeight:800,fontSize:15}}>{item.name} {grade}등급 — 상품 사진</div>
            <div style={{color:"rgba(255,255,255,0.65)",fontSize:11,marginTop:2}}>{seller.name} · {market.name} · 경락 당일 촬영</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:13,fontWeight:700}}>✕</button>
        </div>

        {/* 탭 메뉴 */}
        <div style={{display:"flex",background:"#f9fafb",borderBottom:"1px solid #e5e7eb"}}>
          {tabs.map(function(t) {
            var active=activeTab===t.key;
            return (
              <button key={t.key} onClick={function(){setActiveTab(t.key);}}
                style={{flex:1,padding:"10px 4px",border:"none",background:"transparent",borderBottom:active?"2.5px solid #1b4332":"2.5px solid transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <span style={{fontSize:16}}>{t.icon}</span>
                <span style={{fontSize:10,fontWeight:active?800:400,color:active?"#1b4332":"#888"}}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* 메인 콘텐츠 */}
        <div style={{background:contentBg,minHeight:220,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,gap:10}}>
          {activeTab==="video"
            ? <>
                <div style={{fontSize:56}}>▶️</div>
                <div style={{color:"#fff",fontWeight:700,fontSize:15}}>{item.name} {grade}등급 출하 영상</div>
                <div style={{color:"rgba(255,255,255,0.6)",fontSize:12,textAlign:"center"}}>새벽 {record.date.split(" ")[1]} 출하장 촬영<br/>포장 상태 및 수량 실물 확인 가능</div>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <span style={{background:"#22c55e",color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700}}>🔴 LIVE 녹화본</span>
                  <span style={{background:"rgba(255,255,255,0.15)",color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:11}}>재생시간 2분 14초</span>
                </div>
              </>
            : <>
                <div style={{fontSize:72}}>{item.emoji}</div>
                <div style={{fontWeight:700,fontSize:16,color:"#1b4332"}}>{item.name} {grade}등급</div>
                <div style={{fontSize:12,color:"#555",textAlign:"center"}}>{market.name} 경락 당일 출하 물량</div>
                {activeTab==="qty" && (
                  <div style={{background:"#fff",borderRadius:10,padding:"10px 14px",marginTop:4,border:"1px solid #bbf7d0",textAlign:"left",width:"100%"}}>
                    <div style={{fontSize:11,color:"#1b4332",fontWeight:700,marginBottom:4}}>수량 확인 방법</div>
                    <div style={{fontSize:12,color:"#555",lineHeight:1.7}}>{cur.desc}</div>
                    <div style={{fontSize:11,color:"#888",marginTop:6}}>낙찰 수량: <b>{record.qty}box</b> · 잔여: <b>{record.remainQty}box</b></div>
                  </div>
                )}
              </>
          }
        </div>

        {/* 탭 설명 */}
        {activeTab!=="qty" && (
          <div style={{padding:"10px 16px",background:"#f8fffe",borderTop:"1px solid #e5e7eb"}}>
            <div style={{fontSize:12,color:"#555"}}>{cur.desc}</div>
          </div>
        )}

        {/* 인증 정보 */}
        <div style={{padding:"12px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0"}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
            <span style={{background:"#dcfce7",color:"#166534",fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 8px"}}>✅ 사업자 인증</span>
            {seller.escrow&&<span style={{background:"#dbeafe",color:"#1e40af",fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 8px"}}>✅ 직거래</span>}
            <span style={{background:"#fef3c7",color:"#92400e",fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 8px"}}>📋 경락 데이터 연동</span>
            <span style={{background:"#f3e8ff",color:"#6b21a8",fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 8px"}}>🎥 영상 인증</span>
          </div>
          <div style={{fontSize:10,color:"#888"}}>촬영: {record.date} · {market.name} 출하장 · 위·변조 방지 블록체인 기록</div>
        </div>
      </div>
    </div>
  );
}

// ── 채팅 엔진 ──
function extractQty(txt){var m=txt.match(/(\d+)/);return m?parseInt(m[1],10):null;}
function classifyIntent(raw){
  var t=raw.replace(/\s/g,"");
  if(/(\d+)(박스|box)/.test(t)&&/가능|살게|주세요|됩니까|구매|할게/.test(t))return"qty_confirm";
  if(/^[\d]+$/.test(t.trim()))return"qty_number_only";
  if(/(\d+)(박스|box|개)/.test(t))return"qty_check";
  if(/물류비|배송비|운임|택배비/.test(t))return"freight";
  if(/언제|몇시|도착|소요/.test(t))return"arrival";
  if(/얼마|가격|단가|견적/.test(t))return"price";
  if(/할인|깎|네고|싸게|저렴/.test(t))return"discount";
  if(/재고|몇박스|남아있/.test(t))return"stock";
  if(/오늘|당일/.test(t))return"today";
  if(/내일|새벽|납품일|일정/.test(t))return"delivery";
  if(/신선|품질|맛|당도|믿|보장/.test(t))return"quality";
  if(/사기|에스크로|안전|보호/.test(t))return"trust";
  if(/사진|영상|실물/.test(t))return"photo";
  if(/결제|계좌|세금계산서/.test(t))return"payment";
  if(/정기|단골|계약/.test(t))return"regular";
  if(/샘플|체험/.test(t))return"sample";
  if(/안녕|반갑|처음/.test(t))return"greeting";
  if(/감사|고마|알겠|생각해볼/.test(t))return"closing";
  if(/^(네|ㅇ|응|맞아|좋아요|ok)$/.test(t))return"agree";
  return"unknown";
}
function getReply(input,info,histLen,lastIntent,destRegion){
  var p=info.price,remain=info.remainQty,iname=info.itemName,grade=info.grade,unit=info.unit;
  var mname=info.marketName,sname=info.sellerName,from=info.marketRegion;
  var intent=classifyIntent(input),qty=extractQty(input);
  function lg(n){
    if(!destRegion)return "";
    var l=calcLogistics(from,destRegion,n||10,"cj");
    return "\n\n🚚 "+destRegion+" "+l.arriveStr+" 도착 예정 (CJ대한통운 로킷 기준)\n물류비 "+l.totalFreight.toLocaleString()+"원 (box당 "+l.ratePerBox.toLocaleString()+"원)\n※ 한진 냉장특송·롯데글로벌로지스 선택 시 요금·도착시간이 달라질 수 있습니다.";
  }
  if(intent==="qty_confirm"||intent==="qty_check"){
    var n=qty||2;
    if(n<5)return n+"box는 최소 출고(5box)보다 적어 어렵습니다 😅 5box 이상부터 출고 가능해요!";
    if(n<=remain)return n+"box 가능합니다 ✅\n경락가 총 "+(p*n).toLocaleString()+"원"+lg(n)+"\n에스크로 결제로 안전하게 진행할 수 있어요 🔒";
    return "현재 "+remain+"box 재고라 "+n+"box 전량은 어렵고 "+remain+"box까지 가능합니다 📦";
  }
  if(intent==="qty_number_only"){
    var nn=parseInt(input.trim(),10);
    if(lastIntent==="price"||lastIntent==="discount"){
      var disc=nn>=100?0.90:nn>=50?0.94:nn>=30?0.96:1;
      var dp=Math.round(p*disc/100)*100;
      return nn+"box → 박스당 "+dp.toLocaleString()+"원, 총 "+(dp*nn).toLocaleString()+"원"+(disc<1?" (수량 할인 적용) 😊":"")+lg(nn);
    }
    if(nn<5)return nn+"box는 최소 물량(5box)보다 적습니다 😅";
    if(nn<=remain)return nn+"box 가능합니다 ✅ 총 "+(p*nn).toLocaleString()+"원이에요."+lg(nn);
    return "현재 "+remain+"box 재고라 "+nn+"box 전량은 어렵습니다. "+remain+"box 바로 가능해요 📦";
  }
  if(intent==="freight"){
    if(destRegion){
      var b=qty||10;
      var lCJ=calcLogistics(from,destRegion,b,"cj");
      var lHJ=calcLogistics(from,destRegion,b,"hanjin");
      var lLT=calcLogistics(from,destRegion,b,"lotte");
      return destRegion+"까지 "+b+"box 기준 물류비 안내입니다 🚛\n\n"+
        "🚛 CJ대한통운 로킷: "+lCJ.totalFreight.toLocaleString()+"원 · "+lCJ.arriveStr+"\n"+
        "🚚 한진 냉장특송: "+lHJ.totalFreight.toLocaleString()+"원 · "+lHJ.arriveStr+"\n"+
        "🏎️ 롯데글로벌로지스: "+lLT.totalFreight.toLocaleString()+"원 · "+lLT.arriveStr+"\n\n"+
        "택배사별 요금·도착시간이 다르니 에스크로 결제 시 직접 선택해 주세요!";
    }
    return "납품 지역을 알려주시면 택배사별 물류비와 도착시간 계산해 드릴게요 🚛";
  }
  if(intent==="arrival"){
    if(destRegion){
      var lc=calcLogistics(from,destRegion,10,"cj");
      var lh=calcLogistics(from,destRegion,10,"hanjin");
      return "택배사별 도착 예정 시간입니다 🕐\n\n"+
        "🚛 CJ대한통운 로킷: "+lc.arriveStr+" (새벽 5시 출고)\n"+
        "🚚 한진 냉장특송: "+lh.arriveStr+" (새벽 3시 출고 · 더 빨라요!)\n\n"+
        "에스크로 결제 시 원하시는 택배사를 직접 선택하실 수 있어요!";
    }
    return "납품 지역 알려주시면 택배사별 도착 예정 시간 계산해 드릴게요 🕐";
  }
  if(intent==="price")return "오늘 경락가 박스당 "+p.toLocaleString()+"원입니다 ("+unit+" 기준) 😊 몇 박스 필요하세요?";
  if(intent==="discount"){var d30=Math.round(p*.96/100)*100,d50=Math.round(p*.94/100)*100,d100=Math.round(p*.90/100)*100;return "수량별 할인 단가입니다 💪\n30box → "+d30.toLocaleString()+"원/box\n50box → "+d50.toLocaleString()+"원/box\n100box↑ → "+d100.toLocaleString()+"원/box\n몇 박스 생각하세요?";}
  if(intent==="stock")return "현재 "+remain+"box 재고 있습니다 📦 "+iname+" "+grade+"등급, "+unit+" 단위 출고예요.";
  if(intent==="today")return "오늘 출고는 오후 2시 이전 확정 시 가능합니다 🚚 납품 지역 알려주시면 당일 도착 가능 여부 확인해 드릴게요!";
  if(intent==="delivery")return "내일 새벽 5시 출고 가능합니다 🌙"+lg(10);
  if(intent==="quality"){
    if(grade==="특")return iname+" 특등급은 크기·당도·외관 모두 최상급입니다 🌟 당일 경락 출하라 신선도 확실해요!";
    if(grade==="상")return "상등급이지만 맛은 특등급과 거의 같아요 😊 크기 균일도만 조금 다를 뿐이고 가성비 최고입니다!";
    return "보통등급이라 가격이 저렴한 대신 크기 편차가 있어요. 가공용·대량 납품엔 딱 맞습니다 👍";
  }
  if(intent==="trust")return "에스크로 결제 지원 업체입니다 🔒\n수령 확인 후 대금 지급 구조라 먹튀 위험 없어요.\n수령 후 36시간 내 이의 신청도 가능합니다!";
  if(intent==="photo")return "사진·영상은 카드 하단 사진 탭에서 확인하실 수 있어요 📸 경락 당일 촬영본이라 신선도·포장 상태 직접 확인 가능합니다!";
  if(intent==="payment")return "현금·계좌이체·세금계산서 모두 가능합니다 📋 에스크로 결제 권장드려요. 수령 36시간 후 자동 구매확정됩니다!";
  if(intent==="regular")return "정기 거래 환영합니다 🤝 주 1회 이상이면 단가 추가 협의 드리고 원하시는 수량·등급 미리 예약도 가능해요!";
  if(intent==="sample")return "첫 거래 시 1~2box 체험 가능합니다 😊 에스크로 결제로 안심하고 진행하세요!";
  if(intent==="greeting")return sname+"입니다, 반갑습니다 😊\n"+iname+" "+grade+"등급 현재 "+remain+"box 재고 있어요.\n납품 지역·수량 알려주시면 물류비·도착시간 한번에 안내드릴게요!";
  if(intent==="agree")return "좋습니다! 납품 주소와 담당자 성함 알려주시면 바로 진행하겠습니다 ✅\n에스크로 결제로 진행하시면 36시간 내 자동 구매확정됩니다 🔒";
  if(intent==="closing")return "네, 편하게 생각해 보세요 😊 재고 "+remain+"box 선착순이니 결정되시면 빠르게 연락 주세요 🙏";
  var fb=["어떤 부분이 궁금하신지 말씀해 주시겠어요? 가격·수량·납품 지역 알려주시면 한번에 안내드릴게요 😊","납품 지역 알려주시면 물류비와 도착 예정 시간 바로 계산해 드릴게요 📦"];
  return fb[histLen%fb.length];
}

// ── 채팅 모달 ──
function ChatModal(props) {
  var record=props.record, onClose=props.onClose;
  var seller=record.seller,item=record.item,market=record.market,grade=record.grade,price=record.price,remainQty=record.remainQty,qty=record.qty;
  var info={sellerName:seller.name,marketName:market.name,marketRegion:market.region,career:seller.career,itemName:item.name,grade:grade,unit:item.unit,price:price,qty:qty,remainQty:remainQty};
  var initMsg="안녕하세요! "+seller.name+" 영업팀입니다 😊\n"+item.name+" "+grade+"등급 현재 "+remainQty+"box 재고 있습니다.\n납품 지역·수량 알려주시면 물류비·도착시간 한번에 안내드릴게요!";
  var ms=useState([{from:"seller",text:initMsg,time:new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}]);
  var msgs=ms[0]; var setMsgs=ms[1];
  var hs=useState([]); var history=hs[0]; var setHistory=hs[1];
  var li=useState(""); var lastIntent=li[0]; var setLastIntent=li[1];
  var inp=useState(""); var input=inp[0]; var setInput=inp[1];
  var ty=useState(false); var typing=ty[0]; var setTyping=ty[1];
  var dr=useState(""); var destRegion=dr[0]; var setDestRegion=dr[1];
  var bottomRef=useRef(null);
  useEffect(function(){if(bottomRef.current)bottomRef.current.scrollIntoView({behavior:"smooth"});},[msgs,typing]);
  function getNow(){return new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});}
  function doSend(txt){
    if(!txt||typing)return;
    setInput("");
    setMsgs(function(m){return m.concat([{from:"buyer",text:txt,time:getNow()}]);});
    setTyping(true);
    var newH=history.concat([txt]); setHistory(newH);
    var intent=classifyIntent(txt); setLastIntent(intent);
    var newDR=destRegion; DEST_REGIONS.forEach(function(r){if(txt.includes(r))newDR=r;}); if(newDR!==destRegion)setDestRegion(newDR);
    setTimeout(function(){
      var reply=getReply(txt,info,newH.length,lastIntent,newDR);
      setMsgs(function(m){return m.concat([{from:"seller",text:reply,time:getNow()}]);});
      setTyping(false);
    },700+Math.floor(Math.random()*600));
  }
  var qb=["가격 얼마예요?","재고 몇 박스?","할인 되나요?","물류비 알려주세요","내일 납품 가능해요?","에스크로 가능해요?"];
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:420,height:620,background:"#fff",borderRadius:22,display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 32px 80px rgba(0,0,0,0.35)"}}>
        <div style={{background:"linear-gradient(135deg,#0d2b1a,#2d6a4f)",padding:"13px 18px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div style={{width:40,height:40,borderRadius:11,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{item.emoji}</div>
          <div style={{flex:1}}>
            <div style={{color:"#fff",fontWeight:800,fontSize:15}}>{seller.name}</div>
            <div style={{color:"rgba(255,255,255,0.65)",fontSize:11}}>{market.name} · {item.name} {grade}등급</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 6px #4ade80"}}/>
              <span style={{color:"rgba(255,255,255,0.7)",fontSize:10}}>온라인</span>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:700}}>✕</button>
          </div>
        </div>
        <div style={{background:"#f0fdf4",borderBottom:"1px solid #bbf7d0",padding:"6px 14px",display:"flex",gap:8,fontSize:11,color:"#166534",flexWrap:"wrap",flexShrink:0}}>
          <span>{item.emoji} {item.name} {grade}등급</span><span style={{color:"#ccc"}}>|</span>
          <span>경락가 <b>{price.toLocaleString()}원</b></span><span style={{color:"#ccc"}}>|</span>
          <span>잔여 <b>{remainQty}box</b></span>
        </div>
        <div style={{background:"#fffbeb",borderBottom:"1px solid #fde68a",padding:"5px 12px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <span style={{fontSize:11,color:"#92400e",fontWeight:600,whiteSpace:"nowrap"}}>📍 납품 지역</span>
          <select value={destRegion} onChange={function(e){setDestRegion(e.target.value);}} style={{border:"1px solid #fde68a",borderRadius:7,padding:"3px 8px",fontSize:12,background:"#fff",outline:"none",flex:1}}>
            <option value="">선택시 물류비 자동계산</option>
            {DEST_REGIONS.map(function(r){return <option key={r} value={r}>{r}</option>;})}
          </select>
        </div>
        {destRegion&&(function(){var l=calcLogistics(market.region,destRegion,10,"cj");return <div style={{background:"#eff6ff",borderBottom:"1px solid #bfdbfe",padding:"5px 14px",display:"flex",gap:10,fontSize:11,color:"#1e40af",flexShrink:0}}><span>🚚 CJ기준 10box</span><span>물류비 <b>{l.totalFreight.toLocaleString()}원</b></span><span style={{color:"#93c5fd"}}>|</span><span>도착 <b>{l.arriveStr}</b></span></div>;}())}
        <div style={{background:"#fafff8",borderBottom:"1px solid #e8f5e9",padding:"5px 12px",display:"flex",gap:5,flexWrap:"wrap",flexShrink:0}}>
          {qb.map(function(q){return <button key={q} onClick={function(){doSend(q);}} disabled={typing} style={{background:"#fff",border:"1px solid #bbf7d0",borderRadius:18,padding:"3px 9px",fontSize:10,color:"#166534",cursor:typing?"not-allowed":"pointer",fontWeight:600,opacity:typing?0.5:1}}>{q}</button>;})}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 12px",display:"flex",flexDirection:"column",gap:10,background:"#fafff8"}}>
          {msgs.map(function(m,i){return (
            <div key={i} style={{display:"flex",justifyContent:m.from==="buyer"?"flex-end":"flex-start",alignItems:"flex-end",gap:6}}>
              {m.from==="seller"&&<div style={{width:28,height:28,borderRadius:7,background:"#d1fae5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{item.emoji}</div>}
              <div style={{maxWidth:"76%"}}>
                <div style={{background:m.from==="buyer"?"linear-gradient(135deg,#0d2b1a,#2d6a4f)":"#fff",color:m.from==="buyer"?"#fff":"#1a2e1a",borderRadius:m.from==="buyer"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"9px 13px",fontSize:13,lineHeight:1.65,boxShadow:"0 2px 8px rgba(0,0,0,0.07)",whiteSpace:"pre-line"}}>{m.text}</div>
                <div style={{fontSize:9,color:"#aaa",marginTop:2,textAlign:m.from==="buyer"?"right":"left"}}>{m.time}</div>
              </div>
            </div>
          );})}
          {typing&&<div style={{display:"flex",alignItems:"flex-end",gap:6}}>
            <div style={{width:28,height:28,borderRadius:7,background:"#d1fae5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{item.emoji}</div>
            <div style={{background:"#fff",borderRadius:"18px 18px 18px 4px",padding:"10px 14px",boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
              <div style={{display:"flex",gap:4}}>{[0,1,2].map(function(i){return <div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#aaa",animation:"bounce 1s "+(i*0.25)+"s infinite"}}/>;})}</div>
            </div>
          </div>}
          <div ref={bottomRef}/>
        </div>
        <div style={{padding:"9px 12px",borderTop:"1px solid #e5e7eb",display:"flex",gap:8,background:"#fff",flexShrink:0}}>
          <input value={input} onChange={function(e){setInput(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")doSend(input.trim());}} placeholder="지역 입력시 물류비 자동계산..." disabled={typing} style={{flex:1,border:"1.5px solid #bbf7d0",borderRadius:11,padding:"9px 13px",fontSize:13,outline:"none",background:typing?"#f5f5f5":"#f0fdf4",fontFamily:"inherit"}}/>
          <button onClick={function(){doSend(input.trim());}} disabled={typing||!input.trim()} style={{background:(typing||!input.trim())?"#ccc":"linear-gradient(135deg,#0d2b1a,#2d6a4f)",color:"#fff",border:"none",borderRadius:11,padding:"0 16px",fontSize:15,cursor:(typing||!input.trim())?"not-allowed":"pointer"}}>▶</button>
        </div>
      </div>
      <style>{"@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}"}</style>
    </div>
  );
}




// 판매자 답변 샘플
var SELLER_REPLIES = [
  "소중한 리뷰 감사합니다. 다음에도 좋은 품질로 보답하겠습니다 😊",
  "말씀하신 부분 개선하겠습니다. 앞으로도 잘 부탁드립니다.",
  "배송 지연으로 불편 드려 죄송합니다. 재발 방지하겠습니다.",
  "소중한 말씀 감사합니다. 더 노력하는 판매자가 되겠습니다!",
  "이런 리뷰 남겨주셔서 감사해요. 덕분에 더 잘할 수 있습니다 🙏",
];

function ReviewCards(props){
  var reviews=props.reviews, sellerName=props.sellerName;
  var rs=useState({}); var reported=rs[0]; var setReported=rs[1];
  var es=useState({}); var expanded=es[0]; var setExpanded=es[1];
  var ds=useState({}); var showReply=ds[0]; var setShowReply=ds[1];
  var cs=useState(null); var confirmIdx=cs[0]; var setConfirmIdx=cs[1];

  function toggleReport(i){
    if(reported[i])return;
    setConfirmIdx(i);
  }
  function doReport(i){
    setReported(function(r){var n=Object.assign({},r);n[i]=true;return n;});
    setConfirmIdx(null);
  }

  // 판매자 답변: 3점 이하 리뷰에만 + 하자/불만 키워드 포함 시
  function hasReply(rv){
    if(!rv||rv.score==null)return false;
    if(rv.score>3)return false;
    return true;
  }
  function getReply(rv){
    var txt=(rv&&rv.text)||"";
    if(!rv||rv.score<=1) return "소중한 말씀 감사합니다. 해당 건에 대해 확인 후 처리해 드렸습니다. 재발 방지하겠습니다.";
    if(txt.indexOf("하자")!==-1||txt.indexOf("환불")!==-1||txt.indexOf("부족")!==-1||txt.indexOf("부패")!==-1||txt.indexOf("물러")!==-1) return "불편 드려 진심으로 사과드립니다. 에스크로를 통해 처리해 드렸고, 품질 관리 더욱 철저히 하겠습니다.";
    if(txt.indexOf("늦")!==-1||txt.indexOf("배송")!==-1) return "배송 지연으로 불편 드려 죄송합니다. 출하 일정 더욱 꼼꼼히 관리하겠습니다.";
    if(txt.indexOf("등급")!==-1||txt.indexOf("편차")!==-1||txt.indexOf("크기")!==-1) return "등급 선별 기준 더욱 엄격히 적용하겠습니다. 소중한 피드백 감사합니다.";
    if(txt.indexOf("연락")!==-1||txt.indexOf("응대")!==-1||txt.indexOf("기다")!==-1) return "응대가 늦어 죄송합니다. 채팅 알림 설정을 개선해 빠르게 답변드리겠습니다.";
    return "소중한 피드백 감사합니다. 더 나은 서비스로 보답하겠습니다 🙏";
  }

  return (
    <div>
      {/* 신고 확인 모달 */}
      {confirmIdx!==null&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"#fff",borderRadius:16,padding:22,maxWidth:300,width:"100%",boxShadow:"0 16px 40px rgba(0,0,0,0.3)"}}>
          <div style={{fontWeight:800,fontSize:15,color:"#dc2626",marginBottom:8}}>🚩 리뷰 신고</div>
          <div style={{fontSize:13,color:"#555",lineHeight:1.7,marginBottom:14}}>이 리뷰를 신고하시겠습니까?<br/><span style={{fontSize:11,color:"#dc2626"}}>⚠️ 허위 신고 시 계정 이용이 제한될 수 있습니다.</span></div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={function(){setConfirmIdx(null);}} style={{flex:1,background:"#f3f4f6",border:"none",borderRadius:10,padding:"10px 0",fontSize:13,fontWeight:600,cursor:"pointer",color:"#666"}}>취소</button>
            <button onClick={function(){doReport(confirmIdx);}} style={{flex:1,background:"linear-gradient(135deg,#7f1d1d,#dc2626)",border:"none",borderRadius:10,padding:"10px 0",fontSize:13,fontWeight:800,cursor:"pointer",color:"#fff"}}>신고하기</button>
          </div>
        </div>
      </div>}
      {reviews.map(function(rv,i){
        var isReported=reported[i];
        var isExpanded=expanded[i];
        var longText=rv.text.length>60;
        var displayText=longText&&!isExpanded?rv.text.slice(0,60)+"...":rv.text;
        var hasRep=hasReply(rv);

        return (
          <div key={i} style={{background:isReported?"#f9fafb":"#fff",borderRadius:12,border:"1px solid "+(isReported?"#e5e7eb":"#e5e7eb"),marginBottom:9,overflow:"hidden",opacity:isReported?0.6:1}}>
            {/* 리뷰 헤더 */}
            <div style={{padding:"11px 13px 6px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:13,color:"#f59e0b",letterSpacing:1}}>{"★".repeat(rv.score)+"☆".repeat(5-rv.score)}</span>
                  <span style={{fontSize:10,fontWeight:700,color:rv.score>=4?"#166534":rv.score>=3?"#92400e":"#dc2626"}}>{rv.score}.0</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:10,color:"#aaa"}}>{rv.date}</span>

                </div>
              </div>
              <div style={{fontSize:12,color:isReported?"#aaa":"#374151",lineHeight:1.65}}>
                {isReported?"🚫 신고 접수된 리뷰입니다. 검토 중입니다.":displayText}
              </div>
              {longText&&!isReported&&<button onClick={function(){setExpanded(function(e){var n=Object.assign({},e);n[i]=!e[i];return n;});}} style={{fontSize:10,color:"#2563eb",background:"none",border:"none",cursor:"pointer",padding:"3px 0",marginTop:1}}>{isExpanded?"접기 ▲":"더보기 ▼"}</button>}
            </div>

            {/* 판매자 답변 */}
            {hasRep&&!isReported&&<div style={{background:"#f8fffe",borderLeft:"3px solid #2d6a4f",margin:"0 13px 10px",borderRadius:"0 8px 8px 0",padding:"8px 10px"}}>
              <div style={{fontSize:10,color:G.mid,fontWeight:700,marginBottom:3}}>💬 판매자 {sellerName} 답변</div>
              <div style={{fontSize:11,color:"#374151",lineHeight:1.6}}>{getReply(i)}</div>
            </div>}

            {/* 하단 액션 */}
            {!isReported&&<div style={{padding:"6px 13px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",gap:5}}>
                <button onClick={function(){setShowReply(function(s){var n=Object.assign({},s);n[i]=!s[i];return n;});}} style={{fontSize:10,color:"#888",background:"#f3f4f6",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>
                  {showReply[i]?"답변 숨기기":"💬 답변 보기"}
                </button>
              </div>
              <button onClick={function(){toggleReport(i);}} style={{fontSize:10,color:"#dc2626",background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>
                🚩 신고
              </button>
            </div>}
          </div>
        );
      })}
      <div style={{fontSize:10,color:"#aaa",textAlign:"center",marginTop:4}}>
        모든 리뷰는 실제 거래 완료 후에만 작성 가능합니다 · 허위 신고 시 계정 제한
      </div>
    </div>
  );
}

function NormalReviewSection(){
  var rs=useState(0); var rating=rs[0]; var setRating=rs[1];
  var hs=useState(0); var hover=hs[0]; var setHover=hs[1];
  var ts=useState(""); var reviewText=ts[0]; var setReviewText=ts[1];
  var ss=useState(false); var submitted=ss[0]; var setSubmitted=ss[1];
  if(submitted) return (
    <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:14,textAlign:"center",marginBottom:12}}>
      <div style={{fontSize:24,marginBottom:4}}>✅</div>
      <div style={{fontWeight:700,fontSize:13,color:G.mid}}>리뷰가 등록되었습니다</div>
      <div style={{fontSize:11,color:"#888",marginTop:3}}>{"⭐".repeat(rating)} · {reviewText.slice(0,30)}{reviewText.length>30?"...":""}</div>
    </div>
  );
  return (
    <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:12,padding:14,marginBottom:12,textAlign:"left"}}>
      <div style={{fontWeight:700,fontSize:13,color:G.mid,marginBottom:8}}>⭐ 거래 리뷰 남기기</div>
      <div style={{display:"flex",gap:4,justifyContent:"center",marginBottom:8}}>
        {[1,2,3,4,5].map(function(s){var f=s<=(hover||rating);return <div key={s} onClick={function(){setRating(s);}} onMouseEnter={function(){setHover(s);}} onMouseLeave={function(){setHover(0);}} style={{fontSize:28,cursor:"pointer",color:f?"#f59e0b":"#d1d5db"}}>★</div>;})}
      </div>
      {rating>0&&<div style={{textAlign:"center",fontSize:11,color:"#f59e0b",fontWeight:700,marginBottom:7}}>{["","최악이에요","별로예요","보통이에요","좋았어요","최고예요!"][rating]}</div>}
      <textarea value={reviewText} onChange={function(e){setReviewText(e.target.value);}} placeholder="거래 경험을 남겨주세요." style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"8px 10px",fontSize:12,outline:"none",fontFamily:"inherit",resize:"vertical",minHeight:60,boxSizing:"border-box",marginBottom:7}}/>
      <button onClick={function(){if(rating===0){alert("별점을 선택해 주세요.");return;}setSubmitted(true);}} style={{width:"100%",background:rating>0?"linear-gradient(135deg,#374151,#6b7280)":"#e5e7eb",color:rating>0?"#fff":"#aaa",border:"none",borderRadius:9,padding:"9px 0",fontSize:12,fontWeight:700,cursor:rating>0?"pointer":"not-allowed"}}>리뷰 등록</button>
    </div>
  );
}

function ReviewSection(){
  var rs=useState(0); var rating=rs[0]; var setRating=rs[1];
  var hs=useState(0); var hover=hs[0]; var setHover=hs[1];
  var ts=useState(""); var reviewText=ts[0]; var setReviewText=ts[1];
  var ss=useState(false); var submitted=ss[0]; var setSubmitted=ss[1];
  if(submitted) return (
    <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:14,padding:16,textAlign:"center",marginBottom:14}}>
      <div style={{fontSize:28,marginBottom:6}}>✅</div>
      <div style={{fontWeight:700,fontSize:14,color:G.mid}}>리뷰가 등록되었습니다</div>
      <div style={{fontSize:12,color:"#888",marginTop:4}}>{"⭐".repeat(rating)} {rating}.0점</div>
      <div style={{fontSize:12,color:"#555",marginTop:6,lineHeight:1.6}}>{reviewText}</div>
    </div>
  );
  return (
    <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:14,padding:16,marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:14,color:G.mid,marginBottom:4}}>⭐ 거래 리뷰 남기기</div>
      <div style={{fontSize:11,color:"#888",marginBottom:10}}>판매자 리뷰를 남겨주세요. 판매자도 구매자를 평가합니다.</div>
      {/* 별점 */}
      <div style={{display:"flex",gap:5,justifyContent:"center",marginBottom:10}}>
        {[1,2,3,4,5].map(function(s){
          var filled=s<=(hover||rating);
          return <div key={s} onClick={function(){setRating(s);}}
            onMouseEnter={function(){setHover(s);}} onMouseLeave={function(){setHover(0);}}
            style={{fontSize:32,cursor:"pointer",color:filled?"#f59e0b":"#d1d5db",transition:"color 0.1s"}}>★</div>;
        })}
      </div>
      {rating>0&&<div style={{textAlign:"center",fontSize:12,color:"#f59e0b",fontWeight:700,marginBottom:8}}>{["","최악이에요","별로예요","보통이에요","좋았어요","최고예요!"][rating]}</div>}
      {/* 텍스트 */}
      <textarea value={reviewText} onChange={function(e){setReviewText(e.target.value);}}
        placeholder="거래 경험을 자세히 남겨주세요. 다른 구매자에게 큰 도움이 됩니다."
        style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:9,padding:"9px 11px",fontSize:12,outline:"none",fontFamily:"inherit",resize:"vertical",minHeight:70,boxSizing:"border-box",marginBottom:8}}/>
      <button onClick={function(){if(rating===0){alert("별점을 선택해 주세요.");return;}setSubmitted(true);}}
        style={{width:"100%",background:rating>0?"linear-gradient(135deg,#0d2b1a,#40916c)":"#e5e7eb",color:rating>0?"#fff":"#aaa",border:"none",borderRadius:10,padding:"10px 0",fontSize:13,fontWeight:700,cursor:rating>0?"pointer":"not-allowed"}}>
        리뷰 등록하기
      </button>
      <div style={{fontSize:10,color:"#aaa",textAlign:"center",marginTop:6}}>※ 허위 리뷰 작성 시 계정 이용이 제한될 수 있습니다</div>
    </div>
  );
}

// ── 에스크로 모달 ──
function EscrowModal(props) {
  var record=props.record, onClose=props.onClose, onClaim=props.onClaim, onOrderComplete=props.onOrderComplete;
  var ss=useState("select"); var step=ss[0]; var setStep=ss[1];
  var tt=useState("escrow"); var tradeType=tt[0]; var setTradeType=tt[1];
  var qs=useState(function(){return Math.min(10,record.remainQty);}); var qty=qs[0]; var setQty=qs[1];
  var ds=useState("서울"); var dest=ds[0]; var setDest=ds[1];
  var cs=useState(CARRIERS[0].id); var carrierId=cs[0]; var setCarrierId=cs[1];
  var ad=useState(""); var addrDetail=ad[0]; var setAddrDetail=ad[1];
  var ac=useState(""); var addrContact=ac[0]; var setAddrContact=ac[1];
  var ap=useState(""); var addrPhone=ap[0]; var setAddrPhone=ap[1];
  var ts=useState(36*3600); var timer=ts[0]; var setTimer=ts[1];
  var tas=useState(false); var timerActive=tas[0]; var setTimerActive=tas[1];
  var lg=calcLogistics(record.market.region,dest,qty,carrierId);
  var goodsAmt=record.price*qty;
  var escrowFee=0; // 보증금 방식 — 별도 수수료 없음
  var total=goodsAmt+lg.totalFreight;
  var steps=[["select","방식선택"],["input","주문입력"],["confirm","내용확인"],["payment","신청완료"],["shipped","배송중"],["received","수령확인"],["done","완료"]];
  useEffect(function(){if(!timerActive||timer<=0)return;var t=setTimeout(function(){setTimer(function(x){return x-1;});},1000);return function(){clearTimeout(t);};},[timerActive,timer]);
  function fmtT(s){var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");}
  var ai=steps.findIndex(function(x){return x[0]===step;});
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:500,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"8px 8px 0",overflowY:"auto",WebkitOverflowScrolling:"touch"}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:22,maxWidth:420,width:"100%",height:"90vh",maxHeight:660,overflowY:"auto",WebkitOverflowScrolling:"touch",boxShadow:"0 32px 80px rgba(0,0,0,0.35)"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{background:"linear-gradient(135deg,#1e3a5f,#2563eb)",padding:"16px 20px",borderRadius:"22px 22px 0 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{color:"#fff",fontWeight:900,fontSize:16}}>💳 보증금 안전거래</div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:700}}>✕</button>
          </div>
          <div style={{display:"flex",alignItems:"center"}}>
            {steps.map(function(s,i){
              var done=i<ai,cur=i===ai;
              return <div key={s[0]} style={{display:"flex",alignItems:"center",flex:1}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1}}>
                  <div style={{width:20,height:20,borderRadius:"50%",background:done?"#4ade80":cur?"#fff":"rgba(255,255,255,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:done?"#0d2b1a":cur?"#2563eb":"rgba(255,255,255,0.5)",marginBottom:2}}>{done?"✓":i+1}</div>
                  <div style={{fontSize:8,color:cur?"#fff":"rgba(255,255,255,0.5)",textAlign:"center",whiteSpace:"nowrap"}}>{s[1]}</div>
                </div>
                {i<steps.length-1&&<div style={{height:1,flex:1,background:done?"#4ade80":"rgba(255,255,255,0.2)",marginBottom:12}}/>}
              </div>;
            })}
          </div>
        </div>
        <div style={{padding:20}}>
          {step==="select"&&<div>
            <div style={{fontWeight:800,fontSize:15,color:G.mid,marginBottom:14}}>📋 거래 신청</div>
            <div style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:14,padding:16,marginBottom:14}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:44,height:44,borderRadius:12,background:G.mid,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🤝</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:15,color:G.mid}}>중도매인 직거래</div>
                  <div style={{fontSize:12,color:"#555",marginTop:4,lineHeight:1.7}}>중도매인과 소매업자를 직접 연결하는 공영 중계 플랫폼입니다.<br/>수수료 없이 경락가 정보를 공유하고 거래를 중계합니다.</div>
                </div>
              </div>
            </div>
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"10px 13px",fontSize:11,color:"#92400e",lineHeight:1.7,marginBottom:14}}>
              💡 이 플랫폼은 <b>수수료 없는 공영 중계 서비스</b>입니다.<br/>거래 조건·결제 방식은 판매자와 직접 협의하세요.
            </div>
            <button onClick={function(){setTradeType("normal");setStep("input");}} style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:13,padding:"14px 0",fontWeight:900,fontSize:15,cursor:"pointer"}}>
              거래 신청하기 →
            </button>
          </div>}

          {/* ── 일반거래 플로우 ── */}
          {step==="normal_input"&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontWeight:800,fontSize:14,color:G.mid}}>📦 일반거래 주문</div>
              <span style={{background:"#f3f4f6",color:"#6b7280",fontSize:11,fontWeight:700,borderRadius:6,padding:"3px 9px"}}>🤝 일반거래</span>
            </div>
            <div style={{background:"#f0fdf4",borderRadius:12,padding:"11px 14px",marginBottom:12,display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:28}}>{record.item.emoji}</span>
              <div><div style={{fontWeight:700,fontSize:14,color:"#0d1f15"}}>{record.item.name} {record.grade}등급</div><div style={{fontSize:12,color:"#666"}}>{record.market.name} · 박스당 {record.price.toLocaleString()}원</div></div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:12,color:"#888",fontWeight:700,display:"block",marginBottom:6}}>주문 수량</label>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                <button onClick={function(){setQty(Math.max(5,qty-1));}} style={{width:34,height:34,borderRadius:9,border:"1.5px solid #bbf7d0",background:"#f0fdf4",fontSize:18,cursor:"pointer",fontWeight:700,color:G.mid,flexShrink:0}}>−</button>
                <input type="number" value={qty} min={5} max={record.remainQty} onChange={function(e){var v=parseInt(e.target.value)||5;setQty(Math.min(record.remainQty,Math.max(5,v)));}} style={{flex:1,textAlign:"center",fontSize:20,fontWeight:900,color:G.mid,border:"1.5px solid #bbf7d0",borderRadius:9,padding:"6px 0",outline:"none",background:"#f0fdf4",fontFamily:"inherit"}}/>
                <button onClick={function(){setQty(Math.min(record.remainQty,qty+1));}} style={{width:34,height:34,borderRadius:9,border:"1.5px solid #bbf7d0",background:"#f0fdf4",fontSize:18,cursor:"pointer",fontWeight:700,color:G.mid,flexShrink:0}}>+</button>
              </div>
              <div style={{display:"flex",gap:5,marginBottom:4}}>
                {[5,10,20,30].map(function(n){var newQty=Math.min(record.remainQty,qty+n);var atMax=qty+n>record.remainQty;return <button key={n} onClick={function(){setQty(newQty);}} disabled={atMax} style={{flex:1,padding:"4px 0",fontSize:11,background:atMax?"#f3f4f6":"#f0fdf4",color:atMax?"#bbb":G.mid,border:"1px solid "+(atMax?"#e5e7eb":G.border),borderRadius:7,cursor:atMax?"not-allowed":"pointer",fontWeight:600}}>+{n}</button>;})}
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:12,color:"#888",fontWeight:700,display:"block",marginBottom:5}}>납품 지역</label>
              <select value={dest} onChange={function(e){setDest(e.target.value);}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:9,padding:"9px 11px",fontSize:13,background:"#f8fffe",outline:"none"}}>
                {DEST_REGIONS.map(function(r){return <option key={r} value={r}>{r}</option>;})}
              </select>
            </div>
            <div style={{background:"#f9fafb",borderRadius:11,padding:"11px 14px",marginBottom:8}}>
              {[["상품 금액",(record.price*qty).toLocaleString()+"원"],["물류비","판매자와 직접 협의"],["총 결제금액","협의 후 확정"]].map(function(r){return <div key={r[0]} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"#888"}}>{r[0]}</span><b style={{color:"#374151"}}>{r[1]}</b></div>;})}
            </div>
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"9px 13px",marginBottom:12,fontSize:11,color:"#92400e",lineHeight:1.7}}>
              💡 <b>플랫폼 제휴 택배 할인은 이 플랫폼 이용 시에만 적용됩니다.</b><br/>
              일반거래는 판매자와 직접 배송 방법·비용을 협의하시면 됩니다.
            </div>
            <div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 13px",marginBottom:14,fontSize:11,color:"#991b1b",lineHeight:1.7}}>
              ⚠️ 일반거래는 에스크로 보호가 적용되지 않습니다.<br/>결제 방법 및 조건은 판매자와 직접 협의하세요.
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={function(){setStep("select");}} style={{flex:1,background:"#fff",border:"1.5px solid #e5e7eb",color:"#666",borderRadius:13,padding:"12px 0",fontWeight:700,fontSize:13,cursor:"pointer"}}>← 뒤로</button>
              <button onClick={function(){setStep("normal_done");}} style={{flex:2,background:"linear-gradient(135deg,#374151,#6b7280)",color:"#fff",border:"none",borderRadius:13,padding:"12px 0",fontWeight:900,fontSize:13,cursor:"pointer"}}>🤝 주문 신청</button>
            </div>
          </div>}

          {step==="normal_done"&&<div style={{textAlign:"center",padding:"16px 0"}}>
            <div style={{fontSize:52,marginBottom:10}}>✅</div>
            <div style={{fontWeight:900,fontSize:19,color:G.mid,marginBottom:6}}>주문 신청 완료</div>
            <div style={{fontSize:13,color:"#666",lineHeight:1.8,marginBottom:16}}>
              <b>{record.seller.name}</b>에게 주문이 전달되었습니다.<br/>
              결제 방법 및 일정은 판매자와 직접 협의해 주세요.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16,textAlign:"left"}}>
              {[["주문 상태","📋 판매자 확인 대기"],["연락 방법","채팅 또는 전화 직접 연락"],["결제 방식","판매자와 협의 (계좌이체 등)"],["배송 일정","판매자 확인 후 안내"]].map(function(r){return <div key={r[0]} style={{display:"flex",justifyContent:"space-between",padding:"9px 12px",background:"#f9fafb",borderRadius:9,fontSize:12}}><span style={{color:"#888"}}>{r[0]}</span><b style={{color:G.mid}}>{r[1]}</b></div>;})}
            </div>
            {/* 배송 완료 후 리뷰 안내 */}
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:13,color:"#92400e",marginBottom:5}}>⭐ 거래 리뷰</div>
              <div style={{fontSize:12,color:"#78350f",lineHeight:1.7}}>
                상품 수령 후 채팅에서 판매자에게 리뷰를 남길 수 있습니다.<br/>
                <b>배송 완료 확인 후</b> 채팅 → 리뷰 남기기 버튼을 이용해 주세요.
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={function(){setChatRec&&setChatRec(record);onClose();}} style={{flex:1,background:"#f0fdf4",border:"1px solid #bbf7d0",color:G.mid,borderRadius:13,padding:"12px 0",fontWeight:700,fontSize:13,cursor:"pointer"}}>💬 채팅하기</button>
              <button onClick={onClose} style={{flex:1,background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:13,padding:"12px 0",fontWeight:900,fontSize:13,cursor:"pointer"}}>확인</button>
            </div>
          </div>}

          {step==="input"&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontWeight:800,fontSize:14,color:G.mid}}>📦 주문 정보 입력</div>
              <span style={{background:tradeType==="escrow"?"#eff6ff":"#f3f4f6",color:tradeType==="escrow"?"#2563eb":"#6b7280",fontSize:11,fontWeight:700,borderRadius:6,padding:"3px 9px"}}>{tradeType==="escrow"?"🔒 안전거래":"🤝 일반거래"}</span>
            </div>
            <div style={{background:"#f0fdf4",borderRadius:12,padding:"11px 14px",marginBottom:12,display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:28}}>{record.item.emoji}</span>
              <div><div style={{fontWeight:700,fontSize:14,color:"#0d1f15"}}>{record.item.name} {record.grade}등급</div><div style={{fontSize:12,color:"#666"}}>{record.market.name} · 박스당 {record.price.toLocaleString()}원</div></div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:12,color:"#888",fontWeight:700,display:"block",marginBottom:6}}>주문 수량 <span style={{color:"#aaa",fontWeight:400}}>(최소 5box · 1box 단위 조절)</span></label>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                <button onClick={function(){setQty(Math.max(5,qty-1));}} style={{width:34,height:34,borderRadius:9,border:"1.5px solid #bbf7d0",background:"#f0fdf4",fontSize:18,cursor:"pointer",fontWeight:700,color:G.mid,flexShrink:0}}>−</button>
                <input type="number" value={qty} min={5} max={record.remainQty} onChange={function(e){var v=parseInt(e.target.value)||5;setQty(Math.min(record.remainQty,Math.max(5,v)));}} style={{flex:1,textAlign:"center",fontSize:20,fontWeight:900,color:G.mid,border:"1.5px solid #bbf7d0",borderRadius:9,padding:"6px 0",outline:"none",background:"#f0fdf4",fontFamily:"inherit"}}/>
                <button onClick={function(){setQty(Math.min(record.remainQty,qty+1));}} style={{width:34,height:34,borderRadius:9,border:"1.5px solid #bbf7d0",background:"#f0fdf4",fontSize:18,cursor:"pointer",fontWeight:700,color:G.mid,flexShrink:0}}>+</button>
              </div>
              <div style={{display:"flex",gap:5,marginBottom:4}}>
                {[5,10,20,30].map(function(n){var newQty=Math.min(record.remainQty,qty+n);var atMax=qty+n>record.remainQty;return <button key={n} onClick={function(){setQty(newQty);}} disabled={atMax} style={{flex:1,padding:"4px 0",fontSize:11,background:atMax?"#f3f4f6":"#f0fdf4",color:atMax?"#bbb":G.mid,border:"1px solid "+(atMax?"#e5e7eb":G.border),borderRadius:7,cursor:atMax?"not-allowed":"pointer",fontWeight:600}}>+{n}</button>;})}
              </div>
              <div style={{fontSize:11,color:"#aaa",textAlign:"center"}}>잔여 재고 {record.remainQty}box · 직접 입력 가능</div>
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:12,color:"#888",fontWeight:700,display:"block",marginBottom:5}}>납품 지역</label>
              <select value={dest} onChange={function(e){setDest(e.target.value);}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:9,padding:"9px 11px",fontSize:13,background:"#f8fffe",outline:"none"}}>
                {DEST_REGIONS.map(function(r){return <option key={r} value={r}>{r}</option>;})}
              </select>
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:12,color:"#888",fontWeight:700,display:"block",marginBottom:5}}>📍 배송지 정보 <span style={{color:"#ef4444",marginLeft:2}}>*</span></label>
              <input value={addrDetail} onChange={function(e){setAddrDetail(e.target.value);}} placeholder="예) 서울특별시 송파구 올림픽로 300 창고 2동" style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:9,padding:"9px 11px",fontSize:13,background:"#f8fffe",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:6}}/>
              <div style={{display:"flex",gap:5}}>
                <input value={addrContact} onChange={function(e){setAddrContact(e.target.value);}} placeholder="담당자 성함 *" style={{flex:1,border:"1.5px solid #bbf7d0",borderRadius:9,padding:"8px 10px",fontSize:12,background:"#f8fffe",outline:"none",fontFamily:"inherit"}}/>
                <input value={addrPhone} onChange={function(e){setAddrPhone(e.target.value);}} placeholder="010-0000-0000 *" style={{flex:1,border:"1.5px solid #bbf7d0",borderRadius:9,padding:"8px 10px",fontSize:12,background:"#f8fffe",outline:"none",fontFamily:"inherit"}}/>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:12,color:"#888",fontWeight:700,display:"block",marginBottom:7}}>🚚 배송 방식 <span style={{color:"#2563eb",fontWeight:400}}>(플랫폼 제휴 할인)</span></label>
              {CARRIERS.map(function(c){
                var l=calcLogistics(record.market.region,dest,qty,c.id);
                var sel=carrierId===c.id;
                return <button key={c.id} onClick={function(){setCarrierId(c.id);}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"9px 12px",background:sel?"#eff6ff":"#f9fafb",border:"1.5px solid "+(sel?"#2563eb":"#e5e7eb"),borderRadius:10,cursor:"pointer",textAlign:"left",marginBottom:6}}>
                  <div><div style={{fontSize:12,fontWeight:sel?800:600,color:sel?"#1e40af":"#374151"}}>{c.logo} {c.name}</div><div style={{fontSize:10,color:"#888"}}>{c.desc}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:12,fontWeight:800,color:sel?"#1e40af":G.mid}}>{l.totalFreight.toLocaleString()}원</div><div style={{fontSize:10,color:"#2563eb"}}>최대 {Math.round(c.discount*100)}% 할인</div></div>
                </button>;
              })}
            </div>
            <div style={{background:"#eff6ff",borderRadius:11,padding:"11px 14px",marginBottom:14}}>
              <div style={{fontSize:12,color:"#1e40af",fontWeight:700,marginBottom:6}}>예상 비용</div>
              {[["상품 금액",goodsAmt.toLocaleString()+"원"],["물류비 ("+(CARRIERS.find(function(c){return c.id===carrierId;})?CARRIERS.find(function(c){return c.id===carrierId;}).name:"")+")  ",lg.totalFreight.toLocaleString()+"원"]].concat(tradeType==="escrow"?[["에스크로 수수료 (1%)",escrowFee.toLocaleString()+"원"]]:[]).concat([["도착 예정",dest+" "+lg.arriveStr]]).map(function(r){return <div key={r[0]} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3}}><span style={{color:"#64748b"}}>{r[0]}</span><b style={{color:r[0].indexOf("수수료")!==-1?"#dc2626":"#1e40af"}}>{r[1]}</b></div>;})}
              <div style={{borderTop:"1px solid #bfdbfe",marginTop:7,paddingTop:7,display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:900}}><span style={{color:"#1e3a8a"}}>총 결제금액</span><span style={{color:"#1e3a8a"}}>{total.toLocaleString()}원</span></div>
            </div>
            <button onClick={function(){
              if(!addrDetail.trim()){alert("상세 주소를 입력해 주세요.");return;}
              if(!addrContact.trim()){alert("담당자 성함을 입력해 주세요.");return;}
              if(!addrPhone.trim()){alert("연락처를 입력해 주세요.");return;}
              setStep("confirm");
            }} style={{width:"100%",background:"linear-gradient(135deg,#1e3a5f,#2563eb)",color:"#fff",border:"none",borderRadius:13,padding:"13px 0",fontSize:14,fontWeight:900,cursor:"pointer"}}>다음 단계 →</button>
          </div>}

          {step==="confirm"&&<div>
            <div style={{fontWeight:800,fontSize:14,color:G.mid,marginBottom:14}}>📋 주문 내용 확인</div>
            <div style={{border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden",marginBottom:12}}>
              {[["판매자",record.seller.name],["품목",record.item.name+" "+record.grade+"등급"],["수량",qty+"box"],["납품지역",dest],["상세주소",addrDetail],["담당자",addrContact+" · "+addrPhone],["택배사",CARRIERS.find(function(c){return c.id===carrierId;})?CARRIERS.find(function(c){return c.id===carrierId;}).name:""],["도착예정",dest+" "+lg.arriveStr],["상품금액",(record.price*qty).toLocaleString()+"원"],["물류비",lg.totalFreight.toLocaleString()+"원"],["총결제",total.toLocaleString()+"원"]].map(function(row,i){
                return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",background:i%2===0?"#f9fafb":"#fff",fontSize:13}}>
                  <span style={{color:"#888"}}>{row[0]}</span><b style={{color:row[0]==="총결제"?"#2563eb":"#1a2e1a"}}>{row[1]}</b>
                </div>;
              })}
            </div>
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:11,padding:"11px 14px",marginBottom:12,fontSize:12,color:"#166534",lineHeight:1.8}}>
              <b>✅ 직거래 보호</b><br/>
              ✅ 결제금액은 플랫폼 에스크로 계좌에 예치<br/>
              ✅ 판매자 출고 확인 후 배송 추적 시작<br/>
              ✅ 수령 후 <b>36시간 내 이의 신청</b> 가능<br/>
              ✅ 이의 없으면 <b>자동 구매확정</b> → 대금 지급
            </div>
            <div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 13px",marginBottom:8,fontSize:11,color:"#991b1b",lineHeight:1.8}}>
              ⏱️ <b>하자 신고 시한</b><br/>
              • 신선도·변질 (딸기·복숭아·방울토마토 등): <b>수령 후 12시간 이내</b><br/>
              • 수량 부족·등급 불일치: <b>수령 후 36시간 이내</b><br/>
              • 포장 파손: <b>수령 즉시</b> 개봉 전 사진 촬영 필수
            </div>
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"9px 13px",marginBottom:14,fontSize:11,color:"#92400e",lineHeight:1.7}}>
              ⚠️ 허위 하자신고 시 계정 정지 · 손해배상 청구<br/>
              📌 신고 접수 후 중재팀 24시간 내 연락<br/>
              🚚 배송 중 파손은 제휴 택배사 과실로 플랫폼이 직접 처리합니다.
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={function(){setStep("input");}} style={{flex:1,background:"#fff",border:"1.5px solid #e5e7eb",color:"#666",borderRadius:13,padding:"12px 0",fontWeight:700,fontSize:13,cursor:"pointer"}}>← 수정</button>
              <button onClick={function(){setStep("payment");}} style={{flex:2,background:"linear-gradient(135deg,#1e3a5f,#2563eb)",color:"#fff",border:"none",borderRadius:13,padding:"12px 0",fontWeight:900,fontSize:13,cursor:"pointer"}}>🛒 구매 신청</button>
            </div>
          </div>}

          {step==="payment"&&<div>
            <div style={{fontWeight:800,fontSize:14,color:G.mid,marginBottom:14}}>✅ 거래 신청 완료</div>
            <div style={{background:"linear-gradient(135deg,#1e3a5f,#2563eb)",borderRadius:14,padding:18,marginBottom:12,textAlign:"center",color:"#fff"}}>
              <div style={{fontSize:32,marginBottom:6}}>🔒</div>
              <div style={{fontWeight:900,fontSize:18,marginBottom:3}}>{total.toLocaleString()}원</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.8)"}}>판매자에게 거래 신청이 전달되었습니다</div>
            </div>
            {[["신청 상태","✅ 전송됨"],["판매자 알림","📱 출고 요청 전송됨"],["예상 출고","내일 새벽 5:00"],["택배사",CARRIERS.find(function(c){return c.id===carrierId;})?CARRIERS.find(function(c){return c.id===carrierId;}).name:""],["예상 도착",dest+" "+lg.arriveStr],["자동확정","수령 후 36시간 이내"]].map(function(r){return <div key={r[0]} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:"#f9fafb",borderRadius:9,marginBottom:5,fontSize:13}}><span style={{color:"#888"}}>{r[0]}</span><b style={{color:G.mid}}>{r[1]}</b></div>;})}
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:11,padding:"10px 14px",margin:"12px 0",fontSize:11,color:"#92400e",lineHeight:1.7}}>
              💡 판매자에게 연락 후 결제 방법·배송 일정을 직접 협의하세요.
            </div>
            <button onClick={function(){
              setStep("shipped");
              if(onOrderComplete) onOrderComplete(record, qty, lg.totalFreight, total, dest+" "+addrDetail, addrPhone||"010-1234-5678");
            }} style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:13,padding:"13px 0",fontSize:13,fontWeight:900,cursor:"pointer"}}>✅ 신청 완료</button>
          </div>}

          {step==="shipped"&&<div>
            <div style={{fontWeight:800,fontSize:14,color:G.mid,marginBottom:14}}>🚚 배송 중</div>
            <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:14,padding:16,marginBottom:12,textAlign:"center",color:"#fff"}}>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",marginBottom:6}}>예상 도착</div>
              <div style={{fontSize:22,fontWeight:900,color:"#4ade80"}}>{lg.arriveStr}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:6}}>배달 완료 후 수령 확인 → 36시간 이의신청 가능</div>
            </div>
            {[["운송장","5219-8847-3301"],["택배사",CARRIERS.find(function(c){return c.id===carrierId;})?CARRIERS.find(function(c){return c.id===carrierId;}).name:""],["출고",record.market.name+" 새벽 "+String(lg.departH||5).padStart(2,"0")+":00"],["수량",qty+"box"],["냉장","✅ 저온 냉장 차량 이용"]].map(function(r){return <div key={r[0]} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5,padding:"7px 11px",background:"#f0fdf4",borderRadius:8}}><span style={{color:"#888"}}>{r[0]}</span><b>{r[1]}</b></div>;})}
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:11,padding:"12px 14px",margin:"12px 0",fontSize:11,color:"#92400e",lineHeight:1.8}}>
              📦 상품 수령 후 <b>수령 확인</b> 버튼을 눌러주세요.<br/>확인 시점부터 <b>36시간</b> 이의신청 가능 · 이후 자동 대금 지급
            </div>
            <div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:11,padding:"12px 14px",marginBottom:12,fontSize:11,color:"#166534",lineHeight:1.8}}>
              🚚 <b>택배사 배송완료 처리 시 자동으로 수령확인 페이지로 전환됩니다.</b><br/>
              별도로 버튼을 누르지 않아도 배송완료와 동시에 36시간 카운트가 시작되며, 이후 이의신청이 없으면 판매자에게 대금이 자동 지급됩니다.
            </div>
            <button onClick={function(){setStep("received");setTimer(36*3600);setTimerActive(true);}} style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:13,padding:"13px 0",fontWeight:900,fontSize:14,cursor:"pointer"}}>📦 수령 확인했습니다</button>
          </div>}

          {step==="received"&&<div>
            <div style={{fontWeight:800,fontSize:14,color:G.mid,marginBottom:14}}>✅ 수령 완료 — 이의신청 대기</div>
            <div style={{background:"linear-gradient(135deg,#1e3a5f,#2563eb)",borderRadius:14,padding:16,marginBottom:12,textAlign:"center",color:"#fff"}}>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",marginBottom:4}}>자동 구매확정까지 남은 시간</div>
              <div style={{fontSize:34,fontWeight:900,fontFamily:"monospace",letterSpacing:2}}>{fmtT(timer)}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",marginTop:4}}>36시간 내 이의 없으면 에스크로 대금 자동 지급</div>
            </div>
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:11,padding:"10px 14px",marginBottom:8,fontSize:12,color:"#166534",lineHeight:1.7}}>
              ✅ 수령 확인 완료<br/>이상이 없으시면 아래 <b>구매 확정</b> 버튼을 눌러주세요.<br/>하자 발견 시 이의 신청 후 플랫폼 중재를 받을 수 있습니다.
            </div>
            <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:11,padding:"10px 14px",marginBottom:10,fontSize:11,color:"#1e40af",lineHeight:1.8}}>
              📹 <b>개봉 전 영상 촬영을 권장합니다</b><br/>
              포장 파손·신선도 하자 발생 시 <b>개봉 전 영상</b>이 가장 강력한 증거가 됩니다.<br/>
              <span style={{fontSize:10,color:"#3b82f6"}}>특히 딸기·방울토마토·복숭아 등 신선도 민감 품목은 수령 즉시 확인해 주세요.</span>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:0}}>
              <button onClick={function(){onClaim&&onClaim(record);}} style={{flex:1,background:"#fff",border:"1.5px solid #fca5a5",color:"#dc2626",borderRadius:13,padding:"12px 0",fontWeight:700,fontSize:12,cursor:"pointer"}}>⚠️ 하자신고</button>
              <button onClick={function(){setStep("done");setTimerActive(false);}} style={{flex:2,background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:13,padding:"12px 0",fontWeight:900,fontSize:13,cursor:"pointer"}}>✅ 구매 확정</button>
            </div>
          </div>}

          {step==="done"&&<div style={{textAlign:"center",padding:"16px 0"}}>
            <div style={{fontSize:52,marginBottom:10}}>🎉</div>
            <div style={{fontWeight:900,fontSize:19,color:G.mid,marginBottom:6}}>거래 완료!</div>
            <div style={{fontSize:13,color:"#666",lineHeight:1.8,marginBottom:16}}>{total.toLocaleString()}원이 <b>{record.seller.name}</b>에게 지급되었습니다.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:14}}>
              {[["✅","에스크로\n보호 완료","#f0fdf4","#166534"],["📋","세금계산서\n발행 완료","#eff6ff","#1e40af"],["⭐","리뷰 작성\n가능","#fef3c7","#92400e"]].map(function(r){return <div key={r[0]} style={{background:r[2],borderRadius:11,padding:"10px 6px",textAlign:"center"}}><div style={{fontSize:18,marginBottom:3}}>{r[0]}</div><div style={{fontSize:10,fontWeight:700,color:r[3],whiteSpace:"pre-line"}}>{r[1]}</div></div>;})}
            </div>
            <button onClick={onClose} style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:13,padding:"13px 0",fontSize:14,fontWeight:900,cursor:"pointer"}}>확인</button>
          </div>}
        </div>
      </div>
    </div>
  );
}

// ── 하자 신고 모달 ──
function ClaimModal(props) {
  var record=props.record, onClose=props.onClose;
  var TYPES=["등급 불일치 (특→상 혼입 등)","수량 부족","상품 변질·부패","포장 파손","이물질 혼입","납품 지연·미납품","기타"];
  var ss=useState([]); var sel=ss[0]; var setSel=ss[1];
  var ds=useState(""); var detail=ds[0]; var setDetail=ds[1];
  var imgs=useState(null); var imgData=imgs[0]; var setImgData=imgs[1];
  var st=useState("input"); var step=st[0]; var setStep=st[1];
  function toggle(t){setSel(function(s){return s.includes(t)?s.filter(function(x){return x!==t;}):[...s,t];});}
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:500,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"8px 8px 0",overflowY:"auto",WebkitOverflowScrolling:"touch"}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:22,maxWidth:420,width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 32px 80px rgba(0,0,0,0.35)"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{background:"linear-gradient(135deg,#7f1d1d,#dc2626)",padding:"14px 20px",borderRadius:"22px 22px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{color:"#fff",fontWeight:900,fontSize:15}}>⚠️ 하자 신고 / 이의 신청</div><div style={{color:"rgba(255,255,255,0.7)",fontSize:11,marginTop:1}}>수령 후 36시간 이내 신청 가능</div></div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:700}}>✕</button>
        </div>
        <div style={{padding:20}}>
          {step==="input"&&<div>
            <div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:11,padding:"10px 14px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:26}}>{record.item.emoji}</span>
              <div><div style={{fontWeight:700,fontSize:13,color:"#991b1b"}}>{record.item.name} {record.grade}등급</div><div style={{fontSize:11,color:"#b91c1c"}}>{record.seller.name} · {record.market.name}</div></div>
            </div>
            <div style={{fontSize:12,color:"#888",fontWeight:700,marginBottom:7}}>하자 유형 선택</div>
            <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
              {TYPES.map(function(t){var on=sel.includes(t);return <button key={t} onClick={function(){toggle(t);}} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",background:on?"#fef2f2":"#f9fafb",border:"1.5px solid "+(on?"#dc2626":"#e5e7eb"),borderRadius:9,cursor:"pointer",textAlign:"left"}}>
                <div style={{width:16,height:16,borderRadius:4,background:on?"#dc2626":"#fff",border:"1.5px solid "+(on?"#dc2626":"#d1d5db"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{on&&<span style={{color:"#fff",fontSize:10,fontWeight:800}}>✓</span>}</div>
                <span style={{fontSize:12,color:on?"#991b1b":"#374151",fontWeight:on?700:400}}>{t}</span>
              </button>;})}
            </div>
            <div style={{fontSize:12,color:"#888",fontWeight:700,marginBottom:5}}>상세 내용</div>
            <textarea value={detail} onChange={function(e){setDetail(e.target.value);}} placeholder="구체적인 하자 내용을 입력해 주세요." style={{width:"100%",border:"1.5px solid #fca5a5",borderRadius:9,padding:"9px 11px",fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",minHeight:70,boxSizing:"border-box",marginBottom:10}}/>
            <div style={{fontSize:12,color:"#888",fontWeight:700,marginBottom:5}}>증거 사진 (필수)</div>
            <label style={{display:"flex",alignItems:"center",gap:10,background:"#fef2f2",border:"1.5px dashed #fca5a5",borderRadius:9,padding:"10px 13px",cursor:"pointer",marginBottom:12}}>
              {imgData?<img src={imgData} alt="증거" style={{width:52,height:52,objectFit:"cover",borderRadius:7}}/>:<div style={{width:52,height:52,background:"#fff",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📷</div>}
              <div><div style={{fontSize:12,fontWeight:700,color:"#991b1b"}}>{imgData?"사진 변경":"사진 첨부"}</div><div style={{fontSize:10,color:"#aaa"}}>하자 부위가 잘 보이도록 촬영</div></div>
              <input type="file" accept="image/*" onChange={function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){setImgData(ev.target.result);};r.readAsDataURL(f);}} style={{display:"none"}}/>
            </label>
            <div style={{background:"#fef3c7",border:"1px solid #fde68a",borderRadius:10,padding:"9px 13px",marginBottom:14,fontSize:11,color:"#92400e",lineHeight:1.7}}>
              ⚠️ 허위 하자신고 시 계정 정지 및 손해배상 청구됩니다.<br/>📌 신고 접수 후 중재팀이 <b>24시간 내</b> 연락드립니다.
            </div>
            <button onClick={function(){if(sel.length===0){alert("하자 유형을 선택해 주세요.");return;}setStep("submitted");}} style={{width:"100%",background:sel.length>0?"linear-gradient(135deg,#7f1d1d,#dc2626)":"#ccc",color:"#fff",border:"none",borderRadius:13,padding:"13px 0",fontSize:14,fontWeight:900,cursor:sel.length>0?"pointer":"not-allowed"}}>⚠️ 이의 신청 접수</button>
          </div>}
          {step==="submitted"&&<div style={{textAlign:"center",padding:"16px 0"}}>
            <div style={{fontSize:48,marginBottom:10}}>📨</div>
            <div style={{fontWeight:900,fontSize:18,color:"#dc2626",marginBottom:6}}>이의 신청 접수 완료</div>
            <div style={{fontSize:12,color:"#666",lineHeight:1.8,marginBottom:16}}>접수 번호: <b style={{color:"#dc2626"}}>CLM-2026-{Math.floor(Math.random()*90000+10000)}</b></div>
            {[["접수 상태","🔄 검토 중"],["에스크로","⏸️ 지급 보류"],["처리 기간","영업일 1~3일"],["중재 결과","환불 또는 부분 보상"]].map(function(r){return <div key={r[0]} style={{display:"flex",justifyContent:"space-between",padding:"9px 12px",background:"#fef2f2",borderRadius:9,marginBottom:5,fontSize:13}}><span style={{color:"#888"}}>{r[0]}</span><b style={{color:"#991b1b"}}>{r[1]}</b></div>;})}
            <button onClick={onClose} style={{width:"100%",marginTop:14,background:"linear-gradient(135deg,#7f1d1d,#dc2626)",color:"#fff",border:"none",borderRadius:13,padding:"13px 0",fontSize:14,fontWeight:900,cursor:"pointer"}}>확인</button>
          </div>}
        </div>
      </div>
    </div>
  );
}

// ── 중도매인 상세 모달 ──
function SellerModal(props) {
  var record=props.record,onClose=props.onClose,onChat=props.onChat,onEscrow=props.onEscrow,onClaim=props.onClaim;
  var seller=record.seller,item=record.item,market=record.market,grade=record.grade,price=record.price,remainQty=record.remainQty,qty=record.qty;
  var at=useState("info"); var activeTab=at[0]; var setActiveTab=at[1];
  var avg=seller.rating;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:22,maxWidth:430,width:"100%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.25)",position:"relative"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{background:"linear-gradient(135deg,#0d2b1a,#2d6a4f)",borderRadius:"22px 22px 0 0",padding:"18px 20px"}}>
          <button onClick={onClose} style={{position:"absolute",top:13,right:13,background:"rgba(255,255,255,0.15)",border:"none",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:13,color:"#fff"}}>✕</button>
          <div style={{display:"flex",gap:13,alignItems:"center"}}>
            <div style={{width:54,height:54,borderRadius:15,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{item.emoji}</div>
            <div>
              <div style={{fontWeight:900,fontSize:17,color:"#fff"}}>{seller.name}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginTop:2}}>📍 {market.name} 소속 · 경력 {seller.career}년</div>
              <div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap"}}>
                <span style={{background:"rgba(255,255,255,0.15)",color:"#fff",fontSize:10,fontWeight:700,borderRadius:5,padding:"2px 7px"}}>⭐ {avg}</span>
                <span style={{background:"#4ade80",color:"#0d2b1a",fontSize:10,fontWeight:700,borderRadius:5,padding:"2px 7px"}}>✅ 사업자인증</span>
                <span style={{background:"#60a5fa",color:"#1e3a8a",fontSize:10,fontWeight:700,borderRadius:5,padding:"2px 7px"}}>✅ 직거래</span>
                {seller.claimCount===0&&<span style={{background:"#fde68a",color:"#78350f",fontSize:10,fontWeight:700,borderRadius:5,padding:"2px 7px"}}>🏅 무하자</span>}{seller.claimCount===1&&<span style={{background:"#fff7ed",color:"#c2410c",fontSize:10,fontWeight:700,borderRadius:5,padding:"2px 7px"}}>⚠️ 주의</span>}{seller.claimCount===2&&<span style={{background:"#fef2f2",color:"#dc2626",fontSize:10,fontWeight:700,borderRadius:5,padding:"2px 7px"}}>🔶 거래제한</span>}
                <span style={{background:"rgba(74,222,128,0.25)",color:"#4ade80",fontSize:10,fontWeight:700,borderRadius:5,padding:"2px 7px"}}>🔄 재거래 {seller.reorderRate}%</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid #e5e7eb",background:"#fafff8"}}>
          {[["info","📋 업체정보"],["review","⭐ 리뷰 "+seller.reviews.length+"건"],["logistics","🚚 물류안내"]].map(function(t){return <button key={t[0]} onClick={function(){setActiveTab(t[0]);}} style={{flex:1,padding:"10px 0",fontSize:12,fontWeight:activeTab===t[0]?800:400,color:activeTab===t[0]?"#1b4332":"#888",border:"none",background:"transparent",borderBottom:activeTab===t[0]?"2.5px solid #1b4332":"2.5px solid transparent",cursor:"pointer"}}>{t[1]}</button>;})}
        </div>
        <div style={{padding:"18px 20px"}}>
          {activeTab==="info"&&<div>
            {/* 한 줄 소개 (판매자 자유 입력, 50자 이내) */}
            <div style={{background:"#f8fffe",border:"1px solid #bbf7d0",borderRadius:11,padding:"11px 14px",marginBottom:8}}>
              <div style={{fontSize:10,color:"#888",fontWeight:600,marginBottom:5}}>📝 판매자 한 줄 소개 <span style={{color:"#aaa"}}>(50자 이내 자유 입력)</span></div>
              <div style={{fontSize:13,color:"#1a2e1a",lineHeight:1.7,fontWeight:500}}>"{seller.intro}"</div>
            </div>
            {/* 기본 정보 - 경락 데이터 자동 추출 */}
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:11,padding:"10px 14px",marginBottom:12}}>
              <div style={{fontSize:10,color:"#92400e",fontWeight:600,marginBottom:5}}>📊 기본 정보 <span style={{color:"#aaa"}}>(경락 데이터 자동 추출 · 수정 불가)</span></div>
              <div style={{fontSize:12,color:"#78350f",lineHeight:1.8}}>소속 시장: <b>{market.name}</b> · 경력: <b>{seller.career}년</b> · 주요 품목: <b>{seller.mainItems.join(", ")}</b></div>
            </div>
            <div style={{border:"1px solid #e5e7eb",borderRadius:11,padding:"12px 14px",marginBottom:12}}>
              <div style={{fontSize:11,color:"#888",fontWeight:700,marginBottom:8}}>사업자 정보</div>
              {[["사업자 등록","✅ 완료 (플랫폼 인증)"],["소속 시장",market.name],["대표자",seller.owner],["에스크로 결제",seller.escrow?"🔒 지원":"미지원"],["하자신고 이력",seller.claimCount+"건"+(seller.claimCount===0?" 🏅":"")],["거래 건수",seller.deals+"건"],["거래 별점","⭐ "+avg+" / 5.0"]].map(function(row){return <div key={row[0]} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}><span style={{color:"#888"}}>{row[0]}</span><b style={{color:row[0]==="사업자 등록"?"#1b7a34":"inherit"}}>{row[1]}</b></div>;})}
            </div>
            {/* 신뢰 지표 카드 */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {/* 재거래율 */}
              <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:12,padding:"14px 12px",textAlign:"center"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",marginBottom:4}}>재거래율</div>
                <div style={{fontSize:26,fontWeight:900,color:"#4ade80"}}>{seller.reorderRate}%</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",marginTop:3}}>구매자 재주문 비율</div>
              </div>
              {/* 별점 */}
              <div style={{background:"#fffbeb",borderRadius:12,padding:"14px 12px",textAlign:"center",border:"1px solid #fde68a"}}>
                <div style={{fontSize:10,color:"#92400e",marginBottom:4}}>거래 별점</div>
                <div style={{fontSize:26,fontWeight:900,color:"#f59e0b"}}>⭐ {avg}</div>
                <div style={{fontSize:9,color:"#aaa",marginTop:3}}>총 {seller.reviews.length}건 리뷰</div>
              </div>
            </div>
            {/* 거래 통계 바 */}
            <div style={{background:"#f8fffe",border:"1px solid #bbf7d0",borderRadius:11,padding:"12px 14px",marginBottom:12}}>
              <div style={{fontSize:11,color:"#888",fontWeight:700,marginBottom:8}}>거래 통계</div>
              {[
                ["총 거래 건수", seller.deals+"건", seller.deals/1000],
                ["재거래율", seller.reorderRate+"%", seller.reorderRate/100],
                ["하자신고", seller.claimCount+"건 ("+( seller.claimCount===0?"무하자":"주의 필요")+")"],
              ].map(function(row,i){
                return <div key={row[0]} style={{marginBottom:i<2?8:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                    <span style={{color:"#888"}}>{row[0]}</span>
                    <b style={{color:row[0]==="하자신고"&&seller.claimCount>0?"#dc2626":G.mid}}>{row[1]}</b>
                  </div>
                  {row[2]!=null&&<div style={{height:5,background:"#e5e7eb",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:Math.min(100,row[2]*100)+"%",background:row[0]==="재거래율"?"linear-gradient(90deg,#1b4332,#4ade80)":"linear-gradient(90deg,#1e40af,#60a5fa)",borderRadius:3}}/>
                  </div>}
                </div>;
              })}
            </div>

            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:11,padding:"12px 14px",marginBottom:12}}>
              <div style={{fontSize:11,color:"#92400e",fontWeight:700,marginBottom:8}}>경락 정보</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,fontSize:13}}>
                <div><div style={{fontSize:10,color:"#aaa",marginBottom:2}}>품목</div><b>{item.name}</b></div>
                <div><div style={{fontSize:10,color:"#aaa",marginBottom:2}}>등급</div><b>{grade}등급 / {item.unit}</b></div>
                <div><div style={{fontSize:10,color:"#aaa",marginBottom:2}}>낙찰 수량</div><b>{qty}box</b></div>
                <div><div style={{fontSize:10,color:"#aaa",marginBottom:2}}>잔여 재고</div><b>{remainQty}box</b></div>
                <div style={{gridColumn:"span 2"}}><div style={{fontSize:10,color:"#aaa",marginBottom:3}}>경락가</div><span style={{fontSize:20,fontWeight:900,color:"#1b4332"}}>{price.toLocaleString()}<span style={{fontSize:13,fontWeight:600}}>원</span></span></div>
              </div>
            </div>
            {seller.claimCount>=2
              ? <div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:9,padding:"10px 14px",marginBottom:12}}><div style={{fontSize:12,color:"#dc2626",fontWeight:600}}>🔒 거래 제한 중 — 연락처 비공개</div><div style={{fontSize:11,color:"#b91c1c",marginTop:3}}>30일 거래 제한 기간 중 연락처가 자동 비공개 처리됩니다.</div></div>
              : seller.canContact
                ? <div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:9,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><span style={{fontSize:12,color:"#166534",fontWeight:600}}>📞 직통 연락처</span><span style={{fontSize:14,fontWeight:800,color:"#1b4332"}}>{seller.phone}</span></div>
                : <div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:9,padding:"10px 14px",marginBottom:12}}><div style={{fontSize:12,color:"#991b1b",fontWeight:600}}>🔒 연락처 비공개</div><div style={{fontSize:11,color:"#b91c1c",marginTop:3}}>채팅으로 문의하세요.</div></div>
            }
          </div>}

          {activeTab==="review"&&<div>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14,padding:14,background:"#f8fffe",borderRadius:12,border:"1px solid #bbf7d0"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:32,fontWeight:900,color:"#1b4332"}}>{avg}</div><div style={{fontSize:11,color:"#888"}}>/ 5.0</div></div>
              <div style={{flex:1}}>
                {[5,4,3].map(function(s){var cnt=seller.reviews.filter(function(r){return r.score===s;}).length,pct=seller.reviews.length?Math.round(cnt/seller.reviews.length*100):0;return <div key={s} style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}><span style={{fontSize:10,color:"#888",width:10}}>{s}</span><span style={{fontSize:9}}>⭐</span><div style={{flex:1,height:5,background:"#e5e7eb",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:"#4ade80",borderRadius:3}}/></div><span style={{fontSize:10,color:"#888",width:20}}>{cnt}건</span></div>;})}
                <div style={{fontSize:10,color:"#aaa",marginTop:3}}>총 {seller.reviews.length}건</div>
              </div>
            </div>
            <ReviewCards reviews={seller.reviews} sellerName={seller.name}/>
          </div>}

          {activeTab==="logistics"&&<div>
            <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:11,padding:"12px 14px",marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,color:"#1e40af",marginBottom:8}}>🚚 플랫폼 제휴 택배사</div>
              {CARRIERS.map(function(c){return <div key={c.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}><span style={{color:"#374151"}}>{c.logo} {c.name}</span><span style={{color:"#2563eb",fontWeight:700}}>최대 {Math.round(c.discount*100)}% 할인</span></div>;})}
              <div style={{fontSize:11,color:"#888",marginTop:6}}>* 에스크로 결제 시 구매자가 직접 선택</div>
            </div>
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:11,padding:"12px 14px",marginBottom:12,fontSize:13,lineHeight:1.8}}>
              <b>출하 기준</b><br/>
              • 출하 시각: 새벽 <b>5:00</b> (경락 직후)<br/>
              • 출발지: {market.name} ({market.region})<br/>
              • 최소 출고: <b>5box</b> · 냉장 차량 이용
            </div>
            <div style={{fontSize:12,color:"#888",fontWeight:700,marginBottom:7}}>지역별 도착예정 & 물류비 (10box 기준)</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {DEST_REGIONS.map(function(r){var l=calcLogistics(market.region,r,10,null);return <div key={r} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 11px",background:"#f9fafb",borderRadius:9,border:"1px solid #e5e7eb",fontSize:12}}><span style={{fontWeight:600,color:"#374151",width:34}}>{r}</span><span style={{color:"#1b4332"}}>🕐 {l.arriveStr}</span><span style={{color:"#2563eb",fontWeight:600}}>{l.totalFreight.toLocaleString()}원</span></div>;})}
            </div>
          </div>}

          {seller.claimCount>=2&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:11,padding:"11px 14px",marginTop:12,textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:800,color:"#dc2626",marginBottom:3}}>🔶 30일 거래 제한 중</div>
            <div style={{fontSize:11,color:"#991b1b"}}>현재 플랫폼 제재로 신규 거래·채팅이 불가합니다.<br/>기존 거래 관련 하자신고만 가능합니다.</div>
          </div>}
          <div style={{display:"flex",gap:7,marginTop:12,flexWrap:"wrap"}}>
            {record.available&&seller.escrow&&seller.claimCount<2&&<button onClick={function(){onEscrow(record);}} style={{flex:1,background:"linear-gradient(135deg,#0d2b1a,#40916c)",border:"none",color:"#fff",borderRadius:11,padding:"9px 0",fontWeight:800,fontSize:12,cursor:"pointer"}}>🛒 구매하기</button>}
            <button onClick={function(){onClaim(record);}} style={{flex:1,background:"#fef2f2",border:"1px solid #fca5a5",color:"#dc2626",borderRadius:11,padding:"9px 0",fontWeight:700,fontSize:12,cursor:"pointer"}}>⚠️ 하자신고</button>
          </div>
          {seller.claimCount<2&&<div style={{display:"flex",gap:8,marginTop:8}}>
            {seller.canContact&&<button style={{flex:1,background:"#fff",border:"2px solid #2d6a4f",color:"#2d6a4f",borderRadius:13,padding:"12px 0",fontWeight:700,fontSize:12,cursor:"pointer"}}>📞 전화</button>}
            <button onClick={function(){onChat(record);}} style={{flex:2,background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:13,padding:"12px 0",fontWeight:900,fontSize:14,cursor:"pointer",boxShadow:"0 6px 18px rgba(27,67,50,0.3)"}}>💬 채팅 시작하기</button>
          </div>}
        </div>
      </div>
    </div>
  );
}

// ── 경락 카드 ──
function RecordCard(props) {
  var record=props.record,rank=props.rank,onDetail=props.onDetail,onChat=props.onChat,onEscrow=props.onEscrow,onPhoto=props.onPhoto,sortBy=props.sortBy,destRegion=props.destRegion;
  var item=record.item,grade=record.grade,price=record.price,qty=record.qty,remainQty=record.remainQty,market=record.market,date=record.date,seller=record.seller,available=record.available;
  var lg=destRegion?calcLogistics(market.region,destRegion,10,null):null;
  var rankStyle=rank===1?{border:"2px solid #4ade80",boxShadow:"0 6px 28px rgba(45,106,79,0.18)"}:rank===2?{border:"1.5px solid #86efac",boxShadow:"0 3px 14px rgba(0,0,0,0.07)"}:{border:"1px solid #e8f5e9",boxShadow:"0 2px 10px rgba(0,0,0,0.05)"};
  var top1=sortBy==="price"?"🏆 최저가":sortBy==="date"?"🕐 최신":"📦 최다수량";
  var badge=sortBy==="date"?"🕐 최신":rank===1?top1:rank===2?"🥈 2위":"🥉 3위";
  var PHOTO_TABS=[{key:"front",icon:"📦",label:"포장 전면"},{key:"side",icon:"🏷️",label:"측면·등급"},{key:"qty",icon:"🔢",label:"수량 확인"},{key:"video",icon:"🎥",label:"영상"}];
  return (
    <div style={{background:"#fff",borderRadius:18,padding:"16px 18px",position:"relative",...rankStyle}}>
      {rank<=3&&<div style={{position:"absolute",top:-1,left:16,background:rank===1?"linear-gradient(90deg,#0d2b1a,#1b4332)":rank===2?"#374151":"#6b7280",color:"#fff",fontSize:10,fontWeight:800,padding:"3px 12px",borderRadius:"0 0 9px 9px"}}>{badge}</div>}

      {/* 상단: 품목 + 가격 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,paddingTop:rank<=3?8:0}}>
        <div style={{display:"flex",gap:11,alignItems:"center"}}>
          <div style={{width:50,height:50,borderRadius:14,background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>{item.emoji}</div>
          <div>
            <div style={{fontWeight:900,fontSize:15,color:"#0d1f15"}}>{item.name}</div>
            <div style={{display:"flex",gap:4,marginTop:3,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{background:"#f0fdf4",color:"#166634",fontSize:10,fontWeight:700,borderRadius:5,padding:"1px 7px"}}>{grade}등급</span>
              <span style={{fontSize:11,color:"#888"}}>{item.unit}</span>

              {seller.claimCount===0&&<span style={{background:"#fef3c7",color:"#92400e",fontSize:10,fontWeight:700,borderRadius:5,padding:"1px 7px"}}>🏅무하자</span>}{seller.claimCount===1&&<span style={{background:"#fff7ed",color:"#c2410c",fontSize:10,fontWeight:700,borderRadius:5,padding:"1px 7px"}}>⚠️주의</span>}{seller.claimCount===2&&<span style={{background:"#fef2f2",color:"#dc2626",fontSize:10,fontWeight:700,borderRadius:5,padding:"1px 7px"}}>🔶거래제한</span>}
            </div>
            <div style={{fontSize:10,color:"#888",marginTop:3}}>🏪 {market.name} · {market.region}</div>
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontWeight:900,fontSize:21,color:"#1b4332",lineHeight:1}}>{price.toLocaleString()}</div>
          <div style={{fontSize:10,color:"#aaa",marginTop:1}}>원 / {item.unit}</div>
          {lg&&<div style={{fontSize:10,color:"#7c3aed",fontWeight:600,marginTop:2}}>실질 {(price+lg.ratePerBox).toLocaleString()}원*</div>}
        </div>
      </div>

      {/* 물류 정보 */}
      {lg&&<div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:9,padding:"5px 11px",marginBottom:9,display:"flex",gap:8,fontSize:10,color:"#1e40af"}}>
        <span>🚚 {destRegion} 도착: <b>{lg.arriveStr}</b></span><span style={{color:"#93c5fd"}}>|</span><span>물류비 <b>{lg.totalFreight.toLocaleString()}원</b></span>
      </div>}

      {/* 경락 정보 바 */}
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10,padding:"7px 11px",background:"#f8fffe",borderRadius:9,fontSize:11,color:"#4a6741"}}>
        <span>🕐 {date}</span><span style={{color:"#ddd"}}>|</span>
        <span>📦 {qty}box</span><span style={{color:"#ddd"}}>|</span>
        <span>🔖 잔여 {remainQty}box</span><span style={{color:"#ddd"}}>|</span>
        <span style={{color:available?"#1b7a34":"#c0392b",fontWeight:700}}>{available?"✅ 거래가능":"⛔ 거래불가"}</span>
      </div>

      {/* 사진 썸네일 */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:10,color:"#888",fontWeight:600,marginBottom:5}}>📸 판매자 등록 사진·영상 (클릭하여 확인)</div>
        <div style={{display:"flex",gap:5}}>
          {PHOTO_TABS.map(function(t){
            return (
              <button key={t.key} onClick={function(){onPhoto(record,t.key);}}
                style={{flex:1,height:52,borderRadius:9,background:t.key==="video"?"#1a1a2e":"#f0fdf4",border:"1.5px solid "+(t.key==="video"?"#334155":"#bbf7d0"),cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,transition:"opacity 0.15s"}}
                onMouseOver={function(e){e.currentTarget.style.opacity="0.8";}}
                onMouseOut={function(e){e.currentTarget.style.opacity="1";}}>
                <span style={{fontSize:16}}>{t.icon}</span>
                <span style={{fontSize:8,color:t.key==="video"?"#94a3b8":"#555",fontWeight:600}}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 버튼 */}
      <div style={{display:"flex",gap:7}}>
        <button onClick={function(){onDetail(record);}} style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"#f8fffe",border:"1px solid #bbf7d0",borderRadius:11,padding:"8px 10px",cursor:"pointer",textAlign:"left"}}>
          <div style={{width:30,height:30,borderRadius:8,background:"#d1fae5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>👤</div>
          <div><div style={{fontSize:12,fontWeight:700,color:"#1b4332"}}>{seller.name}</div><div style={{fontSize:9,color:"#888"}}>{"⭐"+seller.rating+" · "+seller.deals+"건 · 재거래 "+seller.reorderRate+"%"}</div></div>
          <span style={{marginLeft:"auto",fontSize:10,color:"#ccc"}}>›</span>
        </button>
        {available&&seller.escrow&&<button onClick={function(){onEscrow(record);}} style={{background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:11,padding:"0 10px",fontSize:10,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>🛒 구매하기</button>}
        {available&&seller.claimCount<2&&<button onClick={function(){onChat(record);}} style={{background:"linear-gradient(135deg,#1b4332,#40916c)",color:"#fff",border:"none",borderRadius:11,padding:"0 13px",fontSize:12,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 4px 14px rgba(27,67,50,0.25)"}}>💬 채팅</button>}
        {seller.claimCount>=2&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:11,padding:"0 10px",fontSize:10,fontWeight:700,color:"#dc2626",display:"flex",alignItems:"center",whiteSpace:"nowrap"}}>🔶 거래제한</div>}
        {!available&&<button disabled style={{background:"#f3f4f6",color:"#bbb",border:"none",borderRadius:11,padding:"0 13px",fontSize:11,cursor:"not-allowed",whiteSpace:"nowrap"}}>거래불가</button>}
      </div>
    </div>
  );
}


// 한국 지도 SVG 기반 도매시장 탭
function MarketMapTab(props){
  var onGoSearch=props.onGoSearch;
  var hs=useState(null); var hovered=hs[0]; var setHovered=hs[1];
  var ss=useState(null); var selected=ss[0]; var setSelected=ss[1];

  // 정밀 한국 행정구역 SVG paths (viewBox 0 0 560 580)
  // 실제 GeoJSON 기반 근사 경계
  var REGION_PATHS = {
    "서울":  "M216,196 C224,188 238,188 248,194 C256,202 255,214 248,221 C240,228 226,227 217,222 C209,216 208,205 216,196Z",
    "인천":  "M178,198 C188,190 208,192 218,200 C222,210 218,225 205,228 C190,230 175,222 172,210 C170,204 174,200 178,198Z",
    "경기":  "M198,158 C222,150 262,152 282,168 C295,180 292,205 278,220 C262,234 240,236 220,228 C202,222 190,210 188,195 C186,178 192,162 198,158Z",
    "강원":  "M282,132 C308,122 355,120 388,138 C402,148 405,172 398,200 C390,228 368,242 342,240 C318,238 295,225 280,208 C268,194 268,170 272,152 C274,142 278,135 282,132Z",
    "충북":  "M245,232 C268,224 302,226 322,242 C334,254 330,278 318,295 C305,310 282,314 260,305 C240,298 232,278 235,260 C237,246 242,235 245,232Z",
    "충남":  "M148,232 C168,220 205,220 232,235 C246,244 244,268 232,285 C218,302 192,308 165,298 C142,290 132,268 138,248 C141,238 145,234 148,232Z",
    "대전":  "M212,258 C220,252 240,252 248,262 C252,270 248,282 238,285 C226,288 212,282 208,272 C206,265 208,260 212,258Z",
    "전북":  "M148,302 C170,292 208,290 232,308 C245,318 245,345 232,362 C218,380 188,385 162,375 C138,366 128,342 132,318 C134,308 140,304 148,302Z",
    "전남":  "M130,378 C152,365 195,362 220,378 C235,388 238,415 228,440 C216,462 188,470 160,462 C132,454 112,430 112,404 C112,388 120,380 130,378Z",
    "광주":  "M168,378 C180,372 198,374 205,384 C210,392 205,405 194,408 C180,412 165,406 162,395 C160,386 164,380 168,378Z",
    "경북":  "M322,218 C348,208 398,210 425,235 C440,248 440,282 428,312 C415,340 385,352 355,348 C325,344 305,322 302,295 C298,268 305,240 315,228 C318,224 320,220 322,218Z",
    "대구":  "M322,285 C338,278 368,278 378,295 C385,308 378,328 362,334 C345,340 322,332 316,318 C310,305 314,290 322,285Z",
    "경남":  "M228,365 C255,352 308,350 348,368 C368,378 372,408 358,435 C342,460 308,468 275,462 C245,456 222,435 220,408 C218,388 224,370 228,365Z",
    "부산":  "M352,430 C368,418 398,418 412,435 C420,448 414,465 398,470 C380,475 355,466 348,450 C344,440 346,434 352,430Z",
    "울산":  "M392,362 C410,352 435,354 445,372 C452,385 445,405 428,410 C410,415 390,406 384,390 C380,378 384,366 392,362Z",
  };

  var REGION_LABELS = {
    "서울":[232,207], "인천":[196,211], "경기":[238,192],
    "강원":[335,182], "충북":[280,268], "충남":[190,262],
    "대전":[228,270], "세종":[231,250], "전북":[188,335],
    "전남":[172,418], "광주":[186,392], "경북":[368,282],
    "대구":[348,308], "경남":[292,410], "부산":[380,446],
    "울산":[412,385],
  };

  // 시장 있는 권역
  // 9개 중앙공영도매시장 지역만 활성화
  var ACTIVE_REGIONS = ["서울","인천","부산","대구","광주","대전","울산"];

  function getStats(region){
    var ms=MARKETS.filter(function(m){return m.region===region;});
    var cnt=0,avl=0;
    ms.forEach(function(m){
      cnt+=REC_TODAY.filter(function(r){return r.market.id===m.id;}).length;
      avl+=REC_TODAY.filter(function(r){return r.market.id===m.id&&r.available;}).length;
    });
    return {markets:ms.length,cnt:cnt,avl:avl};
  }

  var selStats=selected?getStats(selected):null;
  var selMarkets=selected?MARKETS.filter(function(m){return m.region===selected;}):[];
  var ALL_REGIONS=(function(){
    var keys=Object.keys(REGION_PATHS);
    // 서울/인천/대전/광주/대구/부산/울산 등 작은 도시는 맨 마지막에 그려서 클릭 가능하게
    var small=["세종","대전","광주","대구","울산","부산","서울","인천"];
    var big=keys.filter(function(k){return small.indexOf(k)===-1;});
    var sm=keys.filter(function(k){return small.indexOf(k)!==-1;});
    return big.concat(sm);
  })();

  return (
    <div>
      <div style={{background:"#fff",borderRadius:16,padding:"14px 18px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",marginBottom:14,border:"1px solid #bbf7d0"}}>
        <div style={{fontWeight:900,fontSize:15,color:G.mid}}>전국 중앙공영도매시장</div>
        <div style={{fontSize:11,color:"#888",marginTop:2}}>9개 중앙공영도매시장 · 지역 탭 → 시장 정보 · 회색은 미운영 지역</div>
      </div>

      {/* 지도 영역 */}
      <div style={{background:"#f8fffe",borderRadius:20,padding:"10px",marginBottom:14,border:"1px solid #bbf7d0",boxShadow:"0 4px 20px rgba(0,0,0,0.06)"}}>
        <svg viewBox="90 115 420 395" style={{width:"100%",display:"block"}}>
          <defs>
            <filter id="rgn-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="rgba(13,43,26,0.25)"/>
            </filter>
            <filter id="sel-shadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="rgba(13,43,26,0.4)"/>
            </filter>
          </defs>

          {ALL_REGIONS.map(function(r){
            var path=REGION_PATHS[r];
            var lbl=REGION_LABELS[r];
            var isActive=ACTIVE_REGIONS.indexOf(r)!==-1;
            var isSel=selected===r;
            var isHov=hovered===r;
            var ms=MARKETS.filter(function(m){return m.region===r;}).length;

            // 색상 체계
            var fill, stroke, strokeW;
            if(!isActive){
              // 시장 없는 지역 (세종)
              fill="#c8e6d0"; stroke="#a8d4b8"; strokeW="1";
            } else if(isSel){
              fill="#1b4332"; stroke="#0d2b1a"; strokeW="2.5";
            } else if(isHov){
              fill="#40916c"; stroke="#2d6a4f"; strokeW="2";
            } else {
              // 시장 수에 따라 색상 농도 조절
              var intensity = ms>=4?"#2d6a4f":ms>=3?"#40916c":ms>=2?"#52b788":"#74c69d";
              fill=intensity; stroke="#fff"; strokeW="1.2";
            }

            return (
              <g key={r}
                style={{cursor:isActive?"pointer":"default"}}
                onClick={function(){if(isActive)setSelected(isSel?null:r);}}
                onMouseEnter={function(){if(isActive)setHovered(r);}}
                onMouseLeave={function(){setHovered(null);}}>
                <path
                  d={path}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeW}
                  strokeLinejoin="round"
                  filter={isSel?"url(#sel-shadow)":"url(#rgn-shadow)"}
                  style={{transition:"fill 0.18s ease, stroke 0.18s ease, filter 0.18s ease"}}
                />
                {lbl&&<text
                  x={lbl[0]} y={lbl[1]}
                  textAnchor="middle"
                  fontSize={["서울","인천","대전","광주","대구","세종"].indexOf(r)!==-1?"8":"9"}
                  fontWeight="800"
                  fill={isSel?"#d1fae5":!isActive?"#6b7280":"#fff"}
                  letterSpacing="-0.3"
                  style={{pointerEvents:"none",userSelect:"none"}}>
                  {r}
                </text>}
                {isActive&&lbl&&ms>0&&<text
                  x={lbl[0]} y={lbl[1]+11}
                  textAnchor="middle"
                  fontSize="6.5"
                  fill={isSel?"rgba(209,250,229,0.9)":"rgba(255,255,255,0.75)"}
                  style={{pointerEvents:"none",userSelect:"none"}}>
                  {ms}개 시장
                </text>}
              </g>
            );
          })}
        </svg>

        {/* 안내 */}
        <div style={{textAlign:"center",paddingBottom:4}}>
          {!selected&&!hovered&&<span style={{fontSize:10,color:"#94a3b8"}}>지역을 탭하여 시장 정보 확인 👆</span>}
          {hovered&&!selected&&<span style={{fontSize:11,color:G.mid,fontWeight:700}}>📍 {hovered} 권역 — 탭하여 선택</span>}
          {selected&&<span style={{fontSize:11,color:G.mid,fontWeight:700}}>📍 {selected} 권역 선택됨 · 다시 탭하면 해제</span>}
        </div>

        {/* 범례 */}
        <div style={{display:"flex",justifyContent:"center",gap:12,paddingTop:4,borderTop:"1px solid #e8f5e9",marginTop:6}}>
          {[["#1b4332","선택"],["#40916c","시장 4개↑"],["#52b788","시장 2~3개"],["#74c69d","시장 1개"],["#c8e6d0","미운영"]].map(function(item){
            return <div key={item[1]} style={{display:"flex",alignItems:"center",gap:3}}>
              <div style={{width:10,height:10,borderRadius:3,background:item[0],border:"1px solid rgba(0,0,0,0.1)"}}/>
              <span style={{fontSize:9,color:"#888"}}>{item[1]}</span>
            </div>;
          })}
        </div>
      </div>

      {/* 선택 지역 패널 */}
      {selected&&selStats&&(
        <div style={{background:"#fff",borderRadius:16,border:"2px solid #1b4332",padding:"16px",marginBottom:12,boxShadow:"0 6px 24px rgba(27,67,50,0.12)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{fontWeight:900,fontSize:17,color:G.mid}}>📍 {selected}권</div>
              <div style={{fontSize:11,color:"#888",marginTop:2}}>공영도매시장 {selStats.markets}개소</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:14,fontWeight:800,color:G.mid}}>오늘 {selStats.cnt}건</div>
              <div style={{fontSize:11,color:"#22c55e",fontWeight:600}}>거래가능 {selStats.avl}건</div>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:12}}>
            {selMarkets.map(function(m){
              var cnt=REC_TODAY.filter(function(r){return r.market.id===m.id;}).length;
              var avl=REC_TODAY.filter(function(r){return r.market.id===m.id&&r.available;}).length;
              return (
              <div key={m.id} style={{borderRadius:12,border:"1px solid #bbf7d0",overflow:"hidden",marginBottom:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 13px",background:"#f8fffe"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:"#0d1f15"}}>{m.name}</div>
                      <div style={{fontSize:10,color:"#aaa",marginTop:1}}>{m.addr}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                      <div style={{fontSize:12,fontWeight:700,color:G.mid}}>{avl}건 가능</div>
                      <div style={{fontSize:10,color:"#aaa"}}>총 {cnt}건</div>
                    </div>
                  </div>
                  {m.auctionTimes&&m.auctionTimes.length>0&&(
                    <div style={{background:"#fffbeb",borderTop:"1px solid #fde68a",padding:"8px 13px"}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#92400e",marginBottom:4}}>🕐 경매 시간</div>
                      {m.auctionTimes.map(function(at,ai){return (
                        <div key={ai} style={{display:"flex",gap:6,marginBottom:2,alignItems:"flex-start"}}>
                          <span style={{fontSize:10,color:"#78350f",fontWeight:600,minWidth:80,flexShrink:0}}>{at.session}</span>
                          <span style={{fontSize:10,color:"#92400e"}}>{at.time}{at.items?" — "+at.items:""}</span>
                        </div>
                      );})}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={function(){onGoSearch(selected);}}
            style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:13,padding:"13px 0",fontWeight:900,fontSize:14,cursor:"pointer",boxShadow:"0 4px 14px rgba(27,67,50,0.3)"}}>
            🔍 {selected}권 경락가 검색하기
          </button>
        </div>
      )}

      {/* 전체 통계 */}
      <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:14,padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,textAlign:"center"}}>
        {[["🏪","참여 시장",MARKETS.length+"개소"],["📊","오늘 경락",REC_TODAY.length+"건"],["✅","거래 가능",REC_TODAY.filter(function(r){return r.available;}).length+"건"]].map(function(r){
          return <div key={r[1]}>
            <div style={{fontSize:20}}>{r[0]}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",marginTop:3}}>{r[1]}</div>
            <div style={{fontSize:15,fontWeight:900,color:"#4ade80",marginTop:1}}>{r[2]}</div>
          </div>;
        })}
      </div>
    </div>
  );
}

// ── 시연용 계정 & 공유 주문 저장소 ──
var DEMO_USERS = [
  {id:"buyer01", pw:"1234", name:"김민준", role:"buyer",  biz:"서울청과마트",   bizNo:"123-45-67890", deposit:500000,  joined:"2025-03-10"},
  {id:"seller01",pw:"1234", name:"이정호", role:"seller", biz:"가락청과",       bizNo:"987-65-43210", deposit:2000000, joined:"2024-11-05",
   market:MARKETS[0], mainItems:["사과(후지)","배(신고)","사과(홍로)"]},
];

// 전역 주문 저장소 (세션 내 공유)
var ORDER_STORE = [
  {id:"ORD-2026-0388", date:"2026-05-22 05:14", buyerId:"buyer01", sellerId:"seller01",
   item:"포도(샤인머스켓) 특등급", emoji:"🍇", market:"서울 가락시장", qty:15, price:28000,
   freight:57000, total:477000, status:"거래확정", review:null,
   addr:"서울 마포구 홍대로 52", phone:"010-1234-5678"},
  {id:"ORD-2026-0412", date:"2026-05-28 04:51", buyerId:"buyer01", sellerId:"seller01",
   item:"딸기(설향) 특등급", emoji:"🍓", market:"서울 가락시장", qty:30, price:22000,
   freight:114000, total:774000, status:"거래확정", review:"신선도가 정말 좋았어요. 재거래 의사 있습니다.",
   addr:"서울 마포구 홍대로 52", phone:"010-1234-5678"},
  {id:"ORD-2026-0481", date:"2026-06-01 03:22", buyerId:"buyer01", sellerId:"seller01",
   item:"사과(후지) 상등급", emoji:"🍎", market:"서울 가락시장", qty:20, price:36000,
   freight:76000, total:796000, status:"수령확인대기", review:null,
   addr:"서울 마포구 홍대로 52", phone:"010-1234-5678"},
];

// 판매자 등록 상품 저장소
var LISTING_STORE = [
  {id:"LST-001", sellerId:"seller01", date:TODAY, item:"사과(후지)", grade:"특", emoji:"🍎",
   qty:80, price:41000, market:"서울 가락시장", desc:"오늘 새벽 직경락. 경북 안동 사과 80box 특등급 선별 완료.", remainQty:80},
  {id:"LST-002", sellerId:"seller01", date:TODAY, item:"배(신고)", grade:"상", emoji:"🍐",
   qty:40, price:50000, market:"서울 가락시장", desc:"당일 경락 배 상등급 40box. 15kg 규격박스.", remainQty:28},
];

function genOrderId() {
  return "ORD-2026-" + String(Math.floor(Math.random()*900)+100+ORDER_STORE.length*7);
}
function genListingId() {
  return "LST-" + String(LISTING_STORE.length + 10).padStart(3,"0");
}

// ── 로그인 모달 ──

function LoginModal(props) {
  var onClose=props.onClose, onLogin=props.onLogin;
  var us=useState(""); var uid=us[0]; var setUid=us[1];
  var ps=useState(""); var pw=ps[0]; var setPw=ps[1];
  var es=useState(""); var err=es[0]; var setErr=es[1];
  var ms=useState("login"); var mode=ms[0]; var setMode=ms[1];

  function doLogin() {
    var u = DEMO_USERS.find(function(u){return u.id===uid&&u.pw===pw;});
    if(!u){setErr("아이디 또는 비밀번호가 올바르지 않습니다.\n(시연계정: buyer01/1234 또는 seller01/1234)");return;}
    onLogin(u);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:22,maxWidth:380,width:"100%",overflow:"hidden",boxShadow:"0 32px 80px rgba(0,0,0,0.35)"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{background:"linear-gradient(160deg,#0d2b1a,#1b4332)",padding:"20px 22px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{color:"#52b788",fontSize:10,letterSpacing:3,fontWeight:700}}>AGRO CONNECT</div>
              <div style={{color:"#fff",fontWeight:900,fontSize:17,marginTop:3}}>{mode==="login"?"로그인":"회원가입"}</div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:13}}>✕</button>
          </div>
        </div>

        {mode==="login"&&<div style={{padding:"22px 22px 20px"}}>
          <div style={{marginBottom:13}}>
            <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:5}}>아이디</div>
            <input value={uid} onChange={function(e){setUid(e.target.value);setErr("");}} placeholder="아이디 입력" style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"11px 13px",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
          </div>
          <div style={{marginBottom:13}}>
            <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:5}}>비밀번호</div>
            <input type="password" value={pw} onChange={function(e){setPw(e.target.value);setErr("");}} onKeyDown={function(e){if(e.key==="Enter")doLogin();}} placeholder="비밀번호 입력" style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"11px 13px",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
          </div>
          {err&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:9,padding:"9px 12px",fontSize:11,color:"#dc2626",marginBottom:12,whiteSpace:"pre-line"}}>{err}</div>}
          <button onClick={doLogin} style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontSize:14,fontWeight:900,cursor:"pointer",marginBottom:12}}>로그인</button>
          <div style={{background:"#f0fdf4",borderRadius:10,padding:"11px 13px",fontSize:11,color:"#166534",lineHeight:1.8}}>
            <b>시연 계정</b><br/>
            구매자: <code>buyer01</code> / <code>1234</code><br/>
            판매자: <code>seller01</code> / <code>1234</code>
          </div>
          <button onClick={function(){setMode("signup");}} style={{width:"100%",background:"none",border:"none",color:"#888",fontSize:12,marginTop:12,cursor:"pointer"}}>계정이 없으신가요? <span style={{color:G.mid,fontWeight:700}}>회원가입</span></button>
        </div>}

        {mode==="signup"&&<div style={{padding:"22px 22px 20px"}}>
          <div style={{fontSize:13,color:"#555",lineHeight:1.8,marginBottom:16}}>
            사업자등록증 인증 후 가입이 완료됩니다.<br/>아래 정보를 입력해 주세요.
          </div>
          {[["사업자명","상호명 입력"],["대표자명","대표자 실명"],["사업자등록번호","000-00-00000"],["아이디","영문+숫자 6자 이상"],["비밀번호","8자 이상"]].map(function(f){return (
            <div key={f[0]} style={{marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>{f[0]}</div>
              <input placeholder={f[1]} style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
            </div>
          );})}
          <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:9,padding:"9px 12px",fontSize:11,color:"#92400e",marginBottom:14,lineHeight:1.7}}>
            📎 사업자등록증 사본 업로드 (승인 후 입점 가능)<br/>보증금: 최소 50만원 이상 예치 필요
          </div>
          <button style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontSize:14,fontWeight:900,cursor:"pointer",marginBottom:8}} onClick={function(){alert("시연 환경에서는 실제 가입이 제한됩니다.\n시연 계정: buyer01/1234, seller01/1234");}}>📋 가입 신청</button>
          <button onClick={function(){setMode("login");}} style={{width:"100%",background:"none",border:"none",color:"#888",fontSize:12,cursor:"pointer"}}>로그인으로 돌아가기</button>
        </div>}
      </div>
    </div>
  );
}

// ── 주문 상태 배지 ──
function statusBadge(s) {
  if(s==="주문접수")     return {bg:"#fef3c7",color:"#92400e",label:"📋 주문접수"};
  if(s==="판매자확인중") return {bg:"#eff6ff",color:"#1e40af",label:"👀 확인중"};
  if(s==="발송완료")     return {bg:"#f0f9ff",color:"#0369a1",label:"🚚 발송완료"};
  if(s==="수령확인대기") return {bg:"#fef9c3",color:"#713f12",label:"📦 수령확인"};
  if(s==="거래확정")     return {bg:"#f0fdf4",color:"#166534",label:"✅ 거래확정"};
  if(s==="취소")         return {bg:"#fef2f2",color:"#dc2626",label:"❌ 취소"};
  return {bg:"#f3f4f6",color:"#666",label:s};
}

// ── 구매자 마이페이지 ──
function BuyerMyPage(props) {
  var user=props.user, orders=props.orders, onUpdateOrder=props.onUpdateOrder, onGoSearch=props.onGoSearch, onLogout=props.onLogout;
  var ts=useState("orders"); var tab=ts[0]; var setTab=ts[1];
  var rs=useState(null); var reviewTarget=rs[0]; var setReviewTarget=rs[1];
  var rt=useState(""); var reviewText=rt[0]; var setReviewText=rt[1];
  var rr=useState(0); var reviewRating=rr[0]; var setReviewRating=rr[1];
  var ds=useState(null); var detailOrder=ds[0]; var setDetailOrder=ds[1];

  var myOrders = orders.filter(function(o){return o.buyerId===user.id;})
    .sort(function(a,b){return b.date>a.date?1:-1;});
  var totalSpent = myOrders.filter(function(o){return o.status==="거래확정";}).reduce(function(s,o){return s+o.total;},0);

  function submitReview(ord) {
    if(!reviewRating){alert("별점을 선택해주세요.");return;}
    onUpdateOrder(ord.id, {review:reviewText||"만족합니다.", reviewRating:reviewRating, status:"거래확정"});
    setReviewTarget(null); setReviewText(""); setReviewRating(0);
  }

  return (
    <div>
      {/* 주문 상세 모달 */}
      {detailOrder&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={function(){setDetailOrder(null);}}>
        <div style={{background:"#fff",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,maxHeight:"85vh",overflowY:"auto",padding:"20px 18px 34px"}} onClick={function(e){e.stopPropagation();}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontWeight:900,fontSize:16,color:G.mid}}>📋 주문 상세</div>
            <button onClick={function(){setDetailOrder(null);}} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"5px 12px",cursor:"pointer"}}>✕</button>
          </div>
          <div style={{background:"#f0fdf4",borderRadius:14,padding:"14px",marginBottom:14}}>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:32}}>{detailOrder.emoji}</span>
              <div>
                <div style={{fontWeight:800,fontSize:15}}>{detailOrder.item}</div>
                <div style={{fontSize:12,color:"#666"}}>{detailOrder.market} · {detailOrder.qty}box</div>
              </div>
            </div>
            {[["주문번호",detailOrder.id],["주문일시",detailOrder.date],["단가",detailOrder.price.toLocaleString()+"원/box"],["물류비",detailOrder.freight.toLocaleString()+"원"]].map(function(r){return (
              <div key={r[0]} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{color:"#888"}}>{r[0]}</span><b>{r[1]}</b></div>
            );})}
            <div style={{display:"flex",justifyContent:"space-between",fontSize:14,marginTop:8,paddingTop:8,borderTop:"1px solid #bbf7d0"}}>
              <span style={{fontWeight:700}}>총 결제금액</span>
              <b style={{color:G.mid,fontSize:17}}>{detailOrder.total.toLocaleString()}원</b>
            </div>
          </div>
          <div style={{background:"#f8fffe",borderRadius:11,padding:"11px 13px",marginBottom:14,fontSize:12}}>
            <div style={{fontWeight:700,marginBottom:4}}>📍 납품 주소</div>
            <div style={{color:"#555"}}>{detailOrder.addr}</div>
            <div style={{color:"#888",marginTop:3}}>📞 {detailOrder.phone}</div>
          </div>
          {detailOrder.status==="발송완료"&&<button onClick={function(){onUpdateOrder(detailOrder.id,{status:"수령확인대기"});setDetailOrder(null);}} style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:13,padding:"14px 0",fontWeight:900,fontSize:14,cursor:"pointer",marginBottom:8}}>📦 수령 확인 완료</button>}
          {detailOrder.status==="수령확인대기"&&!detailOrder.review&&<button onClick={function(){setReviewTarget(detailOrder);setDetailOrder(null);}} style={{width:"100%",background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",border:"none",borderRadius:13,padding:"14px 0",fontWeight:900,fontSize:14,cursor:"pointer"}}>⭐ 거래 리뷰 작성하기</button>}
          {detailOrder.review&&<div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:11,padding:"11px 13px"}}>
            <div style={{fontWeight:700,fontSize:12,marginBottom:3}}>내 리뷰 {"★".repeat(detailOrder.reviewRating||4)}</div>
            <div style={{fontSize:12,color:"#555"}}>{detailOrder.review}</div>
          </div>}
        </div>
      </div>}

      {/* 리뷰 모달 */}
      {reviewTarget&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div style={{background:"#fff",borderRadius:20,maxWidth:360,width:"100%",padding:"22px 20px"}}>
          <div style={{fontWeight:900,fontSize:16,color:G.mid,marginBottom:14}}>⭐ 거래 리뷰 작성</div>
          <div style={{background:"#f0fdf4",borderRadius:11,padding:"10px 13px",marginBottom:14,fontSize:12,color:"#555"}}>{reviewTarget.item} · {reviewTarget.market}</div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"#888",marginBottom:8}}>별점 선택</div>
            <div style={{display:"flex",gap:8,fontSize:32}}>
              {[1,2,3,4,5].map(function(n){return <span key={n} onClick={function(){setReviewRating(n);}} style={{cursor:"pointer",color:reviewRating>=n?"#f59e0b":"#ddd"}}>{reviewRating>=n?"★":"☆"}</span>;})}
            </div>
          </div>
          <textarea value={reviewText} onChange={function(e){setReviewText(e.target.value);}} placeholder="신선도, 포장 상태, 납품 시간 등 솔직하게 남겨주세요." rows={3} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none",resize:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:14}}/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={function(){setReviewTarget(null);}} style={{flex:1,background:"#f3f4f6",border:"none",borderRadius:12,padding:"13px 0",fontWeight:700,color:"#666",cursor:"pointer"}}>나중에</button>
            <button onClick={function(){submitReview(reviewTarget);}} style={{flex:2,background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontWeight:900,cursor:"pointer"}}>리뷰 등록</button>
          </div>
        </div>
      </div>}

      {/* 프로필 */}
      <div style={{background:"linear-gradient(160deg,#0d2b1a,#1b4332)",borderRadius:20,padding:"18px 18px 14px",marginBottom:14,color:"#fff"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <div style={{width:50,height:50,borderRadius:14,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🛒</div>
          <div>
            <div style={{fontWeight:900,fontSize:17}}>{user.name}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginTop:1}}>{user.biz}</div>
            <div style={{display:"flex",gap:5,marginTop:4}}>
              <span style={{background:"rgba(74,222,128,0.25)",color:"#4ade80",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 9px"}}>✅ 사업자 인증</span>
              <span style={{background:"rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.8)",fontSize:10,borderRadius:20,padding:"2px 9px"}}>구매자</span>
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[["총 구매",myOrders.length+"건"],["확정",myOrders.filter(function(o){return o.status==="거래확정";}).length+"건"],["구매액",(totalSpent/10000).toFixed(0)+"만원"]].map(function(r){return (
            <div key={r[0]} style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",marginBottom:2}}>{r[0]}</div>
              <div style={{fontSize:14,fontWeight:900}}>{r[1]}</div>
            </div>
          );})}
        </div>
      </div>

      <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",overflow:"hidden",marginBottom:14}}>
        <div style={{display:"flex",borderBottom:"1px solid #e5e7eb"}}>
          {[["orders","📦 구매내역"],["profile","👤 내 정보"]].map(function(t){return (
            <button key={t[0]} onClick={function(){setTab(t[0]);}} style={{flex:1,padding:"13px 0",border:"none",background:"transparent",fontWeight:tab===t[0]?800:400,color:tab===t[0]?G.mid:"#888",borderBottom:tab===t[0]?"2.5px solid "+G.mid:"2.5px solid transparent",cursor:"pointer",fontSize:13}}>{t[1]}</button>
          );})}
        </div>
        <div style={{padding:14}}>
          {tab==="orders"&&<div>
            {myOrders.length===0
              ?<div style={{textAlign:"center",padding:"30px 0"}}>
                  <div style={{fontSize:40,marginBottom:8}}>📦</div>
                  <div style={{fontSize:13,color:"#888",marginBottom:14}}>아직 구매 내역이 없어요</div>
                  <button onClick={onGoSearch} style={{background:G.mid,color:"#fff",border:"none",borderRadius:11,padding:"11px 22px",fontWeight:700,cursor:"pointer"}}>경락가 검색하러 가기 →</button>
                </div>
              :<div style={{display:"flex",flexDirection:"column",gap:10}}>
                {myOrders.map(function(o){var sb=statusBadge(o.status);return (
                  <div key={o.id} style={{border:"1px solid #e5e7eb",borderRadius:14,overflow:"hidden"}}>
                    <div style={{background:"#f9fafb",padding:"8px 13px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{fontSize:10,color:"#aaa"}}>{o.id} · {o.date.split(" ")[0]}</div>
                      <span style={{background:sb.bg,color:sb.color,fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px"}}>{sb.label}</span>
                    </div>
                    <div style={{padding:"11px 13px"}}>
                      <div style={{display:"flex",gap:9,alignItems:"center",marginBottom:7}}>
                        <span style={{fontSize:26}}>{o.emoji}</span>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>{o.item}</div>
                          <div style={{fontSize:11,color:"#888"}}>{o.market} · {o.qty}box</div>
                        </div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{fontWeight:900,fontSize:15,color:G.mid}}>{o.total.toLocaleString()}원</div>
                        <div style={{display:"flex",gap:6}}>
                          {o.status==="발송완료"&&<button onClick={function(){setDetailOrder(o);}} style={{background:G.mid,color:"#fff",border:"none",borderRadius:9,padding:"6px 13px",fontSize:11,fontWeight:700,cursor:"pointer"}}>📦 수령확인</button>}
                          {o.status==="수령확인대기"&&!o.review&&<button onClick={function(){setReviewTarget(o);}} style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:9,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⭐ 리뷰</button>}
                          {o.review&&<span style={{background:"#f0fdf4",color:"#166534",fontSize:10,fontWeight:700,borderRadius:9,padding:"5px 10px"}}>✅ 리뷰완료</span>}
                          <button onClick={function(){setDetailOrder(o);}} style={{background:"#f0fdf4",color:G.mid,border:"1px solid #bbf7d0",borderRadius:9,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>상세</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );})}
              </div>}
          </div>}
          {tab==="profile"&&<div>
            {[["상호명",user.biz],["대표자",user.name],["사업자번호",user.bizNo],["가입일",user.joined],["예치 보증금",user.deposit.toLocaleString()+"원"],["신용 등급","A+"]].map(function(r){return (
              <div key={r[0]} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #f3f4f6",fontSize:13}}><span style={{color:"#888"}}>{r[0]}</span><b>{r[1]}</b></div>
            );})}
          </div>}
        </div>
      </div>
      <button onClick={onLogout} style={{width:"100%",background:"#f3f4f6",border:"none",borderRadius:13,padding:"13px 0",fontSize:13,fontWeight:700,color:"#666",cursor:"pointer"}}>로그아웃</button>
    </div>
  );
}

// ── 판매자 마이페이지 ──
function SellerMyPage(props) {
  var user=props.user, orders=props.orders, listings=props.listings,
      onUpdateOrder=props.onUpdateOrder, onAddListing=props.onAddListing, onLogout=props.onLogout;
  var ts=useState("orders"); var tab=ts[0]; var setTab=ts[1];
  var ls=useState(false); var showListForm=ls[0]; var setShowListForm=ls[1];
  var fc=useState("사과"); var fCat=fc[0]; var setFCat=fc[1];
  var fv=useState("후지"); var fVariety=fv[0]; var setFVariety=fv[1];
  var fi=useState("사과(후지)"); var fItem=fi[0]; var setFItem=fi[1];
  var fg=useState("특"); var fGrade=fg[0]; var setFGrade=fg[1];
  var fq=useState(""); var fQty=fq[0]; var setFQty=fq[1];
  var fp=useState(""); var fPrice=fp[0]; var setFPrice=fp[1];
  var fd=useState(""); var fDesc=fd[0]; var setFDesc=fd[1];
  var fph=useState(null); var fPhoto=fph[0]; var setFPhoto=fph[1];
  var fps=useState(false); var showPhotoSheet=fps[0]; var setShowPhotoSheet=fps[1];

  // Artifact 환경에서는 파일 접근 불가 → 품목별 샘플 사진 선택 UI 사용
  // 실제 Replit 배포 시엔 진짜 갤러리 연동으로 교체
  var SAMPLE_PHOTOS = {
    "사과":   ["🍎 경북 안동 사과 박스 정면","🍎 사과 등급 라벨 클로즈업","🍎 사과 10kg 박스 측면"],
    "배":     ["🍐 나주 배 박스 정면","🍐 배 15kg 등급 스티커","🍐 배 박스 묶음 전경"],
    "감귤":   ["🍊 제주 감귤 망 포장","🍊 감귤 10kg 라벨","🍊 감귤 선별 완료 사진"],
    "딸기":   ["🍓 딸기 2kg 팩 정면","🍓 딸기 특등급 클로즈업","🍓 딸기 팩 묶음 사진"],
    "포도":   ["🍇 샤인머스켓 2kg 포장","🍇 포도송이 클로즈업","🍇 포도 박스 정면"],
    "복숭아": ["🍑 복숭아 4kg 박스","🍑 복숭아 등급 라벨","🍑 복숭아 선별 사진"],
    "수박":   ["🍉 수박 낱개 사진","🍉 수박 등급 스티커","🍉 수박 출하 현장"],
    "참외":   ["🍈 참외 10kg 박스","🍈 참외 등급 라벨","🍈 참외 선별 완료"],
    "토마토": ["🍅 토마토 5kg 박스","🍅 토마토 등급 사진","🍅 토마토 출하 현장"],
  };

  // 품목 이모지 → 배경색 (카드 시각화용)
  var PHOTO_BG = {
    "사과":"#fee2e2","배":"#fef9c3","감귤":"#ffedd5","딸기":"#ffe4e6",
    "포도":"#f3e8ff","복숭아":"#fce7f3","수박":"#dcfce7","참외":"#fef9c3","토마토":"#fee2e2",
  };

  function getCatFromItem(item){
    var cats=["사과","배","감귤","딸기","포도","복숭아","수박","참외","토마토"];
    return cats.find(function(k){return item.includes(k);})||"사과";
  }

  var myOrders   = orders.filter(function(o){return o.sellerId===user.id;}).sort(function(a,b){return b.date>a.date?1:-1;});
  var myListings = listings.filter(function(l){return l.sellerId===user.id;});
  var pendingCnt = myOrders.filter(function(o){return o.status==="주문접수";}).length;
  var totalSales = myOrders.filter(function(o){return o.status==="거래확정";}).reduce(function(s,o){return s+o.total;},0);

  // 카테고리별 품종 목록
  var VARIETY_MAP = {
    "사과":   ["후지","홍로","부사","아오리","감홍"],
    "배":     ["신고","원황","황금","추황"],
    "감귤":   ["노지감귤","한라봉","천혜향","레드향"],
    "딸기":   ["설향","죠향","킹스베리","매향"],
    "포도":   ["샤인머스켓","캠벨","거봉","청포도"],
    "복숭아": ["백도","황도","천도"],
    "수박":   ["일반","애플수박","블랙수박"],
    "참외":   ["일반","허니참외"],
    "토마토": ["일반토마토","방울토마토","대추토마토"],
  };
  var CATEGORY_LIST = Object.keys(VARIETY_MAP);
  var ITEMS_LIST = CATEGORY_LIST; // 호환용
  var EMOJI_MAP = {"사과":"🍎","배":"🍐","감귤":"🍊","한라봉":"🍊","딸기":"🍓","포도":"🍇","복숭아":"🍑","수박":"🍉","참외":"🍈","토마토":"🍅"};
  function getEmoji(name){var k=Object.keys(EMOJI_MAP).find(function(k){return name.includes(k);});return k?EMOJI_MAP[k]:"🌿";}

  function submitListing() {
    if(!fQty||!fPrice){alert("수량과 가격을 입력해주세요.");return;}
    onAddListing({id:genListingId(),sellerId:user.id,date:TODAY,item:fItem,grade:fGrade,emoji:getEmoji(fItem),qty:parseInt(fQty),price:parseInt(fPrice),market:user.market?user.market.name:"서울 가락시장",desc:fDesc||(TODAY+" 새벽 직경락 "+fGrade+"등급"),remainQty:parseInt(fQty),photoUrl:fPhoto?fPhoto.url:null});
    setShowListForm(false); setFQty(""); setFPrice(""); setFDesc(""); setFPhoto(null);
    alert("✅ 상품이 등록되었습니다!");
  }

  return (
    <div>
      {/* 상품 등록 폼 */}
      {showListForm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={function(){setShowListForm(false);}}>
        <div style={{background:"#fff",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,padding:"22px 18px 36px",maxHeight:"90vh",overflowY:"auto"}} onClick={function(e){e.stopPropagation();}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <div style={{fontWeight:900,fontSize:17,color:G.mid}}>🌿 오늘 낙찰 물량 등록</div>
            <button onClick={function(){setShowListForm(false);}} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:14}}>✕</button>
          </div>

          <div style={{marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:700,color:"#333",marginBottom:9}}>① 과일 선택</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>
              {CATEGORY_LIST.map(function(cat){return (
                <button key={cat} onClick={function(){setFCat(cat);var v=VARIETY_MAP[cat][0];setFVariety(v);setFItem(cat+"("+v+")");}} style={{padding:"12px 4px",background:fCat===cat?G.mid:"#f0fdf4",color:fCat===cat?"#fff":G.mid,border:"2px solid "+(fCat===cat?G.mid:"#bbf7d0"),borderRadius:12,cursor:"pointer",fontSize:12,fontWeight:fCat===cat?800:500}}>
                  {getEmoji(cat+"(x)")} {cat}
                </button>
              );})}
            </div>
          </div>
          {fCat&&VARIETY_MAP[fCat]&&VARIETY_MAP[fCat].length>1&&<div style={{marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:700,color:"#333",marginBottom:9}}>② 품종 선택</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {VARIETY_MAP[fCat].map(function(v){return (
                <button key={v} onClick={function(){setFVariety(v);setFItem(fCat+"("+v+")");}} style={{padding:"10px 16px",background:fVariety===v?G.mid:"#f9fafb",color:fVariety===v?"#fff":"#555",border:"2px solid "+(fVariety===v?G.mid:"#e5e7eb"),borderRadius:11,cursor:"pointer",fontSize:13,fontWeight:fVariety===v?800:500}}>
                  {v}
                </button>
              );})}
            </div>
          </div>}

          <div style={{marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:"#333",marginBottom:9}}>③ 등급 선택</div>
            <div style={{display:"flex",gap:9}}>
              {["특","상","보통"].map(function(g){return (
                <button key={g} onClick={function(){setFGrade(g);}} style={{flex:1,padding:"14px 0",background:fGrade===g?G.mid:"#f9fafb",color:fGrade===g?"#fff":"#555",border:"2px solid "+(fGrade===g?G.mid:"#e5e7eb"),borderRadius:14,cursor:"pointer",fontSize:16,fontWeight:900}}>
                  {g}등급
                </button>
              );})}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:"#333",marginBottom:7}}>④ 수량 (box)</div>
              <input type="number" value={fQty} onChange={function(e){setFQty(e.target.value);}} placeholder="예: 50" style={{width:"100%",border:"2px solid #bbf7d0",borderRadius:12,padding:"14px 10px",fontSize:20,fontWeight:700,outline:"none",boxSizing:"border-box",textAlign:"center",fontFamily:"inherit"}}/>
            </div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:"#333",marginBottom:7}}>⑤ 가격 (원/box)</div>
              <input type="number" value={fPrice} onChange={function(e){setFPrice(e.target.value);}} placeholder="예: 38000" style={{width:"100%",border:"2px solid #bbf7d0",borderRadius:12,padding:"14px 10px",fontSize:17,fontWeight:700,outline:"none",boxSizing:"border-box",textAlign:"center",fontFamily:"inherit"}}/>
            </div>
          </div>

          <div style={{marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:"#333",marginBottom:7}}>⑥ 한 줄 소개 <span style={{fontSize:12,fontWeight:400,color:"#aaa"}}>(선택사항)</span></div>
            <input value={fDesc} onChange={function(e){setFDesc(e.target.value);}} placeholder="예: 경북 안동 사과 당일 직경락, 크기 균일" style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:12,padding:"13px 12px",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
          </div>

          {fQty&&fPrice&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:13,padding:"13px 15px",marginBottom:16}}>
            <div style={{fontSize:11,color:"#888",marginBottom:6}}>📋 등록 미리보기</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><span style={{fontSize:24,marginRight:8}}>{getEmoji(fItem)}</span><b style={{fontSize:14}}>{fItem} {fGrade}등급 · {fQty}box</b></div>
              <b style={{fontSize:17,color:G.mid}}>{parseInt(fPrice||0).toLocaleString()}원</b>
            </div>
          </div>}

          {/* ⑦ 사진 선택 (선택사항) */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:"#333",marginBottom:7}}>⑦ 상품 사진 <span style={{fontSize:12,fontWeight:400,color:"#aaa"}}>(선택사항 · 구매자 신뢰 향상)</span></div>

            {/* 갤러리 시트 */}
            {showPhotoSheet&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:900,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={function(){setShowPhotoSheet(false);}}>
              <div style={{background:"#fff",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,padding:"20px 16px 34px",maxHeight:"70vh",overflowY:"auto"}} onClick={function(e){e.stopPropagation();}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={{fontWeight:800,fontSize:16,color:"#111"}}>📷 사진 선택</div>
                  <button onClick={function(){setShowPhotoSheet(false);}} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:14}}>✕</button>
                </div>
                <div style={{fontSize:12,color:"#888",marginBottom:12}}>
                  {fItem||"선택된 품목"}의 샘플 사진을 선택하세요
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {(SAMPLE_PHOTOS[getCatFromItem(fItem||"사과")]||SAMPLE_PHOTOS["사과"]).map(function(label,i){
                    var cat=getCatFromItem(fItem||"사과");
                    var bg=PHOTO_BG[cat]||"#f0fdf4";
                    var em=getEmoji(fItem||"사과");
                    var isSelected=fPhoto&&fPhoto.name===label;
                    return (
                      <button key={i} onClick={function(){
                        setFPhoto({name:label, url:null, sampleEmoji:em, sampleBg:bg, sampleLabel:label});
                        setShowPhotoSheet(false);
                      }} style={{background:isSelected?G.mid:bg,border:"2px solid "+(isSelected?G.mid:"transparent"),borderRadius:12,padding:"14px 6px",cursor:"pointer",textAlign:"center"}}>
                        <div style={{fontSize:30,marginBottom:6}}>{em}</div>
                        <div style={{fontSize:10,color:isSelected?"#fff":"#555",lineHeight:1.4,fontWeight:isSelected?700:400}}>{label.replace(/^[^ ]+ /,"")}</div>
                      </button>
                    );
                  })}
                </div>
                <div style={{marginTop:16,padding:"10px 12px",background:"#f8fffe",borderRadius:10,fontSize:11,color:"#888",textAlign:"center"}}>
                  💡 실제 서비스에서는 갤러리·카메라 직접 연동
                </div>
              </div>
            </div>}

            {fPhoto
              ? <div style={{borderRadius:14,overflow:"hidden",border:"2px solid #40916c"}}>
                  <div style={{background:fPhoto.sampleBg||"#f0fdf4",height:160,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6}}>
                    <div style={{fontSize:54}}>{fPhoto.sampleEmoji||"📸"}</div>
                    <div style={{fontSize:12,color:"#555",fontWeight:600}}>{fPhoto.sampleLabel||fPhoto.name}</div>
                  </div>
                  <div style={{padding:"10px 13px",background:"#f0fdf4",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:12,color:G.mid,fontWeight:700}}>📸 사진 선택됨</div>
                    <button onClick={function(){setShowPhotoSheet(true);}} style={{background:"#fff",border:"1px solid #bbf7d0",borderRadius:8,padding:"5px 12px",fontSize:11,color:G.mid,cursor:"pointer",fontWeight:600}}>사진 변경</button>
                  </div>
                </div>
              : <button onClick={function(){setShowPhotoSheet(true);}} style={{width:"100%",border:"2px dashed #bbf7d0",borderRadius:14,padding:"28px 16px",background:"#fafff8",cursor:"pointer",textAlign:"center",display:"block"}}>
                  <div style={{fontSize:40,marginBottom:8}}>📷</div>
                  <div style={{fontSize:15,color:"#333",fontWeight:700,marginBottom:4}}>사진 선택하기</div>
                  <div style={{fontSize:11,color:"#aaa"}}>탭하면 사진 목록이 열려요</div>
                </button>
            }
          </div>

          <button onClick={submitListing} style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:16,padding:"18px 0",fontSize:17,fontWeight:900,cursor:"pointer",boxShadow:"0 6px 20px rgba(27,67,50,0.35)"}}>
            ✅ 등록 완료
          </button>
        </div>
      </div>}

      {/* 프로필 */}
      <div style={{background:"linear-gradient(160deg,#0d2b1a,#1b4332)",borderRadius:20,padding:"18px 18px 14px",marginBottom:14,color:"#fff"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <div style={{width:50,height:50,borderRadius:14,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🏪</div>
          <div>
            <div style={{fontWeight:900,fontSize:17}}>{user.name}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginTop:1}}>{user.biz} · {user.market?user.market.name:"서울 가락시장"}</div>
            <div style={{display:"flex",gap:5,marginTop:4}}>
              <span style={{background:"rgba(74,222,128,0.25)",color:"#4ade80",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 9px"}}>✅ 사업자 인증</span>
              {pendingCnt>0&&<span style={{background:"rgba(251,191,36,0.4)",color:"#fde047",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 9px"}}>🔔 신규 {pendingCnt}건</span>}
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[["총 판매",myOrders.length+"건"],["확정",myOrders.filter(function(o){return o.status==="거래확정";}).length+"건"],["매출",(totalSales/10000).toFixed(0)+"만원"]].map(function(r){return (
            <div key={r[0]} style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",marginBottom:2}}>{r[0]}</div>
              <div style={{fontSize:14,fontWeight:900}}>{r[1]}</div>
            </div>
          );})}
        </div>
      </div>

      {/* 상품 등록 버튼 */}
      <button onClick={function(){setShowListForm(true);}} style={{width:"100%",background:"linear-gradient(135deg,#065f46,#059669)",color:"#fff",border:"none",borderRadius:16,padding:"17px 0",fontSize:17,fontWeight:900,cursor:"pointer",marginBottom:14,boxShadow:"0 6px 20px rgba(5,150,105,0.35)"}}>
        + 오늘 낙찰 물량 등록하기
      </button>

      <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",overflow:"hidden",marginBottom:14}}>
        <div style={{display:"flex",borderBottom:"1px solid #e5e7eb"}}>
          {[["orders","📋 들어온 주문"+(pendingCnt>0?" ("+pendingCnt+")":"")],["listings","🌿 내 상품"],["profile","👤 내 정보"]].map(function(t){return (
            <button key={t[0]} onClick={function(){setTab(t[0]);}} style={{flex:1,padding:"12px 4px",border:"none",background:"transparent",fontWeight:tab===t[0]?800:400,color:tab===t[0]?(pendingCnt>0&&t[0]==="orders"?"#dc2626":G.mid):"#888",borderBottom:tab===t[0]?"2.5px solid "+(pendingCnt>0&&t[0]==="orders"?"#dc2626":G.mid):"2.5px solid transparent",cursor:"pointer",fontSize:11}}>
              {t[1]}
            </button>
          );})}
        </div>
        <div style={{padding:14}}>

          {tab==="orders"&&<div>
            {myOrders.length===0
              ?<div style={{textAlign:"center",padding:"30px 0",color:"#aaa",fontSize:13}}>아직 들어온 주문이 없습니다</div>
              :<div style={{display:"flex",flexDirection:"column",gap:10}}>
                {myOrders.map(function(o){var sb=statusBadge(o.status); var isNew=o.status==="주문접수"; return (
                  <div key={o.id} style={{border:"2px solid "+(isNew?"#fde68a":"#e5e7eb"),borderRadius:14,overflow:"hidden",background:isNew?"#fffdf5":"#fff"}}>
                    <div style={{background:isNew?"#fef9c3":"#f9fafb",padding:"8px 13px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{fontSize:10,color:isNew?"#92400e":"#aaa",fontWeight:isNew?700:400}}>{isNew?"🔔 새 주문 들어왔어요!":o.id} · {o.date.split(" ")[0]}</div>
                      <span style={{background:sb.bg,color:sb.color,fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px"}}>{sb.label}</span>
                    </div>
                    <div style={{padding:"11px 13px"}}>
                      <div style={{display:"flex",gap:9,alignItems:"center",marginBottom:8}}>
                        <span style={{fontSize:26}}>{o.emoji}</span>
                        <div>
                          <div style={{fontWeight:700,fontSize:14}}>{o.item}</div>
                          <div style={{fontSize:11,color:"#888"}}>{o.qty}box · 납품: {o.addr}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{fontWeight:900,fontSize:15,color:G.mid}}>{o.total.toLocaleString()}원</div>
                        <div style={{display:"flex",gap:6}}>
                          {o.status==="주문접수"&&<button onClick={function(){onUpdateOrder(o.id,{status:"판매자확인중"});}} style={{background:"#eff6ff",color:"#1e40af",border:"1px solid #bfdbfe",borderRadius:9,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✔ 확인</button>}
                          {(o.status==="주문접수"||o.status==="판매자확인중")&&<button onClick={function(){onUpdateOrder(o.id,{status:"발송완료"});alert("🚚 발송 처리 완료!");}} style={{background:G.mid,color:"#fff",border:"none",borderRadius:9,padding:"7px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🚚 발송처리</button>}
                          {o.review&&<div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:9,padding:"5px 9px",fontSize:10,color:"#92400e"}}>⭐{"★".repeat(o.reviewRating||4)}</div>}
                          {o.status==="거래확정"&&!o.review&&<span style={{background:"#f0fdf4",color:"#166534",fontSize:10,fontWeight:700,borderRadius:9,padding:"5px 9px"}}>✅ 확정</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );})}
              </div>}
          </div>}

          {tab==="listings"&&<div>
            {myListings.length===0
              ?<div style={{textAlign:"center",padding:"30px 0"}}>
                  <div style={{fontSize:40,marginBottom:8}}>🌿</div>
                  <div style={{fontSize:13,color:"#888",marginBottom:14}}>등록된 상품이 없어요</div>
                  <button onClick={function(){setShowListForm(true);}} style={{background:G.mid,color:"#fff",border:"none",borderRadius:11,padding:"11px 22px",fontWeight:700,cursor:"pointer"}}>첫 상품 등록하기 +</button>
                </div>
              :<div style={{display:"flex",flexDirection:"column",gap:10}}>
                {myListings.map(function(l){return (
                  <div key={l.id} style={{border:"1px solid #e5e7eb",borderRadius:14,overflow:"hidden"}}>
                    {l.photoUrl&&<img src={l.photoUrl} alt={l.item} style={{width:"100%",height:130,objectFit:"cover",display:"block"}}/>}
                    <div style={{padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        {!l.photoUrl&&<span style={{fontSize:28}}>{l.emoji}</span>}
                        <div>
                          <div style={{fontWeight:700,fontSize:14}}>{l.item} {l.grade}등급</div>
                          <div style={{fontSize:11,color:"#888",marginTop:2}}>{l.market} · 잔여 {l.remainQty}box</div>
                          {l.desc&&<div style={{fontSize:10,color:"#aaa",marginTop:2}}>{l.desc}</div>}
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontWeight:900,fontSize:15,color:G.mid}}>{l.price.toLocaleString()}원</div>
                        <div style={{fontSize:10,color:"#aaa",marginTop:2}}>{l.remainQty}box 남음</div>
                      </div>
                    </div>
                  </div>
                );})}
              </div>}
          </div>}

          {tab==="profile"&&<div>
            {[["상호명",user.biz],["대표자",user.name],["사업자번호",user.bizNo],["소속 시장",user.market?user.market.name:"서울 가락시장"],["가입일",user.joined],["예치 보증금",user.deposit.toLocaleString()+"원"],["신용 등급","A+"]].map(function(r){return (
              <div key={r[0]} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #f3f4f6",fontSize:13}}><span style={{color:"#888"}}>{r[0]}</span><b>{r[1]}</b></div>
            );})}
          </div>}
        </div>
      </div>
      <button onClick={onLogout} style={{width:"100%",background:"#f3f4f6",border:"none",borderRadius:13,padding:"13px 0",fontSize:13,fontWeight:700,color:"#666",cursor:"pointer"}}>로그아웃</button>
    </div>
  );
}

// ── 마이페이지 라우터 ──
function MyPage(props) {
  if(props.user.role==="buyer") return <BuyerMyPage {...props}/>;
  return <SellerMyPage {...props}/>;
}

// ── 메인 앱 ──
function App() {
  var s1=useState("search");   var tab=s1[0];          var setTab=s1[1];
  var s2=useState(TODAY);      var selDate=s2[0];       var setSelDate=s2[1];
  var s3=useState("전체");    var filterCat=s3[0];     var setFilterCat=s3[1];
  var s4=useState("");         var filterItem=s4[0];    var setFilterItem=s4[1];
  var s5=useState("전체");    var filterRegion=s5[0];  var setFilterRegion=s5[1];
  var s6=useState("전체");    var filterGrade=s6[0];   var setFilterGrade=s6[1];
  var s7=useState(false);      var filterAvail=s7[0];   var setFilterAvail=s7[1];
  var s8=useState("price");    var sortBy=s8[0];        var setSortBy=s8[1];
  var s9=useState(false);      var searched=s9[0];      var setSearched=s9[1];
  var s10=useState("");        var keyword=s10[0];      var setKeyword=s10[1];
  var s11=useState("");        var destRegion=s11[0];   var setDestRegion=s11[1];
  var s12=useState(null);      var detailRec=s12[0];    var setDetailRec=s12[1];
  var s13=useState(null);      var chatRec=s13[0];      var setChatRec=s13[1];
  var s14=useState(null);      var escrowRec=s14[0];    var setEscrowRec=s14[1];
  var s15=useState(null);      var claimRec=s15[0];     var setClaimRec=s15[1];
  var s16=useState(null);      var photoRec=s16[0];     var setPhotoRec=s16[1];
  // 로그인 상태
  var sl=useState(null);       var loginUser=sl[0];     var setLoginUser=sl[1];
  var sm=useState(false);      var showLogin=sm[0];     var setShowLogin=sm[1];
  var so=useState(ORDER_STORE.slice()); var orders=so[0]; var setOrders=so[1];
  var sx=useState(LISTING_STORE.slice()); var listings=sx[0]; var setListings=sx[1];

  // ── Google Sheets 실시간 데이터 ──
  var sg1=useState(null);  var sheetData=sg1[0];   var setSheetData=sg1[1];
  var sg2=useState("idle"); var sheetStatus=sg2[0]; var setSheetStatus=sg2[1];
  var sg3=useState("");    var sheetError=sg3[0];   var setSheetError=sg3[1];

  var marketsMap = {};
  MARKETS.forEach(function(m){ marketsMap[String(m.id)] = m; });

  useEffect(function(){
    var cancelled = false;
    async function loadSheet() {
      setSheetStatus("loading");
      try {
        var res = await fetch(CSV_URL);
        if(!res.ok) throw new Error("시트 로드 실패 " + res.status);
        var csv = await res.text();
        if(cancelled) return;
        var rows = parseSheetRows(csv, marketsMap);
        if(rows.length > 0) {
          setSheetData(rows);
          setSheetStatus("ok");
        } else {
          setSheetStatus("empty");
        }
      } catch(e) {
        if(!cancelled) { setSheetStatus("error"); setSheetError(e.message); }
      }
    }
    loadSheet();
    // 1시간마다 자동 갱신
    var interval = setInterval(loadSheet, 60 * 60 * 1000);
    return function(){ cancelled=true; clearInterval(interval); };
  }, []);

  var usingRealData = !!(sheetData && sheetData.length > 0);

  function updateOrder(id, changes) {
    setOrders(function(prev){return prev.map(function(o){return o.id===id?Object.assign({},o,changes):o;});});
  }
  function addOrder(newOrder) {
    setOrders(function(prev){return [newOrder].concat(prev);});
  }
  function addListing(newListing) {
    setListings(function(prev){return [newListing].concat(prev);});
  }

  // Google Sheets CORS 차단 시 가상 데이터로 fallback
  // 단, 데이터가 있으면 실제 데이터로 표시
  var base = usingRealData ? sheetData : (ALL_REC[selDate] || []);
  var isRealData = usingRealData;
  var filtered=base.filter(function(r){
    if(filterCat!=="전체"&&r.item.cat!==filterCat)return false;
    if(filterItem&&r.item.name!==filterItem)return false;
    if(filterRegion!=="전체"&&r.market.region!==filterRegion)return false;
    if(filterGrade!=="전체"&&r.grade!==filterGrade)return false;
    if(filterAvail&&!r.available)return false;
    if(keyword&&!r.item.name.includes(keyword)&&!r.market.name.includes(keyword))return false;
    return true;
  }).sort(function(a,b){
    if(sortBy==="price"&&destRegion){
      var la=calcLogistics(a.market.region,destRegion,10,null),lb=calcLogistics(b.market.region,destRegion,10,null);
      return (a.price+la.ratePerBox)-(b.price+lb.ratePerBox);
    }
    if(sortBy==="price")return a.price-b.price;
    if(sortBy==="date")return b.date.localeCompare(a.date);
    return b.qty-a.qty;
  });

  var catItems=ITEMS.filter(function(i){return filterCat==="전체"||i.cat===filterCat;});
  var stats={total:base.length, markets:new Set(base.map(function(r){return r.market.id;})).size, avg:base.length?Math.round(base.reduce(function(s,r){return s+r.price;},0)/base.length):0, avail:base.filter(function(r){return r.available;}).length};

  function openEscrow(r){
    setDetailRec(null);
    setEscrowRec(r);
  }
  function openClaim(r){setDetailRec(null);setEscrowRec(null);setClaimRec(r);}
  function openChat(r){setDetailRec(null);setChatRec(r);}
  function openPhoto(r,tab){setPhotoRec({record:r,initTab:tab||"front"});}

  // 에스크로 결제 완료 → 마이페이지에 주문 추가
  function handleOrderComplete(record, qty, freightTotal, total, dest, phone) {
    if(!loginUser) return;
    var EMOJI_MAP2 = {"사과":"🍎","배":"🍐","감귤":"🍊","딸기":"🍓","포도":"🍇","복숭아":"🍑","수박":"🍉","참외":"🍈","토마토":"🍅"};
    var ek = Object.keys(EMOJI_MAP2).find(function(k){return record.item.name.includes(k);});
    var newOrder = {
      id: genOrderId(), date: TODAY+" "+new Date().toTimeString().slice(0,5),
      buyerId: loginUser.id,
      sellerId: "seller01",
      item: record.item.name+" "+record.grade+"등급",
      emoji: ek ? EMOJI_MAP2[ek] : "🌿",
      market: record.market.name, qty: qty, price: record.price,
      freight: freightTotal, total: total, status: "주문접수",
      review: null, addr: dest||"서울 마포구 홍대로 52", phone: phone||"010-1234-5678",
    };
    addOrder(newOrder);
  }

  return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif"}}>
      {/* 헤더 */}
      <div style={{background:"linear-gradient(160deg,#0d2b1a 0%,#1b4332 55%,#2d6a4f 100%)"}}>
        <div style={{maxWidth:960,margin:"0 auto",padding:"0 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 0 12px"}}>
            <div>
              <div style={{color:"#52b788",fontSize:10,letterSpacing:4,fontWeight:700}}>AGRO CONNECT</div>
              <div style={{color:"#fff",fontSize:19,fontWeight:900,letterSpacing:-0.5,lineHeight:1.2,marginTop:2}}>중도매인 직거래 플랫폼</div>
              <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,marginTop:3}}>전국 9개 중앙공영도매시장 · 사업자 인증 · 보증금 거래 · 자동확정 36h</div>
              <div style={{marginTop:5}}>
                {sheetStatus==="loading"&&<span style={{background:"rgba(234,179,8,0.25)",color:"#fde047",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px",border:"1px solid rgba(234,179,8,0.4)"}}>⏳ 경락 데이터 불러오는 중...</span>}
                {sheetStatus==="ok"&&<span style={{background:"rgba(34,197,94,0.2)",color:"#4ade80",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px",border:"1px solid rgba(34,197,94,0.4)"}}>🟢 실시간 경락 데이터 연동됨 · {sheetData?sheetData.length:0}건</span>}
                {sheetStatus==="error"&&!usingRealData&&<span style={{background:"rgba(239,68,68,0.2)",color:"#fca5a5",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px",border:"1px solid rgba(239,68,68,0.3)"}}>🔴 연결 실패 — 가상 데이터 표시 중</span>}
                {sheetStatus==="empty"&&<span style={{background:"rgba(234,179,8,0.2)",color:"#fde047",fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 10px"}}>🟡 오늘 데이터 없음</span>}
              </div>
            </div>
            <div style={{display:"flex",gap:7}}>
              {loginUser
                ?<button onClick={function(){setTab("mypage");}} style={{background:"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",borderRadius:20,padding:"6px 14px",fontSize:12,cursor:"pointer",fontWeight:600}}>
                    👤 {loginUser.name}
                  </button>
                :<><button onClick={function(){setShowLogin(true);}} style={{background:"rgba(255,255,255,0.1)",color:"#fff",border:"1px solid rgba(255,255,255,0.25)",borderRadius:20,padding:"6px 14px",fontSize:12,cursor:"pointer"}}>로그인</button>
                  <button onClick={function(){setShowLogin(true);}} style={{background:"#52b788",color:"#fff",border:"none",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>회원가입</button></>
              }
            </div>
          </div>
          <div style={{display:"flex",gap:2}}>
            {[["search","🔍 경락가 검색"],["markets","🏪 도매시장"],["compare","💡 플랫폼 소개"],["guide","📋 이용안내"],loginUser?["mypage","👤 마이페이지"]:null].filter(Boolean).map(function(it){return <button key={it[0]} onClick={function(){setTab(it[0]);}} style={{background:tab===it[0]?"#f0fdf4":"transparent",color:tab===it[0]?G.mid:"rgba(255,255,255,0.7)",border:"none",borderRadius:"9px 9px 0 0",padding:"9px 14px",fontSize:12,fontWeight:tab===it[0]?800:400,cursor:"pointer"}}>{it[1]}</button>;})}
          </div>
        </div>
      </div>

      <div style={{maxWidth:960,margin:"0 auto",padding:"20px 14px"}}>
        {tab==="search"&&<div>
          {/* 통계 */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:20}}>
            {[["📊","오늘 경락건수",stats.total+"건","#1b4332"],["🏪","참여 시장",stats.markets+"개소","#1e40af"],["💰","평균 경락가",stats.avg.toLocaleString()+"원","#7c3aed"],["✅","거래가능",stats.avail+"건","#059669"]].map(function(r){return <div key={r[1]} style={{background:"#fff",borderRadius:13,padding:"12px 14px",boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #e0f2f1"}}><div style={{fontSize:18}}>{r[0]}</div><div style={{fontSize:9,color:"#999",marginTop:4}}>{r[1]}</div><div style={{fontSize:16,fontWeight:900,color:r[3],marginTop:1}}>{r[2]}</div></div>;})}
          </div>

          {/* 검색 패널 */}
          <div style={{background:"#fff",borderRadius:18,padding:20,boxShadow:"0 4px 20px rgba(0,0,0,0.07)",marginBottom:20,border:"1px solid #bbf7d0"}}>
            <div style={{fontSize:14,color:G.mid,fontWeight:900,marginBottom:14}}>🔍 경락 검색 필터</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#888",fontWeight:700,marginBottom:6}}>경락 일자</div>
              <div style={{display:"flex",gap:7}}>
                {[[TODAY,"오늘"],[YESTERDAY,"어제"]].map(function(d){return <button key={d[0]} onClick={function(){setSelDate(d[0]);}} style={{background:selDate===d[0]?G.mid:"#f0fdf4",color:selDate===d[0]?"#fff":G.mid,border:"1.5px solid "+(selDate===d[0]?G.mid:G.border),borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{d[1]+" ("+d[0]+")"}</button>;})}
              </div>
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:9}}>
              {[{label:"카테고리",val:filterCat,setter:function(v){setFilterCat(v);setFilterItem("");},opts:CATEGORIES,req:false},{label:"품목",val:filterItem,setter:setFilterItem,opts:["전체 품목"].concat(catItems.map(function(i){return i.name;})),req:true},{label:"등급",val:filterGrade,setter:setFilterGrade,opts:["전체","특","상","보통"],req:false},{label:"지역",val:filterRegion,setter:setFilterRegion,opts:REGIONS,req:false}].map(function(f){return <div key={f.label} style={{display:"flex",flexDirection:"column",gap:3,flex:"1 1 100px"}}><label style={{fontSize:11,color:"#888",fontWeight:700}}>{f.label}{f.req&&<span style={{color:"#ef4444",marginLeft:2}}>*</span>}</label><select value={f.val} onChange={function(e){f.setter(e.target.value);}} style={{border:"1.5px solid #bbf7d0",borderRadius:9,padding:"8px 9px",fontSize:12,background:"#f8fffe",outline:"none",cursor:"pointer"}}>{f.opts.map(function(o){return <option key={o} value={o==="전체 품목"?"":o}>{o}</option>;})}</select></div>;})}
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:9,alignItems:"flex-end"}}>
              <div style={{display:"flex",flexDirection:"column",gap:3,flex:"1 1 140px"}}>
                <label style={{fontSize:11,color:"#1e40af",fontWeight:700}}>📍 납품 지역 <span style={{fontWeight:400,color:"#93c5fd",fontSize:10}}>(물류비·도착시간 자동계산)</span></label>
                <select value={destRegion} onChange={function(e){setDestRegion(e.target.value);}} style={{border:"1.5px solid #bfdbfe",borderRadius:9,padding:"8px 9px",fontSize:12,background:"#eff6ff",outline:"none",cursor:"pointer"}}>
                  <option value="">납품 지역 선택</option>
                  {DEST_REGIONS.map(function(r){return <option key={r} value={r}>{r}</option>;})}
                </select>
              </div>
              <div style={{flex:"1 1 130px",display:"flex",flexDirection:"column",gap:3}}>
                <label style={{fontSize:11,color:"#888",fontWeight:700}}>키워드 검색</label>
                <input value={keyword} onChange={function(e){setKeyword(e.target.value);}} placeholder="품목명 또는 시장명..." style={{border:"1.5px solid #bbf7d0",borderRadius:9,padding:"8px 11px",fontSize:12,background:"#f8fffe",outline:"none",fontFamily:"inherit"}}/>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#166534",cursor:"pointer",paddingBottom:1}}>
                <input type="checkbox" checked={filterAvail} onChange={function(e){setFilterAvail(e.target.checked);}} style={{accentColor:G.mid,width:14,height:14}}/>거래 가능만
              </label>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:"#888",fontWeight:700,marginBottom:6}}>빠른 품목 선택</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{ITEMS.map(function(i){return <button key={i.name} onClick={function(){setFilterItem(i.name);setFilterCat(i.cat);}} style={{background:filterItem===i.name?G.mid:"#f0fdf4",color:filterItem===i.name?"#fff":G.mid,border:"1px solid "+(filterItem===i.name?G.mid:G.border),borderRadius:20,padding:"4px 11px",fontSize:11,cursor:"pointer",fontWeight:filterItem===i.name?700:400}}>{i.emoji+" "+i.name}</button>;})}</div>
            </div>
            <button onClick={function(){setSearched(true);}} style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:13,padding:"13px 0",fontSize:14,fontWeight:900,cursor:"pointer",boxShadow:"0 6px 20px rgba(27,67,50,0.3)"}}>🔍 전국 경락가 검색</button>
          </div>

          {searched&&<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:7}}>
              <div style={{fontSize:13,color:"#333"}}>
                <b style={{color:G.mid}}>{filterItem||(filterCat!=="전체"?filterCat:"전체 품목")}</b>{" "}검색결과 <b style={{color:G.mid,fontSize:16}}>{filtered.length}건</b>
                <span style={{color:"#bbb",fontSize:11,marginLeft:6}}>({selDate}{destRegion?" · "+destRegion+" 기준":""})</span>
              </div>
              <div style={{display:"flex",gap:5}}>{[["price",destRegion?"💰 실질비용순":"💰 최저가순"],["date","🕐 최신순"],["qty","📦 수량순"]].map(function(s){return <button key={s[0]} onClick={function(){setSortBy(s[0]);}} style={{background:sortBy===s[0]?G.mid:"#fff",color:sortBy===s[0]?"#fff":"#666",border:"1px solid "+(sortBy===s[0]?G.mid:G.border),borderRadius:20,padding:"5px 11px",fontSize:11,cursor:"pointer",fontWeight:sortBy===s[0]?700:400}}>{s[1]}</button>;})}</div>
            </div>
            {destRegion&&<div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:11,padding:"8px 14px",marginBottom:12,fontSize:11,color:"#1e40af"}}>💡 <b>{destRegion}</b> 납품 기준 실질 비용(경락가+물류비) 자동 정렬 중</div>}
            {filtered.length===0
              ?<div style={{background:"#fff",borderRadius:18,padding:50,textAlign:"center"}}><div style={{fontSize:36}}>🔍</div><div style={{fontWeight:700,fontSize:16,color:"#444",marginTop:10}}>검색 결과가 없습니다</div></div>
              :<div style={{display:"flex",flexDirection:"column",gap:12}}>{filtered.map(function(r,idx){return <RecordCard key={r.id} record={r} rank={idx+1} onDetail={setDetailRec} onChat={openChat} onEscrow={openEscrow} onPhoto={openPhoto} sortBy={sortBy} destRegion={destRegion}/>;})}</div>
            }
          </div>}
        </div>}

        {tab==="markets"&&<MarketMapTab onGoSearch={function(region){setFilterRegion(region);setTab("search");setSearched(false);}}/>}

        {tab==="compare"&&<div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* 비전 */}
          <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:16,padding:"20px 20px",color:"#fff"}}>
            <div style={{fontSize:11,color:"#4ade80",fontWeight:700,letterSpacing:1,marginBottom:6}}>AGRO CONNECT</div>
            <div style={{fontWeight:900,fontSize:16,lineHeight:1.5,marginBottom:8}}>전국 9개 중앙공영도매시장<br/>중도매인 직거래 플랫폼</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",lineHeight:1.8}}>경락가 직거래로 중간 유통 마진을 없애고,<br/>사업자 인증·보증금으로 온라인 거래의 불안함을 해결합니다.</div>
          </div>

          {/* 이용 대상 */}
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",padding:"16px 18px",boxShadow:"0 2px 10px rgba(0,0,0,0.06)"}}>
            <div style={{fontWeight:900,fontSize:14,color:G.mid,marginBottom:12}}>👥 이용 대상</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{background:"#f0fdf4",borderRadius:12,padding:"12px 14px",border:"1px solid #bbf7d0"}}>
                <div style={{fontWeight:800,fontSize:12,color:G.mid,marginBottom:4}}>🏪 판매자 (중도매인)</div>
                <div style={{fontSize:11,color:"#374151",lineHeight:1.7}}>전국 중앙공영도매시장 중도매인 · 경락 후 직접 납품 · 사업자 등록 필수</div>
              </div>
              <div style={{background:"#eff6ff",borderRadius:12,padding:"12px 14px",border:"1px solid #bfdbfe"}}>
                <div style={{fontWeight:800,fontSize:12,color:"#1e40af",marginBottom:4}}>🛒 구매자 (정기 구매자)</div>
                <div style={{fontSize:11,color:"#374151",lineHeight:1.7}}>소매 과일가게 · 식당·카페 · 급식업체 · 온라인 판매자 등<br/>정기적으로 농산물을 구매하는 사업자</div>
              </div>
            </div>
          </div>

          {/* 이런 분께 필요합니다 */}
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",padding:"16px 18px",boxShadow:"0 2px 10px rgba(0,0,0,0.06)"}}>
            <div style={{fontWeight:900,fontSize:14,color:G.mid,marginBottom:12}}>🎯 이런 분께 필요합니다</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                ["🔍","새 거래처를 찾고 싶을 때","기존 거래처 가격이 올랐거나 품질이 불만족스러울 때, 전국 9개 중앙공영도매시장 경락가를 한눈에 비교하고 새 판매자를 안전하게 만날 수 있어요.","#f0fdf4","#166534"],
                ["🌐","처음 온라인 거래를 시작할 때","직접 만나지 않고 거래하는 게 불안하다면, 에스크로가 결제를 보호해 드려요. 문제가 생기면 플랫폼이 중재합니다.","#eff6ff","#1e40af"],
                ["💬","가격 협상력을 높이고 싶을 때","경락가 데이터를 보여주면서 기존 거래처에 가격 협상을 할 수 있어요. 시장 평균가 파악만으로도 유리한 협상이 가능합니다.","#fefce8","#92400e"],
              ].map(function(r){return <div key={r[0]} style={{background:r[3],borderRadius:12,padding:"12px 14px",border:"1px solid",borderColor:r[3]==="#f0fdf4"?"#bbf7d0":r[3]==="#eff6ff"?"#bfdbfe":"#fde68a"}}>
                <div style={{fontWeight:800,fontSize:12,color:r[4],marginBottom:4}}>{r[0]} {r[1]}</div>
                <div style={{fontSize:11,color:"#374151",lineHeight:1.7}}>{r[2]}</div>
              </div>;})}
            </div>
            <div style={{background:"#f9fafb",borderRadius:10,padding:"10px 13px",marginTop:8,border:"1px solid #e5e7eb"}}>
              <div style={{fontSize:11,color:"#6b7280",lineHeight:1.7}}>
                💡 <b>이미 단골 거래처가 있다면?</b><br/>
                기존 거래처를 유지하면서 <b>새 거래처 비교용</b>으로 활용하셔도 됩니다.<br/>
                AGRO CONNECT는 <b>새로운 거래처 발굴</b>과 <b>온라인 거래 안전화</b>가 필요한 분을 위한 플랫폼입니다.
              </div>
            </div>
          </div>

          {/* 기존 서비스와 차이 */}
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",padding:"16px 18px",boxShadow:"0 2px 10px rgba(0,0,0,0.06)"}}>
            <div style={{fontWeight:900,fontSize:14,color:G.mid,marginBottom:10}}>⚡ KAFB2B와 차이점</div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {[
                ["경락가 조회","✅","✅"],
                ["거래처 연락처 제공","✅","✅"],
                ["에스크로 결제 보호","❌","✅"],
                ["하자신고 및 중재","❌","✅"],
                ["재거래율·리뷰 공개","❌","✅"],
                ["제휴 택배 할인","❌","✅"],
                ["사업자 인증 필수","❌","✅"],
                ["수수료 없는 직거래","❌","✅"],
              ].map(function(r,i){return <div key={r[0]} style={{display:"flex",alignItems:"center",padding:"7px 10px",background:i%2===0?"#f9fafb":"#fff",borderRadius:8}}>
                <div style={{flex:1,fontSize:11,color:"#374151",fontWeight:i===0?700:400}}>{i===0?<b>{r[0]}</b>:r[0]}</div>
                <div style={{width:60,textAlign:"center",fontSize:i===0?10:13,color:i===0?"#888":"#374151",fontWeight:i===0?700:400}}>{i===0?"KAFB2B":r[1]}</div>
                <div style={{width:60,textAlign:"center",fontSize:i===0?10:13,color:i===0?G.mid:r[2]==="✅"?"#16a34a":"#dc2626",fontWeight:i===0?700:600}}>{i===0?"AGRO":r[2]}</div>
              </div>;})}
            </div>
          </div>
          <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:16,padding:"20px 20px",color:"#fff"}}>
            <div style={{fontWeight:900,fontSize:19,marginBottom:7}}>🌾 AGRO CONNECT vs KAFB2B(aT)</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",lineHeight:1.8}}>KAFB2B는 <b style={{color:"#4ade80"}}>산지→실구매자</b> 직배송입니다.<br/>AGRO CONNECT는 <b style={{color:"#fbbf24"}}>경락 완료 후 중도매인 보유 재고</b>를<br/>소매상·기업이 직접 찾아 거래하는 <b style={{color:"#fbbf24"}}>2차 유통 직연결</b> 플랫폼입니다.</div>
          </div>
          {[{icon:"📊",title:"전국 경락가 실시간 비교",desc:"9개 중앙공영도매시장 일별 경락 데이터 비교. 품목·등급·지역별 필터로 최적 거래처를 즉시 발견.",c:"#dcfce7",tc:"#166534"},{icon:"🚚",title:"물류비 + 도착시간 자동 계산",desc:"납품 지역 선택 시 권역별 정밀 소요시간과 제휴 택배사 할인 운임이 자동 계산됩니다.",c:"#eff6ff",tc:"#1e40af"},{icon:"📸",title:"사진·영상 인증 시스템",desc:"판매자가 경락 당일 포장 전면·측면·수량·영상을 등록. 구매자가 직접 품질을 확인할 수 있습니다.",c:"#f3e8ff",tc:"#6b21a8"},{icon:"🏛️",title:"공영 중계 플랫폼",desc:"수수료 ZERO · 경락가 투명 공개 · 중도매인과 소매업자를 직접 연결합니다. 광고·알고리즘 없이 경락 데이터만으로 매칭.",c:"#fef3c7",tc:"#92400e"},{icon:"⚠️",title:"하자 신고 & 이의 신청",desc:"수령 후 36시간 내 사진과 함께 이의 신청 가능. 중재팀 검토 후 환불·부분 보상 처리.",c:"#fef2f2",tc:"#dc2626"},{icon:"⭐",title:"양방향 신뢰 평가 시스템",desc:"구매자→판매자: 별점·리뷰·항목별 평가. 판매자→구매자: 대금지급 속도·소통·재거래 의향. 서로가 서로를 평가해 블랙컨슈머·불량 판매자를 동시에 걸러냅니다.",c:"#fce7f3",tc:"#9d174d"},{icon:"🔄",title:"재거래율 공개",desc:"해당 판매자와 재주문한 구매자 비율을 실시간 공개. 별점보다 더 직관적인 신뢰 지표. 허위신고 이력은 구매자 등급에 반영되어 판매자도 보호받습니다.",c:"#f0fdf4",tc:"#166534"}].map(function(item){return <div key={item.title} style={{background:"#fff",borderRadius:14,padding:"16px 18px",boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #e8f5e9",display:"flex",gap:12,alignItems:"flex-start"}}><div style={{width:42,height:42,borderRadius:12,background:item.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{item.icon}</div><div><div style={{fontWeight:800,fontSize:13,color:G.mid,marginBottom:4}}>{item.title}</div><div style={{fontSize:12,color:"#555",lineHeight:1.7}}>{item.desc}</div></div></div>;})}
          <div style={{background:"#fff",borderRadius:14,padding:"18px 20px",border:"1px solid #e8f5e9"}}>
            <div style={{fontWeight:800,fontSize:13,color:G.mid,marginBottom:12}}>🆚 기존 서비스 비교</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#f0fdf4"}}>{["서비스","경락가비교","중도매인채팅","물류비계산","에스크로","사진인증","하자신고"].map(function(h){return <th key={h} style={{padding:"7px 7px",textAlign:"center",color:"#1b4332",fontWeight:700,borderBottom:"2px solid #bbf7d0"}}>{h}</th>;})}</tr></thead>
                <tbody>{[["AGRO CONNECT","✅","✅","✅","✅","✅","✅"],["KAFB2B(aT)","❌","❌","❌","❌","❌","❌"],["KAMIS","✅","❌","❌","❌","❌","❌"],["싱싱이음","❌","일부","❌","❌","❌","❌"],["푸드팡","❌","❌","❌","부분","❌","❌"]].map(function(row,i){return <tr key={i} style={{background:i===0?"#f0fdf4":"#fff",fontWeight:i===0?700:400}}>{row.map(function(cell,j){return <td key={j} style={{padding:"8px 7px",borderBottom:"1px solid #f0f0f0",color:i===0&&j===0?G.mid:"#374151",textAlign:j===0?"left":"center"}}>{cell}</td>;})}</tr>;})}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:14,padding:"18px 20px",color:"#fff"}}>
            <div style={{fontWeight:800,fontSize:13,marginBottom:7}}>⚠️ 시뮬레이션 안내</div>
            <div style={{fontSize:12,lineHeight:1.9,color:"rgba(255,255,255,0.75)"}}>현재 표시되는 경락정보는 <b style={{color:"#fff"}}>가상 데이터</b>입니다.<br/>실제 서비스 출시 시 agromarket.kr API와 연동되어 전국 중앙공영도매시장 경락정보가 실시간 반영됩니다.</div>
          </div>
        </div>}

        {tab==="guide"&&<div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* 공통 STEP */}
          <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:14,padding:"14px 18px",color:"#fff"}}>
            <div style={{fontWeight:900,fontSize:14,marginBottom:4}}>📋 공통 이용 흐름</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.75)",lineHeight:1.7}}>검색 → 사진확인 → 채팅상담 → 거래방식 선택 → 완료</div>
          </div>

          {[["🔍","STEP 1 — 경락가 검색","품목·등급·지역 선택 후 전국 9개 중앙공영도매시장 경락가를 비교하세요.","#f0fdf4"],["📍","STEP 2 — 납품 지역 선택","납품 지역 선택 시 권역별 물류비와 도착 예정 시간이 자동 계산됩니다.","#f0fdf4"],["📸","STEP 3 — 사진·영상 확인","카드 하단 탭에서 포장 전면·측면·수량·영상을 직접 확인하세요.","#f0fdf4"],["👤","STEP 4 — 판매자 정보 확인","사업자 인증, 하자신고 이력, 리뷰·별점, 지역별 물류안내를 확인하세요.","#f0fdf4"],["💬","STEP 5 — 채팅 상담","가격·수량·납품 지역 입력 시 물류비와 도착시간이 자동 계산됩니다.","#f0fdf4"]].map(function(row){return <div key={row[1]} style={{background:"#fff",borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #e8f5e9",display:"flex",gap:12,alignItems:"flex-start"}}><div style={{width:40,height:40,borderRadius:11,background:row[3],display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{row[0]}</div><div><div style={{fontWeight:800,fontSize:13,color:G.mid,marginBottom:3}}>{row[1]}</div><div style={{fontSize:12,color:"#555",lineHeight:1.7}}>{row[2]}</div></div></div>;})}

          {/* 택배사 제휴 안내 */}
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #bfdbfe",padding:"14px 16px",boxShadow:"0 2px 10px rgba(0,0,0,0.06)"}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
              <div style={{width:40,height:40,borderRadius:11,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>🚚</div>
              <div><div style={{fontWeight:800,fontSize:13,color:"#1e40af",marginBottom:3}}>STEP 2-1 — 플랫폼 제휴 택배사 할인</div><div style={{fontSize:12,color:"#555",lineHeight:1.7}}>이 플랫폼 이용 시 아래 3개 제휴 택배사 중 선택하면 일반 운임 대비 최대 28% 할인이 적용됩니다.</div></div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
              {[["🚛","CJ대한통운 로킷 (냉장)","최대 28% 할인 · 전국 익일 · 새벽 5시 출고"],["🚚","한진 냉장특송","최대 22% 할인 · 5box 이상 · 새벽 3시 출고 (더 빨라요)"],["🏎️","롯데글로벌로지스","최대 18% 할인 · 10box 이상 · 온도관리 특화"]].map(function(c){return <div key={c[1]} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 10px",background:"#f8fbff",borderRadius:9,border:"1px solid #dbeafe"}}><span style={{fontSize:16}}>{c[0]}</span><div><div style={{fontSize:12,fontWeight:700,color:"#1e40af"}}>{c[1]}</div><div style={{fontSize:10,color:"#64748b"}}>{c[2]}</div></div></div>;})}
            </div>
            <div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:9,padding:"8px 12px",fontSize:11,color:"#991b1b",lineHeight:1.7}}>
              ⚠️ <b>일반거래는 제휴 택배 할인이 적용되지 않습니다.</b><br/>일반거래 시 배송 방법·비용은 판매자와 직접 협의하세요.
            </div>
          </div>

          {/* 거래방식 분기 */}
          <div style={{background:"#f8fffe",borderRadius:14,border:"1px solid #bbf7d0",padding:"14px 16px"}}>
            <div style={{fontWeight:800,fontSize:13,color:G.mid,marginBottom:10}}>STEP 6 — 거래 신청</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {/* 안전거래 */}
              <div style={{background:"#eff6ff",borderRadius:12,padding:"12px",border:"1px solid #bfdbfe"}}>
                <div style={{fontWeight:800,fontSize:12,color:G.mid,marginBottom:6}}>🤝 직거래 신청</div>
                <div style={{fontSize:10,color:"#3b82f6",lineHeight:1.7}}>
                  • 결제금액 1% 수수료<br/>
                  • 플랫폼 에스크로 예치<br/>
                  • 배송완료 자동 수령확인<br/>
                  • 수령 후 36시간 이의신청<br/>
                  • 하자 시 플랫폼 중재<br/>
                  • 자동 구매확정 후 지급
                </div>
                <div style={{marginTop:8,fontSize:10,color:"#1e40af",fontWeight:700}}>✅ 신규 구매자 권장</div>
              </div>
              {/* 일반거래 */}
              <div style={{background:"#f9fafb",borderRadius:12,padding:"12px",border:"1px solid #e5e7eb"}}>
                <div style={{fontWeight:800,fontSize:12,color:"#374151",marginBottom:6}}>🤝 일반거래</div>
                <div style={{fontSize:10,color:"#6b7280",lineHeight:1.7}}>
                  • 수수료 없음<br/>
                  • 판매자와 직접 결제<br/>
                  • 채팅으로 일정 협의<br/>
                  • 플랫폼 보호 미적용<br/>
                  • 배송 후 리뷰 등록<br/>
                  • 신뢰 관계 형성 후 권장
                </div>
                <div style={{marginTop:8,fontSize:10,color:"#6b7280",fontWeight:700}}>⚠️ 일반 등급 이상</div>
              </div>
            </div>
          </div>

          {/* 안전거래 전용 STEP */}
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #bfdbfe",padding:"14px 16px"}}>
            <div style={{fontSize:10,color:"#2563eb",fontWeight:700,marginBottom:8}}>📋 구매 절차 추가 절차</div>
            {[["📦","출고 확인","판매자가 출고 사진·운송장 등록 → 배송 시작"],["🚚","배송완료 자동 수령확인","택배사 배송완료 처리 시 자동으로 수령확인 페이지 전환"],["⏱️","36시간 이의신청","수령 확인 시점부터 36시간 내 하자신고 가능"],["✅","자동 구매확정","이의 없으면 에스크로 대금이 판매자에게 자동 지급"]].map(function(row){return <div key={row[1]} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}><div style={{width:28,height:28,borderRadius:8,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{row[0]}</div><div><div style={{fontSize:12,fontWeight:700,color:"#1e40af"}}>{row[1]}</div><div style={{fontSize:11,color:"#64748b",marginTop:1}}>{row[2]}</div></div></div>;})}
          </div>

          {/* 하자신고 */}
          {[["⚠️","STEP 7 — 분쟁 해결","거래 중 문제가 생기면 채팅으로 판매자와 먼저 협의하세요. 협의가 어려울 경우 플랫폼 운영팀에 신고하면 검토 후 조치합니다.","#fef2f2"]].map(function(row){return <div key={row[1]} style={{background:"#fff",borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #fca5a5",display:"flex",gap:12,alignItems:"flex-start"}}><div style={{width:40,height:40,borderRadius:11,background:row[3],display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{row[0]}</div><div><div style={{fontWeight:800,fontSize:13,color:"#dc2626",marginBottom:3}}>{row[1]}</div><div style={{fontSize:12,color:"#555",lineHeight:1.7}}>{row[2]}</div></div></div>;})}

          {/* 신뢰 시스템 */}
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #e5e7eb",padding:"18px 20px",boxShadow:"0 2px 10px rgba(0,0,0,0.06)"}}>
            <div style={{fontWeight:900,fontSize:14,color:G.mid,marginBottom:14}}>⚖️ 신뢰 생태계 보호 시스템</div>
            <div style={{marginBottom:14}}>
              <div style={{fontWeight:800,fontSize:13,color:"#1e40af",marginBottom:8}}>🔵 사업자등록 인증</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {[["📋","사업자등록증 제출 필수","입점 신청 시 사업자등록증 원본 제출. 플랫폼 운영팀이 직접 확인 후 승인합니다.","#eff6ff","#1e40af"],["✅","인증 마크 부여","승인 완료 시 프로필에 사업자 인증 마크 표시. 미인증 판매자는 거래 불가.","#f0fdf4","#166534"],["🔄","연 1회 갱신","사업자 상태 유지 여부를 연 1회 재확인합니다.","#fefce8","#92400e"]].map(function(r){return <div key={r[0]} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"9px 12px",background:r[3],borderRadius:10}}><span style={{fontSize:14,flexShrink:0}}>{r[0]}</span><div><div style={{fontSize:11,fontWeight:700,color:r[4],marginBottom:2}}>{r[1]}</div><div style={{fontSize:11,color:r[4],opacity:0.8}}>{r[2]}</div></div></div>;})}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontWeight:800,fontSize:13,color:"#059669",marginBottom:8}}>🟢 보증금 예치 제도</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {[["💰","판매자 보증금","거래 전 보증금을 플랫폼에 예치. 분쟁·하자 발생 시 보증금에서 우선 보상합니다.","#f0fdf4","#166534"],["🛡️","구매자 보호","보증금 예치 판매자와의 거래는 하자 발생 시 즉시 보상 처리됩니다.","#eff6ff","#1e40af"],["📊","보증금 등급","거래량·신뢰도에 따라 보증금 규모 및 거래 한도가 달라집니다.","#fefce8","#92400e"]].map(function(r){return <div key={r[0]} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"9px 12px",background:r[3],borderRadius:10}}><span style={{fontSize:14,flexShrink:0}}>{r[0]}</span><div><div style={{fontSize:11,fontWeight:700,color:r[4],marginBottom:2}}>{r[1]}</div><div style={{fontSize:11,color:r[4],opacity:0.8}}>{r[2]}</div></div></div>;})}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontWeight:800,fontSize:13,color:"#0d2b1a",marginBottom:8}}>📋 주문 취소 정책 (B2B 기준)</div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {[["주문 후 1시간 이내","✅ 무료 취소","#f0fdf4","#166534"],["판매자 출고 확인 전","⚠️ 취소 가능 + 주문금액 7% 수수료","#fffbeb","#92400e"],["판매자 출고 후","🚫 취소 불가 (하자신고로만 처리)","#fef2f2","#dc2626"]].map(function(r){return <div key={r[0]} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:r[2],borderRadius:9}}><span style={{fontSize:11,color:r[3],fontWeight:600}}>{r[0]}</span><span style={{fontSize:11,color:r[3],fontWeight:700}}>{r[1]}</span></div>;})}
              </div>
              <div style={{fontSize:10,color:"#888",marginTop:5}}>* 출고 직전·후 반복 취소 3회 누적 시 구매 제한 · B2B 특성상 소비자 청약철회 의무 미적용</div>
            </div>
            <div style={{background:"#f8fffe",border:"1px solid #bbf7d0",borderRadius:10,padding:"11px 14px",marginBottom:8}}>
              <div style={{fontWeight:700,fontSize:12,color:G.mid,marginBottom:4}}>🤝 판매자 거래 거절권</div>
              <div style={{fontSize:11,color:"#555",lineHeight:1.7}}>판매자도 구매자를 평가합니다. 구매자 신뢰 등급이 낮거나 허위 신고 이력이 있는 경우 <b>판매자가 거래를 거절</b>할 수 있습니다.<br/><span style={{color:"#aaa"}}>당근마켓·중고나라도 동일한 방향으로 운영 중</span></div>
            </div>
            <div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"11px 14px",marginBottom:8}}>
              <div style={{fontWeight:700,fontSize:12,color:"#dc2626",marginBottom:4}}>🔒 계정 차단 기준</div>
              <div style={{fontSize:11,color:"#555",lineHeight:1.7}}>계정 탈퇴 후 재가입으로 제재를 우회하는 것을 방지하기 위해 <b>사업자등록번호 + 휴대폰 번호</b> 기준으로 차단합니다. 계정만 삭제해도 동일인 재가입이 차단됩니다.</div>
            </div>
            <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"11px 14px",marginBottom:8}}>
              <div style={{fontWeight:700,fontSize:12,color:"#1e40af",marginBottom:4}}>🚚 배송 중 파손 책임</div>
              <div style={{fontSize:11,color:"#555",lineHeight:1.7}}>배송 중 발생한 파손은 <b>제휴 택배사 과실</b>로 처리됩니다. 플랫폼이 직접 택배사에 클레임을 진행하며, 판매자와 구매자 모두 책임에서 자유롭습니다. 단, 수령 즉시 개봉 전 사진·영상 촬영이 필요합니다.</div>
            </div>
            <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:10,padding:"11px 14px",marginBottom:8}}>
              <div style={{fontWeight:700,fontSize:12,color:"#92400e",marginBottom:4}}>⚠️ 재고 검증 시스템</div>
              <div style={{fontSize:11,color:"#555",lineHeight:1.7}}>판매자의 재고 수량은 <b>경락 데이터 원본과 자동 연동</b>됩니다. 실제 낙찰 수량을 초과하는 재고 입력이 불가능하며, 중복 판매 시도는 시스템에서 자동 차단됩니다.</div>
            </div>
            <div style={{background:"#f0f9ff",border:"1px solid #7dd3fc",borderRadius:10,padding:"11px 14px"}}>
              <div style={{fontWeight:700,fontSize:12,color:"#0369a1",marginBottom:6}}>🤖 AI 사진·영상 위변조 탐지</div>
              <div style={{fontSize:11,color:"#555",lineHeight:1.8,marginBottom:6}}>
                하자 신고 시 업로드된 사진·영상을 <b>AI가 자동 분석</b>합니다.
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {[
                  ["📋","메타데이터 검증","촬영 시각·GPS·기기 정보 자동 확인. 편집 프로그램을 거친 파일은 메타데이터 이상 탐지"],
                  ["🔍","편집 흔적 탐지","픽셀 이상·압축률 불일치·AI 생성 이미지 등 편집 흔적 자동 감지 (Azure AI 연동)"],
                  ["⛓️","블록체인 타임스탬프","업로드 시각 해시값 기록. 사진 위변조 여부 사후 증명 가능"],
                ].map(function(r){return <div key={r[0]} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"7px 10px",background:"#fff",borderRadius:8,border:"1px solid #bae6fd"}}>
                  <span style={{fontSize:14,flexShrink:0}}>{r[0]}</span>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#0369a1"}}>{r[1]}</div>
                    <div style={{fontSize:10,color:"#64748b",marginTop:1}}>{r[2]}</div>
                  </div>
                </div>;})}
              </div>
              <div style={{fontSize:10,color:"#0284c7",marginTop:7,fontWeight:600}}>
                📸 사진·영상은 자유롭게 업로드 가능 · 백엔드에서 자동 검증 (UX 영향 없음)
              </div>
            </div>
          </div>

          <div style={{background:"#fff",borderRadius:14,border:"1px solid #e5e7eb",padding:"16px 18px",boxShadow:"0 2px 10px rgba(0,0,0,0.06)"}}>
            <div style={{fontWeight:800,fontSize:13,color:G.mid,marginBottom:12}}>⚖️ 판매자·구매자 제재 기준 (공정 원칙)</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
              {[["단계","판매자 제재","구매자 제재"],["1경고","프로필 ⚠️ 표시 + 경고 알림","프로필 ⚠️ 표시 + 경고 알림"],["2제한","30일 거래 중단 + 플랫폼 심사","30일 거래 중지 (자동 복귀)"],["3퇴출","영구 정지 + 사업자번호 차단","영구 정지 + 사업자번호·전화 차단"]].map(function(row,i){return <div key={row[0]} style={{display:"flex",gap:0,background:i===0?"#f0fdf4":i%2===0?"#f9fafb":"#fff",borderRadius:8,overflow:"hidden",border:"1px solid #e5e7eb"}}>
                <div style={{width:"22%",padding:"8px 10px",fontWeight:i===0?700:800,color:i===0?G.mid:i===1?"#92400e":i===2?"#c2410c":"#dc2626",fontSize:11,borderRight:"1px solid #e5e7eb",flexShrink:0}}>{row[0]}</div>
                <div style={{flex:1,padding:"8px 10px",fontSize:11,color:"#374151",borderRight:"1px solid #e5e7eb"}}>{row[1]}</div>
                <div style={{flex:1,padding:"8px 10px",fontSize:11,color:"#374151"}}>{row[2]}</div>
              </div>;})}
            </div>
            <div style={{fontSize:10,color:"#888",lineHeight:1.7}}>
              * 판매자·구매자 동일 30일 기준 (공정 원칙)<br/>
              * 판매자 2제한은 심사 통과 시 복귀, 구매자 2제한은 기간 후 자동 복귀<br/>
              * 모든 제재는 중재 확정 건수 기준 (단순 신고 접수 제외)
            </div>
          </div>

          {/* 시뮬레이션 안내 */}
          <div style={{background:"linear-gradient(135deg,#0d2b1a,#1b4332)",borderRadius:14,padding:"16px 18px",color:"#fff"}}>
            <div style={{fontWeight:800,fontSize:13,marginBottom:6}}>⚠️ 시뮬레이션 안내</div>
            <div style={{fontSize:11,lineHeight:1.9,color:"rgba(255,255,255,0.75)"}}>현재 표시되는 경락정보는 <b style={{color:"#fff"}}>가상 데이터</b>입니다.<br/>실제 서비스 출시 시 agromarket.kr API와 연동되어 전국 중앙공영도매시장 경락정보가 실시간 반영됩니다.</div>
          </div>
        </div>}

        {tab==="mypage"&&loginUser&&<MyPage
          user={loginUser}
          orders={orders}
          listings={listings}
          onUpdateOrder={updateOrder}
          onAddListing={addListing}
          onGoSearch={function(){setTab("search");setSearched(false);}}
          onLogout={function(){setLoginUser(null);setTab("search");}}
        />}
        {tab==="mypage"&&!loginUser&&<div style={{textAlign:"center",padding:50}}>
          <div style={{fontSize:36,marginBottom:10}}>🔒</div>
          <div style={{fontWeight:700,color:"#444",marginBottom:14}}>로그인이 필요합니다</div>
          <button onClick={function(){setShowLogin(true);}} style={{background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:13,padding:"12px 28px",fontWeight:900,cursor:"pointer"}}>로그인하기</button>
        </div>}
      </div>

      {/* 모달 */}
      {showLogin&&<LoginModal onClose={function(){setShowLogin(false);}} onLogin={function(u){setLoginUser(u);setShowLogin(false);setTab("mypage");}}/>}
      {detailRec&&<SellerModal record={detailRec} onClose={function(){setDetailRec(null);}} onChat={openChat} onEscrow={openEscrow} onClaim={openClaim}/>}
      {chatRec&&<ChatModal record={chatRec} onClose={function(){setChatRec(null);}}/>}
      {escrowRec&&<EscrowModal record={escrowRec} onClose={function(){setEscrowRec(null);}} onClaim={openClaim} onOrderComplete={function(record,qty,freight,total,dest,phone){handleOrderComplete(record,qty,freight,total,dest,phone);}}/>}
      {claimRec&&<ClaimModal record={claimRec} onClose={function(){setClaimRec(null);}}/>}
      {photoRec&&<PhotoModal record={photoRec.record} initTab={photoRec.initTab} onClose={function(){setPhotoRec(null);}}/>}
    </div>
  );
}


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
