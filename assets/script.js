const PRISTINE_BODY=document.body.innerHTML;   // the untouched page markup, kept so "Save snapshot" can write an exact copy of this page
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const W = 1600, H = 900, GROUND_TOP = 500;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// ================= GRASS =================
class Blade {
  constructor(r, scale){
    this.dx=(r()-0.5)*46*scale; this.dy=(r()-0.5)*14*scale;
    this.h=(34+r()*52)*scale; this.w=(2.6+r()*2.4)*scale;
    this.lean=(r()-0.5)*0.7; this.bend=(r()-0.5)*14*scale;
    this.hue=92+r()*28; this.light=30+r()*12;
  }
}
class GrassPatch {
  constructor(r,x,y){
    this.type='grass'; this.x=x; this.y=y;
    this.depth=(y-GROUND_TOP)/(H-GROUND_TOP);
    this.size=0.55+this.depth*0.75; this.variation=r();
    this.edible=false; this.amount=0; this.a=1;   // a: opacity (1 = full grass, 0 = gone)
    const n=5+Math.floor(r()*9);
    this.blades=Array.from({length:n},()=>new Blade(r,this.size*(0.8+this.variation*0.4)));
    this.sprite=null;
  }
}

// ================= genetics/Alleles =================
// NOTE: this is a deliberately SIMPLIFIED teaching model of variation and
// inheritance. Real rabbit fur colour and incisor length are NOT controlled by
// single two-allele loci like this; it only illustrates genotype -> phenotype.
const Alleles = Object.freeze({
  fur:   {key:'fur', pheno:'furColor', name:'Fur colour',   dominant:'B', recessive:'b', trait:{dominant:'black', recessive:'white'}},
  teeth: {key:'teeth', pheno:'toothLength', name:'Tooth length', dominant:'L', recessive:'l', trait:{dominant:'long',  recessive:'short'}}
});
const LOCI = [Alleles.fur, Alleles.teeth];

// ================= genetics/GeneticsEngine =================
// Pure functions: DNA in, phenotype out. No rendering, no UI, no stored state.
const GeneticsEngine = {
  traitAt(locus,pair){ return pair.includes(locus.dominant) ? locus.trait.dominant : locus.trait.recessive; }, // B_ -> black, bb -> white
  zygosity(locus,pair){
    const n=pair.filter(a=>a===locus.dominant).length;
    return n===2?'Homozygous dominant':n===1?'Heterozygous':'Homozygous recessive';
  },
  express(dna){ const p={}; for(const L of LOCI) p[L.pheno]=this.traitAt(L,dna[L.key]); return p; },
  alleleFreq(dnas){   // frequency of each locus' dominant allele in a set of DNA
    const f={}; for(const L of LOCI){ let n=0,c=0; for(const d of dnas) for(const a of d[L.key]){ n++; if(a===L.dominant) c++; } f[L.key]=n?c/n:0.5; } return f;
  },
  randomDNA(r,p){   // p (optional): probability of the dominant allele per locus; default 50:50
    const dna={};
    for(const L of LOCI){
      const q=p?p[L.key]:0.5, pick=()=>r()<q?L.dominant:L.recessive;
      dna[L.key]=[pick(),pick()].sort((a,b)=>(b===L.dominant)-(a===L.dominant)); // dominant allele listed first
    }
    return dna;
  }
};

