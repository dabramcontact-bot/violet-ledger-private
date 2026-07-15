const root=document.documentElement;
const canvas=document.getElementById('cinematic');
const ctx=canvas.getContext('2d',{alpha:true});
const layer=document.createElement('canvas');
const layerCtx=layer.getContext('2d',{alpha:true});
const glow=document.createElement('canvas');
const glowCtx=glow.getContext('2d',{alpha:true});
const trail=document.createElement('canvas');
const trailCtx=trail.getContext('2d',{alpha:true});
const railButtons=[...document.querySelectorAll('.stage-rail button')];
const sceneLabel=document.getElementById('sceneLabel');
const afterInner=document.getElementById('afterInner');
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const economical=(navigator.hardwareConcurrency||4)<=4||(navigator.deviceMemory||4)<=4||innerWidth<760;
const TAU=Math.PI*2;
const POINTS=reduced?40:economical?56:80;
const CYCLE_SECONDS=24;
const state={w:1,h:1,dpr:1,mx:0,my:0,tx:0,ty:0,pvx:0,pvy:0,lastX:0,lastY:0,stage:-1,scene:-1,timeOffset:0,pausedAt:0};

const objects=[
 {c:[120,101,168],side:1,phase:.12,depth:.18,speed:.33,w:92,y0:.04,y1:.79,lane:-.38,disc:[-.08,.35,.22,.31],pill:[.17,.47,.085,.13]},
 {c:[53,88,162],side:1,phase:.86,depth:.42,speed:.43,w:112,y0:.18,y1:.65,lane:-.22,disc:[.20,.68,.19,.27],pill:[.30,.60,.070,.11]},
 {c:[168,88,61],side:-1,phase:1.51,depth:.82,speed:.38,w:132,y0:.01,y1:.83,lane:-.05,disc:[.48,.23,.24,.34],pill:[.43,.41,.080,.12]},
 {c:[23,111,82],side:-1,phase:2.17,depth:.66,speed:.49,w:110,y0:.24,y1:.56,lane:.10,disc:[.66,.64,.22,.31],pill:[.56,.59,.090,.13]},
 {c:[188,151,67],side:1,phase:2.83,depth:.31,speed:.31,w:96,y0:.44,y1:.92,lane:.24,disc:[.88,.34,.25,.36],pill:[.69,.43,.070,.105]},
 {c:[96,75,154],side:-1,phase:3.43,depth:.75,speed:.42,w:116,y0:.55,y1:.95,lane:.39,disc:[1.03,.72,.30,.42],pill:[.82,.63,.100,.145]},
 {c:[150,144,154],side:1,phase:4.09,depth:.12,speed:.28,w:78,y0:.74,y1:.12,lane:.52,disc:[.08,1.02,.21,.30],pill:[.39,.78,.064,.095]},
 {c:[67,74,95],side:-1,phase:4.67,depth:.08,speed:.25,w:72,y0:.85,y1:.20,lane:.64,disc:[.73,1.06,.24,.34],pill:[.65,.80,.068,.10]}
].sort((a,b)=>a.depth-b.depth);

const sceneCopy=[
 '01 · Запрос входит в движение',
 '02 · Условия собираются в PI',
 '03 · Маршрут набирает глубину',
 '04 · Поставка складывается в систему',
 '05 · Цикл перезапускается бесшовно'
];
const sceneStage=[0,1,2,3,3];

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smoother=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10)};
const mixPoint=(a,b,t)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});

function cubicPoint(g,t){const m=1-t,m2=m*m,t2=t*t;return{x:g.p0.x*m2*m+3*g.p1.x*m2*t+3*g.p2.x*m*t2+g.p3.x*t2*t,y:g.p0.y*m2*m+3*g.p1.y*m2*t+3*g.p2.y*m*t2+g.p3.y*t2*t}}
function cubicDerivative(g,t){const m=1-t;return{x:3*m*m*(g.p1.x-g.p0.x)+6*m*t*(g.p2.x-g.p1.x)+3*t*t*(g.p3.x-g.p2.x),y:3*m*m*(g.p1.y-g.p0.y)+6*m*t*(g.p2.y-g.p1.y)+3*t*t*(g.p3.y-g.p2.y)}}
function widthAt(g,t){return Math.max(1,lerp(g.w0,g.w1,t)+Math.sin(Math.PI*t)*(g.wm-(g.w0+g.w1)*.5))}

