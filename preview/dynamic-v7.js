const root=document.documentElement;
const canvas=document.getElementById('scene');
const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
const layer=document.createElement('canvas'),lctx=layer.getContext('2d',{alpha:true,desynchronized:true});
const blur=document.createElement('canvas'),bctx=blur.getContext('2d',{alpha:true,desynchronized:true});
const rail=[...document.querySelectorAll('.stage-rail button')];
const label=document.getElementById('sceneLabel');
const afterInner=document.getElementById('afterInner');
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const economical=(navigator.hardwareConcurrency||4)<=4||(navigator.deviceMemory||4)<=4||innerWidth<760;
const TAU=Math.PI*2,CYCLE=16,POINTS=reduced?36:economical?50:72;
const state={w:1,h:1,dpr:1,mx:0,my:0,tx:0,ty:0,stage:-1,scene:-1,lastTime:0};

const colors=[[126,103,181],[55,92,174],[173,91,61],[23,116,85],[195,155,68],[99,77,160],[153,147,157],[69,76,99],[133,61,138]];
const objects=colors.map((c,i)=>({
 c,phase:i*.71,depth:[.16,.38,.88,.68,.33,.77,.12,.08,1.05][i],speed:[.62,.76,.72,.88,.58,.73,.51,.46,.96][i],
 side:i%2? -1:1,w:[88,110,138,114,98,120,80,72,150][i],y0:[.02,.18,.00,.24,.44,.55,.74,.85,.30][i],y1:[.80,.65,.84,.56,.92,.96,.12,.20,.10][i]
})).sort((a,b)=>a.depth-b.depth);
const sceneNames=['01 · Поток ускоряется','02 · Ленты закручиваются в вихрь','03 · Камера проваливается в портал','04 · Система взрывается на частицы','05 · Частицы собираются в капсулы','06 · Капсулы рвутся обратно в поток'];
const stageMap=[0,1,2,2,3,3];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const smoother=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10)};

