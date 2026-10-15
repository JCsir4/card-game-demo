// intro-webgl.js
// Advanced intro animation using Canvas (WebGL fallback can be added later).
// Sequence: coin spin -> card flip -> particle burst -> fade out overlay

(function(){
  const overlay = document.getElementById('introOverlay');
  const canvas = document.getElementById('introCanvas');
  const skipBtn = document.getElementById('skipIntro');
  const ctx = canvas.getContext('2d');
  let raf = null;
  let startTime = null;
  let width = 800, height = 600, dpr = Math.max(1, window.devicePixelRatio || 1);

  // particles
  let particles = [];
  const MAX_PARTICLES = 600;

  // state
  const STATE = { phase: 'idle' };

  function resize(){
    width = canvas.clientWidth; height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function clear(){ ctx.clearRect(0,0,width,height); }

  // utility: linear interpolation
  function lerp(a,b,t){ return a + (b-a)*t; }

  // coin draw (simple 2D stylized coin)
  function drawCoin(x,y,r,rot,shinePhase){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rot);

    // rim
    const grad = ctx.createLinearGradient(-r,-r,r,r);
    grad.addColorStop(0,'#ffd966');
    grad.addColorStop(0.5,'#ffb700');
    grad.addColorStop(1,'#b07b00');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();

    // center disc
    const g2 = ctx.createRadialGradient(-r*0.3,-r*0.3,1,0,0,r);
    g2.addColorStop(0,'#fff9df'); g2.addColorStop(0.4,'#ffe08a'); g2.addColorStop(1,'rgba(255,200,0,0.6)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(0,0,r*0.85,0,Math.PI*2); ctx.fill();

    // letters
    ctx.fillStyle = '#1b1720';
    ctx.font = `${r*0.6}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline='middle';
    ctx.fillText('SS',0,0);

    // shine sweep
    ctx.globalCompositeOperation = 'lighter';
    const shp = Math.sin(shinePhase*Math.PI*2)*0.5+0.5;
    const sgrad = ctx.createLinearGradient(-r*2,-r*2,r*2,r*2);
    sgrad.addColorStop(0,`rgba(255,255,255,0)`);
    sgrad.addColorStop(0.48,`rgba(255,255,255,${0.0+0.6*shp})`);
    sgrad.addColorStop(0.52,`rgba(255,255,255,${0.0+0.4*shp})`);
    sgrad.addColorStop(1,`rgba(255,255,255,0)`);
    ctx.fillStyle = sgrad;
    ctx.beginPath(); ctx.ellipse(0, -r*0.2, r*1.6, r*0.6, 0, 0, Math.PI*2); ctx.fill();

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  // card draw (front/back with simple flip progress)
  function drawCard(cx,cy,w,h,progress,frontColor,backColor,label){
    ctx.save();
    ctx.translate(cx,cy);
    // simulate 3D flip by scaling X
    const angle = progress * Math.PI; // 0->pi
    const scaleX = Math.cos(angle);
    ctx.scale(scaleX < 0.01 ? 0.01 : scaleX, 1);

    // card rectangle
    const radius = 12;
    // choose which side shows
    const showingFront = progress < 0.5;
    ctx.fillStyle = showingFront ? frontColor : backColor;
    roundRect(ctx, -w/2, -h/2, w, h, radius);
    ctx.fill();

    // art / text
    ctx.fillStyle = showingFront ? '#fff' : '#071023';
    ctx.font = 'bold 20px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(label, 0, 0);

    ctx.restore();
  }

  function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

  // particle system (Canvas2D implementation)
  class Particle{
    constructor(x,y,vx,vy,size,color,life){
      this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.size=size;this.color=color;this.life=life;this.age=0;this.rot=Math.random()*Math.PI*2;this.vr=(Math.random()-0.5)*4;
    }
    update(dt){ this.age += dt; this.x += this.vx*dt; this.y += this.vy*dt; this.vy += 200*dt; this.rot += this.vr*dt; }
    draw(ctx, alpha){ const t = Math.max(0,1 - this.age/this.life); ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha = alpha * t; ctx.fillStyle = this.color; ctx.beginPath(); ctx.ellipse(this.x, this.y, this.size*t, this.size*t, 0, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
    alive(){ return this.age < this.life; }
  }

  function emitBurst(cx,cy,amount,rarity){
    const baseColor = rarityColor(rarity);
    for(let i=0;i<amount;i++){
      const angle = Math.random()*Math.PI*2;
      const speed = 80 + Math.random()*420;
      const vx = Math.cos(angle)*speed;
      const vy = Math.sin(angle)*speed - (80*Math.random());
      const size = 2 + Math.random()*6;
      const life = 0.9 + Math.random()*1.8;
      const color = baseColor;
      if(particles.length < MAX_PARTICLES) particles.push(new Particle(cx,cy,vx,vy,size,color,life));
    }
  }

  function rarityColor(rarity){
    const map = {
      basic:'#FFFFFF',common:'#9E9E9E',uncommon:'#4CAF50',rare:'#1565C0',epic:'#9C27B0',legendary:'#FFC107',mythic:'#D32F2F',exotic:'#00BCD4',godly:'#FFD700',ethereal:'#BFC9CA'
    };
    return map[rarity] || '#ffffff';
  }

  function step(timestamp){
    if(!startTime) startTime = timestamp;
    const t = (timestamp - startTime)/1000; // seconds
    clear();

    // phases: coin (0..1.6s), card flip (1.9..2.6s), particle burst (2.6..3.6s), hold (3.6..5s), fade
    if(t < 1.6){
      // coin spin
      const cx = width/2, cy = height*0.45; const r = Math.min(120, Math.min(width,height)*0.12);
      const spin = easeOutCubic(Math.min(1,t/1.6)) * (Math.PI*6);
      const shine = (t*2)%1;
      drawCoin(cx,cy,r,spin,shine);
      // title
      drawTitle('SouthSide Cards', width/2, height*0.7, Math.min(1, t/1.0));
    } else if(t < 2.6){
      // card flip phase
      const phaseT = (t - 1.6) / 1.0; // 0..1
      // small background dim
      ctx.fillStyle = 'rgba(2,6,10,0.2)'; ctx.fillRect(0,0,width,height);
      // card appears center
      const cx = width/2, cy = height*0.46; const cw = Math.min(300, width*0.28), ch = cw*1.5;
      const progress = easeOutBack(phaseT);
      drawCard(cx,cy,cw,ch, progress, '#13202b', '#fff', 'SouthSide');
      // subtle coin lingering left
      drawCoin(width*0.25, height*0.48, 42, Math.sin(t*8)*0.6, (t*3)%1);
    } else if(t < 3.6){
      // burst
      const phaseT = (t - 2.6) / 1.0;
      const cx = width/2, cy = height*0.46;
      if(STATE.phase !== 'burst'){ emitBurst(cx,cy,220,'epic'); STATE.phase='burst'; }
      // draw card static (face up)
      drawCard(cx,cy,Math.min(300, width*0.28), Math.min(300, width*0.42), 0.0, '#13202b', '#fff', 'SouthSide');
      // update & draw particles
      updateAndDrawParticles(1/60);
    } else if(t < 4.8){
      // hold with slow particles
      drawCard(width/2, height*0.46, Math.min(300, width*0.28), Math.min(300, width*0.42), 0.0, '#13202b', '#fff', 'SouthSide');
      updateAndDrawParticles(1/60);
    } else {
      // fade out overlay
      const phaseT = Math.min(1, (t - 4.8)/0.6);
      ctx.globalAlpha = 1 - easeOutCubic(phaseT);
      drawCard(width/2, height*0.46, Math.min(300, width*0.28), Math.min(300, width*0.42), 0.0, '#13202b', '#fff', 'SouthSide');
      updateAndDrawParticles(1/60);
      ctx.globalAlpha = 1.0;
      if(phaseT >= 1){ finish(); return; }
    }

    raf = window.requestAnimationFrame(step);
  }

  function drawTitle(text,x,y,alpha){ ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#ffffff'; ctx.font = '700 36px sans-serif'; ctx.textAlign='center'; ctx.fillText(text,x,y); ctx.restore(); }

  function updateAndDrawParticles(dt){
    for(let i=particles.length-1;i>=0;i--){ const p = particles[i]; p.update(dt); if(!p.alive()) particles.splice(i,1); }
    // draw glow background
    for(const p of particles){ p.draw(ctx, 0.9); }
  }

  function finish(){
    // hide overlay and cancel raf
    overlay.classList.add('hidden');
    if(raf) window.cancelAnimationFrame(raf);
  }

  function start(){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){ overlay.classList.add('hidden'); return; }
    resize(); startTime = null; particles = []; STATE.phase = 'start'; raf = window.requestAnimationFrame(step);
  }

  function stop(){ if(raf) window.cancelAnimationFrame(raf); overlay.classList.add('hidden'); }

  skipBtn.addEventListener('click', ()=> stop());
  window.addEventListener('resize', ()=> resize());

  // easing functions
  function easeOutCubic(t){ return 1 - Math.pow(1-t,3); }
  function easeOutBack(t){ const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); }

  // start after small delay so other assets/UI load
  document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(start, 220); });

})();