// ================= image URL helpers =================
const dataImg=u=>typeof u==='string'&&/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(u.trim())?u.trim():null;
const safeUrl=u=>(typeof u==='string'&&u.trim()&&!/^\s*(javascript|data|vbscript):/i.test(u))?u.trim():null;
const fixUrl=u=>{   // tidy a pasted link: encode spaces, and add the missing /public/ in Supabase storage links
  let v=String(u).trim().replace(/^["'<\s]+|[>"'\s]+$/g,'');
  if(!/^https?:\/\//i.test(v)) return v;
  try{ const x=new URL(v);
    x.pathname=x.pathname.replace(/\/storage\/v1\/object\/(?!public\/|sign\/|authenticated\/|upload\/)/,'/storage/v1/object/public/');
    return x.href;
  }catch(e){ return v; }
};
const safeImg=u=>safeUrl(u)||dataImg(u);

// ================= assets/RabbitAssets =================
// Independent of the genetics engine: it only maps phenotype labels to a file name,
// once, when an image is assigned. Later DNA edits do NOT touch rabbit.imageUrl
// (call RabbitAssets.assign(rabbit) to re-derive it on purpose).
const RabbitAssets={
  base:'/assets/rabbits/',   // change this one value when the real PNGs are hosted
  custom:{},   // image set from a profile card, shared by every rabbit of that phenotype, e.g. {'black-long':'https://…'}
  key(ph){ return ph.furColor+'-'+ph.toothLength; },
  urlFor(ph){ return this.custom[this.key(ph)]||`${this.base}rabbit-${ph.furColor}-${ph.toothLength}.png`; },
  assign(r){ r.imageUrl=this.urlFor(r.phenotype); return r.imageUrl; },
  setForPhenotype(ph,url){   // url=null clears the custom image. Applies to living rabbits now and to every future offspring.
    const k=this.key(ph); if(url) this.custom[k]=url; else delete this.custom[k];
    for(const x of world.rabbits) if(this.key(x.phenotype)===k) this.assign(x);
    this.local[k]=url||null; return this.remember();   // null = "cleared here", which also hides an image that came with the saved page
  },
  local:{},   // this browser's own choices, kept in localStorage so the images are still there after a reload
  STORE:'xtrematrix-images-v1',
  remember(){ try{ localStorage.setItem(this.STORE,JSON.stringify(this.local)); return true; }catch(e){ return false; } },
  loadSaved(){   // images stored in this page by "Save snapshot" (validated again here: the file may have been edited by hand)
    try{
      const o=JSON.parse(document.getElementById('saved-images').textContent);
      for(const k of ['black-long','black-short','white-long','white-short']){ const u=typeof o[k]==='string'&&safeImg(o[k]); if(u) this.custom[k]=u; }
    }catch(e){}
    try{   // then this browser's own choices (newer than the saved page): a URL replaces, null removes
      const o=JSON.parse(localStorage.getItem(this.STORE)||'{}');
      for(const k of ['black-long','black-short','white-long','white-short']){
        if(o[k]===null){ delete this.custom[k]; this.local[k]=null; }
        else{ const u=typeof o[k]==='string'&&safeImg(o[k]); if(u){ this.custom[k]=u; this.local[k]=u; } }
      }
    }catch(e){}
  }
};

RabbitAssets.loadSaved();

class Rabbit {
  constructor(id,dna,x,y,r,direction,parents){
    this.type='rabbit';
    this.id=id;                       // unique string id, e.g. '017'
    this.x=x; this.y=y;               // position (feet on ground)
    this.dna=dna; this.imageUrl=RabbitAssets.urlFor(this.phenotype); /* stored asset URL */   // dna: {fur:['B','b'], teeth:['L','l']}
    // direction is its own property, independent of fur colour / genotype (World.pickDirection keeps the population ~50:50)
    this.direction=direction||(r()<0.5?'left':'right');
    // --- running behaviour (visual only) ---
    this.state='run';                 // 'run' | 'idle' (idle = standing still, animation paused)
    this.speed=90+r()*60;             // logical px/s at depth scale 1
    this.stride=r();                  // run-cycle phase 0..1
    this.vy=0; this.vyT=0;            // slow drift in depth so paths are not ruler-straight
    this.lift=0; this.pitch=0; this.twitch=0; this.phase=r()*6.28;   // (used by the drawn fallback rabbit)
    this.born=-1; this.vis=1; this.pressed=false;
    this.parents=parents||null;       // [idA,idB] for rabbits born in the simulation, null for founders
    this.grow=1; this.leaving=false; this.leaveT=0; this.gen=0;   // gen: 0 for founders, parents' generation + 1 for rabbits born here   // newborns start small and grow; 'leaving' rabbits fade out and are removed
  }
  get dir(){ return this.direction==='right'?1:-1; }
  get label(){ return '#'+this.id; }
  // Appearance is ALWAYS derived from DNA, so editing rabbit.dna updates it instantly.
  get phenotype(){ return GeneticsEngine.express(this.dna); }
  get scale(){ return (0.7+0.65*clamp((this.y-GROUND_TOP)/(H-GROUND_TOP),0,1))*this.grow; }
  update(dt){
    if(this.grow<1) this.grow=Math.min(1,this.grow+dt*0.55/8);   // newborn 0.45 -> 1 over ~8 s
    if(this.twitch>0) this.twitch=Math.max(0,this.twitch-dt*3);
    else if(Math.random()<dt*0.25) this.twitch=1;
    if(this.state==='idle'||this.pressed) return;          // standing, or held by a long-press
    this.x+=this.dir*this.speed*this.scale*dt;
    if(this.x>W-10) this.x=10; else if(this.x<10) this.x=W-10;   // run off one side, re-enter on the other (faded by edgeFade)
    this.stride=(this.stride+this.speed*dt/70)%1;                // ~1.3-2.1 strides per second
    this.vyT-=dt; if(this.vyT<=0){ this.vy=(Math.random()-0.5)*10; this.vyT=3+Math.random()*4; }
    this.y=clamp(this.y+this.vy*dt,GROUND_TOP+35,H-25);
  }
}

// ================= WORLD =================
const RABBIT_COUNT=clamp(parseInt(new URLSearchParams(location.search).get('rabbits'))||20,1,200); // testing hook
// Generation 0: 20 rabbits with ONLY two phenotypes - white fur + long teeth (b/b L/L) and black fur + short teeth (B/B or B/b, l/l).
// Nobody has black fur + long teeth. That third phenotype can only appear later, when a white-long rabbit mates with a black-short rabbit
// and the offspring inherit B from one parent and L from the other (B/b L/l). The long/short trait is homozygous in both founder types,
// so this first mating cannot produce a white + short rabbit (no unnecessary fourth phenotype).
const FOUNDERS={wl:{fur:['b','b'],teeth:['L','L']},bs:[{fur:['B','B'],teeth:['l','l']},{fur:['B','b'],teeth:['l','l']}]};
const MAX_RABBITS=35;   // classroom cap: 20 + three taps of +5
class World {
  constructor(seed){
    this.seed=seed; this.entities=[]; this.time=0; this.rng=mulberry32(seed+99);
    const r=mulberry32(seed);
    this.genGrass(r);
    this.genRabbits(RABBIT_COUNT,mulberry32(seed+7));
    this.sort();
  }
  get rabbits(){ return this.entities.filter(e=>e.type==='rabbit'&&!e.leaving); }   // rabbits that are leaving no longer count
  get grass(){ return this.entities.filter(e=>e.type==='grass'); }
  sort(){ this.entities.sort((a,b)=>a.y-b.y); }
  add(e){ this.entities.push(e); this.sort(); }
  genGrass(r){
    const clusters=[];
    for(let i=0;i<11;i++) clusters.push({x:90+r()*(W-180),y:GROUND_TOP+40+r()*(H-GROUND_TOP-70),rad:60+r()*90});
    for(const c of clusters){
      const n=4+Math.floor(r()*6);
      for(let i=0;i<n;i++){
        const a=r()*Math.PI*2,d=Math.pow(r(),0.8)*c.rad;
        const x=c.x+Math.cos(a)*d*1.5,y=c.y+Math.sin(a)*d*0.45;
        if(x<30||x>W-30||y<GROUND_TOP+25||y>H-14) continue;
        this.entities.push(new GrassPatch(r,x,y));
      }
    }
    for(let i=0;i<14;i++) this.entities.push(new GrassPatch(r,40+r()*(W-80),GROUND_TOP+30+r()*(H-GROUND_TOP-50)));
  }
  founderDNA(){   // newcomers from the +5 button are immigrants of the two starting types; the third phenotype can only come from mating
    const g=this.rng()<0.5?FOUNDERS.wl:FOUNDERS.bs[this.rng()<0.5?0:1]; return {fur:g.fur.slice(),teeth:g.teeth.slice()};
  }
  pickDirection(fur){   // keeps left/right ~50:50 inside EACH fur-colour group, so direction never depends on colour
    const R=this.rabbits.filter(r=>r.phenotype.furColor===fur), l=R.filter(r=>r.direction==='left').length, rt=R.length-l;
    return l<rt?'left':rt<l?'right':(this.rng()<0.5?'left':'right');
  }
  genRabbits(n,r){
    const nWL=Math.round(n/2), dnas=[];
    for(let i=0;i<n;i++){ const g=i<nWL?FOUNDERS.wl:FOUNDERS.bs[(i-nWL)%2]; dnas.push({fur:g.fur.slice(),teeth:g.teeth.slice()}); }   // independent copies
    for(let i=n-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [dnas[i],dnas[j]]=[dnas[j],dnas[i]]; }   // shuffle: ids, positions and directions are independent of colour
    // natural spread: random positions with a minimum spacing that relaxes if crowded
    const pts=[]; let minD=130;
    for(let i=0;i<n;i++){
      let p,t=0;
      do{
        p={x:70+r()*(W-140),y:GROUND_TOP+45+r()*(H-GROUND_TOP-80)};
        if(++t>60){minD*=0.9;t=0;}
      }while(pts.some(q=>Math.hypot((q.x-p.x),(q.y-p.y)*2.2)<minD));
      pts.push(p);
    }
    dnas.forEach((d,i)=>this.entities.push(new Rabbit(String(i+1).padStart(3,'0'),d,pts[i].x,pts[i].y,r,this.pickDirection(GeneticsEngine.express(d).furColor))));
    this.nextId=n+1;   // monotonic id counter: ids are never reused
  }
  spawn(n){   // add up to n new rabbits: next unique ids, fresh independent random DNA, spaced away from existing rabbits
    const R=this.rabbits; let id=this.nextId;
    n=Math.max(0,Math.min(n,MAX_RABBITS-R.length));
    const pts=R.map(r=>({x:r.x,y:r.y})), added=[]; let minD=130;
    for(let i=0;i<n;i++){
      let p,t=0;
      do{ p={x:70+this.rng()*(W-140),y:GROUND_TOP+45+this.rng()*(H-GROUND_TOP-80)}; if(++t>60){minD*=0.9;t=0;} }
      while(pts.some(q=>Math.hypot(q.x-p.x,(q.y-p.y)*2.2)<minD));
      pts.push(p);
      const dna=this.founderDNA(), rb=new Rabbit(String(id++).padStart(3,'0'),dna,p.x,p.y,this.rng,this.pickDirection(GeneticsEngine.express(dna).furColor));
      rb.born=this.time; this.add(rb); added.push(rb);
    }
    this.nextId=id; return added;
  }
  update(dt){
    this.time+=dt;
    for(const e of this.entities) if(e.type==='rabbit'){
      e.update(dt);
      e.vis+=((e.leaving?0:(Highlight.matches(e)?1:0.25))-e.vis)*Math.min(1,dt*(e.leaving?(e.caught?6:3):10));
      if(e.leaving){ e.leaveT+=dt; if(e.caught) e.carry=e.leaveT*260*e.scale; }   // a caught rabbit is lifted away with the eagle
    }
    if(this.entities.some(e=>e.leaving&&e.leaveT>(e.caught?0.75:1.6))) this.entities=this.entities.filter(e=>!(e.leaving&&e.leaveT>(e.caught?0.75:1.6)));
    this.sort();
  }
  reset(){   // back to the founder population (same seed -> same starting scene)
    this.entities=this.entities.filter(e=>e.type!=='rabbit'); this.rng=mulberry32(this.seed+99);
    this.genRabbits(RABBIT_COUNT,mulberry32(this.seed+7)); this.sort();
  }
}

// ================= RENDERING =================
const cv=document.getElementById('c'), ctx=cv.getContext('2d');
const world=new World(20260621);
window.world=world;

function drawGround(){
  const g=ctx.createLinearGradient(0,GROUND_TOP,0,H);
  g.addColorStop(0,'#0d0a07'); g.addColorStop(1,'#17110b');
  ctx.fillStyle=g; ctx.fillRect(0,GROUND_TOP,W,H-GROUND_TOP);
  const f=ctx.createLinearGradient(0,GROUND_TOP-30,0,GROUND_TOP+30);
  f.addColorStop(0,'rgba(0,0,0,1)'); f.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=f; ctx.fillRect(0,GROUND_TOP-30,W,60);
}

function drawBlade(c,px,py,b,depth){
  const x=px+b.dx,y=py+b.dy;
  const tx=x+Math.sin(b.lean)*b.h,ty=y-Math.cos(b.lean)*b.h;
  const cx=x+Math.sin(b.lean)*b.h*0.5+b.bend,cy=y-b.h*0.55,hw=b.w/2;
  const L=b.light*(0.7+depth*0.45);
  const grad=c.createLinearGradient(x,y,tx,ty);
  grad.addColorStop(0,`hsl(${b.hue},45%,${L*0.35}%)`);
  grad.addColorStop(0.5,`hsl(${b.hue},52%,${L*0.85}%)`);
  grad.addColorStop(1,`hsl(${b.hue-6},55%,${L*1.25}%)`);
  c.beginPath(); c.moveTo(x-hw,y);
  c.quadraticCurveTo(cx-hw*0.6,cy,tx,ty);
  c.quadraticCurveTo(cx+hw*0.6,cy,x+hw,y);
  c.closePath(); c.fillStyle=grad; c.fill();
  c.beginPath(); c.moveTo(x+hw*0.3,y-b.h*0.1);
  c.quadraticCurveTo(cx+hw*0.3,cy,tx,ty);
  c.strokeStyle=`hsla(${b.hue-8},60%,${Math.min(L*1.9,70)}%,${0.22+depth*0.2})`;
  c.lineWidth=Math.max(0.6,b.w*0.18); c.stroke();
}

// each grass patch is pre-rendered once to a small sprite so rabbits can walk in front of / behind it
function buildSprite(p,k){
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(const b of p.blades){
    const x=b.dx,y=b.dy,hw=b.w/2;
    const tx=x+Math.sin(b.lean)*b.h,ty=y-Math.cos(b.lean)*b.h;
    const cx=x+Math.sin(b.lean)*b.h*0.5+b.bend,cy=y-b.h*0.55;
    x0=Math.min(x0,x-hw,tx,cx);x1=Math.max(x1,x+hw,tx,cx);
    y0=Math.min(y0,y,ty,cy);y1=Math.max(y1,y,ty,cy);
  }
  x0-=3;x1+=3;y0-=3;y1+=3;
  const s=document.createElement('canvas');
  s.width=Math.ceil((x1-x0)*k); s.height=Math.ceil((y1-y0)*k);
  const c=s.getContext('2d'); c.setTransform(k,0,0,k,0,0);
  for(const b of p.blades.slice().sort((a,b)=>a.dy-b.dy)) drawBlade(c,-x0,-y0,b,p.depth);
  p.sprite={img:s,ox:x0,oy:y0,w:x1-x0,h:y1-y0};
}

// ================= scene/Sun =================
// Procedural, physically-motivated Sun: limb-darkened photosphere (cooler/orange toward the limb), granulation and
// supergranulation from 3-D Worley noise sampled on the sphere (so cells foreshorten toward the limb), plus a soft
// coronal glow and a faint warm light on the ground. No rays, flares, or extra objects. The disk is built in small
// time slices so it never blocks the simulation; the genetics/rabbit logic is untouched.
const SUN={x:350,y:130,R:85};   // logical coordinates; sits just right of the legend panel, upper-left of the field
const Sun=(()=>{
  const N=384, Rp=N/2-2;
  const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  const hash=(x,y,z,k)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647)^Math.imul(k,1597334677);n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;return (n>>>0)/4294967296;};
  let D1=0,D2=0,ID=0;
  function worley(px,py,pz){
    const ix=Math.floor(px),iy=Math.floor(py),iz=Math.floor(pz); let d1=9,d2=9,bx=0,by=0,bz=0;
    for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const cx=ix+dx,cy=iy+dy,cz=iz+dz;
      const fx=cx+hash(cx,cy,cz,0)-px,fy=cy+hash(cx,cy,cz,1)-py,fz=cz+hash(cx,cy,cz,2)-pz,d=Math.sqrt(fx*fx+fy*fy+fz*fz);
      if(d<d1){d2=d1;d1=d;bx=cx;by=cy;bz=cz;} else if(d<d2) d2=d;
    }
    D1=d1;D2=d2;ID=hash(bx,by,bz,3);
  }
  const ca=Math.cos(0.5),sa=Math.sin(0.5),cb=Math.cos(-0.6),sb=Math.sin(-0.6);
  const CEN=[255,238,166], LIMB=[245,148,45], EXP=[1,1.25,1.8];   // hotter cell centres turn whiter, cooler lanes turn orange   // restrained yellow-white centre, golden-orange limb
  const st={ready:false,row:0,fade:0,img:null,disk:null,glow:null,tint:null};
  function shadeRow(j){
    const d=st.img.data, y=(j-N/2+0.5)/Rp;
    for(let i=0;i<N;i++){
      const x=(i-N/2+0.5)/Rp, r2=x*x+y*y, o=(j*N+i)*4;
      if(r2>1.05){ d[o+3]=0; continue; }
      const r=Math.sqrt(r2), mu=Math.sqrt(Math.max(0,1-r2));
      const y1=y*ca-mu*sa, z1=y*sa+mu*ca, x2=x*cb+z1*sb, z2=-x*sb+z1*cb;    // tilt so no cell pattern aligns with the screen
      worley(x2*11,y1*11,z2*11); const m1=1+0.16*((1-ss(0,0.7,D1))*(0.8+0.4*ID)-0.5)-0.07*(1-ss(0,0.14,D2-D1));
      worley(x2*26,y1*26,z2*26); const m2=1+0.06*((1-ss(0,0.75,D1))-0.5)-0.03*(1-ss(0,0.16,D2-D1));
      worley(x2*4.2,y1*4.2,z2*4.2); const m3=1+0.05*((1-ss(0,0.9,D1))-0.5);
      const inten=m1*m2*m3;
      const lb=1-0.34*Math.pow(1-mu,1.3), k=Math.pow(mu,0.5), ig=inten*1.2;
      const a=Math.min(1,Math.max(0,(1-r)*Rp+0.5));
      for(let c=0;c<3;c++){ const base=LIMB[c]+(CEN[c]-LIMB[c])*k; d[o+c]=Math.min(255,base*Math.pow(ig,EXP[c])*lb); }
      d[o+3]=a*255;
    }
  }
  return {
    st,
    init(){
      const c=document.createElement('canvas'); c.width=c.height=N; st.disk=c; st.img=c.getContext('2d').createImageData(N,N);
      // soft coronal glow: intensity falls roughly as r^-3 from the limb, reaching zero at 3.6 R
      const G=512,gc=document.createElement('canvas'); gc.width=gc.height=G; const g=gc.getContext('2d'), rg=G/2/3.6, gr=g.createRadialGradient(G/2,G/2,rg*0.97,G/2,G/2,G/2);
      for(let i=0;i<=24;i++){ const t=i/24, rr=1+2.6*t, a=1.25*Math.pow(rr,-2.6)*Math.pow(1-t,1.2), cg=Math.round(222-40*t), cb2=Math.round(160-60*t); gr.addColorStop(t,`rgba(255,${cg},${cb2},${a.toFixed(4)})`); }
      g.fillStyle=gr; g.fillRect(0,0,G,G); st.glow=gc;
      const TW=W/2, TH=Math.ceil((H-GROUND_TOP+30)/2), tc=document.createElement('canvas'); tc.width=TW; tc.height=TH; const t=tc.getContext('2d');
      const tg=t.createRadialGradient(SUN.x/2,(SUN.y-(GROUND_TOP-30))/2,0,SUN.x/2,(SUN.y-(GROUND_TOP-30))/2,575);
      tg.addColorStop(0,'rgba(255,205,140,0.19)');
      for(const [r,a] of [[380,0.19],[500,0.11],[650,0.065],[800,0.043],[1000,0.016],[1150,0]]) tg.addColorStop(r/1150,`rgba(255,205,140,${a})`);
      t.fillStyle=tg; t.fillRect(0,0,TW,TH);
      t.globalCompositeOperation='destination-in'; const mk=t.createLinearGradient(0,0,0,40); mk.addColorStop(0,'rgba(0,0,0,0)'); mk.addColorStop(1,'rgba(0,0,0,1)');
      t.fillStyle=mk; t.fillRect(0,0,TW,TH); st.tint=tc;
    },
    step(ms,dt){   // build a few rows per frame until done, then fade the disk in
      if(!st.ready){ const t0=performance.now(); while(st.row<N && performance.now()-t0<ms) shadeRow(st.row++);
        if(st.row>=N){ st.disk.getContext('2d').putImageData(st.img,0,0); st.ready=true; } }
      else if(st.fade<1) st.fade=Math.min(1,st.fade+dt/0.8);
    },
    draw(){   // sky layer: drawn after the black fill, before the ground
      const gr=SUN.R*3.6;
      ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.drawImage(st.glow,SUN.x-gr,SUN.y-gr,2*gr,2*gr); ctx.restore();
      if(st.ready){ const sz=SUN.R*N/Rp; ctx.save(); ctx.globalAlpha=st.fade; ctx.imageSmoothingQuality='high'; ctx.drawImage(st.disk,SUN.x-sz/2,SUN.y-sz/2,sz,sz); ctx.restore(); }
    },
    light(){   // faint warm sunlight on the ground/grass/rabbits, falling off with distance from the Sun
      ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.drawImage(st.tint,0,GROUND_TOP-30,W,H-GROUND_TOP+30); ctx.restore();
    },
    shadowDX(x,s){ return Math.max(-0.35,Math.min(1,(x-SUN.x)/900))*9*s; }   // shadows fall away from the Sun
  };
})();
Sun.init();