function timeline(time){const p=((time%CYCLE)+CYCLE)%CYCLE/CYCLE;const cuts=[0,.18,.36,.54,.70,.86,1];for(let i=0;i<cuts.length-1;i++)if(p<=cuts[i+1])return{scene:i,t:smoother((p-cuts[i])/(cuts[i+1]-cuts[i])),p};return{scene:0,t:0,p:0}}
function cubic(g,t){const m=1-t,m2=m*m,t2=t*t;return{x:g.p0.x*m2*m+3*g.p1.x*m2*t+3*g.p2.x*m*t2+g.p3.x*t2*t,y:g.p0.y*m2*m+3*g.p1.y*m2*t+3*g.p2.y*m*t2+g.p3.y*t2*t}}
function deriv(g,t){const m=1-t;return{x:3*m*m*(g.p1.x-g.p0.x)+6*m*t*(g.p2.x-g.p1.x)+3*t*t*(g.p3.x-g.p2.x),y:3*m*m*(g.p1.y-g.p0.y)+6*m*t*(g.p2.y-g.p1.y)+3*t*t*(g.p3.y-g.p2.y)}}
function ribbonPath(o,i,time,mode='flight'){
 const w=state.w,h=state.h,a=Math.sin(time*o.speed+o.phase),b=Math.cos(time*o.speed*.77+o.phase),c=Math.sin(time*o.speed*.49+o.phase);
 const sx=o.side>0?-w*.42:w*1.42,ex=o.side>0?w*1.42:-w*.42,cx=w*(.5+state.mx*.014*o.depth),cy=h*(.49+state.my*.012*o.depth),base=o.w*(h/850)*(1+a*.06);
 let g;
 if(mode==='vortex'){
  const spin=time*.9+o.phase,rad=w*(.16+o.depth*.09),vx=cx+Math.cos(spin)*rad,vy=cy+Math.sin(spin*.83)*h*(.13+o.depth*.06);
  g={p0:{x:sx,y:h*(o.y0+a*.05)},p1:{x:vx-w*.18*o.side,y:vy-h*.16},p2:{x:vx+w*.18*o.side,y:vy+h*.16},p3:{x:ex,y:h*(o.y1-b*.05)},w0:base*.8,wm:base*(1.35+o.depth*.35),w1:base*.8};
 }else{
  const speedPush=(mode==='whip'?1.7:1),dx=Math.sin(time*.31+o.phase)*w*(.06+o.depth*.05)*speedPush,dy=Math.cos(time*.27+o.phase)*h*(.055+o.depth*.04)*speedPush;
  g={p0:{x:sx,y:h*(o.y0+a*.05)+dy},p1:{x:lerp(sx,cx+dx,.76),y:cy+h*((i%2?1:-1)*(.14+o.depth*.08)+b*.08)},p2:{x:lerp(ex,cx-dx,.76),y:cy-h*((i%2?1:-1)*(.13+o.depth*.08)+c*.08)},p3:{x:ex,y:h*(o.y1-b*.05)-dy},w0:base,wm:base*(.46+o.depth*.42),w1:base*.92};
 }
 const half=POINTS/2,top=[],bottom=[];
 for(let k=0;k<half;k++){const t=k/(half-1),p=cubic(g,t),d=deriv(g,t),len=Math.hypot(d.x,d.y)||1,nx=-d.y/len,ny=d.x/len,ww=Math.max(2,lerp(g.w0,g.w1,t)+Math.sin(Math.PI*t)*(g.wm-(g.w0+g.w1)/2))/2;top.push({x:p.x+nx*ww,y:p.y+ny*ww});bottom.push({x:p.x-nx*ww,y:p.y-ny*ww})}
 return top.concat(bottom.reverse());
}
function capsule(o,i,time,scale=1){const w=state.w,h=state.h,ang=time*(.7+o.speed*.15)+o.phase,cx=w*(.18+i*.08)+Math.cos(ang)*w*.035,cy=h*(.35+(i%3)*.14)+Math.sin(ang*.9)*h*.04,rx=w*(.045+o.depth*.035)*scale,ry=h*(.08+o.depth*.055)*scale,rot=ang*.55+(i%2?-.6:.6),pts=[];for(let k=0;k<POINTS;k++){const q=TAU*k/POINTS,ca=Math.cos(q),sa=Math.sin(q),n=5.8,x=Math.sign(ca)*Math.pow(Math.abs(ca),2/n)*rx,y=Math.sign(sa)*Math.pow(Math.abs(sa),2/n)*ry,cr=Math.cos(rot),sr=Math.sin(rot);pts.push({x:cx+x*cr-y*sr,y:cy+x*sr+y*cr})}return pts}
function disc(o,i,time,zoom=1){const w=state.w,h=state.h,ang=time*(.45+o.speed*.1)+o.phase,cx=w*(.5+Math.cos(ang+i)*.25)+state.mx*w*.01*o.depth,cy=h*(.5+Math.sin(ang*.8+i)*.22)+state.my*h*.01*o.depth,rx=w*(.10+o.depth*.09)*zoom,ry=h*(.15+o.depth*.11)*zoom,rot=ang*.35,pts=[];for(let k=0;k<POINTS;k++){const q=TAU*k/POINTS,x=Math.cos(q)*rx,y=Math.sin(q)*ry,cr=Math.cos(rot),sr=Math.sin(rot);pts.push({x:cx+x*cr-y*sr,y:cy+x*sr+y*cr})}return pts}
function polygon(target,pts,fill){target.beginPath();target.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)target.lineTo(pts[i].x,pts[i].y);target.closePath();target.fillStyle=fill;target.fill()}
function mixPoints(a,b,t){return a.map((p,i)=>({x:lerp(p.x,b[i].x,t),y:lerp(p.y,b[i].y,t)}))}

function particles(time,progress){const n=economical?100:220,w=state.w,h=state.h,cx=w*.5,cy=h*.49;for(let i=0;i<n;i++){const a=i*2.399963+Math.sin(i)*.2,seed=(i%17)/17,speed=.28+seed*.95,burst=smoother(progress),r=(40+Math.pow(burst,.65)*Math.max(w,h)*speed),swirl=(1-burst)*2.5,px=cx+Math.cos(a+swirl)*r+Math.sin(time*.8+i)*12,py=cy+Math.sin(a+swirl)*r*.68+Math.cos(time*.7+i)*10,size=1.2+(i%5)*.75*(1-progress*.5),col=colors[i%colors.length];ctx.beginPath();ctx.arc(px,py,size,0,TAU);ctx.fillStyle=`rgba(${col[0]},${col[1]},${col[2]},${.18+(1-progress)*.58})`;ctx.fill()}}
function speedLines(time,intensity){const w=state.w,h=state.h,cx=w*.5,cy=h*.49;ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<48;i++){const a=i*TAU/48+time*.06,r1=40+(i%7)*13,r2=r1+120*intensity+(i%5)*18,alpha=.02+.08*intensity;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1*.65);ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2*.65);ctx.strokeStyle=`rgba(190,183,245,${alpha})`;ctx.lineWidth=1+(i%3)*.4;ctx.stroke()}ctx.restore()}
function shockwave(p){if(p<=0||p>=1)return;const r=lerp(20,Math.max(state.w,state.h)*.55,smoother(p));ctx.beginPath();ctx.ellipse(state.w*.5,state.h*.49,r,r*.62,0,0,TAU);ctx.strokeStyle=`rgba(205,198,255,${(1-p)*.36})`;ctx.lineWidth=2+8*(1-p);ctx.stroke()}

