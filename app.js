// Main application logic for SouthSide Cards - guest-only, local-save implementation
// This file implements: save system, currency, pack opening, collection, sell duplicates UI and logic

(function(){
  // Utilities
  function $(sel){return document.querySelector(sel)}
  function el(t,cls,txt){const e=document.createElement(t);if(cls)e.className=cls;if(txt)e.textContent=txt;return e}

  // Load data
  const DATA = GAME_DATA; // from data.js

  // Validate packs at load
  if(DATA.validationErrors && DATA.validationErrors.length){
    console.warn('Pack validation errors:', DATA.validationErrors);
  }

  // Save system (versioned)
  const SAVE_KEY = 'ssc_save_v1';
  function defaultSave(){
    return {
      version:1,
      balance:0,
      lifetimeGained:0,
      lifetimeSpent:0,
      cardCopies:{}, // id -> count
      ownedUniqueIds:[],
      packsOpened:0,
      bestCardPulled:null,
      claimedRewards:{},
      bonuses:{},
      playtimeSeconds:0,
      settings:{sound:true,reducedMotion:false},
      introPlayed:false,
      transactions:[] // recent tx ids to prevent duplicates
    }
  }

  function loadSave(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if(!raw) return defaultSave();
      const s = JSON.parse(raw);
      // basic validation
      if(typeof s.balance !== 'number') throw new Error('invalid save');
      s.cardCopies = s.cardCopies || {};
      s.ownedUniqueIds = s.ownedUniqueIds || [];
      s.claimedRewards = s.claimedRewards || {};
      s.bonuses = s.bonuses || {};
      s.transactions = s.transactions || [];
      return s;
    }catch(e){
      console.error('Failed to load save, using default',e);
      return defaultSave();
    }
  }

  function saveState(){
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  let state = loadSave();

  // Currency system
  function canAfford(amount){return state.balance >= amount}
  function applyTransaction(delta,reason){
    // delta can be positive (gain) or negative (spend)
    if(delta<0 && state.balance + delta < 0) return false;
    state.balance += delta;
    if(delta>0) state.lifetimeGained += delta;
    if(delta<0) state.lifetimeSpent += Math.abs(delta);
    saveState();
    renderBalance();
    return true;
  }

  // Rarity selection using weights and optional luck bonus
  function chooseRarity(pack){
    const weights = Object.assign({},pack.rarityWeights);
    // apply luck bonus from state.bonuses.luckPercent if present
    const luckPercent = Object.values(state.bonuses || {}).reduce((acc,b)=> acc + (b.type==='luck' ? 20 : 0),0);
    if(luckPercent>0){
      // Simple system: add weight proportional to luck to higher rarities (scale by rarity rank)
      DATA.rarities.forEach(r=>{
        if(weights[r.key]){
          weights[r.key] = weights[r.key] * (1 + (luckPercent/100) * (r.rank/10));
        }
      });
    }
    // Normalize to sum 100
    const entries = Object.entries(weights).filter(([k,v])=>v>0);
    const total = entries.reduce((s,[_k,v])=>s+v,0);
    let rnd = Math.random() * total;
    for(const [k,v] of entries){
      if(rnd < v) return k;
      rnd -= v;
    }
    return entries[entries.length-1][0];
  }

  // Find a random card of a rarity
  function chooseCardByRarity(rarity){
    const candidates = DATA.library.filter(c=>c.rarity===rarity);
    if(candidates.length===0) return null;
    return candidates[Math.floor(Math.random()*candidates.length)];
  }

  // Pack opening process
  let openingLock = false; // prevent duplicate opens
  function openPack(pack){
    if(openingLock) return;
    openingLock = true;
    try{
      // validate pack
      if(!pack || !pack.key) return showNotification('Invalid pack');
      if(!canAfford(pack.price)) return showNotification('Cannot afford this pack');
      // deduct price (Free pack price 0 will pass)
      const txId = 'open_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
      if(pack.price>0){
        if(!applyTransaction(-pack.price,`Buy ${pack.key}`)){
          openingLock=false;return showNotification('Purchase failed');
        }
      }
      // select rarity and card
      const rarity = chooseRarity(pack);
      const card = chooseCardByRarity(rarity);
      if(!card){
        showNotification('No card available for selected rarity. Transaction refunded.');
        // refund
        if(pack.price>0) applyTransaction(pack.price, 'Refund');
        openingLock=false;return;
      }
      // show reveal animation (simple) then claim
      showReveal(card,()=>{
        // claim action
        claimCard(card,txId);
        state.packsOpened = (state.packsOpened||0)+1;
        saveState();
        openingLock=false;
      });
    }catch(e){
      console.error(e);openingLock=false;showNotification('Error opening pack');
    }
  }

  function claimCard(card,txId){
    if(state.transactions.includes(txId)) return; // already claimed
    state.transactions.push(txId);
    // ensure inventory
    const prev = state.cardCopies[card.id]||0;
    state.cardCopies[card.id] = prev+1;
    if(prev===0) state.ownedUniqueIds.push(card.id);
    // update best card by rarity rank
    const rarityRank = DATA.rarities.find(r=>r.key===card.rarity).rank;
    if(!state.bestCardPulled || rarityRank > (DATA.rarities.find(r=>r.key===state.bestCardPulled.rarity).rank)){
      state.bestCardPulled = { id: card.id, name:card.name, rarity:card.rarity };
    }
    saveState();
    renderCollectionGrid();
    renderBalance();
    showNotification('Card claimed: '+card.name);
  }

  // Simple reveal UI
  function showReveal(card,cb){
    const prev = $('#pack-view');
    prev.innerHTML='';
    const slot = el('div','card-slot');
    const art = el('div','card-art');
    art.textContent = card.name + ' ['+card.rarity+']';
    slot.appendChild(art);
    const info = el('div','',card.description || '');
    slot.appendChild(info);
    prev.appendChild(slot);
    setTimeout(cb, 800); // brief animation
  }

  // Collection rendering
  function renderCollectionGrid(){
    const grid = $('#collection-grid');
    grid.innerHTML='';
    // Organize by specified rarity order
    DATA.rarities.forEach(r=>{
      // header for rarity
      const header = el('div','',r.label);
      header.style.gridColumn='1/-1';
      header.style.fontWeight='700';
      header.style.marginTop='8px';
      grid.appendChild(header);
      const cards = DATA.library.filter(c=>c.rarity===r.key);
      cards.forEach(card=>{
        const slot = el('div','card-slot');
        const art = el('div','card-art');
        art.textContent = card.name;
        slot.appendChild(art);
        const name = el('div','',card.name);
        slot.appendChild(name);
        const rarity = el('div','',r.label);
        slot.appendChild(rarity);
        const qty = state.cardCopies[card.id]||0;
        const badge = el('div','qty-badge', '×'+qty);
        slot.appendChild(badge);
        grid.appendChild(slot);
      });
    });
  }

  function calculateSellable(){
    // returns {items:[{card,qty,sellValue}],total}
    let total = 0;const items=[];
    DATA.library.forEach(card=>{
      const owned = state.cardCopies[card.id]||0;
      const sellable = Math.max(0, owned - 1);
      if(sellable>0){
        const base = card.baseQuickSell||0;
        items.push({card,qty:sellable,baseValue:base,subtotal: sellable*base});
        total += sellable*base;
      }
    });
    // apply earnings bonuses (+20% per selected earnings)
    const earningsMultiplier = 1 + Object.values(state.bonuses || {}).filter(b=>b.type==='earnings').length * 0.2;
    const finalTotal = Math.round(total * earningsMultiplier);
    return {items,total,finalTotal,earningsMultiplier};
  }

  // Sell duplicates flow
  let sellingLock=false;
  function openSellDialog(){
    const d = $('#sell-dialog');
    const summary = $('#sell-summary');
    const calc = calculateSellable();
    if(calc.items.length===0){
      showNotification('No duplicate cards to sell.');return;
    }
    summary.innerHTML='';
    const list = el('div','');
    calc.items.forEach(it=>{
      const row = el('div','', `${it.card.name} ×${it.qty} → ${it.subtotal} rupees`);
      list.appendChild(row);
    });
    const tot = el('div','', `Subtotal: ${calc.total} rupees`);
    const mult = el('div','', `Earnings multiplier: ${Math.round((calc.earningsMultiplier-1)*100)}% → Final: ${calc.finalTotal} rupees`);
    summary.appendChild(list);summary.appendChild(tot);summary.appendChild(mult);
    d.classList.remove('hidden');
  }

  function confirmSell(){
    if(sellingLock) return;sellingLock=true;
    const calc = calculateSellable();
    if(calc.items.length===0){sellingLock=false;showNotification('No duplicates to sell');return}
    // perform atomic sale: re-calc, then apply
    // remove sellable copies
    calc.items.forEach(it=>{
      state.cardCopies[it.card.id] = (state.cardCopies[it.card.id]||0) - it.qty;
      if(state.cardCopies[it.card.id] < 1){
        // keep zero to be safe and remove from ownedUniqueIds
        delete state.cardCopies[it.card.id];
        const idx = state.ownedUniqueIds.indexOf(it.card.id);
        if(idx!==-1) state.ownedUniqueIds.splice(idx,1);
      }
    });
    // apply rupees
    const gain = calc.finalTotal;
    applyTransaction(gain,'Sell Duplicates');
    saveState();
    renderCollectionGrid();
    renderBalance();
    $('#sell-dialog').classList.add('hidden');
    sellingLock=false;
    showNotification(`Sold duplicates for ${gain} rupees`);
  }

  function cancelSell(){
    $('#sell-dialog').classList.add('hidden');
  }

  // UI renderers
  function renderBalance(){
    const b = $('#rupee-balance');
    const sb = $('#shop-balance');
    if(b) b.textContent = state.balance + ' rupees';
    if(sb) sb.textContent = state.balance + ' rupees';
  }

  function renderPackView(index){
    const view = $('#pack-view');
    view.innerHTML='';
    const pack = DATA.packs[index];
    if(!pack) return;
    const box = el('div','', '');
    const title = el('div','', `${pack.label} — ${pack.price} rupees`);
    const desc = el('div','', pack.description || '');
    box.appendChild(title);box.appendChild(desc);
    view.appendChild(box);
    // odds panel
    const odds = $('#odds-panel');
    odds.innerHTML='';
    const list = el('div','');
    Object.entries(pack.rarityWeights).forEach(([k,v])=>{
      const r = DATA.rarities.find(rr=>rr.key===k);
      const row = el('div','', `${r.label}: ${v}%`);
      list.appendChild(row);
    });
    odds.appendChild(list);
  }

  // Simple notification
  let notifTimeout=null;
  function showNotification(msg){
    const n = $('#notification');
    n.textContent = msg; n.classList.remove('hidden');
    clearTimeout(notifTimeout);notifTimeout=setTimeout(()=>n.classList.add('hidden'),3000);
  }

  // Event wiring and navigation
  let currentPackIndex = 0;
  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
  }

  function init(){
    // Title
    $('#play-button').addEventListener('click',()=>{
      // play cinematic unless already played or reduced-motion
      if(!state.introPlayed && !state.settings.reducedMotion){
        playCinematic(()=>{ state.introPlayed=true; saveState(); showScreen('main-menu'); });
      }else{
        showScreen('main-menu');
      }
    });
    $('#account-button').addEventListener('click',()=>showNotification('Account features require backend configuration.'));

    // Main menu nav
    $('#shop-button').addEventListener('click',()=>{ showScreen('shop-screen'); renderPackView(currentPackIndex); renderBalance(); });
    $('#collection-button').addEventListener('click',()=>{ showScreen('collection-screen'); renderCollectionGrid(); renderBalance(); });
    $('#leaderboard-button').addEventListener('click',()=>showNotification('Leaderboards require backend configuration. Sample data displayed.'));
    $('#standings-button').addEventListener('click',()=>showNotification('Standings will show local stats.'));
    $('#settings-button').addEventListener('click',()=>showNotification('Settings panel not yet implemented.'));

    // Shop controls
    $('#left-arrow').addEventListener('click',()=>{ currentPackIndex = (currentPackIndex-1+DATA.packs.length)%DATA.packs.length; renderPackView(currentPackIndex); });
    $('#right-arrow').addEventListener('click',()=>{ currentPackIndex = (currentPackIndex+1)%DATA.packs.length; renderPackView(currentPackIndex); });
    $('#open-pack').addEventListener('click',()=>{ const pack = DATA.packs[currentPackIndex]; openPack(pack); });
    $('#shop-back').addEventListener('click',()=>showScreen('main-menu'));

    // Collection controls
    $('#sell-duplicates').addEventListener('click',openSellDialog);
    $('#collection-back').addEventListener('click',()=>showScreen('main-menu'));
    $('#confirm-sell').addEventListener('click',confirmSell);
    $('#cancel-sell').addEventListener('click',cancelSell);

    // cinematic skip
    $('#skip-cinematic').addEventListener('click',()=>{ stopCinematic(); state.introPlayed=true; saveState(); showScreen('title-screen'); });

    renderBalance();
    renderPackView(currentPackIndex);
    renderCollectionGrid();
    showScreen('title-screen');
  }

  // Simple cinematic (canvas coin + cards) - respects reduced motion
  let cinematicRunning=false;
  function playCinematic(cb){
    if(state.settings.reducedMotion){ cb(); return; }
    const screen = $('#cinematic');
    screen.classList.remove('hidden');
    showScreen('cinematic');
    cinematicRunning=true;
    const canvas = $('#cinematic-canvas');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    let t=0;const cards=[];
    function initCards(){
      for(let i=0;i<12;i++) cards.push({angle:Math.random()*Math.PI*2,dist: Math.random()*200+50});
    }
    initCards();
    function loop(){
      if(!cinematicRunning){ screen.classList.add('hidden'); cb(); return; }
      t+=0.02; ctx.clearRect(0,0,canvas.width,canvas.height);
      // draw coin falling
      const cx = canvas.width/2, cy = canvas.height/2;
      const coinY = Math.min(canvas.height, 100 + (t*300));
      ctx.fillStyle = '#c69b18'; ctx.beginPath(); ctx.arc(cx, coinY, 30,0,Math.PI*2); ctx.fill();
      // after impact, scatter cards
      if(t>0.8){
        cards.forEach((c,i)=>{
          const a = c.angle + t* (0.5 + i*0.02);
          const x = cx + Math.cos(a)*(c.dist + t*30);
          const y = cy + Math.sin(a)*(c.dist + t*20);
          ctx.fillStyle = '#222'; ctx.fillRect(x-30,y-20,60,40);
        });
      }
      if(t>2.4){ cinematicRunning=false; }
      requestAnimationFrame(loop);
    }
    loop();
  }
  function stopCinematic(){ cinematicRunning=false; }

  // Initialize app on DOM ready
  document.addEventListener('DOMContentLoaded',init);
})();