// ---- rendering/RabbitRenderer: appearance comes ONLY from r.phenotype ----
// Shapes are Path2D objects built once (side view, facing +x, feet at y=0).
const RP={
  body :new Path2D('M-21,-12 C-21,-24 -12,-30 -3,-28 C3,-27 7,-25 11,-26 C13,-31 18,-33 22,-31 C26,-29 28,-24 27,-21 C26,-18 23,-16 20,-16 C17,-14 14,-12 13,-8 C14,-5 14,-3 14,-1 L18,-1 C18,0 18,0 17,0 L11,0 L10,-3 C5,-5 0,-6 -5,-4 L-4,0 L-16,0 C-21,0 -22,-6 -21,-12 Z'),
  ear  :new Path2D('M15,-30 C11,-38 10,-46 13,-51 C17,-49 20,-40 20,-30 Z'),
  inner:new Path2D('M16,-31 C13.5,-38 13.5,-45 14.5,-48 C17,-46 18,-39 18,-31 Z'),
  thigh:new Path2D('M-18,-20 C-14,-27 -4,-26 0,-18 C2,-12 0,-8 -5,-4'),
  fore :new Path2D('M11,-9 C12,-6 12,-3 11,-1'),
  rim  :new Path2D('M-20,-16 C-19,-24 -12,-29.5 -3,-28 C3,-27 7,-25 11,-26'),
  mouth:new Path2D('M26,-21 C25.5,-19.5 24.5,-19 23.5,-19.3')
};
const FUR={
  black:{top:'#3d3d48',mid:'#26262e',bot:'#15151a',ear:'#2c2c35',inner:'#4a3a40',belly:'rgba(70,70,82,0.55)',tail:'#4a4a55',
         edge:'rgba(170,170,190,0.6)',edgeW:1.3,hi:'rgba(205,205,225,0.5)',whisk:'rgba(205,205,220,0.55)',paw:'#101014',eye:'#150f09',ring:'#d6a64a'},
  white:{top:'#fcfbf7',mid:'#ebe9e1',bot:'#c8c5ba',ear:'#f3f1ea',inner:'#e8b9b4',belly:'rgba(255,255,255,0.7)',tail:'#ffffff',
         edge:'rgba(85,80,68,0.45)',edgeW:1,hi:'rgba(255,255,255,0.0)',whisk:'rgba(120,115,102,0.6)',paw:'#d9d6cb',eye:'#2a1f1f',ring:null}
};
function furGradient(pal){   // created once per palette, reused every frame (defined in local rabbit space)
  if(!pal.g){ const g=ctx.createLinearGradient(0,-31,0,0); g.addColorStop(0,pal.top); g.addColorStop(0.55,pal.mid); g.addColorStop(1,pal.bot); pal.g=g; }
  return pal.g;
}
function ell(c,x,y,rx,ry,rot){c.beginPath();c.ellipse(x,y,rx,ry,rot||0,0,Math.PI*2);}

window.RabbitSprites=window.RabbitSprites||{ready:false,get:()=>null};   // filled in by the GLB module below
window.EagleSprites=window.EagleSprites||{ready:false,get:()=>null,uw:1,fw:360,fh:300};
const edgeFade=x=>Math.max(0,Math.min(1,(Math.min(x,W-x)-10)/70));     // rabbits fade out/in at the left/right edges
function drawSpriteRabbit(r,spr){
  const s=r.scale, k=Math.floor(r.stride*spr.frames)%spr.frames, w=76*s, h=w*spr.fh/spr.fw;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(spr.img,k*spr.fw,0,spr.fw,spr.fh,r.x-w/2,r.y-(r.carry||0)-spr.ay/spr.fh*h,w,h);
}
function drawRabbit(r,t){
  const ph=r.phenotype, pal=FUR[ph.furColor], s=r.scale;
  const tw=Math.sin(r.twitch*Math.PI)*0.3, air=Math.min(1,r.lift/9);
  const fade=r.born>=0?Math.min(1,(world.time-r.born)/0.5):1; ctx.globalAlpha=fade*r.vis*edgeFade(r.x);
  // soft contact shadow
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ell(ctx,r.x+Sun.shadowDX(r.x,s),r.y+1,(RabbitSprites.ready?27:20)*s*(1-r.lift*0.015),3.8*s); ctx.fill();
  const spr=RabbitSprites.get(ph.furColor,ph.toothLength,r.direction);
  if(spr){ drawSpriteRabbit(r,spr); ctx.globalAlpha=1; return; }       // GLB rabbit (recoloured per fur colour, turned per direction)
  ctx.save();
  ctx.translate(r.x,r.y-r.lift*s); ctx.scale(r.dir*s,s); ctx.rotate(r.pitch);
  if(r.state==='idle') ctx.scale(1,1+0.016*Math.sin(t*2.2+r.phase)); else ctx.scale(1+0.07*air,1-0.05*air);   // stretch in the air
  ctx.lineJoin='round'; ctx.lineCap='round';
  // far ear (behind head, darker)
  ctx.save(); ctx.translate(14,-29); ctx.rotate(-0.4+tw*0.6); ctx.translate(-17,30);
  ctx.fillStyle=pal.mid; ctx.fill(RP.ear); ctx.restore();
  // tail
  ell(ctx,-22,-14.5,4.6,4.4); ctx.fillStyle=pal.tail; ctx.fill(); ctx.strokeStyle=pal.edge; ctx.lineWidth=0.8; ctx.stroke();
  // body with soft vertical fur shading
  ctx.fillStyle=furGradient(pal); ctx.fill(RP.body);
  ctx.save(); ctx.clip(RP.body);                         // lighter belly + muzzle + paws, kept inside the silhouette
  ell(ctx,3,-3.5,13,4.2); ctx.fillStyle=pal.belly; ctx.fill();
  ell(ctx,24,-20,5.2,4); ctx.fillStyle=pal.belly; ctx.fill();
  ell(ctx,15.5,-0.8,4.5,1.8); ctx.fillStyle=pal.paw; ctx.fill();
  ell(ctx,-12,-1,7,1.6); ctx.fillStyle=pal.paw; ctx.fill();
  ctx.restore();
  ctx.strokeStyle=pal.edge; ctx.lineWidth=pal.edgeW; ctx.stroke(RP.body);
  // thigh and foreleg contours, rim light along the back
  ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=0.9; ctx.stroke(RP.thigh); ctx.stroke(RP.fore);
  ctx.strokeStyle=pal.hi; ctx.lineWidth=1.4; ctx.stroke(RP.rim);
  // near ear with inner ear
  ctx.save(); ctx.translate(17,-30); ctx.rotate(-0.15+tw); ctx.translate(-17,30);
  ctx.fillStyle=pal.ear; ctx.fill(RP.ear); ctx.strokeStyle=pal.edge; ctx.lineWidth=0.9; ctx.stroke(RP.ear);
  ctx.fillStyle=pal.inner; ctx.fill(RP.inner); ctx.restore();
  // eye
  ell(ctx,21,-25.5,2.2,2.2); ctx.fillStyle=pal.eye; ctx.fill();
  if(pal.ring){ ctx.strokeStyle=pal.ring; ctx.lineWidth=0.8; ctx.stroke(); }
  ell(ctx,21.8,-26.3,0.7,0.7); ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill();
  // nose (tiny idle twitch), mouth, whiskers
  const nz=r.state==='idle'?0.35*Math.sin(t*9+r.phase):0;
  ell(ctx,27,-22+nz,1.4,1.2); ctx.fillStyle='#d98a8f'; ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=0.6; ctx.stroke(RP.mouth);
  ctx.strokeStyle=pal.whisk; ctx.lineWidth=0.5; ctx.beginPath();
  ctx.moveTo(24.5,-20.5); ctx.lineTo(35,-23.5); ctx.moveTo(24.5,-20.2); ctx.lineTo(36,-20.5); ctx.moveTo(24.5,-19.8); ctx.lineTo(34,-17.5); ctx.stroke();
  // incisors: long vs short (the only visible tooth difference)
  const L=ph.toothLength==='long'?7:2.6;
  ctx.fillStyle='#f1e8c6'; ctx.strokeStyle='#6b5f3a'; ctx.lineWidth=0.6;
  ctx.fillRect(24.4,-19,2.2,L); ctx.strokeRect(24.4,-19,2.2,L);
  ctx.restore(); ctx.globalAlpha=1;
}

// ---- rendering/RabbitRenderer: selection ring + long-press progress ring ----
const rabbitCenter=r=>({x:r.x,y:r.y-(24+r.lift)*r.scale});
function drawSelection(r){
  if(world.selected!==r) return;
  ctx.strokeStyle='rgba(232,228,216,0.75)'; ctx.lineWidth=1.6;
  ell(ctx,r.x,r.y+1,26*r.scale,6.5*r.scale); ctx.stroke();
}
function drawHold(r){
  const p=longPress.progress(r); if(p<=0) return;
  const c=rabbitCenter(r);
  ctx.strokeStyle='rgba(232,228,216,0.85)'; ctx.lineWidth=2.4; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(c.x,c.y,34*r.scale,-Math.PI/2,-Math.PI/2+p*Math.PI*2); ctx.stroke();
}
function render(t){
  ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  Sun.draw();
  drawGround();
  for(const e of world.entities){
    if(e.type==='grass'){
      if(e.a<=0.003) continue;
      ctx.globalAlpha=e.a; ctx.fillStyle='rgba(0,0,0,0.35)';
      ell(ctx,e.x+Sun.shadowDX(e.x,e.size),e.y+1,23*e.size,4*e.size); ctx.fill();
      const sp=e.sprite; if(sp) ctx.drawImage(sp.img,e.x+sp.ox,e.y+sp.oy,sp.w,sp.h);
      ctx.globalAlpha=1;
    } else if(e.type==='rabbit'){ drawSelection(e); drawRabbit(e,t); drawHold(e); }
  }
  Reproduction.draw();
  Eagles.draw();
  Sun.light();
}