function ribbonPolygon(o,index,time,mode='flight'){
 const w=state.w,h=state.h;
 const wave=Math.sin(time*o.speed+o.phase),wave2=Math.cos(time*o.speed*.77+o.phase),wave3=Math.sin(time*o.speed*.51+o.phase);
 const enter=mode==='burst'?1:0;
 const sx=o.side>0?-w*(.34+enter*.48):w*(1.34+enter*.48);
 const ex=o.side>0?w*(1.34+enter*.48):-w*(.34+enter*.48);
 const lane=o.lane;
 const flightX=Math.sin(time*(.13+o.speed*.08)+o.phase)*w*(.055+o.depth*.045);
 const flightY=Math.cos(time*(.11+o.speed*.07)+o.phase)*h*(.05+o.depth*.035);
 const velocityPush=(state.pvx*(o.side>0?1:-1)+state.pvy)*18*o.depth;
 const cx=w*(.51+state.mx*.014*o.depth)+flightX;
 const cy=h*(.49+state.my*.012*o.depth)+flightY;
 const base=o.w*(h/850)*(1+wave*.045)*(mode==='burst'?.72:1);
 const tension=mode==='weave'?.93:.76;
 const g=mode==='weave'?{
  p0:{x:sx,y:h*(.14+(index%4)*.20+wave*.035)},
  p1:{x:w*(.27+lane*.08+state.mx*.012*o.depth),y:h*(.80-lane*.40+wave2*.065)},
  p2:{x:w*(.73-lane*.08+state.mx*.018*o.depth),y:h*(.18+lane*.46-wave3*.065)},
  p3:{x:ex,y:h*(.84-(index%4)*.17+wave2*.035)},
  w0:base*.82,wm:base*(1.26+o.depth*.42),w1:base*.84
 }:{
  p0:{x:sx,y:h*(o.y0+wave*.04)+enter*h*(index%2?-.22:.22)},
  p1:{x:lerp(sx,cx,tension),y:cy+h*((index%2?1:-1)*(.13+o.depth*.09)+wave2*.08)+velocityPush},
  p2:{x:lerp(ex,cx,tension),y:cy-h*((index%2?1:-1)*(.12+o.depth*.08)+wave3*.08)-velocityPush},
  p3:{x:ex,y:h*(o.y1-wave2*.04)+enter*h*(index%2?.24:-.24)},
  w0:base*1.05,wm:base*(.46+o.depth*.36),w1:base*.96
 };
 const half=POINTS/2,top=[],bottom=[];
 for(let i=0;i<half;i++){
  const t=i/(half-1),p=cubicPoint(g,t),d=cubicDerivative(g,t),len=Math.hypot(d.x,d.y)||1,nx=-d.y/len,ny=d.x/len,hw=widthAt(g,t)*.5;
  top.push({x:p.x+nx*hw,y:p.y+ny*hw});bottom.push({x:p.x-nx*hw,y:p.y-ny*hw});
 }
 return top.concat(bottom.reverse());
}

function superellipsePolygon(o,index,time,kind){
 const w=state.w,h=state.h;let cx,cy,rx,ry,n,rotation,blob=0;
 const orbit=time*(.11+o.speed*.09)+o.phase;
 const px=state.mx*w*.02*o.depth,py=state.my*h*.016*o.depth;
 if(kind==='disc'){
  cx=w*(o.disc[0]+Math.cos(orbit*.72)*(.025+o.depth*.025))+px;
  cy=h*(o.disc[1]+Math.sin(orbit*.66)*(.03+o.depth*.025))+py;
  const near=1+o.depth*.70;
  rx=w*o.disc[2]*near*(1+Math.sin(time*.31+o.phase)*.045);
  ry=h*o.disc[3]*near*(1+Math.cos(time*.27+o.phase)*.045);
  n=2.05;rotation=Math.sin(orbit*.44)*.34;blob=.05+o.depth*.05;
 }else{
  cx=w*(o.pill[0]+Math.cos(orbit*1.12)*(.03+o.depth*.025))+px;
  cy=h*(o.pill[1]+Math.sin(orbit*.88)*(.04+o.depth*.026))+py;
  const flyScale=1+Math.sin(time*.53+o.phase)*.045;
  rx=w*o.pill[2]*flyScale*(1+o.depth*.16);ry=h*o.pill[3]*(1+o.depth*.10);
  n=5.6;rotation=orbit*.58+(index%2?-.62:.62);
 }
 const pts=[];
 for(let i=0;i<POINTS;i++){
  const a=TAU*i/POINTS,ca=Math.cos(a),sa=Math.sin(a);
  const bx=Math.sign(ca)*Math.pow(Math.abs(ca),2/n)*rx;
  const by=Math.sign(sa)*Math.pow(Math.abs(sa),2/n)*ry;
  const radial=1+blob*(Math.sin(a*3+o.phase+time*.24)*.55+Math.sin(a*5-o.phase+time*.19)*.3);
  const x=bx*radial,y=by*radial,cr=Math.cos(rotation),sr=Math.sin(rotation);
  pts.push({x:cx+x*cr-y*sr,y:cy+x*sr+y*cr});
 }
 return pts;
}

