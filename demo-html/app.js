(function(){
'use strict';

const SCREENS=[
  {id:'kmdash',  title:'KM Dashboard',      chapter:'Introduction'},
  {id:'hero',    title:'Overview',          chapter:'Introduction'},
  {id:'before',  title:'Current State',     chapter:'The Change'},
  {id:'change',  title:'Code Change',       chapter:'The Change'},
  {id:'pr',      title:'Pull Request',      chapter:'The Change'},
  {id:'merge',   title:'Merge',             chapter:'The Change'},
  {id:'cicd',    title:'CI/CD Pipeline',    chapter:'The Pipeline'},
  {id:'pipeline',title:'Review & Publish',  chapter:'The Pipeline'},
  {id:'after',   title:'Result',            chapter:'The Result'},
  {id:'chat',    title:'AI Assistant',      chapter:'The Result'},
  {id:'impact',  title:'Business Impact',   chapter:'The Impact'},
];

const state={current:0,presenting:false};

const $=id=>document.getElementById(id);
const fill=$('progress-fill'),chap=$('chapter-label'),
      ctr=$('screen-counter'),btnNext=$('btn-next'),
      btnBack=$('btn-back'),nav=$('sidebar-nav'),stage=$('stage');

/* ── SIDEBAR ── */
function buildNav(){
  const seen={};
  SCREENS.forEach((s,i)=>{
    if(!seen[s.chapter]){
      seen[s.chapter]=1;
      const lbl=document.createElement('div');
      lbl.className='nav-section-label';
      lbl.textContent=s.chapter;
      nav.appendChild(lbl);
    }
    const el=document.createElement('div');
    el.className='nav-item';
    el.dataset.i=i;
    el.innerHTML=`<span>${s.title}</span>`;
    el.addEventListener('click',()=>go(i));
    nav.appendChild(el);
  });
}
function syncNav(i){
  nav.querySelectorAll('.nav-item').forEach(el=>{
    el.classList.toggle('active',+el.dataset.i===i);
  });
}

/* ── PROGRESS ── */
function syncProgress(i){
  fill.style.transform=`scaleX(${(i+1)/SCREENS.length})`;
  chap.textContent=SCREENS[i].chapter;
  ctr.textContent=`${i+1} / ${SCREENS.length}`;
  btnBack.disabled=i===0;
  btnNext.textContent=i===SCREENS.length-1?'Finish ✓':'Next →';
}

/* ── ROUTER ── */
function go(next){
  if(next<0||next>=SCREENS.length)return;
  const prev=state.current;
  const fromEl=stage.querySelector('.screen.active');
  const toEl=stage.querySelector(`[data-id="${SCREENS[next].id}"]`);
  if(fromEl===toEl)return;

  const dir=next>=prev?1:-1;
  toEl.style.transform=`translateX(${dir*32}px)`;
  toEl.style.transition='none';

  if(fromEl){
    fromEl.classList.add('exit-left');
    fromEl.classList.remove('active');
    setTimeout(()=>fromEl.classList.remove('exit-left'),300);
  }

  requestAnimationFrame(()=>{
    toEl.style.transition='';
    toEl.classList.add('active');
    toEl.style.transform='';
  });

  state.current=next;
  syncProgress(next);
  syncNav(next);
  Hooks.enter(SCREENS[next].id);
}

/* ── SCREEN HOOKS ── */
const Hooks={
  enter(id){
    const fn=this[id];
    if(fn)fn();
  }
};

/* ── KEYBOARD ── */
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();go(state.current+1);}
  if(e.key==='ArrowLeft'){e.preventDefault();go(state.current-1);}
  if(e.key==='f'||e.key==='F')togglePresent();
  if(e.key==='Escape'&&state.presenting)togglePresent();
});

/* ── BUTTONS ── */
btnNext.addEventListener('click',()=>go(state.current+1));
btnBack.addEventListener('click',()=>go(state.current-1));

function togglePresent(){
  state.presenting=!state.presenting;
  document.body.classList.toggle('present',state.presenting);
  if(state.presenting)document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}
$('btn-present').addEventListener('click',togglePresent);

/* ── PLACEHOLDER CONTENT ── */
function seedPlaceholders(){
  SCREENS.forEach(s=>{
    const el=stage.querySelector(`[data-id="${s.id}"]`);
    if(!el.children.length){
      el.innerHTML=`<div class="screen-placeholder">
        <h2>${s.title}</h2>
        <p>Chapter: ${s.chapter}</p>
      </div>`;
    }
  });
}

/* ── INIT ── */
buildNav();
seedPlaceholders();
go(0);

/* Export for other modules */
window.App={go,Hooks,SCREENS,state};

})();