let spriteK=0;
function resize(){
  const dpr=window.devicePixelRatio||1, vw=innerWidth, vh=innerHeight;
  let w=vw,h=vw*9/16; if(h>vh){h=vh;w=vh*16/9;}
  cv.style.width=w+'px'; cv.style.height=h+'px';
  cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
  const k=cv.width/W; ctx.setTransform(k,0,0,k,0,0);
  if(Math.abs(k-spriteK)>0.005){ spriteK=k; for(const g of world.grass) buildSprite(g,k); }
}
addEventListener('resize',resize); resize();

// ================= interaction/LongPress =================
// Pointer Events cover touch and mouse. A quick tap never fires; moving the pointer
// beyond `tolerance` px or releasing early cancels the press.
class LongPress {
  constructor(el,{delay=550,tolerance=12,hitTest,contains,onLongPress}){
    Object.assign(this,{el,delay,tolerance,hitTest,contains,onLongPress});
    this.target=null; this.pid=null; this.timer=null; this.t0=0; this.sx=0; this.sy=0; this.x=0; this.y=0;
    el.addEventListener('pointerdown',e=>this.down(e));
    el.addEventListener('pointermove',e=>this.move(e));
    for(const t of ['pointerup','pointercancel','pointerleave']) el.addEventListener(t,e=>{ if(e.pointerId===this.pid) this.cancel(); });
    el.addEventListener('contextmenu',e=>e.preventDefault());
    addEventListener('blur',()=>this.cancel());
  }
  down(e){
    if((e.pointerType==='mouse'&&e.button!==0)||this.pid!==null) return;
    this.ptype=e.pointerType||'mouse'; const hit=this.hitTest(e.clientX,e.clientY,this.ptype); if(!hit) return;
    this.pid=e.pointerId; this.target=hit; hit.pressed=true;
    this.sx=this.x=e.clientX; this.sy=this.y=e.clientY; this.t0=performance.now();
    this.timer=setTimeout(()=>this.fire(),this.delay);
  }
  move(e){
    if(e.pointerId!==this.pid) return;
    this.x=e.clientX; this.y=e.clientY;
    if(Math.hypot(this.x-this.sx,this.y-this.sy)>(this.ptype==='mouse'?this.tolerance:this.tolerance*1.8)) this.cancel();
  }
  fire(){
    const t=this.target, ok=t&&this.contains(t,this.x,this.y,this.ptype);   // is the SAME rabbit still under the finger (with slack)?
    this.cancel();
    if(ok){ if(navigator.vibrate) navigator.vibrate(15); this.onLongPress(t); }
  }
  cancel(){ if(this.target) this.target.pressed=false; clearTimeout(this.timer); this.timer=null; this.target=null; this.pid=null; }
  progress(r){ return this.target===r?Math.min(1,(performance.now()-this.t0)/this.delay):0; }
}
const toWorld=(cx,cy)=>{const b=cv.getBoundingClientRect();return [(cx-b.left)/b.width*W,(cy-b.top)/b.height*H];};
function rabbitD(r,x,y){const c=rabbitCenter(r),s=r.scale,dx=(x-c.x)/(32*s),dy=(y-c.y)/(32*s);return dx*dx+dy*dy;}
const SLOP={mouse:10,pen:22,touch:26};   // minimum grab radius in screen px: a fingertip is far larger than a small rabbit
function rabbitAt(cx,cy,pt='mouse'){   // front-most (largest y) rabbit under the pointer; ties -> nearest centre
  const [x,y]=toWorld(cx,cy); let best=null,bd=1e9;
  for(const r of world.rabbits){
    const d=rabbitD(r,x,y);
    if(d<=1&&(!best||r.y>best.y||(r.y===best.y&&d<bd))){best=r;bd=d;}
  }
  if(best) return best;
  const b=cv.getBoundingClientRect(), k=b.width/W, lim=SLOP[pt]||SLOP.mouse; let nd=1e9;   // nothing directly hit: nearest rabbit within finger reach
  for(const r of world.rabbits){ const c=rabbitCenter(r), d=Math.hypot(c.x*k+b.left-cx,c.y*k+b.top-cy)-32*r.scale*k; if(d<lim&&d<nd){nd=d;best=r;} }
  return best;
}
function rabbitContains(r,cx,cy,pt='mouse'){
  const [x,y]=toWorld(cx,cy); if(rabbitD(r,x,y)<=2.6) return true;
  const b=cv.getBoundingClientRect(), k=b.width/W, c=rabbitCenter(r);
  return Math.hypot(c.x*k+b.left-cx,c.y*k+b.top-cy)-32*r.scale*k<(SLOP[pt]||SLOP.mouse)*1.6;
}

// ================= ui/RabbitProfile =================
const cap=s=>s[0].toUpperCase()+s.slice(1);
const esc=s=>String(s).replace(/[&<>"'`]/g,c=>'&#'+c.charCodeAt(0)+';');
const RabbitProfile={
  rabbit:null,key:'',openedAt:0,editing:false,
  init(){
    this.scrim=document.getElementById('scrim'); this.body=document.getElementById('body');
    this.scrim.addEventListener('pointerdown',e=>{ if(e.target===this.scrim&&performance.now()-this.openedAt>400) this.close(); });
    document.getElementById('close').addEventListener('click',()=>this.close());
    addEventListener('keydown',e=>{ if(e.key==='Escape') this.close(); });
    this.body.addEventListener('click',e=>{
      const a=e.target.closest('[data-act]'); if(!a||!this.rabbit) return;
      if(a.dataset.act==='url'){ this.editing=!this.editing; this.sync(); }
      else if(a.dataset.act==='apply') this.apply(this.body.querySelector('#urlin').value);
      else if(a.dataset.act==='reset'){ RabbitAssets.setForPhenotype(this.rabbit.phenotype,null); this.editing=false; this.sync(); }
    });
    // URL lock: the URL box is hidden until the picture on the card is held down for HOLD_MS. It locks again on Apply, Lock, or when the card closes.
    const HOLD_MS=700; let hold=null,hx=0,hy=0; const stop=()=>{ if(hold){ clearTimeout(hold); hold=null; } }; this.stopHold=stop;
    this.body.addEventListener('pointerdown',e=>{
      if(e.button>0||this.editing||!this.rabbit||!e.target.closest('.plate')) return;
      stop(); hx=e.clientX; hy=e.clientY;
      hold=setTimeout(()=>{ hold=null; if(!this.rabbit||this.editing) return; this.editing=true; this.sync(); try{ if(navigator.vibrate) navigator.vibrate(25); }catch(_){} },HOLD_MS);
    });
    this.body.addEventListener('pointermove',e=>{ if(hold&&Math.hypot(e.clientX-hx,e.clientY-hy)>12) stop(); });
    ['pointerup','pointercancel','pointerleave'].forEach(t=>this.body.addEventListener(t,stop)); this.body.addEventListener('scroll',stop);
    this.body.addEventListener('contextmenu',e=>{ if(e.target.closest('.plate')) e.preventDefault(); });
    this.body.addEventListener('dragstart',e=>{ if(e.target.closest('.plate')) e.preventDefault(); });
    this.body.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.id==='urlin'){ e.preventDefault(); this.apply(e.target.value); } });
    this.body.addEventListener('paste',e=>{   // pasting a URL applies it straight away
      if(e.target.id!=='urlin') return; e.preventDefault();
      const t=(e.clipboardData||window.clipboardData).getData('text'); e.target.value=t.trim(); this.apply(t);
    });
  },
  autoPaused:false,   // true when opening the card paused the simulation (it resumes on close, unless the user had already paused it)
  open(r){ if(!paused&&!this.autoPaused){ this.autoPaused=true; setPaused(true); }
    this.rabbit=r; this.editing=false; world.selected=r; this.key=''; this.openedAt=performance.now(); this.scrim.classList.add('open'); this.sync(); },
  close(){ if(this.stopHold) this.stopHold(); this.rabbit=null; this.editing=false; world.selected=null; this.scrim.classList.remove('open');
    if(this.autoPaused){ this.autoPaused=false; setPaused(false); } },
  sync(){   // re-renders only when the DNA changes, so the card updates live
    if(!this.rabbit) return;
    const key=JSON.stringify([this.rabbit.id,this.rabbit.dna,this.rabbit.imageUrl,this.editing,this.autoPaused]); if(key===this.key) return;
    this.key=key; this.body.innerHTML=this.html(this.rabbit);
    if(this.editing){ const i=this.body.querySelector('#urlin'); if(i) i.focus(); }
  },
  helixSVG(r){
    // Schematic: the rabbit's two chromosome copies (rows), each carrying one allele at each of the two simplified loci.
    const X0=44,X1=312,A=7,P=36,Y=[56,108],CX=[116,240];
    const sty={B:['#1d1d23','#b8b8c8','#e8e4d8'],b:['#ecebe5','#ecebe5','#15130f'],
               L:['#d6a64a','#d6a64a','#15130f'],l:['#15130f','#d6a64a','#d6a64a']};
    const strand=y=>{
      let a='',b='',g='';
      for(let x=X0;x<=X1;x+=3){const d=A*Math.sin(2*Math.PI*(x-X0)/P);
        a+=(x===X0?'M':'L')+x+','+(y+d).toFixed(1); b+=(x===X0?'M':'L')+x+','+(y-d).toFixed(1);}
      for(let x=X0+P/4;x<=X1;x+=P/4){const d=A*Math.sin(2*Math.PI*(x-X0)/P);
        g+=`<line x1="${x}" y1="${(y+d).toFixed(1)}" x2="${x}" y2="${(y-d).toFixed(1)}"/>`;}
      return `<g fill="none"><path d="${a}" stroke="#6a6454" stroke-width="1.6"/><path d="${b}" stroke="#4e4a3d" stroke-width="1.6"/></g><g stroke="#3f3b30" stroke-width="1">${g}</g>`;
    };
    let out=CX.map(x=>`<line x1="${x}" y1="24" x2="${x}" y2="130" stroke="#3a352a" stroke-dasharray="3 3"/>`).join('');
    out+=LOCI.map((L,i)=>`<text x="${CX[i]}" y="14" text-anchor="middle" font-size="11" fill="#b9b3a5">${L.name} locus</text>`).join('');
    Y.forEach((y,c)=>{
      out+=`<text x="0" y="${y+3}" font-size="10" fill="#8a8478">Copy ${c+1}</text>`+strand(y);
      LOCI.forEach((L,i)=>{
        const a=r.dna[L.key][c],[f,k,t]=sty[a];
        out+=`<rect x="${CX[i]-26}" y="${y-15}" width="52" height="30" rx="6" fill="${f}" stroke="${k}" stroke-width="1.6"/>`+
             `<text x="${CX[i]}" y="${y+6}" text-anchor="middle" font-size="17" font-weight="700" fill="${t}">${a}</text>`;
      });
    });
    const lab=[0,1].map(c=>`copy ${c+1}: ${LOCI.map(L=>r.dna[L.key][c]).join(' ')}`).join('; ');
    return `<svg class="helix" viewBox="0 0 320 130" role="img" aria-label="Schematic of two chromosome copies; ${lab}">${out}</svg>`;
  },
  source(r){   // reads the URL straight from the selected rabbit
    const u=safeUrl(r.imageUrl), d=!u&&dataImg(r.imageUrl);
    const line=u?`<a class="src" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)} ↗</a>`
      :d?'<div class="unavail">Embedded image (data URI)</div>':'<div class="unavail">Image unavailable</div>';
    const form=this.editing?'<div class="urlform"><input id="urlin" type="url" inputmode="url" placeholder="Paste image URL here" autocomplete="off" autocapitalize="off" spellcheck="false"><div class="urlrow"><button type="button" class="btn" data-act="apply">Apply</button><button type="button" class="btn" data-act="reset">Reset</button><button type="button" class="btn" data-act="url">Lock</button></div><div class="urlerr" role="status"></div><div class="urlnote">Applies to all '+cap(r.phenotype.furColor)+' · '+cap(r.phenotype.toothLength)+' rabbits</div><div class="urlnote">If the picture does not load, open the link above in a new tab: it must show the picture, and the storage bucket must be Public.</div></div>':'';
    return this.editing?'<div class="sec">Image source</div>'+line+form:'';   // hidden while locked
  },
  apply(text){   // validate, store on THIS rabbit, re-render
    const r=this.rabbit; if(!r) return;
    const v=(text||'').trim(), err=this.body.querySelector('.urlerr');
    if(!v){ if(err) err.textContent='Paste an image URL first.'; return; }
    if(!safeImg(v)){ if(err) err.textContent='Not a valid image URL (use http(s)://… or a /path).'; return; }
    const kept=RabbitAssets.setForPhenotype(r.phenotype,dataImg(v)?v:fixUrl(v)); this.editing=false; this.sync();
    if(!kept) Note.show('Not remembered','This browser would not store the image, so it is forgotten on reload. Use Save snapshot to keep it.');
  },
  plate(r){
    const u=safeImg(r.imageUrl); const eu=u&&esc(u);
    const sil='<svg viewBox="0 0 160 100" aria-hidden="true"><g fill="#2f2b22"><ellipse cx="62" cy="68" rx="28" ry="20"/><ellipse cx="92" cy="64" rx="24" ry="16"/><ellipse cx="116" cy="46" rx="14" ry="12"/><ellipse cx="110" cy="22" rx="4.5" ry="15" transform="rotate(-12 110 22)"/><ellipse cx="119" cy="22" rx="4.5" ry="15" transform="rotate(8 119 22)"/><circle cx="36" cy="64" r="7"/></g></svg>';
    if(!u) return `<div class="plate">${sil}<small>Image unavailable</small></div>`;
    return `<div class="plate">${sil}<small class="pending">Image pending</small><small class="fail">Image failed to load.</small><img src="${eu}" alt="Rabbit ${r.label}" referrerpolicy="no-referrer" decoding="async" onload="this.classList.add('ok');this.parentNode.classList.add('has')" onerror="this.parentNode.classList.add('bad')"></div>`;
  },
  html(r){
    const ph=r.phenotype;
    const locus=L=>{
      const pair=r.dna[L.key];
      const als=pair.map(a=>{
        const dom=a===L.dominant, tr=dom?L.trait.dominant:L.trait.recessive;
        return `<div class="al"><span class="chip ${dom?'dom':'rec'} trait-${tr}">${a}</span><span class="cap">${cap(tr)}<small>${dom?'dominant':'recessive'}</small></span></div>`;
      }).join('');
      const hasDom=pair.includes(L.dominant);
      return `<div class="locus"><div class="lname">${L.name} locus</div><div class="alleles">${als}</div>
        <div class="zyg">${GeneticsEngine.zygosity(L,pair)} (${pair.join(' / ')})</div>
        <div class="rule"><span${hasDom?' class="on"':''}>${L.dominant}_ → ${cap(L.trait.dominant)}</span> · <span${hasDom?'':' class="on"'}>${L.recessive}${L.recessive} → ${cap(L.trait.recessive)}</span></div></div>`;
    };
    return `<div class="title">Rabbit ${r.label}</div>
      <div class="ped">${r.parents?'Parents: #'+r.parents.join(' × #'):'Founder'}${this.autoPaused?' · simulation paused while this card is open':''}</div>${this.plate(r)}${this.source(r)}
      <div class="sec">Simplified genetic profile</div>${this.helixSVG(r)}
      <p class="viz">Schematic only: DNA has no colour. Segments mark where each simplified locus sits on the two chromosome copies; colour shows the allele's effect.</p>${LOCI.map(locus).join('')}
      <div class="sec">Phenotype</div>
      <div class="prow"><span>Fur</span><i class="sw ${ph.furColor}"></i><b>${ph.furColor.toUpperCase()}</b></div>
      <div class="prow"><span>Incisors</span><i class="tooth ${ph.toothLength}"></i><b>${ph.toothLength.toUpperCase()}</b></div>
      <p class="note">Teaching model: fur colour (B) and tooth length (L) are treated as two independent single-gene traits with complete dominance. In real rabbits, coat colour involves several genes, and tooth length is not a simple dominant trait.</p>`;
  }
};
world.selected=null;
const longPress=new LongPress(cv,{hitTest:rabbitAt,contains:rabbitContains,onLongPress:r=>RabbitProfile.open(r)});
RabbitProfile.init();
// ================= ui/Note =================
// Small explanation card used after the two selection events.
const Note=(()=>{ const el=document.getElementById('note'), b=el.querySelector('b'), sp=el.querySelector('span'); let tm=0;
  return { show(title,text,ms=8000){ b.textContent=title; sp.textContent=text; el.classList.add('on'); clearTimeout(tm); tm=setTimeout(()=>el.classList.remove('on'),ms); },
           hide(){ clearTimeout(tm); el.classList.remove('on'); } }; })();

