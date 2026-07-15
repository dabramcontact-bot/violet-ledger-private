const root=document.documentElement;
const heroScroll=document.getElementById('heroScroll');
const canvas=document.getElementById('ribbons');
const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
const layer=document.createElement('canvas');
const layerCtx=layer.getContext('2d',{alpha:true,desynchronized:true});
const shadow=document.createElement('canvas');
const shadowCtx=shadow.getContext('2d',{alpha:true,desynchronized:true});
const railButtons=[...document.querySelectorAll('.stage-rail button')];
const sceneLabel=document.getElementById('sceneLabel');
const leadText=document.getElementById('leadText');
const kickerText=document.getElementById('kickerText');
const afterInner=document.getElementById('afterInner');
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const economical=(navigator.hardwareConcurrency||4)<=4||(navigator.deviceMemory||4)<=4||innerWidth<760;
const state={p:0,mx:0,my:0,tx:0,ty:0,w:1,h:1,dpr:1,stage:-1};
const TAU=Math.PI*2;
const OBJECT_POINTS=reduce?40:economical?52:72;

const stageCopy=[
  ['01 · Ленты входят в сцену','ЗАКУПКИ ИЗ КИТАЯ · ЖИВОЙ МАРШРУТ','Ленты летят с разных сторон, пересекаются и создают глубину вокруг центрального сообщения.'],
  ['02 · Ленты сворачиваются в формы','PI · УСЛОВИЯ СОБИРАЮТСЯ В ЦЕЛОЕ','Свободные траектории закручиваются и превращаются в парящие овальные фигуры.'],
  ['03 · Фигуры становятся объёмными','ЛОГИСТИКА · ДВИЖЕНИЕ · ГЛУБИНА','Формы увеличиваются, проходят перед текстом и создают ощущение движения через пространство.'],
  ['04 · Фигуры складываются в капсулы','СКЛАД · ПРИБЫТИЕ · ЗАВЕРШЕНИЕ','Крупные формы сжимаются в капсулы, разлетаются и открывают рабочий дашборд.']
];

const objects=[
 {c:[116,99,162],side:1,y0:.04,y1:.78,w:108,phase:.10,depth:.28,speed:.36,slot:[.16,.34],blob:[.11,.55,.32,.44],pill:[.20,.48,.085,.115]},
 {c:[48,82,151],side:1,y0:.20,y1:.64,w:122,phase:.82,depth:.56,speed:.48,slot:[.31,.68],blob:[.34,.60,.28,.34],pill:[.31,.57,.065,.095]},
 {c:[158,83,57],side:-1,y0:.01,y1:.82,w:132,phase:1.47,depth:.76,speed:.42,slot:[.47,.27],blob:[.51,.48,.20,.29],pill:[.43,.43,.072,.105]},
 {c:[20,101,75],side:-1,y0:.24,y1:.54,w:112,phase:2.13,depth:.64,speed:.52,slot:[.61,.67],blob:[.67,.57,.22,.31],pill:[.55,.58,.080,.110]},
 {c:[178,145,67],side:1,y0:.43,y1:.91,w:98,phase:2.78,depth:.38,speed:.34,slot:[.73,.29],blob:[.85,.46,.28,.38],pill:[.67,.44,.070,.098]},
 {c:[91,73,145],side:-1,y0:.53,y1:.94,w:116,phase:3.39,depth:.70,speed:.46,slot:[.84,.68],blob:[.96,.63,.30,.39],pill:[.79,.59,.090,.118]},
 {c:[145,140,148],side:1,y0:.73,y1:.10,w:84,phase:4.03,depth:.18,speed:.31,slot:[.23,.84],blob:[-.07,.69,.24,.34],pill:[.38,.77,.062,.090]},
 {c:[64,69,86],side:-1,y0:.84,y1:.19,w:78,phase:4.62,depth:.14,speed:.28,slot:[.78,.83],blob:[.72,1.02,.26,.35],pill:[.65,.77,.068,.094]}
].sort((a,b)=>a.depth-b.depth);

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const smoother=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10)};
const mixPoint=(a,b,t)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});