function resize(){state.dpr=Math.min(devicePixelRatio||1,economical?1:1.5);state.w=Math.max(1,canvas.clientWidth);state.h=Math.max(1,canvas.clientHeight);for(const c of[canvas,layer,blur]){c.width=Math.round(state.w*state.dpr);c.height=Math.round(state.h*state.dpr)}ctx.setTransform(state.dpr,0,0,state.dpr,0,0);lctx.setTransform(state.dpr,0,0,state.dpr,0,0);bctx.setTransform(state.dpr,0,0,state.dpr,0,0)}
function updateUI(tl){const stage=stageMap[tl.scene];root.style.setProperty('--stage',stage);root.style.setProperty('--pulse',Math.sin(tl.t*Math.PI).toFixed(4));if(tl.scene!==state.scene){state.scene=tl.scene;rail.forEach((b,i)=>b.classList.toggle('active',i===stage));label.style.opacity='0';label.style.transform='translateX(-50%) translateY(8px)';setTimeout(()=>{label.textContent=sceneNames[tl.scene];label.style.opacity='1';label.style.transform='translateX(-50%)'},110)}}
function draw(time){const tl=timeline(time);updateUI(tl);ctx.clearRect(0,0,state.w,state.h);lctx.clearRect(0,0,state.w,state.h);bctx.clearRect(0,0,state.w,state.h);
 let mode='flight',alpha=1,zoom=1;if(tl.scene===1)mode='vortex';if(tl.scene===5)mode='whip';
 if(tl.scene<=1||tl.scene===5){objects.forEach((o,i)=>{const pts=ribbonPath(o,i,time,mode),col=o.c,a=.18+o.depth*.27;polygon(lctx,pts,`rgba(${col[0]},${col[1]},${col[2]},${a})`)})}
 if(tl.scene===2){speedLines(time,.35+tl.t*.65);objects.forEach((o,i)=>{const d=disc(o,i,time,1+tl.t*(i===objects.length-1?2.8:.55)),col=o.c;polygon(lctx,d,`rgba(${col[0]},${col[1]},${col[2]},${.16+o.depth*.24})`)})}
 if(tl.scene===3){particles(time,tl.t);shockwave(tl.t);speedLines(time,1-tl.t*.4)}
 if(tl.scene===4){particles(time,1-tl.t);objects.forEach((o,i)=>{const cap=capsule(o,i,time,.55+tl.t*.75),col=o.c;polygon(lctx,cap,`rgba(${col[0]},${col[1]},${col[2]},${(.12+o.depth*.26)*tl.t})`)})}
 bctx.save();bctx.filter=economical?'blur(12px)':'blur(24px)';bctx.globalAlpha=.3;bctx.drawImage(layer,0,12,state.w,state.h);bctx.restore();ctx.drawImage(blur,0,0,state.w,state.h);ctx.drawImage(layer,0,0,state.w,state.h);
 const flash=(tl.scene===2?Math.sin(tl.t*Math.PI)*.12:tl.scene===3?(1-tl.t)*.22:0),g=ctx.createRadialGradient(state.w*.5,state.h*.49,0,state.w*.5,state.h*.49,Math.max(state.w,state.h)*.28);g.addColorStop(0,`rgba(181,164,247,${.055+flash})`);g.addColorStop(.45,'rgba(90,75,140,.018)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,state.w,state.h);
 const x=lerp(-state.w*.3,state.w*1.3,((time*.19)%1+1)%1),gl=ctx.createLinearGradient(x-state.w*.12,0,x+state.w*.12,state.h);gl.addColorStop(0,'rgba(255,255,255,0)');gl.addColorStop(.5,'rgba(255,255,255,.14)');gl.addColorStop(1,'rgba(255,255,255,0)');ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=gl;ctx.fillRect(0,0,state.w,state.h);ctx.restore()}
function loop(ms){const time=reduced?0:ms/1000;state.mx+=(state.tx-state.mx)*.075;state.my+=(state.ty-state.my)*.075;root.style.setProperty('--mx',state.mx.toFixed(4));root.style.setProperty('--my',state.my.toFixed(4));draw(time);requestAnimationFrame(loop)}
addEventListener('pointermove',e=>{if(reduced)return;state.tx=(e.clientX/innerWidth-.5)*2;state.ty=(e.clientY/innerHeight-.5)*2},{passive:true});addEventListener('resize',resize);resize();requestAnimationFrame(loop);new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('visible',e.isIntersecting)),{threshold:.16}).observe(afterInner);