// ================= scene/GrassPressure =================
// FOOD RESOURCE DECLINE. The grass control removes grass patches at random places and random moments (each patch fades out), leaving about
// 10% as scarce food. As the food declines, short-toothed rabbits become weak (they slow down) and then disappear one at a time - only as
// the food runs out, never all at once. Long-toothed rabbits are not affected. A concise card explains it when the event is over.
const FOOD_KEEP=0.10, FOOD_SPAN=14, FOOD_FADE=0.9, STARVE_DELAY=2.2;
const GrassPressure={
  round:0,   // 0 ready | 1 food declining | 4 finished
  t:0, total:0, done:0, n0:0, items:[], log:[],
  CLASSES:['black|long','black|short','white|long'],
  get running(){ return this.round===1; },
  key(r){ const p=r.phenotype; return p.furColor+'|'+p.toothLength; },
  counts(){ const c={}; for(const k of this.CLASSES) c[k]=0; for(const r of world.rabbits) c[this.key(r)]=(c[this.key(r)]||0)+1; return c; },
  start(){
    if(this.round!==0||Eagles.active||Reproduction.active) return;
    const P=world.grass.filter(p=>p.a>0.99); if(!P.length) return;
    for(let i=P.length-1;i>0;i--){ const j=Math.floor(world.rng()*(i+1)); [P[i],P[j]]=[P[j],P[i]]; }
    this.items=P.slice(0,Math.round(P.length*(1-FOOD_KEEP))).map(p=>({p,at:world.rng()*FOOD_SPAN,started:false,t0:0}));   // random patch, random moment
    this.n0=world.rabbits.filter(r=>r.phenotype.toothLength==='short').length; this.total=P.length; this.done=0; this.t=0; this.log.length=0; this.round=1; syncHud();
  },
  reset(){ for(const p of world.grass) p.a=1; this.round=0; this.t=0; this.items=[]; this.done=0; this.total=0; this.n0=0; this.log.length=0; },
  update(dt){
    if(!this.running) return;
    this.t+=dt; let started=0;
    for(const it of this.items){ if(!it.started&&this.t>=it.at){ it.started=true; it.t0=this.t; } if(it.started){ started++; it.p.a=Math.max(0,1-(this.t-it.t0)/FOOD_FADE); } }
    if(started!==this.done){ this.done=started; syncHud(); }
    // the share of short-toothed rabbits that can still be fed falls with the remaining food (1 -> 0 as the food drops to its final 10%)
    const food=1-started/this.total, fed=Math.floor(this.n0*clamp((food-FOOD_KEEP)/(1-FOOD_KEEP),0,1)+1e-9);
    const short=world.rabbits.filter(r=>r.phenotype.toothLength==='short');
    const healthy=short.filter(r=>r.starve===undefined);
    for(let n=healthy.length-fed;n>0;n--){ const i=Math.floor(world.rng()*healthy.length), r=healthy.splice(i,1)[0]; r.starve=this.t; r.speed*=0.5; this.log.push({starve:r.id,t:+this.t.toFixed(2)}); }   // weakened: slower
    for(const r of short) if(r.starve!==undefined&&this.t-r.starve>=STARVE_DELAY&&!r.pressed&&r!==RabbitProfile.rabbit){ r.leaving=true; r.leaveT=0; this.log.push({gone:r.id,t:+this.t.toFixed(2)}); syncHud(); }
    const over=this.t>=FOOD_SPAN+FOOD_FADE;
    if(over&&!world.rabbits.some(r=>r.phenotype.toothLength==='short')&&!world.entities.some(e=>e.type==='rabbit'&&e.leaving)||this.t>FOOD_SPAN+FOOD_FADE+STARVE_DELAY+8){
      this.round=4; syncHud(); Note.show('Food resource decline','Short-toothed rabbits could not survive when food resources became limited.');
    }
  }
};

