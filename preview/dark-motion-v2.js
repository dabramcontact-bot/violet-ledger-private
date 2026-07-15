const root=document.documentElement;
const heroScroll=document.getElementById('heroScroll');
const canvas=document.getElementById('ribbons');
const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
const off=document.createElement('canvas');
const offCtx=off.getContext('2d',{alpha:true,desynchronized:true});
const railButtons=[...document.querySelectorAll('.stage-rail button')];
const sceneLabel=document.getElementById('sceneLabel');
const leadText=document.getElementById('leadText');
const kickerText=document.getElementById('kickerText');
const afterInner=document.getElementById('afterInner');
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const economical=(navigator.hardwareConcurrency||4)<=4||(navigator.deviceMemory||4)<=4||innerWidth<760;
const state={p:0,mx:0,my:0,tx:0,ty:0,w:1,h:1,dpr:1,stage:-1,last:0};
const stageCopy=[
  ['01 · Запрос формируется','ЗАКУПКИ ИЗ КИТАЯ · ЕДИНЫЙ МАРШРУТ','Запросы, PI, поставщики и логистика — в едином пространстве с прозрачными сроками, статусами и ответственными.'],
  ['02 · PI собирает условия','PI · СОГЛАСОВАНИЕ · КОНТРОЛЬ','Линии собираются плотнее: коммерческие условия превращаются в согласованную PI без потери контекста.'],
  ['03 · Логистика запускает движение','ПЕРЕВОЗКА · СРОКИ · ОТВЕТСТВЕННЫЕ','Маршрут ускоряется, но интерфейс остаётся спокойным: даты, перевозчик и стоимость находятся в одной системе.'],
  ['04 · Поставка приходит на склад','СКЛАД · ПРИБЫТИЕ · ЗАВЕРШЕНИЕ','Сцена раскрывается и переводит пользователя из эмоциональной истории в рабочий дашборд.']
];
const ribbons=[
 {c:[116,99,162],side:1,y0:.05,y1:.78,w:104,phase:.1,bend:-.16,depth:.30,speed:.42},
 {c:[48,82,151],side:1,y0:.20,y1:.65,w:118,phase:.8,bend:.12,depth:.55,speed:.54},
 {c:[158,83,57],side:-1,y0:.02,y1:.82,w:126,phase:1.45,bend:-.10,depth:.72,speed:.47},
 {c:[20,101,75],side:-1,y0:.24,y1:.55,w:108,phase:2.1,bend:.16,depth:.62,speed:.58},
 {c:[178,145,67],side:1,y0:.42,y1:.91,w:94,phase:2.8,bend:-.18,depth:.38,speed:.39},
 {c:[91,73,145],side:-1,y0:.53,y1:.94,w:112,phase:3.35,bend:.11,depth:.68,speed:.50},
 {c:[145,140,148],side:1,y0:.72,y1:.10,w:82,phase:4.0,bend:-.08,depth:.20,speed:.34},
 {c:[64,69,86],side:-1,y0:.83,y1:.20,w:76,phase:4.6,bend:.09,depth:.15,speed:.31}
].sort((a,b)=>a.depth-b.depth);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const mixPoint=(a,b,t)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});
function mixGeom(a,b,t){return{p0:mixPoint(a.p0,b.p0,t),p1:mixPoint(a.p1,b.p1,t),p2:mixPoint(a.p2,b.p2,t),p3:mixPoint(a.p3,b.p3,t),w0:lerp(a.w0,b.w0,t),wm:lerp(a.wm,b.wm,t),w1:lerp(a.w1,b.w1,t)}}
function cubic(g,t){const m=1-t,m2=m*m,t2=t*t;return{x:g.p0.x*m2*m+3*g.p1.x*m2*t+3*g.p2.x*m*t2+g.p3.x*t2*t,y:g.p0.y*m2*m+3*g.p1.y*m2*t+3*g.p2.y*m*t2+g.p3.y*t2*t}}
function derivative(g,t){const m=1-t;return{x:3*m*m*(g.p1.x-g.p0.x)+6*m*t*(g.p2.x-g.p1.x)+3*t*t*(g.p3.x-g.p2.x),y:3*m*m*(g.p1.y-g.p0.y)+6*m*t*(g.p2.y-g.p1.y)+3*t*t*(g.p3.y-g.p2.y)}}
function widthAt(g,t){return Math.max(1,lerp(g.w0,g.w1,t)+Math.sin(Math.PI*t)*(g.wm-(g.w0+g.w1)*.5))}
function drawRibbon(target,g,fill,samples){const l=[],r=[];for(let i=0;i<=samples;i++){const t=i/samples,p=cubic(g,t),d=derivative(g,t),len=Math.hypot(d.x,d.y)||1,nx=-d.y/len,ny=d.x/len,half=widthAt(g,t)*.5;l.push({x:p.x+nx*half,y:p.y+ny*half});r.push({x:p.x-nx*half,y:p.y-ny*half})}target.beginPath();target.moveTo(l[0].x,l[0].y);for(let i=1;i<l.length;i++)target.lineTo(l[i].x,l[i].y);for(let i=r.length-1;i>=0;i--)target.lineTo(r[i].x,r[i].y);target.closePath();target.fillStyle=fill;target.fill()}
function fan(r,i,t){const w=state.w,h=state.h,wave=Math.sin(t*r.speed+r.phase),wave2=Math.cos(t*r.speed*.77+r.phase),sx=r.side>0?-w*.3:w*1.3,ex=r.side>0?w*1.3:-w*.3,cx=w*(.51+state.mx*.012*r.depth),cy=h*(.49+wave2*.025+state.my*.012*r.depth),base=r.w*(h/850);return{p0:{x:sx,y:h*(r.y0+wave*.025)},p1:{x:lerp(sx,cx,.76),y:cy+h*(r.bend+wave2*.05)},p2:{x:lerp(ex,cx,.76),y:cy-h*(r.bend+wave*.05)},p3:{x:ex,y:h*(r.y1-wave2*.025)},w0:base*1.05,wm:base*(.46+i*.015),w1:base*.96}}
function weave(r,i,t){const w=state.w,h=state.h,w1=Math.sin(t*r.speed*1.18+r.phase),w2=Math.cos(t*r.speed*.91+r.phase),sx=r.side>0?-w*.34:w*1.34,ex=r.side>0?w*1.34:-w*.34,lane=(i-(ribbons.length-1)*.5)/ribbons.length,base=r.w*(h/850);return{p0:{x:sx,y:h*(.16+(i%4)*.19+w1*.035)},p1:{x:w*(.28+lane*.08+state.mx*.012*r.depth),y:h*(.78-lane*.38+w2*.06)},p2:{x:w*(.72-lane*.08+state.mx*.018*r.depth),y:h*(.20+lane*.43-w1*.06)},p3:{x:ex,y:h*(.83-(i%4)*.16+w2*.03)},w0:base*.88,wm:base*(1.2+r.depth*.45),w1:base*.9}}
function pinch(r,i,t){const w=state.w,h=state.h,pulse=Math.sin(t*r.speed*1.35+r.phase),pulse2=Math.cos(t*r.speed+r.phase),sx=r.side>0?-w*.28:w*1.28,ex=r.side>0?w*1.28:-w*.28,cx=w*(.52+state.mx*.018*r.depth),cy=h*(.48+state.my*.014*r.depth),base=r.w*(h/850);return{p0:{x:sx,y:h*(r.y0+pre(i)*.02+pulse*.02)},p1:{x:lerp(sx,cx,.91),y:cy+h*(r.bend*.22+pulse2*.035)},p2:{x:lerp(ex,cx,.91),y:cy-h*(r.bend*.22+pulse*.035)},p3:{x:ex,y:h*(r.y1-pre(i)*.02-pulse2*.02)},w0:base*1.12,wm:base*(.22+r.depth*.08),w1:base*1.05}}
function pre(i){return(i-(ribbons.length-1)*.5)/ribbons.length}
function outro(r,i,t){const w=state.w,h=state.h,wave=Math.sin(t*r.speed*.8+r.phase),sx=r.side>0?-w*.3:w*1.3,ex=r.side>0?w*1.3:-w*.3,row=(i-(ribbons.length-1)*.5),y=h*(.50+row*.075+wave*.025),base=r.w*(h/850);return{p0:{x:sx,y:y+h*.18*r.side},p1:{x:w*.27,y:y-h*(.05+row*.005)},p2:{x:w*.73,y:y+h*(.05+row*.005)},p3:{x:ex,y:y-h*.18*r.side},w0:base*.72,wm:base*(.78+r.depth*.12),w1:base*.7}}
function geometry(r,i,time,p){const s=p*3,idx=Math.min(2,Math.floor(s)),local=s-idx,t=smooth(local);const scenes=[fan(r,i,time),weave(r,i,time),pinch(r,i,time),outro(r,i,time)];return mixGeom(scenes[idx],scenes[idx+1],t)}
function resize(){state.dpr=Math.min(devicePixelRatio||1,economical?1:1.5);state.w=Math.max(1,canvas.clientWidth);state.h=Math.max(1,canvas.clientHeight);for(const c of[canvas,off]){c.width=Math.round(state.w*state.dpr);c.height=Math.round(state.h*state.dpr)}ctx.setTransform(state.dpr,0,0,state.dpr,0,0);offCtx.setTransform(state.dpr,0,0,state.dpr,0,0)}
function updateState(){const r=heroScroll.getBoundingClientRect(),range=heroScroll.offsetHeight-innerHeight;state.p=clamp(-r.top/Math.max(1,range));state.mx+=(state.tx-state.mx)*.055;state.my+=(state.ty-state.my)*.055;root.style.setProperty('--p',state.p.toFixed(4));root.style.setProperty('--mx',state.mx.toFixed(4));root.style.setProperty('--my',state.my.toFixed(4));const stage=Math.min(3,Math.floor(state.p*4));root.style.setProperty('--stage',stage);if(stage!==state.stage){state.stage=stage;railButtons.forEach((b,i)=>b.classList.toggle('active',i===stage));sceneLabel.style.opacity='0';sceneLabel.style.transform='translateX(-50%) translateY(8px)';leadText.style.opacity='.25';setTimeout(()=>{const c=stageCopy[stage];sceneLabel.textContent=c[0];kickerText.textContent=c[1];leadText.textContent=c[2];sceneLabel.style.opacity='1';sceneLabel.style.transform='translateX(-50%)';leadText.style.opacity='1'},180)}}
function draw(time){ctx.clearRect(0,0,state.w,state.h);offCtx.clearRect(0,0,state.w,state.h);const samples=reduce?10:economical?14:22;for(let i=0;i<ribbons.length;i++){const r=ribbons[i],g=geometry(r,i,time,state.p),alpha=.20+r.depth*.24;const fill=`rgba(${r.c[0]},${r.c[1]},${r.c[2]},${alpha})`;drawRibbon(offCtx,g,fill,samples)}offCtx.save();offCtx.globalCompositeOperation='source-atop';const travel=((time*.075)%1+1)%1,x=lerp(-state.w*.35,state.w*1.35,travel),gl=offCtx.createLinearGradient(x-state.w*.14,0,x+state.w*.14,state.h);gl.addColorStop(0,'rgba(255,255,255,0)');gl.addColorStop(.46,'rgba(222,220,255,.01)');gl.addColorStop(.5,'rgba(255,255,255,.22)');gl.addColorStop(.55,'rgba(158,194,255,.025)');gl.addColorStop(1,'rgba(255,255,255,0)');offCtx.fillStyle=gl;offCtx.fillRect(0,0,state.w,state.h);offCtx.restore();ctx.save();ctx.filter=economical?'blur(10px)':'blur(18px)';ctx.globalAlpha=.22;ctx.drawImage(off,0,10,state.w,state.h);ctx.restore();ctx.drawImage(off,0,0,state.w,state.h);const cx=state.w*(.51+state.mx*.012),cy=state.h*(.49+state.my*.01),radius=Math.max(state.w,state.h)*(.15+Math.sin(state.p*Math.PI)*.06),g=ctx.createRadialGradient(cx,cy,0,cx,cy,radius);g.addColorStop(0,`rgba(153,137,218,${.045+Math.sin(state.p*Math.PI)*.055})`);g.addColorStop(.45,'rgba(96,81,146,.018)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,state.w,state.h)}
function loop(ms){const time=ms/1000;updateState();draw(reduce?0:time);requestAnimationFrame(loop)}
addEventListener('pointermove',e=>{if(reduce)return;state.tx=(e.clientX/innerWidth-.5)*2;state.ty=(e.clientY/innerHeight-.5)*2},{passive:true});addEventListener('resize',resize);resize();requestAnimationFrame(loop);
new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('visible',e.isIntersecting)),{threshold:.16}).observe(afterInner);
