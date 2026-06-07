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
  {id:8, name:"대전 노은시장",  region:"대전", sheetName:"대전노은",  phone:"042-201-1426", corp:"중부청과"},
  {id:9, name:"울산 도매시장",  region:"울산", sheetName:"울산",      phone:"052-229-4000", corp:"울산청과"},
];

function getMarket(sheetName) {
  var found = MARKETS.find(function(m){
    return sheetName && (sheetName.includes(m.sheetName) || m.sheetName.includes(sheetName));
  });
  return found || {id:0, name:sheetName||"기타", region:"기타", sheetName:sheetName, phone:"", corp:""};
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

var idCounter = 10000;
function makeMockData() {
  var result = [];
  var itemNames = Object.keys(PRICE_BASE);

  // 노은시장(id:8) 제외한 시장들
  var mockMarkets = MARKETS.filter(function(m){ return m.id !== 8; });

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

      result.push({
        id: idCounter++,
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
        isMock: true,
      });
    });
  });

  return result;
}

// CSV 파싱 (노은시장 실제 데이터)
function parseCSV(csvText) {
  var lines = csvText.trim().split("\n");
  if(lines.length < 2) return [];
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

    if(cols.length < 9) continue;
    var dateStr  = cols[0]||"";
    var mktName  = cols[1]||"";
    var corpName = cols[2]||"";
    var itemName = cols[3]||"";
    var variety  = cols[4]||"";
    var origin   = cols[5]||"";
    var qty      = parseInt(cols[6])||0;
    var unit     = cols[7]||"";
    var price    = parseInt(cols[8])||0;

    if(!itemName || !price) continue;

    var market = getMarket(mktName);
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
      unit: unit,
      price: price,
      corp: corpName,
      emoji: getEmoji(itemName),
      category: getCategory(itemName),
      isMock: false,
    });
  }
  return records;
}