// ================= scene/Eagles =================
// Two white eagles (your GLB, baked to sprites like the rabbits) enter from the top, glide down on a homing path and touch ONE white
// rabbit each; the touched rabbit disappears and the eagle climbs away. Black rabbits are never targeted or touched.
const Eagles={
  UNIT:2.8,                 // logical px per GLB unit at depth scale 1
  list:[], pending:[], t:0, log:[], seq:0, hunt:null,
  get active(){ return this.list.length>0||this.pending.length>0; },
  whites(){ return world.rabbits.filter(r=>r.phenotype.furColor==='white'); },
  targeted(){ return new Set(this.list.map(e=>e.target&&e.target.id)); },
  launch(n=4){
    if(this.active) return 0;
    const ok=this.whites().filter(r=>r!==RabbitProfile.rabbit&&!r.pressed), shuf=a=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(world.rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
    const picks=shuf(ok).slice(0,n), lanes=shuf(picks.map((_,i)=>(i+0.5)/picks.length)), side=world.rng()<0.5?1:-1;
    // half fly left->right, half right->left; every eagle gets its own height and start time
    this.pending=picks.map((r,i)=>({target:r,dir:i%2?-side:side,lane:70+lanes[i]*330,delay:i*1.3+world.rng()*0.4}));
    this.hunt={caught:0,n:picks.length}; syncHud(); return this.pending.length;
  },
  size(e){ const sp=EagleSprites; const dw=sp.uw*this.UNIT*e.s; return {dw,dh:dw*sp.fh/sp.fw}; },
  spawn(target,dir,lane){
    const s=target.scale, e={target,s,x:0,y:lane,vx:dir*260*s,vy:0,face:dir,state:'glide',t:0,phase:world.rng(),d0:0,gy:target.y,id:this.seq++};
    e.x=dir>0?-this.size(e).dw*0.6:W+this.size(e).dw*0.6;   // enters from the side edge
    const a=this.aim(e); e.d0=Math.hypot(a.x-e.x,a.y-e.y); this.list.push(e);
  },
  aim(e){ const T=e.target, c=rabbitCenter(T), {dh}=this.size(e); return {x:c.x,y:c.y-dh*0.30}; },
  retarget(e){
    const taken=this.targeted(), c=this.whites().filter(r=>!taken.has(r.id)&&r!==RabbitProfile.rabbit);
    if(!c.length){ e.state='exit'; e.t=0; e.target=null; return; }
    e.target=c[Math.floor(world.rng()*c.length)]; e.s=e.target.scale; const a=this.aim(e); e.d0=Math.max(300,Math.hypot(a.x-e.x,a.y-e.y));
  },
  update(dt){
    for(const p of this.pending) p.delay-=dt;
    while(this.pending.length&&this.pending[0].delay<=0){ const p=this.pending.shift(); if(p.target&&!p.target.leaving) this.spawn(p.target,p.dir,p.lane); }
    for(const e of this.list){
      e.t+=dt;
      if(e.state==='glide'){
        const T=e.target;
        if(!T||T.leaving||!world.entities.includes(T)){ this.retarget(e); if(e.state!=='glide') continue; }
        if(e.t>12){ e.state='exit'; e.t=0; continue; }
        e.s=e.target.scale; e.gy=e.target.y;
        const a=this.aim(e), d=Math.hypot(a.x-e.x,a.y-e.y), prog=clamp(1-d/e.d0,0,1);
        const sp=(300+320*prog*prog)*e.s;                              // glide first, then stoop faster
        const tt=Math.min(1.2,d/sp), vT=e.target.pressed?0:e.target.dir*e.target.speed*e.target.scale;
        const ax=a.x+vT*tt, ay=a.y, dd=Math.hypot(ax-e.x,ay-e.y)||1, k=1-Math.exp(-(d<260*e.s?9:3.2)*dt);
        e.vx+=((ax-e.x)/dd*sp-e.vx)*k; e.vy+=((ay-e.y)/dd*sp-e.vy)*k;
        e.x+=e.vx*dt; e.y+=e.vy*dt; e.phase+=dt*(prog<0.55?1.0:2.2);
        if(Math.abs(e.vx)>15) e.face=e.vx>0?1:-1;
        if(d<22*e.s){   // touch: the rabbit disappears, the eagle climbs away
          const T2=e.target; T2.leaving=true; T2.caught=true; T2.leaveT=0; T2.pressed=false;
          this.log.push({eagle:e.id,caught:T2.id,color:T2.phenotype.furColor,x:Math.round(e.x),y:Math.round(e.y),t:+world.time.toFixed(2)}); if(this.hunt) this.hunt.caught++;
          e.state='exit'; e.t=0; syncHud();
        }
      } else {   // exit: powered climb up and away
        const tx=e.x+e.face*500, ty=-300, d=Math.hypot(tx-e.x,ty-e.y)||1, sp=560*e.s, k=1-Math.exp(-2.5*dt);
        e.vx+=((tx-e.x)/d*sp-e.vx)*k; e.vy+=((ty-e.y)/d*sp-e.vy)*k; e.x+=e.vx*dt; e.y+=e.vy*dt; e.phase+=dt*2.4;
        if(Math.abs(e.vx)>15) e.face=e.vx>0?1:-1;
      }
    }
    for(let i=0;i<this.list.length;i++) for(let j=i+1;j<this.list.length;j++){   // never let two eagles overlap: nudge them apart vertically
      const a=this.list[i], b=this.list[j], A=this.size(a), B=this.size(b), dx=b.x-a.x, dy=b.y-a.y, rx=0.55*(A.dw+B.dw)/2, ry=0.55*(A.dh+B.dh)/2;
      if(Math.abs(dx)<rx){ const need=1.05*ry*Math.sqrt(1-(dx/rx)*(dx/rx)); if(Math.abs(dy)<need){ const sg=dy>=0?1:-1, k=Math.min(1,dt*30)*(need-Math.abs(dy))/2; a.y-=sg*k; b.y+=sg*k; } }
    }
    const before=this.list.length;
    this.list=this.list.filter(e=>!(e.state==='exit'&&(e.y<-this.size(e).dh||e.x<-300||e.x>W+300||e.t>8)));
    if(this.list.length!==before){ syncHud(); if(!this.active&&this.hunt){ if(this.hunt.caught) Note.show('Predation pressure','Eagles removed the more visible rabbits, allowing black, long-toothed rabbits to survive.'); this.hunt=null; } }
  },
  draw(){
    for(const e of this.list){
      const {dw,dh}=this.size(e), alt=clamp((e.gy-e.y)/700,0,1);
      ctx.fillStyle=`rgba(0,0,0,${0.38*(1-alt*0.75)})`; ell(ctx,e.x+22*e.s,e.gy+3,0.42*dw*(1-alt*0.45),0.06*dw*(1-alt*0.3)); ctx.fill();   // shadow on the ground
      ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(e.face*clamp(Math.atan2(e.vy,Math.abs(e.vx)),-0.9,0.9)*0.8);
      const spr=EagleSprites.get(e.face>0?'right':'left');
      if(spr){ const k=Math.floor(e.phase*spr.frames)%spr.frames; ctx.imageSmoothingQuality='high'; ctx.drawImage(spr.img,k*spr.fw,0,spr.fw,spr.fh,-dw/2,-dh/2,dw,dh); }
      else { ctx.scale(e.face,1); const f=Math.sin(e.phase*6.283); ctx.fillStyle='#f4f2ec'; ell(ctx,0,0,dw*0.2,dw*0.07); ctx.fill();   // simple stand-in until the GLB is ready
             ctx.beginPath(); ctx.moveTo(-dw*0.05,-dw*0.02); ctx.lineTo(-dw*0.22,-dw*(0.12+0.16*f)); ctx.lineTo(dw*0.06,-dw*0.02); ctx.fill(); }
      ctx.restore();
    }
  }
};

// ================= scene/Reproduction =================
// ONE reproduction event per click. Parents are chosen automatically (one living adult WHITE+LONG rabbit and one living adult BLACK+SHORT
// rabbit, random within each group, never two of the same phenotype), shown on a small genetics card, and ONE offspring is added to the
// existing population. The offspring's genotype is inherited: parent 1 (long-toothed) passes one allele per trait and so does parent 2
// (black); the long-tooth allele (L) comes from parent 1 and the black allele (B) from parent 2, so the offspring is B/b L/l and its
// phenotype - BLACK fur + LONG teeth - is derived from that genotype by GeneticsEngine. It is a new COMBINATION of existing heritable
// characteristics, not a new trait. Parents are held still while the card is shown; nothing else in the simulation is changed.
const Reproduction=(()=>{
  const $=id=>document.getElementById(id), up=s=>String(s).toUpperCase();
  const card=$('rcard'), tag=[$('rtag1'),$('rtag2')], nlab=$('rnew'), msgEl=$('rmsg');
  const T={card:0.6,s2:1.8,s3:2.8,s4:3.7,birth:4.2,hide:4.6,end:5.0}, LABEL_LIFE=3.4, log=[];
  let st=null, lab=null, msgT=0;
  const key=r=>{const p=r.phenotype;return p.furColor+'|'+p.toothLength;}, alive=r=>!!r&&!r.leaving&&world.entities.includes(r);
  const rnd=n=>Math.floor(world.rng()*n);
  function icon(fur,teeth,dir){   // small rabbit picture from the existing GLB sprites (or the legend-style swatch if they are not ready)
    const a=RabbitSprites.ready?RabbitSprites.get(fur,teeth,dir):null, box=document.createElement('div'); box.className='ricon';
    if(a){ const c=document.createElement('canvas'), w=Math.round(50*a.fw/a.fh*2); c.width=w; c.height=100; c.getContext('2d').drawImage(a.img,2*a.fw,0,a.fw,a.fh,0,0,w,100); box.appendChild(c); }
    else box.innerHTML=`<i class="sw ${fur}"></i> <i class="tooth ${teeth}"></i>`;
    return box;
  }
  function inherit(p1,p2){   // one allele per trait from each parent; the dominant allele each parent carries is the one transmitted here
    const take=(pair,want)=>pair.includes(want)?want:pair[rnd(pair.length)], srt=(pair,L)=>pair.slice().sort((a,b)=>(b===L.dominant)-(a===L.dominant));
    const g1={f:p1.dna.fur[rnd(2)],t:take(p1.dna.teeth,Alleles.teeth.dominant)}, g2={f:take(p2.dna.fur,Alleles.fur.dominant),t:p2.dna.teeth[rnd(2)]};
    return {gametes:[g1,g2],dna:{fur:srt([g1.f,g2.f],Alleles.fur),teeth:srt([g1.t,g2.t],Alleles.teeth)}};
  }
  function build(){
    const a=st.p1.phenotype, b=st.p2.phenotype, c=GeneticsEngine.express(st.dna), F=(x)=>up(x.furColor)+' FUR', Tt=(x)=>up(x.toothLength)+' TEETH';
    card.innerHTML=`
      <div class="rs st1"><div class="rt">Reproduction</div><div class="rrow">
        <div class="rp"><div class="ricon" data-i="1"></div><div class="rl">PARENT 1</div><div class="rv">${F(a)}</div><div class="rv">${Tt(a)}</div></div><div class="rx">×</div>
        <div class="rp"><div class="ricon" data-i="2"></div><div class="rl">PARENT 2</div><div class="rv">${F(b)}</div><div class="rv">${Tt(b)}</div></div></div></div>
      <div class="rs st2"><div class="rt">Hereditary information</div><div class="rg">
        <div></div><div class="rh">PARENT 1</div><div></div><div class="rh">PARENT 2</div>
        <div class="rk">FUR</div><span class="rchip l ${a.furColor}">${up(a.furColor)}</span><div class="rplus">+</div><span class="rchip r ${b.furColor}">${up(b.furColor)}</span>
        <div class="rk">TEETH</div><span class="rchip l">${up(a.toothLength)}</span><div class="rplus">+</div><span class="rchip r">${up(b.toothLength)}</span></div></div>
      <div class="rs st3"><div class="rt">Inherited characteristics</div><div class="rcols">
        <div class="rcol"><div class="rk">FUR</div><div class="rsrc">${up(a.furColor)} + ${up(b.furColor)}</div><div class="rarrow">↓</div><span class="rres ${c.furColor}">${up(c.furColor)}</span></div>
        <div class="rcol"><div class="rk">TEETH</div><div class="rsrc">${up(a.toothLength)} + ${up(b.toothLength)}</div><div class="rarrow">↓</div><span class="rres ${c.toothLength}">${up(c.toothLength)}</span></div></div>
        <div class="rnote">Dominant characteristics are expressed in the offspring</div></div>
      <div class="rs st4"><div class="rt">New offspring</div><div class="rneo"><div class="ricon" data-i="3"></div><div><div class="rbig">${F(c)}</div><div class="rbig">+ ${Tt(c)}</div></div></div>
        <div class="rflow">Variation → reproduction → combination → new phenotypic combination</div></div>`;
    for(const [i,node] of [[1,icon(a.furColor,a.toothLength,'right')],[2,icon(b.furColor,b.toothLength,'left')],[3,icon(c.furColor,c.toothLength,'right')]]){ const h=card.querySelector(`[data-i="${i}"]`); h.replaceWith(node); }
  }
  function message(){ msgEl.classList.add('on'); clearTimeout(msgT); msgT=setTimeout(()=>msgEl.classList.remove('on'),3200); }
  function birth(){
    const {p1,p2,dna}=st, ph=GeneticsEngine.express(dna), id=String(world.nextId++).padStart(3,'0');
    const x=clamp(p1.x+(world.rng()-0.5)*80,60,W-60), y=clamp(p1.y+(world.rng()-0.5)*30,GROUND_TOP+35,H-25);
    const child=new Rabbit(id,dna,x,y,world.rng,world.pickDirection(ph.furColor),[p1.id,p2.id]);
    child.grow=0.6; child.gen=Math.max(p1.gen||0,p2.gen||0)+1; child.born=world.time; world.add(child); st.child=child;
    nlab.querySelector('span').textContent=up(ph.furColor)+' FUR + '+up(ph.toothLength)+' TEETH'; nlab.classList.add('on'); lab={r:child,t:0};
    log.push({child:id,parents:[p1.id,p2.id],pdna:[JSON.parse(JSON.stringify(p1.dna)),JSON.parse(JSON.stringify(p2.dna))],gametes:st.gametes,cdna:JSON.parse(JSON.stringify(dna)),phenotype:ph});
    syncHud();
  }
  function release(){ for(const p of [st.p1,st.p2]) if(p) p.pressed=false; }
  function finish(){ release(); card.classList.remove('on'); st=null; for(const t of tag) t.style.opacity=0; syncHud(); }
  return {
    log, get state(){ return st; }, get active(){ return !!st; },
    start(){
      if(st||Eagles.active||GrassPressure.running) return false;
      const adults=world.rabbits.filter(r=>r.grow>=1&&!r.pressed), A=adults.filter(r=>key(r)==='white|long'), B=adults.filter(r=>key(r)==='black|short');
      if(!A.length||!B.length||world.rabbits.length>=MAX_RABBITS){
        msgEl.querySelector('span').textContent=(A.length&&B.length)?'The population limit has been reached.':'Suitable parental phenotypes are currently unavailable.'; message(); return false;
      }
      const p1=A[rnd(A.length)], p2=B[rnd(B.length)]; p1.pressed=p2.pressed=true;
      st={t:0,p1,p2,child:null,hid:false,stage:0,...inherit(p1,p2)}; build(); card.dataset.stage=0; syncHud(); return true;
    },
    cancel(){ if(st){ release(); card.classList.remove('on'); st=null; syncHud(); } for(const t of tag) t.style.opacity=0; nlab.classList.remove('on'); lab=null; },
    update(dt){
      if(lab){ lab.t+=dt; if(lab.t>LABEL_LIFE){ nlab.classList.remove('on'); lab=null; } }
      if(!st) return; st.t+=dt; const t=st.t; st.p1.pressed=st.p2.pressed=true;
      if(t>=T.card){ const n=t>=T.s4?4:t>=T.s3?3:t>=T.s2?2:1; if(n!==st.stage){ st.stage=n; card.dataset.stage=n; } if(!st.hid) card.classList.add('on'); }
      if(t>=T.birth&&!st.child) birth();
      if(t>=T.hide&&!st.hid){ st.hid=true; card.classList.remove('on'); }
      if(t>=T.end) finish();
    },
    draw(){   // rings, tags and connector lines in the environment (no change to rabbits themselves)
      const rc=cv.getBoundingClientRect(), k=rc.width/W, place=(el,x,y)=>{ const sx=Math.max(60,Math.min(innerWidth-60,rc.left+x*k)); el.style.transform=`translate(${sx}px,${rc.top+y*k}px) translate(-50%,-100%)`; };
      if(lab){ if(alive(lab.r)){ const c=rabbitCenter(lab.r); place(nlab,c.x,c.y-34*lab.r.scale); } else { nlab.classList.remove('on'); lab=null; } }
      if(!st){ return; }
      const t=st.t, fadeOut=st.hid?Math.max(0,1-(t-T.hide)/0.4):1, ringA=Math.min(1,t/0.8)*fadeOut, cardA=Math.max(0,Math.min(1,(t-0.5)/0.4))*fadeOut;
      const cr=card.getBoundingClientRect(), ax=(cr.left+cr.width/2-rc.left)/k, ay=(cr.bottom-rc.top)/k;
      [st.p1,st.p2].forEach((p,i)=>{
        if(!alive(p)){ tag[i].style.opacity=0; return; }
        const c=rabbitCenter(p), s=p.scale, fa=edgeFade(p.x);
        ctx.save();
        ctx.lineWidth=5/k; ctx.strokeStyle=`rgba(232,228,216,${0.14*ringA*fa})`; ell(ctx,c.x,c.y,40*s,30*s); ctx.stroke();       // soft glow
        ctx.lineWidth=1.6/k; ctx.strokeStyle=`rgba(232,228,216,${0.85*ringA*fa})`; ell(ctx,c.x,c.y,40*s,30*s); ctx.stroke();    // thin outline
        if(cardA>0){                                                                                                       // thin connector to the card
          const x0=c.x, y0=c.y-30*s; ctx.setLineDash([4/k,4/k]); ctx.lineWidth=1/k; ctx.strokeStyle=`rgba(232,228,216,${0.4*cardA*fa})`;
          ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(ax,ay); ctx.stroke(); ctx.setLineDash([]);
          if(t>=T.s2&&t<T.s3){ const u=Math.min(1,(t-T.s2)/0.9); ctx.fillStyle=`rgba(232,228,216,${0.9*fa})`; ell(ctx,x0+(ax-x0)*u,y0+(ay-y0)*u,2.6/k,2.6/k); ctx.fill(); }   // information travelling to the card
        }
        ctx.restore();
        place(tag[i],c.x,c.y-36*s); tag[i].style.opacity=ringA*fa;
      });
    }
  };
})();

const spawnBtn=document.getElementById('spawn'), countEl=document.getElementById('count'), grassBtn=document.getElementById('grass'), grassTxt=document.getElementById('gtxt'), resetBtn=document.getElementById('reset'), eagleBtn=document.getElementById('eagle'), eagleTxt=document.getElementById('etxt'), reproBtn=document.getElementById('repro');
let paused=false;   // Pause freezes every update (rabbits, eagles, events, growth); drawing continues
function syncHud(){
  const n=world.rabbits.length, full=n>=MAX_RABBITS, gp=GrassPressure;
  countEl.textContent=n+' rabbits'; spawnBtn.disabled=full||gp.running||paused; spawnBtn.textContent=full?'Max '+MAX_RABBITS:'+ 5 rabbits';
  grassTxt.textContent=gp.round===0?'Grass':gp.round===4?'Done':'Grass · '+gp.done+'/'+gp.total;
  grassBtn.disabled=gp.running||gp.round===4||Eagles.active||Reproduction.active||paused; grassBtn.classList.toggle('busy',gp.running);
  const nw=Eagles.whites().length; eagleBtn.disabled=Eagles.active||gp.running||nw===0||paused; eagleBtn.classList.toggle('busy',Eagles.active);
  reproBtn.disabled=Reproduction.active||Eagles.active||gp.running||paused; reproBtn.classList.toggle('busy',Reproduction.active);
  eagleTxt.textContent=Eagles.active?'Hunting…':'Eagles'; eagleBtn.title=nw===0?'No white rabbits left to hunt':'Eagle predation: eagles hunt the white rabbits';
}
eagleBtn.addEventListener('click',()=>Eagles.launch(4));
reproBtn.addEventListener('click',()=>Reproduction.start());
grassBtn.addEventListener('click',()=>GrassPressure.start());
resetBtn.addEventListener('click',()=>{ Note.hide(); Reproduction.cancel(); Eagles.list=[]; Eagles.pending=[]; GrassPressure.reset(); RabbitProfile.close(); world.reset(); Legend.last=''; Legend.gen=0; Trend.clear(); syncHud(); });
spawnBtn.addEventListener('click',()=>{ world.spawn(5); syncHud(); });
// ================= Full screen + keep the screen awake =================
// The full-screen button is hidden where the browser has no Fullscreen API (e.g. iPhone Safari). While the page is visible it asks the
// browser to keep the screen on (Screen Wake Lock: needs https; where it is unavailable nothing happens), so a classroom panel does not dim.
const FullScreen={
  btn:document.getElementById('fs'), root:document.documentElement,
  can(){ return !!(document.fullscreenEnabled||document.webkitFullscreenEnabled); },
  on(){ return !!(document.fullscreenElement||document.webkitFullscreenElement); },
  toggle(){
    try{
      const r=this.on()?(document.exitFullscreen||document.webkitExitFullscreen).call(document):(this.root.requestFullscreen||this.root.webkitRequestFullscreen).call(this.root);
      if(r&&r.catch) r.catch(()=>{});
    }catch(e){}
  },
  paint(){ const on=this.on(); this.btn.classList.toggle('on',on); this.btn.title=this.btn.ariaLabel=on?'Exit full screen':'Full screen'; },
  init(){
    if(!this.can()){ this.btn.hidden=true; return; }
    this.btn.addEventListener('click',()=>this.toggle());
    for(const ev of ['fullscreenchange','webkitfullscreenchange']) document.addEventListener(ev,()=>this.paint());
  }
};
FullScreen.init();
const Awake={
  lock:null, busy:false,
  async hold(){
    if(this.lock||this.busy||!('wakeLock' in navigator)||document.visibilityState!=='visible') return;
    this.busy=true;
    try{ this.lock=await navigator.wakeLock.request('screen'); this.lock.addEventListener('release',()=>{ this.lock=null; }); }catch(e){}
    this.busy=false;
  },
  init(){ addEventListener('pointerdown',()=>this.hold(),{passive:true}); document.addEventListener('visibilitychange',()=>this.hold()); }
};
Awake.init();

// ================= Save snapshot =================
// Downloads this very page with the current rabbit images stored in its "saved-images" block, so the images are still
// there after the file is uploaded (e.g. to GitHub Pages) and reopened. The page is rebuilt from the markup captured at start-up.
const Snapshot={
  json(){ return JSON.stringify(RabbitAssets.custom).replace(/</g,'\\u003c'); },
  html(){
    const head=document.head.cloneNode(true); head.querySelector('#saved-images').textContent=this.json();
    const mod=document.querySelector('script[type="module"]');
    return '<!DOCTYPE html>\n<html lang="en">\n'+head.outerHTML+'\n<body>'+PRISTINE_BODY+(mod?'\n'+mod.outerHTML:'')+'\n</body>\n</html>\n';
  },
  save(){
    try{
      const n=Object.keys(RabbitAssets.custom).length, url=URL.createObjectURL(new Blob([this.html()],{type:'text/html'}));
      const a=document.createElement('a'); a.href=url; a.download='index.html'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000);
      Note.show('Snapshot saved',n?'index.html downloaded with '+n+' phenotype image'+(n>1?'s':'')+'. Upload it to keep them.':'index.html downloaded. No images are set yet.');
    }catch(e){ Note.show('Snapshot failed','This viewer blocked the download. Open the page in a browser and try again.'); }
  }
};
document.getElementById('snap').addEventListener('click',()=>Snapshot.save());
const pauseBtn=document.getElementById('pause');
function setPaused(v){ paused=v; pauseBtn.setAttribute('aria-pressed',paused); pauseBtn.title=paused?'Resume':'Pause'; pauseBtn.setAttribute('aria-label',pauseBtn.title); syncHud(); }
pauseBtn.addEventListener('click',()=>setPaused(!paused));
syncHud();