function cubicPoint(g,t){const m=1-t,m2=m*m,t2=t*t;return{x:g.p0.x*m2*m+3*g.p1.x*m2*t+3*g.p2.x*m*t2+g.p3.x*t2*t,y:g.p0.y*m2*m+3*g.p1.y*m2*t+3*g.p2.y*m*t2+g.p3.y*t2*t}}
function cubicDerivative(g,t){const m=1-t;return{x:3*m*m*(g.p1.x-g.p0.x)+6*m*t*(g.p2.x-g.p1.x)+3*t*t*(g.p3.x-g.p2.x),y:3*m*m*(g.p1.y-g.p0.y)+6*m*t*(g.p2.y-g.p1.y)+3*t*t*(g.p3.y-g.p2.y)}}
function widthAt(g,t){return Math.max(1,lerp(g.w0,g.w1,t)+Math.sin(Math.PI*t)*(g.wm-(g.w0+g.w1)*.5))}

function ribbonPoints(o,index,time,exit=0){
 const w=state.w,h=state.h;
 const wave=Math.sin(time*o.speed+o.phase),wave2=Math.cos(time*o.speed*.79+o.phase),wave3=Math.sin(time*o.speed*.53+o.phase);
 const sx=o.side>0?-w*(.34+exit*.34):w*(1.34+exit*.34);
 const ex=o.side>0?w*(1.34+exit*.34):-w*(.34+exit*.34);
 const driftX=Math.sin(time*(.16+o.speed*.12)+o.phase)*w*(.045+o.depth*.035);
 const driftY=Math.cos(time*(.13+o.speed*.11)+o.phase)*h*(.04+o.depth*.025);
 const fly=Math.sin(time*.22+o.phase)*h*.055;
 const cx=w*(.51+state.mx*.014*o.depth)+driftX;
 const cy=h*(.49+state.my*.012*o.depth)+driftY;
 const base=o.w*(h/850)*(1-exit*.28)*(1+wave*.035);
 const g={
  p0:{x:sx,y:h*(o.y0+wave*.035)+fly+exit*h*(index%2?-.18:.18)},
  p1:{x:lerp(sx,cx,.77),y:cy+h*((index%2?1:-1)*(.13+o.depth*.08)+wave2*.075)},
  p2:{x:lerp(ex,cx,.77),y:cy-h*((index%2?1:-1)*(.12+o.depth*.07)+wave3*.075)},
  p3:{x:ex,y:h*(o.y1-wave2*.035)-fly+exit*h*(index%2?.20:-.20)},
  w0:base*1.05,wm:base*(.45+o.depth*.34),w1:base*.96
 };
 const half=OBJECT_POINTS/2,top=[],bottom=[];
 for(let i=0;i<half;i++){
  const t=i/(half-1),p=cubicPoint(g,t),d=cubicDerivative(g,t),len=Math.hypot(d.x,d.y)||1,nx=-d.y/len,ny=d.x/len,hw=widthAt(g,t)*.5;
  top.push({x:p.x+nx*hw,y:p.y+ny*hw});
  bottom.push({x:p.x-nx*hw,y:p.y-ny*hw});
 }
 return top.concat(bottom.reverse());
}

