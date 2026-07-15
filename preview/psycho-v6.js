const root=document.documentElement;
const canvas=document.getElementById('scene');
const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
const layer=document.createElement('canvas');
const lctx=layer.getContext('2d',{alpha:true,desynchronized:true});
const blur=document.createElement('canvas');
const bctx=blur.getContext('2d',{alpha:true,desynchronized:true});
const rail=[...document.querySelectorAll('.stage-rail button')];
const sceneLabel=document.getElementById('sceneLabel');
const afterInner=document.getElementById('afterInner');
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const economical=(navigator.hardwareConcurrency||4)<=4||(navigator.deviceMemory||4)<=4||innerWidth<760;
const TAU=Math.PI*2;
const POINTS=reduced?40:economical?56:84;
const CYCLE=28;
const state={w:1,h:1,dpr:1,mx:0,my:0,tx:0,ty:0,stage:-1,scene:-1};

const objects=[
 {c:[126,103,181],side:1,phase:.12,depth:.16,speed:.31,w:88,y0:.02,y1:.80,lane:-.42,disc:[-.08,.34,.24,.32],pill:[.18,.47,.08,.13]},
 {c:[55,92,174],side:1,phase:.82,depth:.38,speed:.43,w:110,y0:.18,y1:.65,lane:-.26,disc:[.19,.70,.20,.27],pill:[.30,.61,.07,.11]},
 {c:[173,91,61],side:-1,phase:1.48,depth:.88,speed:.39,w:138,y0:.00,y1:.84,lane:-.08,disc:[.49,.22,.25,.35],pill:[.43,.40,.085,.125]},
 {c:[23,116,85],side:-1,phase:2.12,depth:.68,speed:.51,w:114,y0:.24,y1:.56,lane:.09,disc:[.67,.64,.22,.31],pill:[.57,.59,.095,.135]},
 {c:[195,155,68],side:1,phase:2.77,depth:.33,speed:.30,w:98,y0:.44,y1:.92,lane:.24,disc:[.89,.34,.26,.37],pill:[.69,.43,.072,.108]},
 {c:[99,77,160],side:-1,phase:3.42,depth:.77,speed:.42,w:120,y0:.55,y1:.96,lane:.40,disc:[1.04,.72,.31,.43],pill:[.82,.64,.105,.15]},
 {c:[153,147,157],side:1,phase:4.08,depth:.12,speed:.27,w:80,y0:.74,y1:.12,lane:.54,disc:[.08,1.03,.22,.31],pill:[.39,.79,.064,.096]},
 {c:[69,76,99],side:-1,phase:4.66,depth:.08,speed:.24,w:72,y0:.85,y1:.20,lane:.66,disc:[.74,1.07,.24,.35],pill:[.65,.81,.068,.102]},
 {c:[114,57,121],side:1,phase:5.24,depth:1.05,speed:.56,w:146,y0:.30,y1:.10,lane:.00,disc:[.50,.52,.35,.48],pill:[.52,.52,.13,.19]}
].sort((a,b)=>a.depth-b.depth);

const labels=[
 '01 · Ленты прорывают пространство',
 '02 · Маршрут складывается в гипертуннель',
 '03 · Поток превращается в порталы',
 '04 · Система взрывается на частицы',
 '05 · Частицы собираются в капсулы',
 '06 · Цикл возвращается к началу'
];
const stageMap=[0,1,2,2,3,3];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smoother=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10)};
const mix=(a,b,t)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});