// ================= ui/Legend =================
// Live count of the four phenotypes, derived from each rabbit's DNA via the genetics engine.
// Highlight: tap legend rows to emphasise those phenotypes (several rows = union); the rest fade to 25%. Display only.
const Highlight={
  keys:new Set(),
  matches(r){ if(!this.keys.size) return true; const ph=r.phenotype; return this.keys.has(ph.furColor+'-'+ph.toothLength); }
};
// Minimal rabbit FACE icon for a legend row: white or black fur, long or short front teeth (two incisors drawn on the face).
const RABBIT_SIL="M713 228 708 228 704 234 704 263 706 287 732 321 745 347 756 386 759 406 758 413 755 412 742 367 727 332 714 311 695 288 664 261 639 245 625 238 601 230 593 230 586 235 585 254 594 295 609 345 620 369 633 388 649 404 668 417 686 427 696 437 704 452 705 459 695 474 687 482 690 481 691 485 679 504 682 504 683 507 665 527 670 524 673 524 674 527 658 546 647 553 669 549 670 552 654 565 646 569 631 573 619 573 621 574 620 577 587 577 563 581 542 588 517 601 530 598 533 599 532 602 515 608 494 619 466 641 461 647 469 642 472 642 473 645 443 673 429 691 419 707 403 741 395 768 402 760 405 761 398 782 395 800 395 810 397 803 400 802 401 829 407 855 404 856 393 847 390 848 383 844 366 840 372 847 377 857 377 861 359 862 364 868 375 889 374 892 364 892 379 908 392 917 391 920 380 920 391 928 403 934 419 939 418 942 408 944 418 946 431 946 432 949 427 952 450 952 473 945 474 948 470 952 472 952 497 939 498 942 481 964 481 968 711 968 711 959 705 947 698 939 685 931 669 927 643 927 614 931 609 930 611 926 625 916 646 894 658 874 664 857 667 858 667 864 672 841 673 819 676 820 677 825 677 801 673 782 663 758 649 740 650 737 653 737 669 753 680 771 687 792 689 805 689 825 704 860 734 941 741 954 750 963 765 968 808 968 813 967 816 964 816 957 814 951 808 942 797 934 783 928 774 919 769 909 765 895 761 855 762 829 766 807 769 798 785 771 788 772 785 783 797 762 803 742 805 723 808 724 810 732 810 745 816 723 818 706 817 690 814 679 815 676 817 676 820 680 824 690 824 680 821 661 813 638 816 637 822 644 805 613 803 600 805 594 811 588 817 585 859 574 861 565 883 565 892 555 898 543 902 530 902 521 882 496 866 469 855 454 846 447 826 437 786 425 777 417 774 408 774 365 772 342 769 324 763 302 750 273 740 257 731 245ZM794 473 811 469 824 470 834 478 839 490 839 494 828 496 821 496 815 494 809 490 794 475ZM608 255 618 258 654 281 674 300 681 310 691 333 702 383 716 427 715 430 713 430 696 409 674 394 659 379 646 361 635 340 618 293 610 276 606 263 606 257Z";   // sitting-rabbit silhouette (traced from the supplied emblem); the fang is drawn separately so its length can vary
function legendIcon(fur,teeth){
  const white=fur==='white', T=teeth==='long'?650:598, m=(556+T)>>1, fill=white?'#f3f0e8':'#14130f';
  const disc=white?'<circle cx="625" cy="590" r="452" fill="none" stroke="#e9e6dc" stroke-width="18"/>':'<circle cx="625" cy="590" r="456" fill="#e9e6dc"/>';
  return `<svg class="ricn" viewBox="140 105 970 970" width="30" height="30" aria-hidden="true">${disc}<path fill="${fill}" fill-rule="evenodd" d="${RABBIT_SIL}"/><path fill="${fill}" d="M859 562L890 556C889 ${m} 880 ${T-16} 869 ${T}C862 ${T-14} 860 ${m} 859 580Z"/></svg>`;
}
const Legend={
  keys:[['black','long'],['black','short'],['white','long']], cells:{}, last:'', gen:0,
  init(){
    const box=document.getElementById('lrows');
    for(const [f,t] of this.keys){
      const row=document.createElement('button'); row.type='button'; row.className='lrow'; row.dataset.key=f+'-'+t; row.setAttribute('aria-pressed','false');
      row.innerHTML=`${legendIcon(f,t)}<span>${cap(f)} · ${cap(t)}</span><b>0</b>`;
      box.appendChild(row); this.cells[f+'-'+t]=row.lastChild;
    }
    box.addEventListener('click',e=>{ const b=e.target.closest('.lrow'); if(b) this.toggle(b.dataset.key); });
    document.getElementById('lclear').addEventListener('click',()=>this.clear());
  },
  toggle(k){ Highlight.keys.has(k)?Highlight.keys.delete(k):Highlight.keys.add(k); this.paint(); },
  clear(){ Highlight.keys.clear(); this.paint(); },
  paint(){
    Trend.draw();   // dims the lines of phenotypes that are not highlighted
    for(const row of document.querySelectorAll('#lrows .lrow')) row.setAttribute('aria-pressed',Highlight.keys.has(row.dataset.key));
    document.getElementById('lclear').hidden=!Highlight.keys.size;
  },
  sync(){   // touches the DOM only when a count changes
    const c={}; let n=0;
    for(const e of world.entities) if(e.type==='rabbit'&&!e.leaving){ const ph=e.phenotype, k=ph.furColor+'-'+ph.toothLength; c[k]=(c[k]||0)+1; n++; this.gen=Math.max(this.gen,e.gen||0); }
    const key=Object.keys(this.cells).map(k=>c[k]||0).join(',')+'|'+n+'|'+this.gen;
    if(key===this.last) return; this.last=key;
    document.getElementById('lgen').textContent='Generation '+this.gen+' — Population: '+n;
    for(const k in this.cells) this.cells[k].textContent=c[k]||0;
  }
};
Legend.init(); Legend.sync();

