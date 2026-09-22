/* =============================================================================
   auth.js — 로그인 · 권한 공통 모듈 (포털과 각 도구가 함께 사용)
   -----------------------------------------------------------------------------
   · 등급: 관리자(admin) / 본사담당자(hq) / 현장담당자(field) / 열람자(reader)
     (가입 직후에는 '승인 대기(pending)' 상태이며 관리자가 등급을 지정해야 사용 가능)
   · 도구 키: hq = 본사점검 보고서 관리, dr = 중대재해 이행점검 서류심사, ra = 위험성평가 관리
   · 권한 표를 바꾸려면 아래 PERMS 만 수정하면 화면 쪽이 모두 따라갑니다.
     (단, 실제 데이터 보호는 Firebase Firestore 규칙이 담당하므로 규칙도 같이 맞춰야 합니다.)
   ============================================================================= */
(function(){
  var ADMIN_EMAIL = "xhfalsl@gmail.com";           // 최초 관리자 (인증된 이메일만 인정)

  var ROLE_LABELS = { pending:"승인 대기", reader:"열람자", field:"현장담당자", hq:"본사담당자", admin:"관리자" };
  var ROLE_ORDER  = ["pending","reader","field","hq","admin"];

  // 권한 등급: null(접근 불가) < read(조회) < write(작성·수정) < delete(삭제 포함)
  var PERMS = {
    admin:   { hq:"delete", dr:"delete", ra:"delete" },
    hq:      { hq:"write",  dr:"write",  ra:"write"  },
    field:   { hq:"read",   dr:null,     ra:"write"  },
    reader:  { hq:"read",   dr:"read",   ra:"read"   },
    pending: { hq:null,     dr:null,     ra:null     }
  };
  var RANK = { read:1, write:2, delete:3 };

  function level(role, tool){ var p = PERMS[role]; return (p && p[tool]) || null; }
  function can(role, tool, need){ var l = level(role, tool); return !!l && RANK[l] >= RANK[need || "read"]; }

  function configured(){
    var c = window.FIREBASE_CONFIG;
    return !!(c && c.apiKey && String(c.apiKey).indexOf("여기에") !== 0);
  }

  var auth = null, db = null;
  function boot(){
    if(!configured() || typeof firebase === "undefined") return false;
    try{
      if(!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      return true;
    }catch(e){ console.warn("Firebase 초기화 실패", e); return false; }
  }

  function isBootAdmin(user){
    return !!(user && user.email && user.email.toLowerCase() === ADMIN_EMAIL && user.emailVerified);
  }

  var pendingName = "";   // 이메일 가입 직후 프로필에 넣을 이름
  function setPendingName(n){ pendingName = n || ""; }

  /* 프로필(users/{uid}) 이 없으면 만들고, 최초 관리자는 관리자로 승격 */
  function ensureProfile(user){
    var ref = db.collection("users").doc(user.uid);
    return ref.get().then(function(snap){
      if(!snap.exists){
        var data = {
          email: user.email || "",
          name: user.displayName || pendingName || "",
          role: isBootAdmin(user) ? "admin" : "pending",
          createdAt: new Date().toISOString()
        };
        return ref.set(data).then(function(){ return data; });
      }
      var d = snap.data();
      if(isBootAdmin(user) && d.role !== "admin"){
        return ref.update({ role:"admin", updatedAt:new Date().toISOString() }).then(function(){
          d.role = "admin"; return d;
        });
      }
      return d;
    });
  }

  window.SafetyAuth = {
    ADMIN_EMAIL: ADMIN_EMAIL, ROLE_LABELS: ROLE_LABELS, ROLE_ORDER: ROLE_ORDER, PERMS: PERMS,
    level: level, can: can, configured: configured, boot: boot,
    isBootAdmin: isBootAdmin, ensureProfile: ensureProfile, setPendingName: setPendingName,
    get auth(){ return auth; }, get db(){ return db; }
  };

  /* =========================================================================
     도구 화면 보호 (각 도구 HTML 이 window.TOOL_KEY 를 지정했을 때만 동작)
     ========================================================================= */
  var TOOL = window.TOOL_KEY;
  if(!TOOL) return;

  if(!boot()) return;   // Firebase 설정이 비어 있으면 기존 동작(저장 없이 미리보기) 유지

  var gate = document.createElement("div");
  gate.id = "authGate";
  gate.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;background:#eef1f4;color:#17212c;" +
    "display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;" +
    "font:14px/1.7 'Noto Sans KR',-apple-system,sans-serif";
  gate.innerHTML = "<div>권한을 확인하는 중…</div>";
  document.documentElement.appendChild(gate);

  function showGate(title, msg, buttons){
    var html = "<div style='max-width:360px'><div style='font-weight:700;font-size:16px;margin-bottom:6px'>" + title + "</div>" +
      "<div style='color:#525f6e;margin-bottom:16px'>" + msg + "</div>";
    (buttons || []).forEach(function(b){
      html += "<a href='" + b[1] + "' " + (b[2] ? "target='_top' " : "") +
        "style='display:inline-block;margin:0 4px;padding:9px 16px;border-radius:8px;border:1px solid #1d5673;" +
        (b[3] ? "background:#1d5673;color:#fff;" : "background:#fff;color:#1d5673;") +
        "text-decoration:none;font-weight:600'>" + b[0] + "</a>";
    });
    gate.innerHTML = html + "</div>";
  }

  var CSS =
    /* 조회 전용(read): 편집·저장·삭제 관련 버튼을 모두 숨김 */
    "html.lv-read #btnNew,html.lv-read #btnSaveTop,html.lv-read #fabSave,html.lv-read #btnSaveM," +
    "html.lv-read #btnClearPhotos,html.lv-read #btnClearAll,html.lv-read #drop,html.lv-read .pickers," +
    "html.lv-read #cards button,html.lv-read .rcard [data-act='dup'],html.lv-read .rcard [data-act='del']," +
    "html.lv-read #addSiteBtn,html.lv-read #removeSiteBtn,html.lv-read .photo-del-btn,html.lv-read .tt-addmore," +
    "html.lv-read .tt-fit,html.lv-read #lbDel{display:none!important}" +
    "html.lv-read .photo-slot.empty,html.lv-read .rate-btn{pointer-events:none}" +
    /* 작성·수정(write): 삭제 버튼만 숨김 (삭제는 관리자 전용) */
    "html.lv-write .rcard [data-act='del'],html.lv-write #removeSiteBtn{display:none!important}" +
    ".ro-badge{position:fixed;right:10px;bottom:10px;z-index:2147482000;background:#1d5673;color:#fff;" +
    "font:600 12px 'Noto Sans KR',sans-serif;padding:6px 12px;border-radius:999px;opacity:.9;pointer-events:none}";

  var LOCK_SEL = "#screenEditor .panel input,#screenEditor .panel textarea,#screenEditor .panel select," +
                 "#app input,#app textarea,#app select";
  function lockInputs(){
    var nodes = document.querySelectorAll(LOCK_SEL);
    for(var i = 0; i < nodes.length; i++){
      var el = nodes[i], t = (el.type || "").toLowerCase();
      if(t === "file" || t === "search" || el.id === "search") continue;
      if(el.tagName === "TEXTAREA" || t === "text" || t === "" || t === "number"){ el.readOnly = true; }
      else { el.disabled = true; }
    }
  }
  function startReadOnlyDom(){
    var queued = false;
    function run(){ queued = false; lockInputs(); }
    new MutationObserver(function(){ if(!queued){ queued = true; requestAnimationFrame(run); } })
      .observe(document.documentElement, { childList:true, subtree:true });
    lockInputs();
  }
  function blockWrites(){
    try{
      var F = firebase.firestore;
      ["set","update","delete"].forEach(function(m){
        F.DocumentReference.prototype[m] = function(){ return Promise.resolve(); };
      });
      F.CollectionReference.prototype.add = function(){ return Promise.resolve({ id:"readonly" }); };
    }catch(e){ console.warn("쓰기 차단 설정 실패", e); }
  }

  function apply(lv, role){
    var st = document.createElement("style"); st.textContent = CSS;
    document.head.appendChild(st);
    document.documentElement.classList.add("lv-" + lv);
    if(lv === "read"){
      blockWrites();
      var go = function(){
        startReadOnlyDom();
        var b = document.createElement("div");
        b.className = "ro-badge"; b.textContent = "조회 전용 · " + (ROLE_LABELS[role] || "");
        document.body.appendChild(b);
      };
      if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
    }
    gate.parentNode && gate.parentNode.removeChild(gate);
  }

  auth.onAuthStateChanged(function(user){
    if(!user){
      showGate("로그인이 필요합니다", "안전관리 툴박스 첫 화면에서 로그인한 뒤 이용해 주세요.",
               [["로그인 화면으로", "../index.html", true, true]]);
      return;
    }
    db.collection("users").doc(user.uid).get().then(function(snap){
      var role = snap.exists ? snap.data().role : "pending";
      var lv = level(role, TOOL);
      if(!lv){
        showGate("이 도구를 볼 수 있는 권한이 없습니다",
                 role === "pending" ? "관리자 승인이 완료되면 사용할 수 있습니다." : "현재 등급(" + (ROLE_LABELS[role] || role) + ")에는 열려 있지 않은 도구입니다.",
                 [["첫 화면으로", "../index.html", true, false], ["다시 확인", "javascript:location.reload()", false, true]]);
        return;
      }
      apply(lv, role);
    }).catch(function(err){
      console.warn(err);
      showGate("권한을 확인하지 못했습니다", "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
               [["다시 시도", "javascript:location.reload()", false, true]]);
    });
  });
})();