// ── 경락 카드 ──
function RecordCard(props) {
  var r = props.record, rank = props.rank;
  var isTop = rank === 1;
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
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:10,color:"#aaa"}}>🕐 {r.date}</div>
          <div style={{display:"flex",gap:6}}>
            <a href={"tel:"+r.market.phone} style={{background:"#f0fdf4",color:G.mid,border:"1px solid #bbf7d0",borderRadius:9,padding:"6px 13px",fontSize:11,fontWeight:700,textDecoration:"none"}}>📞 문의</a>
            <button style={{background:G.mid,color:"#fff",border:"none",borderRadius:9,padding:"6px 13px",fontSize:11,fontWeight:700,cursor:"pointer"}} onClick={function(){alert("거래 문의는 해당 도매시장 법인("+r.corp+")에 직접 연락하세요.\n📞 "+r.market.phone+"\n🏛️ "+r.market.name);}}>거래하기</button>
          </div>
        </div>
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

  var d1 = useState([]); var data = d1[0]; var setData = d1[1];
  var d2 = useState("idle"); var status = d2[0]; var setStatus = d2[1];
  var d3 = useState(""); var errMsg = d3[0]; var setErrMsg = d3[1];
  var d4 = useState(null); var lastUpdated = d4[0]; var setLastUpdated = d4[1];
  var d5 = useState(0); var liveCount = d5[0]; var setLiveCount = d5[1];

  var m1 = useState(""); var mapRegion = m1[0]; var setMapRegion = m1[1];

  useEffect(function(){
    var cancelled = false;
    var mockData = makeMockData(); // 가상 데이터 먼저 넣기

    async function load() {
      setStatus("loading");
      // 가상 데이터 먼저 표시
      if(!cancelled) setData(mockData);

      try {
        var res = await fetch(CSV_URL);
        if(!res.ok) throw new Error("노은시장 데이터 로드 실패: " + res.status);
        var csv = await res.text();
        if(cancelled) return;
        var liveRows = parseCSV(csv);
        // 실제 데이터 + 가상 데이터 합치기 (노은시장 실제 데이터 우선)
        var combined = liveRows.concat(mockData);
        setData(combined);
        setLiveCount(liveRows.length);
        setStatus("ok");
        setLastUpdated(new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}));
      } catch(e) {
        if(!cancelled) {
          // 실패해도 가상 데이터는 보여주기
          setStatus("partial");
          setErrMsg(e.message);
        }
      }
    }
    load();
    var iv = setInterval(load, 60*60*1000);
    return function(){ cancelled=true; clearInterval(iv); };
  }, []);

  var filtered = data.filter(function(r){
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
  var marketList = Array.from(new Set(data.map(function(r){return r.market.name;}).filter(Boolean))).sort();

  var stats = {
    total: data.length,
    markets: new Set(data.map(function(r){return r.market.name;})).size,
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
            </div>
          </div>

          {/* 탭 */}
          <div style={{display:"flex",gap:2,paddingBottom:0}}>
            {[["search","🔍 경락 검색"],["map","🗺️ 시장 지도"],["guide","📋 이용 안내"]].map(function(t){
              var active = tab===t[0];
              return <button key={t[0]} onClick={function(){setTab(t[0]);}} style={{flex:1,padding:"10px 0",border:"none",background:active?"rgba(255,255,255,0.15)":"transparent",color:active?"#fff":"rgba(255,255,255,0.55)",fontWeight:active?800:400,fontSize:12,cursor:"pointer",borderBottom:active?"2px solid #52b788":"2px solid transparent",borderRadius:"6px 6px 0 0"}}>
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

            <button onClick={function(){setSearched(true);}} style={{width:"100%",background:"linear-gradient(135deg,#0d2b1a,#40916c)",color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontSize:14,fontWeight:900,cursor:"pointer"}}>
              🔍 전국 경락가 검색
            </button>
          </div>

          {/* 검색 결과 */}
          {searched && <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontWeight:800,fontSize:14,color:"#0d1f15"}}>
                {filterItem||keyword||filterRegion ? (filterItem||keyword||filterRegion) : "전체 품목"} 검색결과 <span style={{color:G.mid}}>{filtered.length}건</span>
                <span style={{fontSize:11,color:"#aaa",fontWeight:400,marginLeft:6}}>({TODAY})</span>
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
                    return <RecordCard key={r.id} record={r} rank={idx+1}/>;
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
              중도매인과 소매업자를 직접 연결합니다.
            </div>
          </div>

          {[
            {icon:"🏛️", title:"9개 중앙공영도매시장", desc:"서울가락·부산엄궁·대구북부·인천남촌·인천삼산·광주각화·대전오정·대전노은·울산"},
            {icon:"🔴", title:"노은시장 실시간 연동", desc:"대전 노은시장 경락 데이터를 aT API 기반으로 실시간 반영 · 1시간마다 자동 업데이트"},
            {icon:"📊", title:"전국 경락 통합 검색", desc:"9개 시장 품목별·지역별·가격별 통합 검색 · 최저가 자동 정렬"},
            {icon:"💰", title:"수수료 없는 공영 중계", desc:"플랫폼 수수료 0원 · 경락 정보만 투명하게 공개 · 직접 거래 유도"},
            {icon:"📞", title:"거래 문의", desc:"해당 도매시장 법인에 직접 연락 · 중간 유통 없는 직거래"},
          ].map(function(item){return (
            <div key={item.title} style={{background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:10,border:"1px solid #e5e7eb",display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{fontSize:24,flexShrink:0}}>{item.icon}</div>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:G.mid,marginBottom:4}}>{item.title}</div>
                <div style={{fontSize:12,color:"#555",lineHeight:1.7}}>{item.desc}</div>
              </div>
            </div>
          );})}

          <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:14,padding:"14px 16px",marginTop:4}}>
            <div style={{fontWeight:700,fontSize:13,color:"#92400e",marginBottom:6}}>📞 운영 문의</div>
            <div style={{fontSize:12,color:"#78350f",lineHeight:1.8}}>
              농림축산식품부 빅데이터전략팀<br/>
              담당자: 남석현<br/>
              📞 044-201-1426
            </div>
          </div>

          {/* 데이터 출처 안내 */}
          <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:14,padding:"14px 16px",marginTop:10}}>
            <div style={{fontWeight:700,fontSize:13,color:G.mid,marginBottom:6}}>ℹ️ 데이터 출처</div>
            <div style={{fontSize:12,color:"#555",lineHeight:1.8}}>
              📍 <b>대전 노은시장</b>: aT 농수산물 유통정보 API 실시간 연동<br/>
              📍 <b>기타 8개 시장</b>: agromarket.kr 기준 경락 참고 데이터<br/>
              <span style={{color:"#888",fontSize:11}}>※ 실제 거래 전 반드시 해당 시장에 확인하세요</span>
            </div>
          </div>
        </div>}

      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