let last=0, simClock=0;
// ================= Trend graph =================
// Samples the living population twice a second of simulation time (so Pause freezes it) and draws either the phenotype counts or the
// B / L allele frequencies among the living rabbits' gene copies. G / E / R mark when the grass, eagle and reproduction events began.
const Trend={
  mode:'types', t:0, acc:0, every:0.5, rows:[], marks:[], prev:{G:false,E:false,R:false},
  TYPES:[['black-long','Black · long','#e0a840','7 3'],['black-short','Black · short','#7fa6d6','2 2'],['white-long','White · long','#f3f0e8','']],
  ALLELES:[['B','Allele B (black)','#b79cf2',''],['L','Allele L (long teeth)','#5fd0b0','6 3']],
  init(){
    this.cv=document.getElementById('tcv'); this.ctx=this.cv.getContext('2d'); this.body=document.getElementById('tbody'); this.key=document.getElementById('tkey');
    const col=document.getElementById('tcol'), setOpen=o=>{ this.body.hidden=!o; col.setAttribute('aria-expanded',o); if(o) this.draw(); };
    col.addEventListener('click',()=>setOpen(this.body.hidden));
    setOpen(innerHeight>500);   // short (landscape phone) screens start collapsed so the graph never covers the rabbits
    if(this.body.hidden===false&&matchMedia('(max-width:760px) and (orientation:portrait)').matches&&document.getElementById('trend').getBoundingClientRect().top<cv.getBoundingClientRect().bottom) setOpen(false);   // portrait phone too short for the card below the field
    for(const b of document.querySelectorAll('.tseg button')) b.addEventListener('click',()=>{ this.mode=b.dataset.m;
      for(const x of document.querySelectorAll('.tseg button')) x.setAttribute('aria-pressed',x===b); this.keyHtml(); this.draw(); });
    this.keyHtml(); this.clear();
  },
  keyHtml(){
    const L=this.mode==='types'?this.TYPES:this.ALLELES;
    this.key.innerHTML=L.map(l=>`<span><i style="border-top-style:${l[3]?(l[3].startsWith('2')?'dotted':'dashed'):'solid'};border-top-color:${l[2]}"></i>${l[1]}</span>`).join('')+'<span>G grass · E eagles · R repro</span>';
  },
  counts(){
    const R=world.rabbits.filter(r=>!r.leaving), c={'black-long':0,'black-short':0,'white-long':0}; let B=0,Lc=0;
    for(const r of R){ const k=r.phenotype.furColor+'-'+r.phenotype.toothLength; if(k in c) c[k]++;
      B+=r.dna.fur.filter(a=>a==='B').length; Lc+=r.dna.teeth.filter(a=>a==='L').length; }
    const n=R.length||1;
    return {v:this.TYPES.map(l=>c[l[0]]), a:[B/(2*n),Lc/(2*n)], n:R.length};
  },
  clear(){ this.t=0; this.acc=0; this.every=0.5; this.rows=[]; this.marks=[]; this.prev={G:false,E:false,R:false}; this.sample(); },
  sample(){ const c=this.counts(); this.rows.push({t:this.t,v:c.v,a:c.a});
    if(this.rows.length>600){ this.rows=this.rows.filter((_,i)=>i%2===0); this.every*=2; }
    this.cv.setAttribute('aria-label','Trend graph. Now: '+this.TYPES.map((l,i)=>l[1]+' '+c.v[i]).join(', ')+'. Allele B '+Math.round(c.a[0]*100)+'%, allele L '+Math.round(c.a[1]*100)+'%.');
    this.draw(); },
  step(dt){
    const now={G:GrassPressure.running,E:Eagles.active,R:Reproduction.active};
    for(const k in now){ if(now[k]&&!this.prev[k]) this.marks.push({t:this.t,k}); this.prev[k]=now[k]; }
    this.t+=dt; this.acc+=dt; if(this.acc>=this.every){ this.acc=0; this.sample(); }
  },
  draw(){
    if(this.body.hidden) return;
    const cv=this.cv, d=window.devicePixelRatio||1, W=150, H=92;
    if(cv.width!==Math.round(W*d)||cv.height!==Math.round(H*d)){ cv.width=Math.round(W*d); cv.height=Math.round(H*d); }
    const g=this.ctx; g.setTransform(d,0,0,d,0,0); g.clearRect(0,0,W,H);
    const x0=26,x1=W-4,y0=9,y1=H-17, types=this.mode==='types', R=this.rows, tmax=Math.max(60,this.t);
    let ymax=100; if(types){ let m=10; for(const r of R) for(const v of r.v) m=Math.max(m,v); ymax=Math.ceil(m/5)*5; }
    const X=t=>x0+(x1-x0)*t/tmax, Y=v=>y1-(y1-y0)*v/ymax;
    g.font='8px system-ui,sans-serif'; g.fillStyle='#8a8478'; g.strokeStyle='#3a352a'; g.lineWidth=1; g.textAlign='right'; g.textBaseline='middle';
    for(const f of [0,.5,1]){ const y=Y(ymax*f); g.setLineDash(f===0?[]:[2,3]); g.beginPath(); g.moveTo(x0,y); g.lineTo(x1,y); g.stroke(); g.fillText(types?String(Math.round(ymax*f)):Math.round(f*100)+'%',x0-3,y); }
    g.setLineDash([]); g.textAlign='center'; g.textBaseline='top'; const m=Math.round(tmax); g.fillText(m>=120?Math.round(m/60)+' min':m+' s',x1-8,y1+2);
    g.textBaseline='top'; g.strokeStyle='#5a5446';
    for(const mk of this.marks){ const x=X(mk.t); g.setLineDash([1,2]); g.beginPath(); g.moveTo(x,y0); g.lineTo(x,y1); g.stroke(); g.setLineDash([]); g.fillStyle='#cfc9b8'; g.fillText(mk.k,Math.min(x+3,x1-3),y0-7); }
    const hl=Highlight.keys, L=types?this.TYPES:this.ALLELES;
    L.forEach((l,i)=>{
      const dim=types&&hl.size&&!hl.has(l[0]);
      g.globalAlpha=dim?0.22:1; g.strokeStyle=l[2]; g.lineWidth=types&&hl.has(l[0])?2.4:1.6; g.lineJoin='round'; g.setLineDash(l[3]?l[3].split(' ').map(Number):[]);
      g.beginPath(); R.forEach((r,j)=>{ const v=types?r.v[i]:r.a[i]*100, x=X(r.t), y=Y(v); j?g.lineTo(x,y):g.moveTo(x,y); }); g.stroke();
      const e=R[R.length-1]; if(e){ g.setLineDash([]); g.fillStyle=l[2]; g.beginPath(); g.arc(X(e.t),Y(types?e.v[i]:e.a[i]*100),2,0,6.2832); g.fill(); }
    });
    g.globalAlpha=1; g.setLineDash([]);
  }
};

Trend.init();
// ================= Start-up gate =================
// The simulation waits (clock, rabbits, graph all frozen) until the 3D rabbit and eagle sprites are baked, so the rabbits are realistic
// from the very first moment instead of changing shape mid-run. If the models cannot load (no internet) it gives up after a few seconds
// and starts with the drawn rabbits, exactly as before; it never gets stuck.
const Boot=window.Boot={
  active:true, started:false, p:0, t0:performance.now(),
  el:document.getElementById('boot'), LOCK:['hud','legend','fs'],
  init(){ this.bar=this.el.querySelector('.bar i'); for(const id of this.LOCK) document.getElementById(id).inert=true; },
  set(f){ this.p=Math.max(this.p,Math.min(1,f)); this.bar.style.width=Math.round(this.p*100)+'%'; },
  finish(failed){
    if(!this.active) return; this.active=false; this.set(1);
    for(const id of this.LOCK) document.getElementById(id).inert=false;
    this.el.classList.add('done'); setTimeout(()=>{ this.el.hidden=true; },600);
    if(failed) Note.show('Simplified rabbits','The 3D rabbit models could not load, so drawn rabbits are shown. Check the internet connection and reload.');
  },
  check(){
    const age=performance.now()-this.t0, R=RabbitSprites, E=EagleSprites;
    const rd=R.ready||R.error, ed=E.ready||E.error;
    if(rd&&ed) return this.finish(!R.ready);
    if(!this.started&&(age>5000||(age>1500&&navigator.onLine===false))) return this.finish(true);   // the 3D library never started
    if(age>30000) this.finish(!R.ready);                                                            // safety net on a very slow device
  }
};
Boot.init();
function frame(ts){
  const dt0=Math.min(0.05,(ts-last)/1000||0); last=ts; if(Boot.active) Boot.check(); const dt=(paused||Boot.active)?0:dt0; simClock+=dt;   // paused: dt = 0 freezes every update
  world.update(dt); GrassPressure.update(dt); Eagles.update(dt); Reproduction.update(dt); RabbitProfile.sync(); Legend.sync(); Trend.step(dt); Sun.step(5,dt); render(simClock);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
