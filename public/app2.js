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
  var l1 = useState(null); var loginUser = l1[0]; var setLoginUser = l1[1];
  var l2 = useState(false); var showLogin = l2[0]; var setShowLogin = l2[1];
  var p1 = useState({}); var purchases = p1[0]; var setPurchases = p1[1];
  var pv1 = useState([]); var prevData = pv1[0]; var setPrevData = pv1[1];

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

        // 거래실적 데이터로 노은시장 경락 카드 생성 (가장 최신 날짜만)
        var NOEUN_MARKET = {id:8, name:"대전 노은시장", region:"대전", sheetName:"대전노은", phone:"", corp:"중부청과"};

        // 날짜 정규화: 2026.06.10 → 2026-06-10
        function normDate(d){ return (d||"").split(" ")[0].replace(/\./g,"-").trim(); }

        // 가장 최신 날짜 추출
        var allTradeDates = rows.map(function(r){ return normDate(r["경매일자"]||r["매매일자"]||""); }).filter(Boolean);
        var latestTradeDate = allTradeDates.sort().pop() || "";

        // 최신 날짜 행만 필터
        var todayRows = latestTradeDate
          ? rows.filter(function(r){ return normDate(r["경매일자"]||r["매매일자"]||"") === latestTradeDate; })
          : rows;

        var itemGroups = {};
        todayRows.forEach(function(row){
          var itemName = (row["품목명"]||row["품목"]||"").trim();
          if(!itemName) return;
          var price = parseInt((row["단가"]||"0").replace(/,/g,""))||0;
          if(!price) return;
          if(!itemGroups[itemName]) itemGroups[itemName] = [];
          itemGroups[itemName].push(row);
        });

        var noeunCards = Object.keys(itemGroups).map(function(itemName, i){
          var rows2 = itemGroups[itemName];
          var prices = rows2.map(function(r){ return parseInt((r["단가"]||"0").replace(/,/g,"")); }).filter(function(p){ return p>0; });
          var avgPrice = prices.length ? Math.round(prices.reduce(function(a,b){return a+b;},0)/prices.length) : 0;
          var totalQty = rows2.reduce(function(s,r){ return s+(parseInt((r["수량"]||"0").replace(/,/g,""))||0); },0);
          var sampleWeight = (rows2[0]&&rows2[0]["중량"]) ? rows2[0]["중량"] : "";
          return {
            id: "noeun_"+i,
            date: latestTradeDate,
            market: NOEUN_MARKET,
            itemName: itemName,
            fullName: itemName,
            variety: "",
            origin: (rows2[0]&&rows2[0]["산지명"]) ? rows2[0]["산지명"] : "",
            qty: totalQty,
            unit: sampleWeight ? sampleWeight+"kg" : "박스",
            price: avgPrice,
            corp: "중부청과",
            emoji: getEmoji(itemName),
            category: getCategory(itemName),
            isMock: false,
            bidder: "", grade: "", shipperName: "", shipperPhone: "",
          };
        }).filter(function(r){ return r.price > 0; });

        // 노은 카드 별도 state로 저장
        setNoeunCards(noeunCards);
        setLiveCount(noeunCards.length);

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
    if(sortBy==="smart") {
      var userSido2 = (function(){ try { var s=JSON.parse(localStorage.getItem("agro_buyer_"+(loginUser&&loginUser.id||"guest"))||"{}"); return s.bizSido||""; } catch(e){ return ""; } })();
      var aKg = parseFloat((a.unit||"").replace(/kg.*/i,""))||1;
      var bKg = parseFloat((b.unit||"").replace(/kg.*/i,""))||1;
      var aFrom = a.market ? a.market.region : "서울";
      var bFrom = b.market ? b.market.region : "서울";
      var aShip = userSido2 ? calcShipping(aKg, aFrom, userSido2).total : 0;
      var bShip = userSido2 ? calcShipping(bKg, bFrom, userSido2).total : 0;
      return (a.price + aShip) - (b.price + bShip);
    }
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

  var gradeList = Array.from(new Set(activeData.map(function(r){return r.grade||"";}).filter(Boolean))).sort();

  // 단위 구간화
  var UNIT_RANGES = [
    {label:"5kg 이하",   min:0,   max:5},
    {label:"5~10kg",     min:5,   max:10},
    {label:"10~15kg",    min:10,  max:15},
    {label:"15kg 이상",  min:15,  max:9999},
  ];
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
            {[["search","🔍 경락"],["guide","📋 안내"],["mypage","👤 MY"]].map(function(t){
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

            {/* 품목 선택 */}
            <div style={{marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>품목</div>
              <select value={filterItem} onChange={function(e){setFilterItem(e.target.value); setFilterSubItem(""); setFilterGrade(""); setFilterUnit("");}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"9px 10px",fontSize:13,background:"#f8fffe",outline:"none"}}>
                <option value="">전체 품목</option>
                {itemList.map(function(name){return <option key={name} value={name}>{getEmoji(name)+" "+name}</option>;})}
              </select>
            </div>

            {/* 품목상세 - 대분류 선택 시만 표시 */}
            {filterItem && subItemList.length > 1 && (
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>품목 상세</div>
                <select value={filterSubItem} onChange={function(e){setFilterSubItem(e.target.value);}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"9px 10px",fontSize:13,background:"#f8fffe",outline:"none"}}>
                  <option value="">전체 ({subItemList.length}종)</option>
                  {subItemList.map(function(name){return <option key={name} value={name}>{name}</option>;})}
                </select>
              </div>
            )}

            {/* 등급 + 단위 */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>등급</div>
                <select value={filterGrade} onChange={function(e){setFilterGrade(e.target.value);}} style={{width:"100%",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"9px 10px",fontSize:13,background:"#f8fffe",outline:"none"}}>
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

            {/* 도매시장 */}
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
              {[["price","💰 최저가순"],["smart","🚚 실속가순"],["qty","📦 수량순"]].map(function(s){return (
                <button key={s[0]} onClick={function(){setSortBy(s[0]);}} style={{flex:1,padding:"8px 0",background:sortBy===s[0]?G.mid:"#fff",color:sortBy===s[0]?"#fff":"#666",border:"1px solid "+(sortBy===s[0]?G.mid:"#e5e7eb"),borderRadius:20,fontSize:11,fontWeight:sortBy===s[0]?700:400,cursor:"pointer"}}>{s[1]}</button>
              );})}
            </div>

            </div>

            {/* 실속가순 안내 배너 */}
            {sortBy==="smart" && (function(){
              var userSido = (function(){ try { var s=JSON.parse(localStorage.getItem("agro_buyer_"+(loginUser&&loginUser.id||"guest"))||"{}"); return s.bizSido||""; } catch(e){ return ""; } })();
              return (
                <div style={{background:"linear-gradient(135deg,#4c1d95,#7c3aed)",borderRadius:12,padding:"12px 14px",marginBottom:10,color:"#fff"}}>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:4}}>🚚 실속가순 — 배송비 포함 실질 최저가 정렬</div>
                  {userSido
                    ? <div style={{fontSize:11,opacity:0.9}}>
                        📍 도착지: <b>{userSido}</b> · 각 시장에서 출발 기준 CJ대한통운 예상 배송비 포함<br/>
                        <span style={{fontSize:10,opacity:0.75}}>예) 서울가락→{userSido} / 부산→{userSido} 배송비가 각각 다르게 적용됩니다</span>
                      </div>
                    : <div style={{fontSize:11,color:"#fde68a",fontWeight:700}}>
                        ⚠️ MY 탭 → 사업장 지역 설정 시 정확한 배송비를 계산해드립니다
                      </div>
                  }
                </div>
              );
            })()}

            {filtered.length===0
              ? <div style={{textAlign:"center",padding:"40px 0"}}>
                  <div style={{fontSize:40,marginBottom:10}}>🔍</div>
                  <div style={{fontWeight:700,fontSize:14,color:"#888"}}>검색 결과가 없습니다</div>
                  <div style={{fontSize:12,color:"#aaa",marginTop:6}}>다른 품목이나 지역으로 검색해보세요</div>
                </div>
              : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {filtered.slice(0, 100).map(function(r, idx){
                    return <RecordCard key={r.id} record={r} rank={idx+1} tradeData={tradeData} purchases={purchases} setPurchases={setPurchases} loginUser={loginUser} sortBy={sortBy}/>;
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

          {tradeStatus==="loading" && <div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{fontSize:32,marginBottom:10}}>⏳</div>
            <div style={{fontSize:13,color:"#888"}}>거래실적 불러오는 중...</div>
          </div>}

          {tradeStatus==="error" && <div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{fontSize:32,marginBottom:10}}>⚠️</div>
            <div style={{fontSize:13,color:"#888"}}>거래실적을 불러오지 못했습니다</div>
          </div>}

          {tradeStatus==="ok" && tradeData.length > 0 && (function(){
            // 품목별 그룹화
            var itemGroups = {};
            tradeData.forEach(function(row){
              var item = (row["품목명"]||row["품목"]||"기타").trim();
              if(!itemGroups[item]) itemGroups[item] = [];
              itemGroups[item].push(row);
            });

            return (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {Object.keys(itemGroups).map(function(itemName){
                  var rows = itemGroups[itemName];
                  var emoji = getEmoji(itemName);
                  // 중도매인별 그룹화
                  var dealerMap = {};
                  rows.forEach(function(r){
                    var no = String(r["낙찰 중도매인"]||"").trim();
                    if(!dealerMap[no]) dealerMap[no] = [];
                    dealerMap[no].push(r);
                  });
                  var dealers = Object.keys(dealerMap);
                  var allPrices = rows.map(function(r){ return parseInt((r["단가"]||"0").replace(/,/g,"")); }).filter(function(p){ return p>0; });
                  var minPrice = allPrices.length ? Math.min.apply(null,allPrices) : 0;
                  var maxPrice = allPrices.length ? Math.max.apply(null,allPrices) : 0;
                  var sampleWeight = (rows[0]&&rows[0]["중량"]) ? rows[0]["중량"] : "";

                  return (
                    <div key={itemName} style={{background:"#fff",borderRadius:16,border:"1px solid #e0e7ff",overflow:"hidden",boxShadow:"0 2px 8px rgba(30,64,175,0.06)"}}>
                      {/* 품목 헤더 */}
                      <div style={{background:"linear-gradient(90deg,#1e3a8a,#1e40af)",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:22}}>{emoji}</span>
                          <div>
                            <div style={{color:"#fff",fontWeight:800,fontSize:14}}>{itemName}</div>
                            <div style={{color:"#93c5fd",fontSize:10,marginTop:1}}>{rows.length}건 · {dealers.length}명 낙찰</div>
                          </div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{color:"#4ade80",fontWeight:900,fontSize:15}}>
                            {minPrice===maxPrice ? minPrice.toLocaleString() : minPrice.toLocaleString()+"~"+maxPrice.toLocaleString()}원
                          </div>
                          <div style={{color:"rgba(255,255,255,0.6)",fontSize:10}}>
                            {sampleWeight ? "/ "+sampleWeight+"kg 단위" : "/ 단위"}
                          </div>
                        </div>
                      </div>

                      {/* 거래 내역 테이블 */}
                      <div style={{overflowX:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,minWidth:480}}>
                          <thead>
                            <tr style={{background:"#eff6ff"}}>
                              {["경매시간","산지","등급","중량","수량","단가","kg당","중도매인","문의"].map(function(h){return(
                                <th key={h} style={{padding:"6px 8px",color:"#1e40af",fontWeight:700,textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                              );})}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(function(row,i){
                              var weight   = parseFloat(row["중량"]||0);
                              var price    = parseInt((row["단가"]||"0").replace(/,/g,""))||0;
                              var qty      = parseInt((row["수량"]||"0").replace(/,/g,""))||0;
                              var kgPrice  = (weight>0&&price>0) ? Math.round(price/weight) : null;
                              var grade    = (row["등급"]||"").trim();
                              var no       = String(row["낙찰 중도매인"]||"").trim();
                              var info     = getDealerInfo(no);
                              var gradeStyle = {
                                "특":{bg:"#fef9c3",color:"#854d0e"},"상":{bg:"#dbeafe",color:"#1e40af"},
                                "보통":{bg:"#f3f4f6",color:"#555"},"1":{bg:"#fef9c3",color:"#854d0e"},
                                "2":{bg:"#dbeafe",color:"#1e40af"},"3":{bg:"#f3f4f6",color:"#555"},
                              }[grade]||{bg:"#f3f4f6",color:"#555"};
                              return (
                                <tr key={i} style={{background:i%2===0?"#fff":"#f8faff",borderBottom:"1px solid #e8edf8"}}
                                  onMouseEnter={function(e){e.currentTarget.style.background="#eff6ff";}}
                                  onMouseLeave={function(e){e.currentTarget.style.background=i%2===0?"#fff":"#f8faff";}}>
                                  <td style={{padding:"6px 8px",color:"#64748b",fontSize:10}}>{(row["경매시간"]||"-")}</td>
                                  <td style={{padding:"6px 8px",color:"#1e293b",fontWeight:500}}>{(row["산지명"]||"-")}</td>
                                  <td style={{padding:"6px 8px"}}>
                                    {grade ? <span style={{background:gradeStyle.bg,color:gradeStyle.color,borderRadius:6,padding:"1px 6px",fontWeight:700}}>{grade}</span> : <span style={{color:"#ccc"}}>-</span>}
                                  </td>
                                  <td style={{padding:"6px 8px",color:"#1e293b",fontWeight:600}}>{weight ? weight+"kg" : "-"}</td>
                                  <td style={{padding:"6px 8px",color:"#1e293b"}}>{qty ? qty+"개" : "-"}</td>
                                  <td style={{padding:"6px 8px"}}>
                                    <div style={{color:G.mid,fontWeight:700}}>{price ? price.toLocaleString()+"원" : "-"}</div>
                                    <div style={{color:"#aaa",fontSize:9}}>{weight ? weight+"kg 단위" : ""}</div>
                                  </td>
                                  <td style={{padding:"6px 8px"}}>
                                    {kgPrice ? <span style={{background:"#ecfdf5",color:"#065f46",borderRadius:6,padding:"2px 6px",fontWeight:700,fontSize:10}}>{kgPrice.toLocaleString()}원</span> : <span style={{color:"#ccc"}}>-</span>}
                                  </td>
                                  <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>
                                    <div style={{fontWeight:600,fontSize:10,color:"#1e293b"}}>{info.name}</div>
                                    {info.phone && <a href={"tel:"+info.phone} style={{color:G.light,fontSize:9,textDecoration:"none"}}>📞 {info.phone}</a>}
                                  </td>
                                  <td style={{padding:"5px 6px"}}>
                                    <button onClick={function(){
                                      window._chatDealer={no:no, tradeRow:row, chatType:"inquiry"};
                                      // 채팅 모달은 경락탭에서 열리므로 탭 전환 후 오픈
                                    }} style={{background:"#f0fdf4",color:"#166534",border:"1px solid #bbf7d0",borderRadius:6,padding:"3px 7px",fontSize:10,fontWeight:700,cursor:"pointer"}}>❓</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {tradeStatus==="ok" && tradeData.length===0 && <div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{fontSize:36,marginBottom:10}}>📋</div>
            <div style={{fontSize:13,color:"#888"}}>아직 거래 데이터가 없습니다</div>
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
