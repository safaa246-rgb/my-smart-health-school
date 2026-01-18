/* =========================
   Storage & Data Model
========================= */
const LS_KEY = "smartHealthySchool_v1";

const defaultData = () => ({
  settings: {
    teacherPass: "1234",
    pointsRules: {
      fruit: 10,
      veg: 10,
      water: 8,
      nuts: 9,
      sandwich: 12,
      dairy: 9,
      other: 7,
      varietyBonus: 5
    }
  },
  currentUserId: null,
  users: {},
  posts: [],
  stations: {
    "ST-APPLE": { code:"ST-APPLE", question:"ما فائدة التفاح للجسم؟", answer:"المناعة", points:5, createdAt:Date.now() },
    "ST-WATER": { code:"ST-WATER", question:"كم كوب ماء يُنصح به تقريبًا يوميًا؟", answer:"8", points:5, createdAt:Date.now() }
  },
  stationClaims: []
});

function loadData(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return defaultData();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultData(), parsed);
  }catch(e){
    return defaultData();
  }
}
function saveData(){
  localStorage.setItem(LS_KEY, JSON.stringify(DATA));
}

let DATA = loadData();

/* =========================
   Helpers
========================= */
const $ = (id)=>document.getElementById(id);
const fmtDate = (ts)=> new Date(ts).toLocaleString("ar", {dateStyle:"medium", timeStyle:"short"});
const todayKey = ()=> {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const uid = ()=> Math.random().toString(16).slice(2)+Date.now().toString(16);

function normalizeAnswer(s){
  return (s||"").trim().toLowerCase()
    .replace(/\s+/g," ")
    .replace(/[أإآا]/g,"ا")
    .replace(/ة/g,"ه")
    .replace(/ى/g,"ي");
}

function computeLevel(points){
  if(points >= 300) return 6;
  if(points >= 200) return 5;
  if(points >= 120) return 4;
  if(points >= 60)  return 3;
  if(points >= 20)  return 2;
  return 1;
}

/* =========================
   Badges
========================= */
const BADGES = [
  { id:"starter", name:"بداية صحية", rule:(u)=>u.posts>=1, icon:"🌱" },
  { id:"tenPosts", name:"ملتزم", rule:(u)=>u.posts>=10, icon:"✅" },
  { id:"points50", name:"نقاط 50", rule:(u)=>u.points>=50, icon:"⭐" },
  { id:"points150", name:"بطل الصحة", rule:(u)=>u.points>=150, icon:"🏅" },
  { id:"variety3", name:"متذوّق", rule:(u)=>countVariety(u.id)>=3, icon:"🍇" },
  { id:"cafeteria3", name:"اختيارات مقصف ذكية", rule:(u)=>countCafeteriaHealthy(u.id)>=3, icon:"🏫" },
];

function countVariety(userId){
  const types = new Set(DATA.posts.filter(p=>p.userId===userId).map(p=>p.foodType));
  return types.size;
}
function countCafeteriaHealthy(userId){
  return DATA.posts.filter(p=>p.userId===userId && p.fromCafeteria==="yes").length;
}

function refreshBadges(user){
  const owned = new Set(user.badges||[]);
  let changed = false;
  BADGES.forEach(b=>{
    if(!owned.has(b.id) && b.rule(user)){
      owned.add(b.id);
      changed = true;
    }
  });
  user.badges = [...owned];
  if(changed) saveData();
}

/* =========================
   UI: Tabs / Views
========================= */
const tabs = document.querySelectorAll(".tab");
tabs.forEach(t=>{
  t.addEventListener("click", ()=>{
    tabs.forEach(x=>x.classList.remove("active"));
    t.classList.add("active");
    showView(t.dataset.view);
  });
});

function showView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hide"));
  const el = $("view-"+name);
  if(el) el.classList.remove("hide");

  if(["submit","station","badges","history"].includes(name) && !getCurrentUser()){
    document.querySelector('[data-view="login"]').click();
    alert("سجّل دخولك أولاً.");
  } else {
    if(name==="submit") renderMyStats();
    if(name==="history") renderHistory();
    if(name==="badges") renderBadges();
  }
}

