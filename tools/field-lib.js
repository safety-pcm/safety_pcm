/* =============================================================================
   field-lib.js — 현장 기록 도구 공통 모듈 (일일안전보건일지·TBM·교육일지·중점관리 점검표·작업허가서)
   -----------------------------------------------------------------------------
   · 각 도구 HTML 은 window.TOOL_KEY 를 지정하고 auth.js → field-lib.js 순서로 불러온 뒤
     FL.start({ key, title, tabs:[["탭id","탭 이름"],...], onReady(ctx){ ... } }) 를 호출합니다.
   · 화면 뼈대(상단바·탭·사진 카메라·출력 미리보기)와 로그인·권한·현장 목록은 이 파일이 맡습니다.
   · 입력칸은 data-k="경로" 로 표시하면 FL.bind 가 상태 객체에 자동으로 연결합니다.
   · 사진은 기존 도구와 같은 방식(압축한 base64 를 문서의 photos 하위 컬렉션에 저장)으로 저장합니다.
   ============================================================================= */
(function(){
"use strict";
const FL = window.FL = {};
const SA = window.SafetyAuth;

/* ---------------- 작은 도구들 ---------------- */
const $ = FL.$ = id => document.getElementById(id);
FL.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const esc = FL.esc;
const pad = FL.pad = n => String(n).padStart(2, "0");
FL.iso = () => new Date().toISOString();
FL.ymd = s => { const d = (s instanceof Date) ? s : new Date(s); return isNaN(d) ? "" : `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
FL.today = () => FL.ymd(new Date());
FL.nowInput = () => { const d = new Date(); return `${FL.ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
FL.WD = ["일","월","화","수","목","금","토"];
FL.dow = ymd => { const d = new Date(ymd + "T00:00:00"); return isNaN(d) ? "" : FL.WD[d.getDay()]; };
FL.addDays = (ymd, n) => { const d = new Date(ymd + "T00:00:00"); d.setDate(d.getDate() + n); return FL.ymd(d); };
FL.clone = o => JSON.parse(JSON.stringify(o));
FL.key = s => String(s || "").replace(/[\/\s.#$\[\]]+/g, "_");
FL.num = v => { const n = parseFloat(String(v).replace(/,/g, "")); return isNaN(n) ? 0 : n; };

/* ---------------- 공통 스타일 ---------------- */
const CSS = `
:root{--ink:#17212c;--ink-soft:#525f6e;--ink-faint:#8a94a3;--paper:#eef1f4;--surface:#fff;--surface-2:#f5f7f9;--line:#dbe0e6;--accent:#1d5673;--accent-soft:#e4edf1;--accent-ink:#fff;--hazard:#c97f16;--hazard-soft:#faf1e0;--bad:#b3372b;--bad-soft:#f7e3e0;--good:#2f7d57;--good-soft:#e1efe7;--font:"Noto Sans KR","Malgun Gothic","맑은 고딕","Apple SD Gothic Neo",-apple-system,sans-serif}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--ink:#e7ecf1;--ink-soft:#aab5c2;--ink-faint:#7c8896;--paper:#0d1218;--surface:#182029;--surface-2:#1d2731;--line:#2c3843;--accent:#7fbcdb;--accent-soft:#1c2e38;--accent-ink:#0c222c;--hazard:#e0a24a;--hazard-soft:#332810;--bad:#e2776b;--bad-soft:#3a201d;--good:#66b98c;--good-soft:#1c2e24}}
*{box-sizing:border-box}html,body{margin:0;background:var(--paper)}
body{font-family:var(--font);color:var(--ink);font-size:14px;line-height:1.55;-webkit-text-size-adjust:100%;padding-bottom:env(safe-area-inset-bottom,0px)}
.bar{display:flex;align-items:center;gap:12px;padding:calc(10px + env(safe-area-inset-top,0px)) 16px 10px;background:var(--surface);border-bottom:3px solid var(--hazard);position:sticky;top:0;z-index:20}
.bar h1{font-size:15px;margin:0;font-weight:800;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar a.back{color:var(--accent);text-decoration:none;font-weight:700;font-size:13px;white-space:nowrap}
.role{font-size:11.5px;color:var(--ink-soft);white-space:nowrap}
.banner{margin:12px 16px 0;padding:10px 14px;background:var(--hazard-soft);border:1px solid var(--hazard);font-size:13px}.banner[hidden]{display:none}
.tabs{display:flex;gap:2px;padding:0 16px;margin-top:12px;border-bottom:1px solid var(--line);overflow-x:auto}
.tabs button{flex:0 0 auto;background:none;border:none;border-bottom:2px solid transparent;padding:10px 14px;font:700 14px var(--font);color:var(--ink-soft);cursor:pointer}
.tabs button.on{color:var(--ink);border-bottom-color:var(--hazard)}
main{max-width:1000px;margin:0 auto;padding:16px}
.view{display:none}.view.on{display:block}
.card{background:var(--surface);border:1px solid var(--line);padding:16px;margin-bottom:16px}
.card h2{font-size:15px;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line)}
.card h3{font-size:13.5px;margin:18px 0 6px;color:var(--ink)}
label{display:block;font-size:12.5px;color:var(--ink-soft);margin:12px 0 4px}
label.first,.row2>div:first-child>label,.row3>div:first-child>label{margin-top:0}
input,select,textarea{width:100%;padding:9px 10px;font:14px var(--font);color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:0}
input[type=checkbox],input[type=radio]{width:auto}
input[readonly],textarea[readonly]{opacity:.85}
textarea{min-height:64px;resize:vertical}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.row4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
button.primary{margin-top:16px;width:100%;padding:12px;background:var(--accent);color:var(--accent-ink);border:none;font:700 14px var(--font);cursor:pointer}
button.primary:disabled{opacity:.55;cursor:default}
.hint{font-size:12px;color:var(--ink-faint);margin-top:8px}
.sbtn{font:600 12px var(--font);padding:6px 11px;border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);cursor:pointer;white-space:nowrap}
.sbtn:hover{color:var(--ink)}.sbtn.danger{color:var(--bad);border-color:var(--bad)}.sbtn.pri{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}.sbtn:disabled{opacity:.5;cursor:default}
.tag{display:inline-block;padding:1px 8px;font-size:11.5px;font-weight:700;border:1px solid currentColor;white-space:nowrap}
.tag.good{color:var(--good);background:var(--good-soft)}.tag.bad{color:var(--bad);background:var(--bad-soft)}.tag.warn{color:var(--hazard);background:var(--hazard-soft)}.tag.off{color:var(--ink-faint);background:var(--surface-2)}.tag.info{color:var(--accent);background:var(--accent-soft)}
.filters{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}.filters select,.filters input{width:auto;min-width:130px;padding:6px 8px;font-size:13px}
.empty{padding:22px 0;text-align:center;color:var(--ink-faint);font-size:13px}
.rec{border-top:1px solid var(--line)}.rec:first-child{border-top:none}
.rec-h{display:flex;width:100%;gap:10px;align-items:flex-start;justify-content:space-between;padding:11px 0;background:none;border:none;text-align:left;cursor:pointer;font:14px var(--font);color:var(--ink)}
.rec-h .t{font-weight:700}.rec-h .s{font-size:12.5px;color:var(--ink-soft);margin-top:1px}
.rec-b{padding:2px 0 14px}
.btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.rows{border:1px solid var(--line);margin-top:4px}
.rrow{display:grid;gap:6px;padding:8px;border-top:1px solid var(--line);align-items:start}.rrow:first-child{border-top:none}
.rrow .x{justify-self:end}
.seg{display:inline-flex;border:1px solid var(--line)}
.seg button{padding:6px 11px;font:600 12.5px var(--font);border:none;border-right:1px solid var(--line);background:var(--surface);color:var(--ink-soft);cursor:pointer}
.seg button:last-child{border-right:none}
.seg button.on.g{background:var(--good-soft);color:var(--good)}.seg button.on.b{background:var(--bad-soft);color:var(--bad)}.seg button.on.n{background:var(--surface-2);color:var(--ink)}
.chk{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;margin:6px 0;color:var(--ink)}.chk input{margin-top:4px}
.pk{margin-top:8px}.pk .pa{display:flex;gap:6px;flex-wrap:wrap}.pk .th{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.pk .th div{position:relative;width:60px;height:60px;border:1px solid var(--line)}.pk .th img{width:100%;height:100%;object-fit:cover;display:block}
.pk .th button{position:absolute;top:0;right:0;width:18px;height:18px;padding:0;border:none;background:rgba(0,0,0,.6);color:#fff;font-size:12px;line-height:17px;cursor:pointer}
.pk .cam{border-color:var(--hazard);color:var(--hazard)}
.photos{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.photos img{width:76px;height:76px;object-fit:cover;border:1px solid var(--line);cursor:zoom-in;display:block}
.kv{display:grid;grid-template-columns:96px 1fr;gap:4px 10px;font-size:13px;margin:0 0 10px}.kv dt{color:var(--ink-soft)}.kv dd{margin:0;white-space:pre-wrap;word-break:break-word}
.modal{position:fixed;inset:0;display:none;z-index:50;background:rgba(0,0,0,.88);align-items:center;justify-content:center;padding:14px}.modal.show{display:flex}
.cambox{width:100%;max-width:520px;background:#111;color:#fff}.cambox video{width:100%;display:block;background:#000;max-height:62vh;object-fit:cover}
.camact{display:flex;gap:8px;padding:12px}.camact button{flex:1;padding:12px 6px;font:700 14px var(--font);border:none;background:#333;color:#fff;cursor:pointer}.camact button.shot{background:var(--hazard)}
.caminfo{padding:0 12px 12px;font-size:12.5px;color:#c9cfc9}
#lightbox img{max-width:100%;max-height:100%}
.dlg{background:var(--surface);color:var(--ink);width:100%;max-width:520px;max-height:92vh;overflow:auto;padding:16px;border:1px solid var(--line)}
.dlg h2{font-size:15px;margin:0 0 8px}
.pmodal{position:fixed;inset:0;display:none;z-index:60;background:rgba(13,18,24,.93);overflow:auto;padding:12px}.pmodal.show{display:block}
.pmbar{display:flex;gap:8px;max-width:800px;margin:0 auto 8px}.pmbar button{flex:1;padding:11px 6px;font:700 13.5px var(--font);border:none;background:#333;color:#fff;cursor:pointer}.pmbar button.p{background:var(--hazard)}
.pmhint{max-width:800px;margin:0 auto 10px;color:#c9cfc9;font-size:12.5px}
.paper{max-width:800px;margin:0 auto;padding:24px 22px;background:#fff}
.pmodal.land .paper,.pmodal.land .pmbar,.pmodal.land .pmhint{max-width:1120px}
#printArea{display:none}
@media print{@page{margin:12mm}html,body{background:#fff!important}body>*:not(#printArea){display:none!important}#printArea{display:block!important}}
html.lv-read .wr{display:none!important}
@media (max-width:640px){.row2,.row3,.row4{grid-template-columns:1fr}.kv{grid-template-columns:82px 1fr}.row2.keep,.row3.keep,.row4.keep{grid-template-columns:repeat(var(--n,2),1fr)}}
`;

/* 출력용(양식) 스타일 — 화면 미리보기·인쇄·새 창에서 같이 사용 */
FL.DOC_CSS = `
.fm{color:#000;background:#fff;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;font-size:9.5pt;line-height:1.4}
.fm h1{font-size:19pt;font-weight:900;text-align:center;letter-spacing:5pt;margin:0 0 8pt}
.fm .meta{display:flex;justify-content:space-between;align-items:flex-end;gap:10pt;margin-bottom:5pt;font-size:10pt}
.fm table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:6pt}
.fm th,.fm td{border:1px solid #000;padding:3pt 4pt;vertical-align:middle;word-break:break-all;white-space:pre-wrap}
.fm th{background:#eee;font-weight:700;text-align:center}
.fm td.c{text-align:center}.fm td.t{vertical-align:top}.fm td.h{height:34pt}
.fm .sign{width:auto;margin:0 0 0 auto;flex:none}.fm .sign th,.fm .sign td{width:56pt;text-align:center;font-size:8.5pt}.fm .sign td{height:30pt}.fm .sign th.v{width:18pt}
.fm .sec{font-weight:900;margin:7pt 0 3pt;font-size:10pt}
.fm .note{font-size:8pt;margin:3pt 0}
.fm .ph{display:flex;flex-wrap:wrap;gap:6pt}.fm .ph div{width:48%;font-size:8pt}.fm .ph img{width:100%;height:150pt;object-fit:cover;border:1px solid #000;display:block}
.fm .pb{page-break-before:always;margin-top:0}
.fm tr{page-break-inside:avoid}
`;
let docLand = false, docHtml = "";
FL.signBox = labels => { labels = labels || ["작성","검토","승인"]; return `<table class="sign"><tr><th class="v" rowspan="2">결<br>재</th>${labels.map(l => `<th>${esc(l)}</th>`).join("")}</tr><tr>${labels.map(() => "<td></td>").join("")}</tr></table>`; };
FL.showDoc = (html, land) => {
  docHtml = html; docLand = !!land;
  $("pmBody").innerHTML = html;
  $("pModal").classList.toggle("land", docLand); $("pModal").classList.add("show");
};
const pageRule = () => `@page{margin:12mm}${docLand ? "@page{size:A4 landscape;margin:10mm}" : ""}`;

/* ---------------- 화면 뼈대 ---------------- */
function buildFrame(opts){
  document.title = opts.title;
  const st = document.createElement("style"); st.textContent = CSS + FL.DOC_CSS; document.head.appendChild(st);
  const tabs = (opts.tabs || []).map((t, i) => `<button class="${i ? "" : "on"}" data-v="${t[0]}">${esc(t[1])}</button>`).join("");
  const views = (opts.tabs || []).map((t, i) => `<section class="view${i ? "" : " on"}" id="v-${t[0]}"></section>`).join("");
  document.body.innerHTML = `
  <header class="bar"><a class="back" href="../index.html">← 툴박스</a><h1>${esc(opts.title)}</h1><span class="role" id="roleBadge"></span></header>
  <div class="banner" id="banner" hidden></div>
  ${tabs ? `<nav class="tabs" id="tabs">${tabs}</nav>` : ""}
  <main id="app">${views}</main>
  <div class="modal" id="camModal"><div class="cambox"><video id="camVideo" autoplay playsinline muted></video>
    <div class="camact"><button class="shot" id="camShot" type="button">촬영</button><button id="camFlip" type="button">전·후면 전환</button><button id="camClose" type="button">완료</button></div>
    <div class="caminfo" id="camInfo"></div></div></div>
  <div class="modal" id="lightbox"><img alt=""></div>
  <div class="pmodal" id="pModal"><div class="pmbar"><button class="p" id="pmPrint" type="button">인쇄</button><button id="pmWin" type="button">새 창에서 열기</button><button id="pmClose" type="button">닫기</button></div>
    <div class="pmhint">아래가 인쇄될 문서입니다. [인쇄]가 반응하지 않으면 [새 창에서 열기]로 열어 인쇄하세요.</div><div class="paper fm" id="pmBody"></div></div>
  <div id="printArea" class="fm"></div>`;
  if(window.self !== window.top){ const bk = document.querySelector(".bar .back"); if(bk) bk.style.display = "none"; }

  $("pmClose").onclick = () => $("pModal").classList.remove("show");
  $("pmPrint").onclick = () => {
    const a = $("printArea"); a.innerHTML = docHtml;
    let ps = document.getElementById("pgStyle"); if(!ps){ ps = document.createElement("style"); ps.id = "pgStyle"; document.head.appendChild(ps); }
    ps.textContent = pageRule();
    Promise.all(Array.from(a.querySelectorAll("img")).map(i => i.decode ? i.decode().catch(() => {}) : Promise.resolve()))
      .then(() => { try{ window.print(); }catch(e){ alert("이 화면에서는 인쇄 창을 열 수 없습니다. [새 창에서 열기]를 이용해 주세요."); } });
  };
  $("pmWin").onclick = () => {
    const w = window.open("", "_blank");
    if(!w){ alert("새 창이 차단되었습니다. 브라우저의 팝업 허용 후 다시 시도해 주세요."); return; }
    w.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>출력</title><style>${pageRule()}body{margin:0;padding:${docLand ? "0" : "12mm"}}${FL.DOC_CSS}</style></head><body class="fm">${docHtml}</body></html>`);
    w.document.close(); setTimeout(() => { try{ w.focus(); w.print(); }catch(e){} }, 600);
  };
  document.addEventListener("click", e => {
    const im = e.target.closest("img[data-zoom]");
    if(im){ const lb = $("lightbox"); lb.querySelector("img").src = im.src; lb.classList.add("show"); }
  });
  $("lightbox").onclick = () => $("lightbox").classList.remove("show");
  initCamera();
  if($("tabs")){
    $("tabs").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if(b) FL.show(b.dataset.v); });
    const h = location.hash.slice(1), m = (opts.hashMap || {})[h] || h;
    if(m && document.getElementById("v-" + m)) FL.show(m);
  }
}
FL.show = id => {
  document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x.dataset.v === id));
  document.querySelectorAll("#app > .view").forEach(v => v.classList.toggle("on", v.id === "v-" + id));
  window.scrollTo(0, 0);
};
FL.banner = msg => { const b = $("banner"); if(!msg){ b.hidden = true; return; } b.hidden = false; b.textContent = msg; };
FL.onErr = e => {
  console.warn(e);
  if(e && e.code === "permission-denied") FL.banner("데이터를 불러오거나 저장할 권한이 없습니다. 관리자에게 Firestore 보안 규칙(이 도구의 컬렉션) 적용 여부를 확인해 달라고 요청해 주세요.");
  else if(e && e.code === "unavailable") FL.banner("네트워크 연결이 불안정합니다. 연결을 확인한 뒤 새로고침해 주세요.");
};

/* ---------------- 카메라 · 사진 ---------------- */
let camStream = null, camFacing = "environment", camCb = null, camShots = 0;
function loadImageEl(src){ return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function compress(src){
  const img = await loadImageEl(src);
  let maxDim = 900, quality = 0.6;
  for(let n = 0; n < 5; n++){
    const sc = Math.min(1, maxDim / Math.max(img.width, img.height));
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(img.width * sc)); cv.height = Math.max(1, Math.round(img.height * sc));
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const url = cv.toDataURL("image/jpeg", quality);
    if(url.length < 235000 || n === 4) return url;
    quality = Math.max(0.25, quality - 0.15); maxDim = Math.round(maxDim * 0.85);
  }
}
function stopStream(){ if(camStream){ camStream.getTracks().forEach(t => t.stop()); camStream = null; } }
async function startStream(){ stopStream(); camStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:camFacing}}, audio:false}); $("camVideo").srcObject = camStream; }
const camInfo = () => { $("camInfo").textContent = camShots ? `이번에 촬영한 사진 ${camShots}장 — 계속 촬영하거나 [완료]를 누르세요.` : "촬영 버튼을 누르면 사진이 바로 첨부됩니다."; };
async function openCamera(cb, fallback){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ fallback.click(); return; }
  camCb = cb; camShots = 0; camInfo(); $("camModal").classList.add("show");
  try{ await startStream(); }catch(e){ closeCamera(); fallback.click(); }
}
function closeCamera(){ stopStream(); $("camModal").classList.remove("show"); camCb = null; }
function initCamera(){
  $("camClose").onclick = closeCamera;
  $("camFlip").onclick = async () => { camFacing = camFacing === "environment" ? "user" : "environment"; try{ await startStream(); }catch(e){} };
  $("camShot").onclick = () => {
    const v = $("camVideo"); if(!v.videoWidth || !camCb) return;
    const cv = document.createElement("canvas"); cv.width = v.videoWidth; cv.height = v.videoHeight;
    cv.getContext("2d").drawImage(v, 0, 0);
    cv.toBlob(b => { if(!b || !camCb) return; camCb(URL.createObjectURL(b)); camShots++; camInfo(); }, "image/jpeg", 0.9);
  };
}
/* store 배열을 호출 쪽이 소유합니다(화면이 다시 그려져도 사진이 유지됨) */
FL.makePicker = (mount, store, max, onChange) => {
  mount.innerHTML = "";
  let busy = 0;
  const pa = document.createElement("div"); pa.className = "pa";
  const cam = document.createElement("button"); cam.type = "button"; cam.className = "sbtn cam"; cam.textContent = "📷 바로 촬영";
  const alb = document.createElement("button"); alb.type = "button"; alb.className = "sbtn"; alb.textContent = "🖼 앨범에서 선택";
  const fin = document.createElement("input"); fin.type = "file"; fin.accept = "image/*"; fin.multiple = true; fin.hidden = true;
  const cin = document.createElement("input"); cin.type = "file"; cin.accept = "image/*"; cin.setAttribute("capture", "environment"); cin.hidden = true;
  const th = document.createElement("div"); th.className = "th";
  const render = () => { th.innerHTML = ""; store.forEach((u, i) => { const d = document.createElement("div"); d.innerHTML = `<img src="${u}" alt="" data-zoom><button type="button" data-i="${i}">×</button>`; th.appendChild(d); }); if(onChange) onChange(); };
  async function addSrc(src, revoke){
    if(store.length >= max){ alert(`사진은 최대 ${max}장까지 첨부할 수 있습니다.`); if(revoke) URL.revokeObjectURL(src); return; }
    busy++;
    try{ store.push(await compress(src)); render(); }catch(e){ alert("사진을 처리하지 못했습니다."); }
    finally{ if(revoke) URL.revokeObjectURL(src); busy--; }
  }
  const onFiles = e => { Array.from(e.target.files).forEach(f => addSrc(URL.createObjectURL(f), true)); e.target.value = ""; };
  fin.onchange = onFiles; cin.onchange = onFiles;
  cam.onclick = () => openCamera(u => addSrc(u, true), cin);
  alb.onclick = () => fin.click();
  th.onclick = e => { const b = e.target.closest("button[data-i]"); if(b){ store.splice(+b.dataset.i, 1); render(); } };
  pa.append(cam, alb); mount.append(pa, fin, cin, th); render();
  return { isBusy: () => busy > 0, clear(){ store.length = 0; render(); }, refresh: render };
};

const photoCache = new Map();
FL.loadPhotos = async (db, path) => {
  if(photoCache.has(path)) return photoCache.get(path);
  const snap = await db.collection(path).get();
  const arr = snap.docs.map(d => ({id:d.id, ...d.data()}));
  photoCache.set(path, arr); return arr;
};
FL.dropPhotoCache = path => photoCache.delete(path);
/* 기존 사진을 모두 지우고 새로 저장 (수정 저장 시) */
FL.replacePhotos = async (db, ref, items) => {
  const old = await ref.collection("photos").get();
  await Promise.all(old.docs.map(d => d.ref.delete()));
  await Promise.all(items.map(it => ref.collection("photos").add({...it, createdAt: FL.iso()})));
  photoCache.delete(ref.path);
};
FL.deleteDoc = async (db, col, id) => {
  const ref = db.collection(col).doc(id);
  const ph = await ref.collection("photos").get();
  await Promise.all(ph.docs.map(d => d.ref.delete()));
  await ref.delete(); photoCache.delete(ref.path);
};
FL.imgs = arr => arr.map(p => `<img src="${p.data}" alt="" data-zoom>`).join("");

/* ---------------- 입력칸 ↔ 상태 연결 (data-k="a.b.0.c") ---------------- */
FL.getPath = (o, path) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
FL.setPath = (o, path, v) => { const ks = path.split("."); let a = o; for(let i = 0; i < ks.length - 1; i++) a = a[ks[i]]; a[ks[ks.length - 1]] = v; };
/* root 안의 입력 변화를 getState() 가 돌려주는 객체에 기록 */
FL.bind = (root, getState, onChange) => {
  const handle = e => {
    const el = e.target.closest("[data-k]"); if(!el || !root.contains(el)) return;
    const st = getState(); if(!st) return;
    let v;
    if(el.type === "checkbox") v = el.checked;
    else if(el.type === "radio"){ if(!el.checked) return; v = el.value; }
    else v = el.value;
    FL.setPath(st, el.dataset.k, v);
    if(onChange) onChange(el.dataset.k, v, el);
  };
  root.addEventListener("input", handle); root.addEventListener("change", handle);
};
/* 입력칸 만들기 */
FL.inp = (k, v, attrs) => `<input type="${(attrs && attrs.type) || "text"}" data-k="${k}" value="${esc(v)}"${attrs && attrs.ph ? ` placeholder="${esc(attrs.ph)}"` : ""}${attrs && attrs.ro ? " readonly" : ""}${attrs && attrs.extra ? " " + attrs.extra : ""}>`;
FL.ta = (k, v, ph, ro) => `<textarea data-k="${k}"${ph ? ` placeholder="${esc(ph)}"` : ""}${ro ? " readonly" : ""}>${esc(v)}</textarea>`;
FL.sel = (k, v, list, blank, ro) => `<select data-k="${k}"${ro ? " disabled" : ""}>${blank !== false ? `<option value=""></option>` : ""}${list.map(o => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
/* ○ / × / - 선택 버튼 (data-seg 로 클릭 처리) */
FL.segHtml = (k, v, opts, ro) => `<span class="seg" data-seg="${k}">${opts.map(o => `<button type="button" data-v="${esc(o[0])}" class="${v === o[0] ? "on " + o[1] : ""}"${ro ? " disabled" : ""}>${esc(o[0])}</button>`).join("")}</span>`;
FL.bindSeg = (root, getState, onChange) => {
  root.addEventListener("click", e => {
    const b = e.target.closest(".seg button[data-v]"); if(!b || !root.contains(b) || b.disabled) return;
    const k = b.closest("[data-seg]").dataset.seg, st = getState(); if(!st) return;
    const cur = FL.getPath(st, k), nv = b.dataset.v === cur ? "" : b.dataset.v;
    FL.setPath(st, k, nv); if(onChange) onChange(k, nv);
  });
};

/* ---------------- 시작 ---------------- */
FL.siteList = [];
const siteCbs = [];
FL.onSites = cb => { siteCbs.push(cb); cb(FL.siteList); };
FL.fillSite = (sel, includeAll) => {
  const prev = sel.value; const names = FL.siteList;
  sel.innerHTML = (includeAll ? `<option value="">전체 현장</option>` : "") + (names.length || includeAll ? "" : `<option value="">(등록된 현장 없음 — 본사 메뉴의 현장 등록에서 먼저 등록하세요)</option>`) + names.map(n => `<option>${esc(n)}</option>`).join("");
  const pref = new URLSearchParams(location.search).get("site") || "";
  if(names.includes(prev)) sel.value = prev; else if(pref && names.includes(pref) && !sel.dataset.pref){ sel.value = pref; sel.dataset.pref = "1"; }
};
FL.start = async opts => {
  const go = async () => {
    buildFrame(opts);
    if(!SA || !SA.configured() || !SA.boot()){ FL.banner("Firebase 설정이 없어 이 도구를 사용할 수 없습니다. (firebase-config.js 확인)"); return; }
    const user = await new Promise(res => { const off = SA.auth.onAuthStateChanged(u => { off(); res(u); }); });
    if(!user) return;
    let prof = {};
    try{ const s = await SA.db.collection("users").doc(user.uid).get(); prof = s.exists ? s.data() : {}; }catch(e){}
    const role = prof.role || "pending", lv = SA.level(role, opts.key);
    if(!lv) return;
    const db = SA.db;
    const ctx = {
      db, user, role, lv, uid: user.uid,
      name: prof.name || user.displayName || (user.email || "").split("@")[0],
      canWrite: () => lv === "write" || lv === "delete",
      canManage: () => role === "hq" || role === "admin",
      canDelete: () => lv === "delete"
    };
    $("roleBadge").textContent = (SA.ROLE_LABELS[role] || "") + (lv === "read" ? " · 조회 전용" : "");
    db.collection("siteRegistry").orderBy("order").onSnapshot(s => {
      FL.siteList = s.docs.map(d => d.data().name).filter(Boolean);
      siteCbs.forEach(cb => cb(FL.siteList));
    }, FL.onErr);
    opts.onReady(ctx);
  };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
};
})();