function superShapePoints(o,index,time,kind){
 const w=state.w,h=state.h;
 let cx,cy,rx,ry,rotation,n=2,blob=0;
 const orbit=time*(.10+o.speed*.08)+o.phase;
 const pointerX=state.mx*w*.018*o.depth,pointerY=state.my*h*.014*o.depth;
 if(kind==='oval'){
  cx=w*(o.slot[0]+Math.cos(orbit)*(.035+o.depth*.025))+pointerX;
  cy=h*(o.slot[1]+Math.sin(orbit*.92)*(.045+o.depth*.025))+pointerY;
  rx=w*(.105+o.depth*.055);ry=h*(.060+o.depth*.030);rotation=orbit*.35+(index%2?-.45:.45);n=2.2;
 }else if(kind==='blob'){
  cx=w*(o.blob[0]+Math.cos(orbit*.72)*.025)+pointerX;
  cy=h*(o.blob[1]+Math.sin(orbit*.68)*.030)+pointerY;
  rx=w*o.blob[2]*(1+Math.sin(time*.28+o.phase)*.035);ry=h*o.blob[3]*(1+Math.cos(time*.24+o.phase)*.035);rotation=Math.sin(orbit*.45)*.32;blob=.12+o.depth*.08;n=2;
 }else{
  cx=w*(o.pill[0]+Math.cos(orbit*1.15)*(.025+o.depth*.020))+pointerX;
  cy=h*(o.pill[1]+Math.sin(orbit*.88)*(.035+o.depth*.022))+pointerY;
  rx=w*o.pill[2]*(1+Math.sin(time*.7+o.phase)*.04);ry=h*o.pill[3];rotation=orbit*.55+(index%2?-.62:.62);n=5.2;
 }
 const pts=[];
 for(let i=0;i<OBJECT_POINTS;i++){
  const a=TAU*i/OBJECT_POINTS,ca=Math.cos(a),sa=Math.sin(a);
  const px=Math.sign(ca)*Math.pow(Math.abs(ca),2/n)*rx;
  const py=Math.sign(sa)*Math.pow(Math.abs(sa),2/n)*ry;
  const radial=1+blob*(Math.sin(a*3+o.phase+time*.21)*.55+Math.sin(a*5-o.phase+time*.16)*.28);
  const x=px*radial,y=py*radial,cr=Math.cos(rotation),sr=Math.sin(rotation);
  pts.push({x:cx+x*cr-y*sr,y:cy+x*sr+y*cr});
 }
 return pts;
}

function morphPoints(a,b,t){const out=new Array(a.length);for(let i=0;i<a.length;i++)out[i]=mixPoint(a[i],b[i],t);return out}
function targetPoints(o,index,time,scene){
 if(scene===0)return ribbonPoints(o,index,time,0);
 if(scene===1)return superShapePoints(o,index,time,'oval');
 if(scene===2)return superShapePoints(o,index,time,'blob');
 if(scene===3)return superShapePoints(o,index,time,'pill');
 return ribbonPoints(o,index,time,1);
}
function sceneBlend(p){
 const keys=[0,.22,.47,.71,.89,1];
 const scenes=[0,1,2,3,4,4];
 for(let i=0;i<keys.length-1;i++)if(p<=keys[i+1])return{a:scenes[i],b:scenes[i+1],t:smoother((p-keys[i])/(keys[i+1]-keys[i]))};
 return{a:4,b:4,t:1};
}
function objectPoints(o,index,time,p){const s=sceneBlend(p),a=targetPoints(o,index,time,s.a),b=targetPoints(o,index,time,s.b);return morphPoints(a,b,s.t)}
function drawPolygon(target,pts,fill){target.beginPath();target.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)target.lineTo(pts[i].x,pts[i].y);target.closePath();target.fillStyle=fill;target.fill()}

function resize(){
 state.dpr=Math.min(devicePixelRatio||1,economical?1:1.5);state.w=Math.max(1,canvas.clientWidth);state.h=Math.max(1,canvas.clientHeight);
 for(const c of[canvas,layer,shadow]){c.width=Math.round(state.w*state.dpr);c.height=Math.round(state.h*state.dpr)}
 ctx.setTransform(state.dpr,0,0,state.dpr,0,0);layerCtx.setTransform(state.dpr,0,0,state.dpr,0,0);shadowCtx.setTransform(state.dpr,0,0,state.dpr,0,0);
}

function updateState(){
 const r=heroScroll.getBoundingClientRect(),range=heroScroll.offsetHeight-innerHeight;
 state.p=clamp(-r.top/Math.max(1,range));state.mx+=(state.tx-state.mx)*.052;state.my+=(state.ty-state.my)*.052;
 root.style.setProperty('--p',state.p.toFixed(4));root.style.setProperty('--mx',state.mx.toFixed(4));root.style.setProperty('--my',state.my.toFixed(4));
 const stage=Math.min(3,Math.floor(state.p*4));root.style.setProperty('--stage',stage);
 if(stage!==state.stage){state.stage=stage;railButtons.forEach((b,i)=>b.classList.toggle('active',i===stage));sceneLabel.style.opacity='0';sceneLabel.style.transform='translateX(-50%) translateY(8px)';leadText.style.opacity='.22';setTimeout(()=>{const c=stageCopy[stage];sceneLabel.textContent=c[0];kickerText.textContent=c[1];leadText.textContent=c[2];sceneLabel.style.opacity='1';sceneLabel.style.transform='translateX(-50%)';leadText.style.opacity='1'},180)}
}