/* =========================
   Auth / Current User
========================= */
function getCurrentUser(){
  const id = DATA.currentUserId;
  if(!id) return null;
  return DATA.users[id] || null;
}

function setWhoPill(){
  const u = getCurrentUser();
  if(!u){
    $("whoText").textContent = "غير مسجل";
    $("welcomeText").textContent = "سجّل دخولك للبدء بتجميع نقاط الصحة وفتح البادجات!";
    return;
  }
  $("whoText").textContent = `${u.name} — ${u.class}${u.section?(" "+u.section):""}`;
  $("welcomeText").innerHTML = `أهلًا <b>${u.name}</b> 👋<br/>تابع التحديات واجمع نقاط الصحة على مستوى المدرسة.`;
}

$("btnLogout").addEventListener("click", ()=>{
  DATA.currentUserId = null;
  saveData();
  setWhoPill();
  renderAll();
  document.querySelector('[data-view="login"]').click();
});

$("btnLogin").addEventListener("click", ()=>{
  const name = $("studentName").value.trim();
  const cls  = $("studentClass").value.trim();
  const sec  = $("studentSection").value.trim();
  const scode= $("schoolCode").value.trim();

  if(!name || !cls){
    alert("الرجاء إدخال اسم الطالب واختيار الصف.");
    return;
  }

  const idBase = `${name}|${cls}|${sec}|${scode}`.toLowerCase();
  let foundId = Object.values(DATA.users).find(u=> (u._idBase===idBase))?.id;

  if(!foundId){
    const id = uid();
    DATA.users[id] = {
      id,
      _idBase: idBase,
      name, class: cls, section: sec, schoolCode: scode,
      points: 0, posts: 0, level: 1, badges: [],
      lastFoodType: null,
      createdAt: Date.now()
    };
    foundId = id;
  } else {
    const u = DATA.users[foundId];
    u.name=name; u.class=cls; u.section=sec; u.schoolCode=scode;
  }

  DATA.currentUserId = foundId;
  saveData();
  setWhoPill();
  renderAll();
  document.querySelector('[data-view="submit"]').click();
});

/* =========================
   Submit Post
========================= */
$("btnSubmit").addEventListener("click", async ()=>{
  const u = getCurrentUser();
  if(!u) return;

  const type = $("foodType").value;
  const fromC = $("fromCafeteria").value;
  const note = $("foodNote").value.trim();
  const file = $("foodImage").files[0];

  if(!type){
    alert("اختاري نوع الاختيار الصحي.");
    return;
  }
  if(!file){
    alert("ارفع صورة لتوثيق المشاركة.");
    return;
  }

  const imgDataUrl = await fileToDataUrl(file);

  const base = DATA.settings.pointsRules[type] ?? 5;
  const varietyBonus = (u.lastFoodType && u.lastFoodType !== type) ? DATA.settings.pointsRules.varietyBonus : 0;
  const total = base + varietyBonus;

  const post = {
    id: uid(),
    userId: u.id,
    ts: Date.now(),
    foodType: type,
    fromCafeteria: fromC,
    note,
    imgDataUrl,
    pointsAwarded: total
  };

  DATA.posts.unshift(post);

  u.points += total;
  u.posts += 1;
  u.lastFoodType = type;
  u.level = computeLevel(u.points);

  refreshBadges(u);

  saveData();
  renderAll();

  $("foodType").value = "";
  $("fromCafeteria").value = "no";
  $("foodNote").value = "";
  $("foodImage").value = "";

  alert(`تمت الإضافة ✅ +${total} نقطة`);
});

/* =========================
   Station / QR
========================= */
$("btnLoadStation").addEventListener("click", ()=>{
  const code = $("stationCodeInput").value.trim().toUpperCase();
  const st = DATA.stations[code];
  $("stationResult").textContent = "";
  if(!code){
    alert("أدخل كود المحطة.");
    return;
  }
  if(!st){
    alert("الكود غير موجود.");
    return;
  }

  $("stationBox").classList.remove("hide");
  $("stationQuestion").textContent = st.question;
  $("stationAnswer").value = "";
  $("stationHint").textContent = `نقاط هذه المحطة: +${st.points}`;
  $("stationBox").dataset.code = code;
});

