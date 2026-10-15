// Simple demo app: uses GAME_DATA from data.js
const STORAGE_KEY = "card_demo_state_v1";

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw) return JSON.parse(raw);
  // default state
  return {
    coins: 5000,
    collection: {},
    opened: 0
  };
}
function saveState(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

let state = loadState();

// DOM refs
const coinsEl = document.getElementById('coins');
const packsEl = document.getElementById('packs');
const collectionGrid = document.getElementById('collectionGrid');
const addCoinsBtn = document.getElementById('addCoins');
const resetBtn = document.getElementById('reset');
const packOpenSection = document.getElementById('packOpen');
const openingPackName = document.getElementById('openingPackName');
const cardsReveal = document.getElementById('cardsReveal');
const closeRevealBtn = document.getElementById('closeReveal');

function render(){
  coinsEl.textContent = state.coins;
  renderPacks();
  renderCollection();
}

function preloadImages(urls){
  return Promise.all(urls.map(u => new Promise(res => {
    const img = new Image(); img.src = u; img.onload = res; img.onerror = res;
  })));
}

function renderPacks(){
  packsEl.innerHTML = '';
  GAME_DATA.packs.forEach(p=>{
    const div = document.createElement('div'); div.className='pack';
    const thumb = document.createElement('div'); thumb.className='pack-thumb';
    if(p.imagePath) thumb.style.backgroundImage = `url(${p.imagePath})`;
    const meta = document.createElement('div'); meta.className='meta';
    const h = document.createElement('div'); h.textContent = p.label;
    const sub = document.createElement('div'); sub.textContent = `${p.cardsPerPack} cards · ${p.price} coins`;
    meta.appendChild(h); meta.appendChild(sub);
    const btn = document.createElement('button'); btn.textContent='Buy & Open';
    btn.onclick = ()=>{ buyAndOpenPack(p.key); };
    div.appendChild(thumb); div.appendChild(meta); div.appendChild(btn);
    packsEl.appendChild(div);
  });
}

function renderCollection(){
  collectionGrid.innerHTML = '';
  GAME_DATA.library.forEach(card=>{
    const cnt = state.collection[card.id] || 0;
    const c = document.createElement('div'); c.className='card';
    const art = document.createElement('div'); art.className='art'; art.style.background=rarityHex(card.rarity);
    art.textContent = card.name.split(' ')[0];
    const title = document.createElement('div'); title.textContent = card.name;
    const meta = document.createElement('div'); meta.textContent = `${card.rarity} · owned: ${cnt}`;
    c.appendChild(art); c.appendChild(title); c.appendChild(meta);
    collectionGrid.appendChild(c);
  });
}

function rarityHex(r){
  const rinfo = GAME_DATA.rarities.find(x=>x.key===r);
  return rinfo ? rinfo.hex : '#777';
}

function buyAndOpenPack(packKey){
  const pack = GAME_DATA.packs.find(p=>p.key===packKey);
  if(!pack) return;
  if(state.coins < pack.price){ alert('Not enough coins'); return; }
  state.coins -= pack.price; state.opened += 1; saveState(state); render();
  openPack(pack);
}

function openPack(pack){
  openingPackName.textContent = pack.label;
  cardsReveal.innerHTML = '';
  packOpenSection.classList.remove('hidden');
  // reveal one-by-one
  const results = [];
  for(let i=0;i<pack.cardsPerPack;i++){
    const rarity = drawRarity(pack.rarityWeights);
    const card = drawCardOfRarity(rarity);
    results.push(card);
  }
  // animate reveals
  let i=0;
  function revealNext(){
    if(i>=results.length) return;
    const card = results[i];
    const node = renderRevealedCard(card);
    cardsReveal.appendChild(node);
    // update collection
    state.collection[card.id] = (state.collection[card.id]||0)+1;
    saveState(state);
    render();
    i++;
    setTimeout(revealNext, 700);
  }
  revealNext();
}

function renderRevealedCard(card){
  const box = document.createElement('div'); box.className='revealed';
  const art = document.createElement('div'); art.className='art'; art.style.background=rarityHex(card.rarity);
  art.textContent = card.name.split(' ')[0];
  const title = document.createElement('div'); title.textContent = card.name;
  const meta = document.createElement('div'); meta.textContent = card.rarity;
  box.appendChild(art); box.appendChild(title); box.appendChild(meta);
  return box;
}

function drawRarity(weights){
  const entries = Object.entries(weights).filter(([k,v])=>v>0);
  const total = entries.reduce((s,[k,v])=>s+v,0);
  let r = cryptoRandom()*total;
  for(const [k,v] of entries){
    if(r < v) return k;
    r -= v;
  }
  return entries[entries.length-1][0];
}

function drawCardOfRarity(rarity){
  const pool = GAME_DATA.library.filter(c=>c.rarity===rarity);
  if(pool.length===0) return GAME_DATA.library[Math.floor(cryptoRandom()*GAME_DATA.library.length)];
  return pool[Math.floor(cryptoRandom()*pool.length)];
}

function cryptoRandom(){ // 0..1
  try{
    const a = new Uint32Array(1);
    window.crypto.getRandomValues(a);
    return a[0]/(0xFFFFFFFF+1);
  }catch(e){ return Math.random(); }
}

addCoinsBtn.onclick = ()=>{ state.coins += 1000; saveState(state); render(); };
resetBtn.onclick = ()=>{ if(confirm('Reset demo state?')){ localStorage.removeItem(STORAGE_KEY); state = loadState(); render(); packOpenSection.classList.add('hidden'); } };
closeRevealBtn.onclick = ()=>{ packOpenSection.classList.add('hidden'); }

// start by preloading pack images then render
preloadImages(GAME_DATA.packs.map(p=>p.imagePath)).then(render);

// subtle parallax script (respects prefers-reduced-motion)
(function(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // create background element if not present
  let siteBg = document.querySelector('.site-bg');
  if(!siteBg){
    siteBg = document.createElement('div'); siteBg.className='site-bg'; siteBg.setAttribute('aria-hidden','true');
    const img = document.createElement('img'); img.src = 'assets/backgrounds/southside_bg.png'; img.alt='';
    siteBg.appendChild(img);
    document.body.insertBefore(siteBg, document.body.firstChild);
  }
  const bgImg = siteBg.querySelector('img');
  if(!bgImg) return;
  let mouseX=0, mouseY=0, tx=0, ty=0;
  const maxTranslate = 18;
  function onMove(e){
    const w = window.innerWidth, h = window.innerHeight;
    mouseX = (e.clientX / w - 0.5) * 2;
    mouseY = (e.clientY / h - 0.5) * 2;
  }
  function onScroll(){
    const s = window.scrollY || window.pageYOffset;
    ty = (s / (document.body.scrollHeight || 1)) * 8;
  }
  window.addEventListener('mousemove', onMove, { passive:true });
  window.addEventListener('scroll', onScroll, { passive:true });
  function tick(){
    const targetX = mouseX * maxTranslate;
    const targetY = mouseY * maxTranslate * 0.6 + ty;
    tx += (targetX - tx) * 0.08;
    ty += (targetY - ty) * 0.08;
    bgImg.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(1.02)`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

render();