function cubic(g,t){const m=1-t,m2=m*m,t2=t*t;return{x:g.p0.x*m2*m+3*g.p1.x*m2*t+3*g.p2.x*m*t2+g.p3.x*t2*t,y:g.p0.y*m2*m+3*g.p1.y*m2*t+3*g.p2.y*m*t2+g.p3.y*t2*t}}
function deriv(g,t){const m=1-t;return{x:3*m*m*(g.p1.x-g.p0.x)+6*m*t*(g.p2.x-g.p1.x)+3*t*t*(g.p3.x-g.p2.x),y:3*m*m*(g.p1.y-g.p0.y)+6*m*t*(g.p2.y-g.p1.y)+3*t*t*(g.p3.y-g.p2.y)}}
function widthAt(g,t){return Math.max(1,lerp(g.w0,g.w1,t)+Math.sin(Math.PI*t)*(g.wm-(g.w0+g.w1)*.5))}

function ribbon(o,i,time,mode='flight'){
 const w=state.w,h=state.h,w1=Math.sin(time*o.speed+o.phase),w2=Math.cos(time*o.speed*.77+o.phase),w3=Math.sin(time*o.speed*.51+o.phase);
 const sx=o.side>0?-w*.38:w*1.38,ex=o.side>0?w*1.38:-w*.38;
 const cx=w*(.51+state.mx*.014*o.depth)+Math.sin(time*.14+o.phase)*w*(.05+o.depth*.04);
 const cy=h*(.49+state.my*.012*o.depth)+Math.cos(time*.12+o.phase)*h*(.045+o.depth*.03);
 const base=o.w*(h/850)*(1+w1*.04);
 let g;
 if(mode==='tunnel'){
  const lane=o.lane;
  g={p0:{x:sx,y:h*(.12+(i%4)*.22+w1*.04)},p1:{x:w*(.31+lane*.06),y:h*(.84-lane*.42+w2*.07)},p2:{x:w*(.69-lane*.06),y:h*(.16+lane*.46-w3*.07)},p3:{x:ex,y:h*(.86-(i%4)*.18+w2*.04)},w0:base*.78,wm:base*(1.38+o.depth*.45),w1:base*.80};
 }else{
  g={p0:{x:sx,y:h*(o.y0+w1*.04)},p1:{x:lerp(sx,cx,.79),y:cy+h*((i%2?1:-1)*(.14+o.depth*.08)+w2*.08)},p2:{x:lerp(ex,cx,.79),y:cy-h*((i%2?1:-1)*(.13+o.depth*.07)+w3*.08)},p3:{x:ex,y:h*(o.y1-w2*.04)},w0:base*1.05,wm:base*(.46+o.depth*.36),w1:base*.96};
 }
 const half=POINTS/2,a=[],b=[];
 for(let k=0;k<half;k++){const t=k/(half-1),p=cubic(g,t),d=deriv(g,t),len=Math.hypot(d.x,d.y)||1,nx=-d.y/len,ny=d.x/len,hw=widthAt(g,t)*.5;a.push({x:p.x+nx*hw,y:p.y+ny*hw});b.push({x:p.x-nx*hw,y:p.y-ny*hw})}
 return a.concat(b.reverse());
}

function superShape(o,i,time,kind){
 const w=state.w,h=state.h,orb=time*(.11+o.speed*.08)+o.phase;
 let cx=w*(o.disc[0]+Math.cos(orb)*(.025+o.depth*.02))+state.mx*w*.016*o.depth;
 let cy=h*(o.disc[1]+Math.sin(orb*.83)*(.035+o.depth*.02))+state.my*h*.014*o.depth;
 let rx=w*o.disc[2],ry=h*o.disc[3],n=2,blob=.06,rot=orb*.35+(i%2?-.35:.35);
 if(kind==='pill'){cx=w*(o.pill[0]+Math.cos(orb*1.2)*.024)+state.mx*w*.016*o.depth;cy=h*(o.pill[1]+Math.sin(orb*.9)*.03)+state.my*h*.014*o.depth;rx=w*o.pill[2];ry=h*o.pill[3];n=5.4;blob=.015;rot=orb*.58+(i%2?-.7:.7)}
 if(kind==='collapse'){rx*=.12;ry*=.12;blob=0;rot*=1.8}
 const pts=[];
 for(let k=0;k<POINTS;k++){const a=TAU*k/POINTS,ca=Math.cos(a),sa=Math.sin(a);let x=Math.sign(ca)*Math.pow(Math.abs(ca),2/n)*rx,y=Math.sign(sa)*Math.pow(Math.abs(sa),2/n)*ry;const wobble=1+blob*(Math.sin(a*3+time*.22+o.phase)+Math.sin(a*5-time*.16-o.phase)*.45);x*=wobble;y*=wobble;const cr=Math.cos(rot),sr=Math.sin(rot);pts.push({x:cx+x*cr-y*sr,y:cy+x*sr+y*cr})}
 return pts;
}