$("btnCheckStation").addEventListener("click", ()=>{
  const u = getCurrentUser();
  if(!u) return;

  const code = $("stationBox").dataset.code;
  const st = DATA.stations[code];
  if(!st) return;

  const key = todayKey();
  const already = DATA.stationClaims.some(c=>c.userId===u.id && c.code===code && c.dateKey===key);
  if(already){
    $("stationResult").textContent = "✅ أخذت نقاط هذه المحطة اليوم بالفعل.";
    return;
  }

  const ans = $("stationAnswer").value;
  const ok = normalizeAnswer(ans).includes(normalizeAnswer(st.answer));

  if(ok){
    u.points += Number(st.points)||0;
    u.level = computeLevel(u.points);
    refreshBadges(u);
    DATA.stationClaims.push({userId:u.id, code, dateKey:key});
    saveData();
    renderAll();
    $("stationResult").textContent = `🎉 صحيح! +${st.points} نقطة`;
  } else {
    $("stationResult").textContent = "❌ خطأ، حاول مرة ثانية.";
  }
});

/* =========================
   Teacher
========================= */
$("btnTeacherUnlock").addEventListener("click", ()=>{
  const pass = $("teacherPass").value;
  if(pass === DATA.settings.teacherPass){
    $("teacherPanel").classList.remove("hide");
    renderStations();
  } else {
    alert("كلمة مرور غير صحيحة.");
  }
});

$("btnAddStation").addEventListener("click", ()=>{
  const code = $("tCode").value.trim().toUpperCase();
  const pts  = Number($("tPoints").value || 5);
  const q    = $("tQ").value.trim();
  const a    = $("tA").value.trim();

  if(!code || !q || !a){
    alert("أدخل الكود + السؤال + الإجابة.");
    return;
  }
  DATA.stations[code] = { code, question:q, answer:a, points:pts, createdAt:Date.now() };
  saveData();
  renderStations();

  $("tCode").value=""; $("tQ").value=""; $("tA").value=""; $("tPoints").value=5;
  alert("تمت إضافة المحطة ✅");
});

function renderStations(){
  const box = $("stationList");
  box.innerHTML = "";
  const arr = Object.values(DATA.stations).sort((a,b)=>a.code.localeCompare(b.code));
  arr.forEach(st=>{
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="thumb">QR</div>
      <div style="flex:1">
        <h3>${st.code} <span class="score">+${st.points}</span></h3>
        <div class="meta">${st.question}</div>
        <div class="tags">
          <span class="tag">الإجابة: ${st.answer}</span>
        </div>
      </div>
    `;
    box.appendChild(div);
  });
}

$("btnResetAll").addEventListener("click", ()=>{
  if(confirm("سيتم مسح كل البيانات. هل أنت متأكد؟")){
    localStorage.removeItem(LS_KEY);
    DATA = loadData();
    saveData();
    renderAll();
    alert("تمت إعادة الضبط ✅");
  }
});

/* =========================
   Export / Import
========================= */
$("btnExport").addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(DATA, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "smartHealthySchool_data.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("importFile").addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  try{
    const obj = JSON.parse(text);
    if(!obj.users || !obj.posts || !obj.stations) throw new Error("Invalid");
    DATA = Object.assign(defaultData(), obj);
    saveData();
    renderAll();
    alert("تم الاستيراد ✅");
  }catch(err){
    alert("ملف غير صالح.");
  } finally {
    e.target.value = "";
  }
});

/* =========================
   Render
========================= */
function renderMyStats(){
  const u = getCurrentUser();
  if(!u) return;
  $("myPoints").textContent = u.points;
  $("myPosts").textContent  = u.posts;
  $("myLevel").textContent  = u.level;
}

function renderLeaderboard(){
  const box = $("leaderboard");
  box.i