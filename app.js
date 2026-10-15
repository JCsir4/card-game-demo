// Simple demo app: uses GAME_DATA from data.js
const STORAGE_KEY = "card_demo_state_v1";
const LB_KEY = "card_demo_leaderboard_v1";

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw) return JSON.parse(raw);
  return { coins: 5000, collection: {}, opened: 0 };
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
const leaderboardContainer = document.getElementById('leaderboardContainer');

function render(){
  if(coinsEl) coinsEl.textContent = state.coins;
  renderCollection();
  renderLeaderboard();
}

function preloadImages(urls){
  return Promise.all((urls || []).filter(Boolean).map(u => new Promise(res => {
    const img = new Image();
    img.onload = res; img.onerror = res; img.src = u;
  })));
}

function renderPacks(){
  if(!packsEl) return;
  packsEl.innerHTML = '';

  GAME_DATA.packs.forEach((p, idx)=>{
    const div = document.createElement('div'); div.className='pack'; div.dataset.index = idx;
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

  requestAnimationFrame(highlightNearestPack);

  let scTimer = null;
  packsEl.addEventListener('scroll', ()=>{
    if(scTimer) clearTimeout(scTimer);
    highlightNearestPack();
    scTimer = setTimeout(()=>{ snapToNearestPack(); }, 110);
  }, { passive:true });

  packsEl.addEventListener('click', (e)=>{
    const p = e.target.closest('.pack');
    if(!p) return;
    centerPack(parseInt(p.dataset.index,10));
  });

  packsEl.scrollLeft = 0;
}

function highlightNearestPack(){
  if(!packsEl) return;
  const children = [...packsEl.children];
  if(children.length === 0) return;
  const targetX = packsEl.getBoundingClientRect().left + 24;
  let best = null, bestDist = Infinity;

  children.forEach(c=>{
    const r = c.getBoundingClientRect();
    const d = Math.abs(r.left - targetX);
    if(d < bestDist){ bestDist = d; best = c; }
  });

  children.forEach(c=>c.classList.remove('focused'));
  if(best) best.classList.add('focused');
}

function centerPack(index){
  const children = [...(packsEl ? packsEl.children : [])];
  const el = children[index];
  if(!el || !packsEl) return;
  const containerRect = packsEl.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const targetScroll = packsEl.scrollLeft + (elRect.left - containerRect.left) - 24;
  packsEl.scrollTo({ left: targetScroll, behavior: 'smooth' });
}

function snapToNearestPack(){
  if(!packsEl) return;
  const children = [...packsEl.children];
  if(children.length === 0) return;
  const containerRect = packsEl.getBoundingClientRect();
  const targetX = containerRect.left + 24;
  let best = null, bestDist = Infinity;

  children.forEach(c=>{
    const r = c.getBoundingClientRect();
    const d = Math.abs(r.left - targetX);
    if(d < bestDist){ bestDist = d; best = c; }
  });

  if(best){
    const elRect = best.getBoundingClientRect();
    const target = packsEl.scrollLeft + (elRect.left - containerRect.left) - 24;
    packsEl.scrollTo({ left: target, behavior: 'smooth' });
  }
}

function buyAndOpenPack(packKey){
  const pack = GAME_DATA.packs.find(p=>p.key===packKey);
  if(!pack) return;
  if(state.coins < pack.price){ alert('Not enough coins'); return; }
  state.coins -= pack.price; state.opened += 1; saveState(state);
  if(coinsEl) coinsEl.textContent = state.coins;
  renderLeaderboard();
  openPack(pack);
}

function openPack(pack){
  if(!openingPackName || !cardsReveal || !packOpenSection) return;
  openingPackName.textContent = pack.label;
  cardsReveal.innerHTML = '';
  packOpenSection.classList.remove('hidden');

  const results = [];
  for(let i=0;i<pack.cardsPerPack;i++){
    const rarity = drawRarity(pack.rarityWeights);
    const card = drawCardOfRarity(rarity);
    results.push(card);
  }

  let i=0;
  function revealNext(){
    if(i>=results.length) return;
    const card = results[i];
    const node = renderRevealedCard(card);
    cardsReveal.appendChild(node);
    state.collection[card.id] = (state.collection[card.id]||0)+1;
    saveState(state);
    renderCollection();
    renderLeaderboard();
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

function renderCollection(){
  if(!collectionGrid) return;
  collectionGrid.innerHTML = '';
  const rarityOrder = GAME_DATA.rarities.slice().sort((a,b)=>a.rank - b.rank).map(r=>r.key);

  rarityOrder.forEach(rk=>{
    const rinfo = GAME_DATA.rarities.find(r=>r.key===rk);
    const row = document.createElement('div'); row.className='rarity-row';
    const heading = document.createElement('h3'); heading.textContent = rinfo.label;
    row.appendChild(heading);

    const rowGrid = document.createElement('div'); rowGrid.className='rarity-grid';
    const cardsOfR = GAME_DATA.library.filter(c=>c.rarity===rk);

    cardsOfR.forEach(card=>{
      const cnt = state.collection[card.id] || 0;
      const c = document.createElement('div'); c.className='collection-card';
      const art = document.createElement('div'); art.className='art';
      art.style.background = rarityHex(card.rarity);
      art.style.height = '96px';
      art.style.borderRadius = '8px';
      art.style.display = 'flex';
      art.style.alignItems = 'center';
      art.style.justifyContent = 'center';
      art.textContent = card.name.split(' ')[0];
      const title = document.createElement('div'); title.textContent = card.name;
      const meta = document.createElement('div'); meta.textContent = `Owned: ${cnt}`;
      c.appendChild(art); c.appendChild(title); c.appendChild(meta);
      rowGrid.appendChild(c);
    });

    row.appendChild(rowGrid);
    collectionGrid.appendChild(row);
  });

  animateCollectionReveal();
}

function animateCollectionReveal(){
  const cards = [...document.querySelectorAll('.collection-card')];
  if(cards.length === 0) return;

  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    cards.forEach(el=>el.classList.add('reveal'));
    return;
  }

  cards.forEach((el, i)=>{
    el.classList.remove('reveal');
    el.style.transitionDelay = (i * 60) + 'ms';
    setTimeout(()=>el.classList.add('reveal'), 20 + i * 60);
  });
}

function rarityHex(r){
  const rinfo = GAME_DATA.rarities.find(x=>x.key===r);
  return rinfo ? rinfo.hex : '#777';
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

function cryptoRandom(){
  try{
    const a = new Uint32Array(1);
    window.crypto.getRandomValues(a);
    return a[0]/(0xFFFFFFFF+1);
  }catch(e){ return Math.random(); }
}

function seedPlayers(){
  const seed = [
    { id:'alice', name:'Alice', coins: 2200, cards: 24, packsOpened: 12 },
    { id:'bob', name:'Bob', coins: 1700, cards: 18, packsOpened: 9 },
    { id:'carla', name:'Carla', coins: 5400, cards: 38, packsOpened: 30 },
    { id:'dan', name:'Dan', coins: 800, cards: 8, packsOpened: 3 },
    { id:'you', name:'You', coins: state.coins, cards: totalCards(), packsOpened: state.opened }
  ];
  localStorage.setItem(LB_KEY, JSON.stringify(seed));
  return seed;
}

function loadPlayers(){
  const raw = localStorage.getItem(LB_KEY);
  if(!raw) return seedPlayers();
  try{return JSON.parse(raw);}catch(e){ return seedPlayers(); }
}

function savePlayers(players){ localStorage.setItem(LB_KEY, JSON.stringify(players)); }
function totalCards(){ return Object.values(state.collection || {}).reduce((s,v)=>s+v,0); }

function renderLeaderboard(){
  if(!leaderboardContainer) return;
  leaderboardContainer.innerHTML = '';
  const players = loadPlayers();

  const me = players.find(p=>p.id==='you');
  if(me){
    me.coins = state.coins;
    me.cards = totalCards();
    me.packsOpened = state.opened;
  } else {
    players.push({ id:'you', name:'You', coins:state.coins, cards:totalCards(), packsOpened:state.opened });
  }

  const byCoins = players.slice().sort((a,b)=>b.coins - a.coins).slice(0,8);
  const byCards = players.slice().sort((a,b)=>b.cards - a.cards).slice(0,8);
  const byPacks = players.slice().sort((a,b)=>b.packsOpened - a.packsOpened).slice(0,8);

  function buildColumn(title, list, key){
    const col = document.createElement('div'); col.className='leaderboard-column';
    const h = document.createElement('h4'); h.textContent = title; col.appendChild(h);
    list.forEach((p,i)=>{
      const row = document.createElement('div'); row.className='leader-row';
      row.innerHTML = `<div>${i+1}. ${p.name}</div><div>${p[key]}</div>`;
      if(p.id==='you') row.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.03), rgba(0,0,0,0.03))';
      col.appendChild(row);
    });
    return col;
  }

  leaderboardContainer.appendChild(buildColumn('Most coins', byCoins, 'coins'));
  leaderboardContainer.appendChild(buildColumn('Most cards', byCards, 'cards'));
  leaderboardContainer.appendChild(buildColumn('Most packs opened', byPacks, 'packsOpened'));

  savePlayers(players);
}

function tickLeaderboardSimulation(){
  const players = loadPlayers();
  players.forEach(p=>{
    if(p.id === 'you') return;
    if(Math.random() < 0.2) p.coins = Math.max(0, p.coins + Math.round((Math.random()-0.5)*200));
    if(Math.random() < 0.12) p.cards = Math.max(0, p.cards + Math.round(Math.random()*2));
    if(Math.random() < 0.08) p.packsOpened = Math.max(0, p.packsOpened + Math.round(Math.random()*1));
  });
  savePlayers(players);
  renderLeaderboard();
}

addCoinsBtn.onclick = ()=>{ state.coins += 1000; saveState(state); if(coinsEl) coinsEl.textContent = state.coins; renderLeaderboard(); };
resetBtn.onclick = ()=>{ if(confirm('Reset demo state?')){ localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LB_KEY); state = loadState(); render(); if(packOpenSection) packOpenSection.classList.add('hidden'); } };
if(closeRevealBtn){ closeRevealBtn.onclick = ()=>{ if(packOpenSection) packOpenSection.classList.add('hidden'); }; }

// Tab wiring
const tabs = document.querySelectorAll('.tab');
if(tabs.length){
  tabs.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      tabs.forEach(t=>t.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tabpanel').forEach(p=>p.classList.add('hidden'));
      const panel = document.getElementById(tab);
      if(panel) panel.classList.remove('hidden');
      if(tab === 'collection') renderCollection();
      if(tab === 'shop') renderPacks();
      if(tab === 'leaderboard') renderLeaderboard();
    });
  });
}

preloadImages(GAME_DATA.packs.map(p=>p.imagePath)).then(()=>{
  renderPacks();
  render();
  setInterval(()=>{ tickLeaderboardSimulation(); }, 6000);
});

render();