function drawBackgroundGeometry(time){
 const cx=state.w*(.50+state.mx*.012),cy=state.h*(.48+state.my*.010);
 ctx.save();ctx.lineWidth=1;ctx.globalAlpha=.22;
 for(let i=0;i<4;i++){
  const rx=state.w*(.13+i*.055),ry=state.h*(.09+i*.038),rot=time*(.025+i*.006)*(i%2?1:-1)+state.p*.8;
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,rot,.3+i*.42,TAU-.5+i*.18);ctx.strokeStyle='rgba(205,198,235,.12)';ctx.stroke();
 }
 ctx.restore();
}

function draw(time){
 ctx.clearRect(0,0,state.w,state.h);layerCtx.clearRect(0,0,state.w,state.h);shadowCtx.clearRect(0,0,state.w,state.h);
 const count=economical?6:objects.length;
 for(let i=0;i<count;i++){
  const o=objects[i],pts=objectPoints(o,i,time,state.p),alpha=.18+o.depth*.29;
  const ghost=objectPoints(o,i,time-.24,state.p);
  drawPolygon(layerCtx,ghost,`rgba(${o.c[0]},${o.c[1]},${o.c[2]},${alpha*.12})`);
  drawPolygon(layerCtx,pts,`rgba(${o.c[0]},${o.c[1]},${o.c[2]},${alpha})`);
  drawPolygon(shadowCtx,pts,'rgba(5,5,10,.34)');
 }

 shadowCtx.save();shadowCtx.globalCompositeOperation='source-atop';const shade=shadowCtx.createLinearGradient(0,0,state.w,state.h);shade.addColorStop(0,'rgba(20,12,28,.28)');shade.addColorStop(.55,'rgba(4,5,10,.12)');shade.addColorStop(1,'rgba(0,0,0,.35)');shadowCtx.fillStyle=shade;shadowCtx.fillRect(0,0,state.w,state.h);shadowCtx.restore();

 layerCtx.save();layerCtx.globalCompositeOperation='source-atop';
 const travel=((time*.08)%1+1)%1,x=lerp(-state.w*.35,state.w*1.35,travel),gl=layerCtx.createLinearGradient(x-state.w*.13,0,x+state.w*.13,state.h);
 gl.addColorStop(0,'rgba(255,255,255,0)');gl.addColorStop(.46,'rgba(225,222,255,.015)');gl.addColorStop(.5,'rgba(255,255,255,.25)');gl.addColorStop(.55,'rgba(158,194,255,.03)');gl.addColorStop(1,'rgba(255,255,255,0)');layerCtx.fillStyle=gl;layerCtx.fillRect(0,0,state.w,state.h);layerCtx.restore();

 ctx.save();ctx.filter=economical?'blur(12px)':'blur(22px)';ctx.globalAlpha=.34;ctx.drawImage(shadow,0,14,state.w,state.h);ctx.restore();
 ctx.save();ctx.filter=economical?'blur(8px)':'blur(15px)';ctx.globalAlpha=.18;ctx.drawImage(layer,0,6,state.w,state.h);ctx.restore();
 ctx.drawImage(layer,0,0,state.w,state.h);
 drawBackgroundGeometry(time);

 const cx=state.w*(.5+state.mx*.012),cy=state.h*(.48+state.my*.01),pulse=Math.sin(state.p*Math.PI),radius=Math.max(state.w,state.h)*(.14+pulse*.09);
 const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,radius);glow.addColorStop(0,`rgba(153,137,218,${.04+pulse*.075})`);glow.addColorStop(.42,'rgba(96,81,146,.02)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,state.w,state.h);
}

function loop(ms){const time=ms/1000;updateState();draw(reduce?0:time);requestAnimationFrame(loop)}
addEventListener('pointermove',e=>{if(reduce)return;state.tx=(e.clientX/innerWidth-.5)*2;state.ty=(e.clientY/innerHeight-.5)*2},{passive:true});
addEventListener('resize',resize);resize();requestAnimationFrame(loop);
new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('visible',e.isIntersecting)),{threshold:.16}).observe(afterInner);
