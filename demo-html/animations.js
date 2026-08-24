(function(){
'use strict';
if(!window.App)return;
const {SCREENS,state}=window.App;

const s=document.createElement('style');
s.textContent=`
.si>*{opacity:0}
@keyframes fade-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.si.entered>*:nth-child(1){animation:fade-up .42s ease both .04s}
.si.entered>*:nth-child(2){animation:fade-up .42s ease both .10s}
.si.entered>*:nth-child(3){animation:fade-up .42s ease both .17s}
.si.entered>*:nth-child(4){animation:fade-up .42s ease both .23s}
.si.entered>*:nth-child(5){animation:fade-up .42s ease both .29s}
.si.entered>*:nth-child(n+6){animation:fade-up .42s ease both .34s}

#chap-banner{
  position:fixed;top:var(--topbar-h);left:var(--sidebar-w);right:0;height:32px;
  background:linear-gradient(90deg,var(--brand) 0%,var(--cyan) 60%,rgba(6,182,212,.7) 100%);
  display:flex;align-items:center;justify-content:center;
  font-size:10.5px;font-weight:700;color:#fff;letter-spacing:.14em;text-transform:uppercase;
  z-index:80;pointer-events:none;
  transform:translateY(-32px);transition:transform .38s cubic-bezier(.22,1,.36,1);
  box-shadow:0 2px 12px rgba(59,130,246,.3);
}
#chap-banner.show{transform:none}
body.present #chap-banner{left:0}
@media(max-width:900px){#chap-banner{left:var(--sidebar-c)}}

#progress-fill{box-shadow:0 0 10px rgba(59,130,246,.5)}

#kb-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:300;
  display:flex;align-items:center;justify-content:center;
  opacity:0;pointer-events:none;transition:opacity .22s;
}
#kb-overlay.show{opacity:1;pointer-events:auto}
#kb-panel{
  background:var(--white);border-radius:14px;padding:24px 28px;
  min-width:310px;box-shadow:0 24px 72px rgba(0,0,0,.22);
}
.kb-title{font-size:15px;font-weight:700;color:var(--gray-900);margin-bottom:14px}
.kb-row{
  display:flex;justify-content:space-between;align-items:center;
  padding:7px 0;border-bottom:1px solid var(--gray-100);
  font-size:13px;color:var(--gray-700);
}
.kb-row:last-child{border-bottom:none}
.kb-key{
  background:var(--gray-100);border:1px solid var(--gray-200);border-radius:4px;
  padding:2px 7px;font-family:var(--mono);font-size:11px;color:var(--gray-700);
  margin-left:4px;display:inline-block;
}
.nav-item{transition:background var(--t),color var(--t),padding-left .15s}
.nav-item:hover:not(.active){padding-left:15px}
#topbar-meta{font-size:12px;color:var(--gray-400);font-family:var(--mono);margin-left:auto;margin-right:8px}
#btn-next.done{background:var(--pass);border-color:var(--pass)}
#btn-next.done:hover{background:#16a34a;border-color:#16a34a}
`;
document.head.appendChild(s);

/* ── Chapter banner ── */
const banner=document.createElement('div');
banner.id='chap-banner';
document.body.appendChild(banner);
let prevChap='',bannerT=0;
function showBanner(chapter){
  if(chapter===prevChap)return;
  prevChap=chapter;
  banner.textContent=chapter;
  banner.classList.add('show');
  clearTimeout(bannerT);
  bannerT=setTimeout(()=>banner.classList.remove('show'),2000);
}

/* ── Entrance animation ── */
function enterScreen(el){
  const si=el&&el.querySelector('.si');
  if(!si)return;
  si.classList.remove('entered');
  requestAnimationFrame(()=>requestAnimationFrame(()=>si.classList.add('entered')));
  el.scrollTop=0;
}

/* ── MutationObserver ── */
const obs=new MutationObserver(muts=>{
  for(const m of muts){
    const t=m.target;
    if(m.attributeName==='class'&&t.classList.contains('screen')&&t.classList.contains('active')){
      enterScreen(t);
      const sc=SCREENS.find(s=>s.id===t.dataset.id);
      if(sc)showBanner(sc.chapter);
    }
  }
});
document.querySelectorAll('.screen').forEach(el=>obs.observe(el,{attributes:true}));

/* ── Topbar meta ── */
const meta=document.createElement('span');
meta.id='topbar-meta';
document.getElementById('topbar').insertBefore(meta,document.querySelector('.topbar-actions'));
function syncMeta(i){
  const sc=SCREENS[i];
  meta.textContent=sc?`${i+1}/${SCREENS.length} · ${sc.chapter}`:'';
  const btn=document.getElementById('btn-next');
  if(btn)btn.classList.toggle('done',i===SCREENS.length-1);
}
const progObs=new MutationObserver(()=>syncMeta(state.current));
const fill=document.getElementById('progress-fill');
if(fill)progObs.observe(fill,{attributes:true,attributeFilter:['style']});

/* ── Keyboard shortcut overlay ── */
const kbOv=document.createElement('div');
kbOv.id='kb-overlay';
kbOv.innerHTML=`<div id="kb-panel">
<div class="kb-title">Keyboard Shortcuts</div>
${[
  ['Next slide','→ or Space'],
  ['Previous slide','←'],
  ['Jump to screen 1–9','1 … 9'],
  ['Presentation mode','F'],
  ['Presenter notes','S'],
  ['Auto-play (4s)','P'],
  ['This overlay','?'],
].map(([a,k])=>`<div class="kb-row"><span>${a}</span><span>${
  k.split('or').map(c=>`<kbd class="kb-key">${c.trim()}</kbd>`).join('')
}</span></div>`).join('')}
</div>`;
document.body.appendChild(kbOv);
kbOv.addEventListener('click',e=>{if(e.target===kbOv)kbOv.classList.remove('show');});

document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.key==='?'){e.preventDefault();kbOv.classList.toggle('show');return;}
  if(e.key==='Escape'){kbOv.classList.remove('show');return;}
  const n=parseInt(e.key,10);
  if(!isNaN(n)&&n>=1&&n<=9&&!e.ctrlKey&&!e.metaKey&&!e.altKey)window.App.go(n-1);
});

/* ── Auto-play ── */
let autoTimer=0,autoActive=false;
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.key==='p'||e.key==='P'){
    autoActive=!autoActive;
    if(autoActive){
      autoTimer=setInterval(()=>{
        const next=state.current+1;
        if(next>=SCREENS.length){clearInterval(autoTimer);autoActive=false;return;}
        window.App.go(next);
      },4000);
      banner.textContent='▶ Auto-play';banner.classList.add('show');
      setTimeout(()=>banner.classList.remove('show'),1200);
    }else{
      clearInterval(autoTimer);
      banner.textContent='■ Paused';banner.classList.add('show');
      setTimeout(()=>banner.classList.remove('show'),1000);
    }
  }
});

/* ── Init ── */
setTimeout(()=>{
  const active=document.querySelector('.screen.active');
  if(active)enterScreen(active);
  syncMeta(state.current);
  showBanner(SCREENS[state.current]?.chapter||'');
},90);

})();