function target(o,index,time,scene){
 if(scene===0)return ribbonPolygon(o,index,time,'flight');
 if(scene===1)return ribbonPolygon(o,index,time,'weave');
 if(scene===2)return superellipsePolygon(o,index,time,'disc');
 if(scene===3)return superellipsePolygon(o,index,time,'pill');
 return ribbonPolygon(o,index,time,'burst');
}
function morph(a,b,t){const out=new Array(a.length);for(let i=0;i<a.length;i++)out[i]=mixPoint(a[i],b[i],t);return out}

function timeline(time){
 const cycle=((time%CYCLE_SECONDS)+CYCLE_SECONDS)%CYCLE_SECONDS/CYCLE_SECONDS;
 const keys=[0,.17,.37,.59,.79,1];
 for(let i=0;i<keys.length-1;i++){
  if(cycle<=keys[i+1]){
   const local=smoother((cycle-keys[i])/(keys[i+1]-keys[i]));
   return{cycle,scene:i,next:(i+1)%5,t:local};
  }
 }
 return{cycle:0,scene:0,next:1,t:0};
}
function pointsFor(o,index,time,timelineState){return morph(target(o,index,time,timelineState.scene),target(o,index,time,timelineState.next),timelineState.t)}

function polygonBounds(pts){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of pts){if(p.x<minX)minX=p.x;if(p.y<minY)minY=p.y;if(p.x>maxX)maxX=p.x;if(p.y>maxY)maxY=p.y}return{minX,minY,maxX,maxY}}
function drawPolygon(targetCtx,pts,o,alpha){
 const b=polygonBounds(pts);const grad=targetCtx.createLinearGradient(b.minX,b.minY,b.maxX,b.maxY);
 const [r,g,bl]=o.c;
 grad.addColorStop(0,`rgba(${Math.min(255,r+24)},${Math.min(255,g+24)},${Math.min(255,bl+24)},${alpha*.88})`);
 grad.addColorStop(.48,`rgba(${r},${g},${bl},${alpha})`);
 grad.addColorStop(1,`rgba(${Math.max(0,r-20)},${Math.max(0,g-20)},${Math.max(0,bl-20)},${alpha*.72})`);
 targetCtx.beginPath();targetCtx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)targetCtx.lineTo(pts[i].x,pts[i].y);targetCtx.closePath();targetCtx.fillStyle=grad;targetCtx.fill();
 targetCtx.save();targetCtx.globalCompositeOperation='screen';targetCtx.globalAlpha=.17+o.depth*.09;targetCtx.strokeStyle='rgba(255,255,255,.32)';targetCtx.lineWidth=.65+o.depth*.65;targetCtx.stroke();targetCtx.restore();
}

function resize(){
 state.dpr=Math.min(devicePixelRatio||1,economical?1:1.5);state.w=Math.max(1,canvas.clientWidth);state.h=Math.max(1,canvas.clientHeight);
 for(const c of[canvas,layer,glow,trail]){c.width=Math.round(state.w*state.dpr);c.height=Math.round(state.h*state.dpr)}
 for(const c of[ctx,layerCtx,glowCtx,trailCtx])c.setTransform(state.dpr,0,0,state.dpr,0,0);
 trailCtx.clearRect(0,0,state.w,state.h);
}

function drawRings(time,tl){
 const cx=state.w*(.5+state.mx*.012),cy=state.h*(.48+state.my*.01);
 ctx.save();ctx.globalAlpha=.18+.08*Math.sin(tl.cycle*Math.PI);ctx.lineWidth=1;
 for(let i=0;i<5;i++){
  const rx=state.w*(.12+i*.047),ry=state.h*(.075+i*.037),rot=time*(.022+i*.005)*(i%2?1:-1)+tl.cycle*TAU*.22;
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,rot,.25+i*.34,TAU-.45+i*.17);ctx.strokeStyle=`rgba(205,198,235,${.07+i*.012})`;ctx.stroke();
 }
 ctx.restore();
}