function morph(a,b,t){const out=new Array(a.length);for(let i=0;i<a.length;i++)out[i]=mix(a[i],b[i],t);return out}
function sceneState(time){const p=((time%CYCLE)+CYCLE)%CYCLE/CYCLE,keys=[0,.16,.32,.49,.64,.82,1],scenes=[0,1,2,3,4,5,0];for(let i=0;i<keys.length-1;i++)if(p<=keys[i+1])return{index:i,a:scenes[i],b:scenes[i+1],t:smoother((p-keys[i])/(keys[i+1]-keys[i])),p};return{index:0,a:0,b:1,t:0,p:0}}
function target(o,i,time,s){if(s===0)return ribbon(o,i,time,'flight');if(s===1)return ribbon(o,i,time,'tunnel');if(s===2)return superShape(o,i,time,'disc');if(s===3)return superShape(o,i,time,'collapse');if(s===4)return superShape(o,i,time,'pill');if(s===5)return ribbon(o,i,time+2.4,'flight');return ribbon(o,i,time,'flight')}
function polygon(o,i,time){const s=sceneState(time);return morph(target(o,i,time,s.a),target(o,i,time,s.b),s.t)}
function drawPoly(target,pts,fill){target.beginPath();target.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)target.lineTo(pts[i].x,pts[i].y);target.closePath();target.fillStyle=fill;target.fill()}

function pseudo(seed){const x=Math.sin(seed*12.9898)*43758.5453;return x-Math.floor(x)}
function drawParticles(time,intensity){if(intensity<=.001)return;const count=economical?100:190,cx=state.w*.5,cy=state.h*.49;ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<count;i++){const r1=pseudo(i*3.17),r2=pseudo(i*7.31+4),r3=pseudo(i*11.7+8);const a=r1*TAU+time*(.08+r3*.18);const radius=(80+r2*Math.max(state.w,state.h)*.48)*intensity;const x=cx+Math.cos(a)*radius+Math.sin(time*.8+i)*12;const y=cy+Math.sin(a)*radius*.64+Math.cos(time*.7+i*.3)*10;const size=(.6+r3*2.6)*(1-intensity*.25);const palette=[[177,160,240],[79,119,210],[207,110,79],[45,145,105],[220,183,83]];const c=palette[i%palette.length];ctx.fillStyle=`rgba(${c[0]},${c[1]},${c[2]},${(.08+r2*.38)*intensity})`;ctx.beginPath();ctx.arc(x,y,size,0,TAU);ctx.fill()}ctx.restore()}

function shockwave(time,amount){if(amount<=.001)return;const cx=state.w*.5,cy=state.h*.49;ctx.save();ctx.globalCompositeOperation='screen';ctx.lineWidth=2;for(let i=0;i<3;i++){const r=(60+i*70)+amount*Math.max(state.w,state.h)*(.18+i*.035);ctx.strokeStyle=`rgba(188,174,246,${(.20-i*.045)*(1-amount)})`;ctx.beginPath();ctx.ellipse(cx,cy,r,r*.62,time*.05+i*.4,0,TAU);ctx.stroke()}ctx.restore()}

function resize(){state.dpr=Math.min(devicePixelRatio||1,economical?1:1.5);state.w=Math.max(1,canvas.clientWidth);state.h=Math.max(1,canvas.clientHeight);for(const c of[canvas,layer,blur]){c.width=Math.round(state.w*state.dpr);c.height=Math.round(state.h*state.dpr)}ctx.setTransform(state.dpr,0,0,state.dpr,0,0);lctx.setTransform(state.dpr,0,0,state.dpr,0,0);bctx.setTransform(state.dpr,0,0,state.dpr,0,0)}

function draw(time){const s=sceneState(time);ctx.clearRect(0,0,state.w,state.h);lctx.clearRect(0,0,state.w,state.h);bctx.clearRect(0,0,state.w,state.h);
 const zoom=1+Math.sin(s.p*TAU)*.025+(s.index===2?s.t*.10:0);const roll=Math.sin(time*.18)*.008+(s.index===1?(s.t-.5)*.025:0);ctx.save();ctx.translate(state.w/2,state.h/2);ctx.rotate(roll);ctx.scale(zoom,zoom);ctx.translate(-state.w/2,-state.h/2);
 for(let i=0;i<objects.length;i++){const o=objects[i],pts=polygon(o,i,time),alpha=.18+o.depth*.24,fill=`rgba(${o.c[0]},${o.c[1]},${o.c[2]},${alpha})`;drawPoly(lctx,pts,fill)}
 bctx.save();bctx.filter=economical?'blur(14px)':'blur(26px)';bctx.globalAlpha=.31;bctx.drawImage(layer,0,20,state.w,state.h);bctx.restore();ctx.drawImage(blur,0,0,state.w,state.h);ctx.drawImage(layer,0,0,state.w,state.h);ctx.restore();
 const explode=s.index===3?s.t:(s.index===4?1-s.t:0);drawParticles(time,explode);shockwave(time,explode);
 const sweep=((time*.11)%1+1)%1,x=lerp(-state.w*.4,state.w*1.4,sweep),gl=ctx.createLinearGradient(x-state.w*.13,0,x+state.w*.13,state.h);gl.addColorStop(0,'rgba(255,255,255,0)');gl.addColorStop(.47,'rgba(220,220,255,.01)');gl.addColorStop(.5,'rgba(255,255,255,.20)');gl.addColorStop(.54,'rgba(152,192,255,.025)');gl.addColorStop(1,'rgba(255,255,255,0)');ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=gl;ctx.fillRect(0,0,state.w,state.h);ctx.restore();
 const pulse=Math.max(0,Math.sin(s.p*Math.PI*2));root.style.setProperty('--pulse',pulse.toFixed(3));}

function updateUI(time){const s=sceneState(time),scene=s.index,stage=stageMap[scene]??3;root.style.setProperty('--stage',stage);if(scene!==state.scene){state.scene=scene;sceneLabel.style.opacity='0';sceneLabel.style.transform='translateX(-50%) translateY(8px)';setTimeout(()=>{sceneLabel.textContent=labels[scene];sceneLabel.style.opacity='1';sceneLabel.style.transform='translateX(-50%)'},160)}if(stage!==state.stage){state.stage=stage;rail.forEach((b,i)=>b.classList.toggle('active',i===stage))}}
function loop(ms){const time=reduced?0:ms/1000;state.mx+=(state.tx-state.mx)*.05;state.my+=(state.ty-state.my)*.05;root.style.setProperty('--mx',state.mx.toFixed(4));root.style.setProperty('--my',state.my.toFixed(4));updateUI(time);draw(time);requestAnimationFrame(loop)}
addEventListener('pointermove',e=>{if(reduced)return;state.tx=(e.clientX/innerWidth-.5)*2;state.ty=(e.clientY/innerHeight-.5)*2},{passive:true});addEventListener('resize',resize);resize();requestAnimationFrame(loop);new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('visible',e.isIntersecting)),{threshold:.16}).observe(afterInner);