function drawFrame(time){
 const tl=timeline(time);
 ctx.clearRect(0,0,state.w,state.h);layerCtx.clearRect(0,0,state.w,state.h);glowCtx.clearRect(0,0,state.w,state.h);
 trailCtx.save();trailCtx.globalCompositeOperation='destination-out';trailCtx.fillStyle=economical?'rgba(0,0,0,.14)':'rgba(0,0,0,.085)';trailCtx.fillRect(0,0,state.w,state.h);trailCtx.restore();

 for(let i=0;i<objects.length;i++){
  const o=objects[i],pts=pointsFor(o,i,time,tl),alpha=.28+o.depth*.40;
  drawPolygon(layerCtx,pts,o,alpha);
 }

 trailCtx.save();trailCtx.globalAlpha=economical?.12:.18;trailCtx.drawImage(layer,0,0,state.w,state.h);trailCtx.restore();
 glowCtx.save();glowCtx.filter=economical?'blur(13px)':'blur(25px)';glowCtx.globalAlpha=.40;glowCtx.drawImage(layer,0,18,state.w,state.h);glowCtx.restore();

 ctx.save();ctx.globalAlpha=.68;ctx.drawImage(trail,0,0,state.w,state.h);ctx.restore();
 ctx.drawImage(glow,0,0,state.w,state.h);ctx.drawImage(layer,0,0,state.w,state.h);
 drawRings(time,tl);

 const sweep=((time*.075)%1+1)%1,x=lerp(-state.w*.32,state.w*1.32,sweep);
 const sheen=ctx.createLinearGradient(x-state.w*.15,0,x+state.w*.15,state.h);
 sheen.addColorStop(0,'rgba(255,255,255,0)');sheen.addColorStop(.45,'rgba(218,218,255,.012)');sheen.addColorStop(.5,'rgba(255,255,255,.12)');sheen.addColorStop(.55,'rgba(149,195,255,.025)');sheen.addColorStop(1,'rgba(255,255,255,0)');
 ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=sheen;ctx.fillRect(0,0,state.w,state.h);ctx.restore();

 const cx=state.w*(.5+state.mx*.012),cy=state.h*(.48+state.my*.01),radius=Math.max(state.w,state.h)*(.18+.05*Math.sin(tl.cycle*Math.PI));
 const bloom=ctx.createRadialGradient(cx,cy,0,cx,cy,radius);bloom.addColorStop(0,'rgba(158,141,222,.085)');bloom.addColorStop(.45,'rgba(94,80,146,.022)');bloom.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=bloom;ctx.fillRect(0,0,state.w,state.h);
 return tl;
}

function updateUI(tl){
 const stage=sceneStage[tl.scene];root.style.setProperty('--stage',stage);root.style.setProperty('--cycle',tl.cycle.toFixed(4));
 const camera=(tl.scene===2?Math.sin(tl.t*Math.PI):tl.scene===3?.45:0)+Math.min(1,Math.abs(state.pvx)+Math.abs(state.pvy))*.18;
 root.style.setProperty('--camera',camera.toFixed(4));
 if(tl.scene!==state.scene){
  state.scene=tl.scene;state.stage=stage;railButtons.forEach((b,i)=>b.classList.toggle('active',i===stage));
  sceneLabel.style.opacity='0';sceneLabel.style.transform='translateX(-50%) translateY(8px)';
  setTimeout(()=>{sceneLabel.textContent=sceneCopy[tl.scene];sceneLabel.style.opacity='1';sceneLabel.style.transform='translateX(-50%)'},160);
 }
}

function loop(ms){
 const time=reduced?0:(ms-state.timeOffset)/1000;
 state.mx+=(state.tx-state.mx)*.05;state.my+=(state.ty-state.my)*.05;state.pvx*=.92;state.pvy*=.92;
 root.style.setProperty('--mx',state.mx.toFixed(4));root.style.setProperty('--my',state.my.toFixed(4));
 const tl=drawFrame(time);updateUI(tl);requestAnimationFrame(loop);
}

addEventListener('pointermove',e=>{
 if(reduced)return;const nx=(e.clientX/innerWidth-.5)*2,ny=(e.clientY/innerHeight-.5)*2;
 state.pvx+=(nx-state.lastX)*.25;state.pvy+=(ny-state.lastY)*.25;state.lastX=nx;state.lastY=ny;state.tx=nx;state.ty=ny;
},{passive:true});
addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{if(document.hidden)state.pausedAt=performance.now();else if(state.pausedAt){state.timeOffset+=performance.now()-state.pausedAt;state.pausedAt=0}});
resize();requestAnimationFrame(loop);
new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('visible',e.isIntersecting)),{threshold:.16}).observe(afterInner);
