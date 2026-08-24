(function(){
'use strict';
if(!window.App)return;
const {SCREENS,state}=window.App;

const NOTES={
  hero:[
    'Lead with the 57-second number — Change Detected → Validated & Approved → Published.',
    'Emphasise: there is exactly ONE manual step — the human approval gate. Everything else is AI or automated.',
    'The workflow diagram maps each stage: AI-Assisted (detect), Human Review (approve), Automated (publish).',
  ],
  before:[
    'This is the actual Confluence page — KnowledgeHub › payment-service-technical-design.',
    'Section 3 shows @DecimalMin("100.00") — the value before the code change was merged.',
    'Ask: "How long would it take your team to notice this page is stale?"',
  ],
  change:[
    'One annotation changed. Shubham did not think about Confluence at all.',
    'Point out: no doc-update step in the workflow, no comment, no ticket.',
    'This is commit abc1234 on the development branch — the exact trigger.',
  ],
  pr:[
    'Standard GitHub PR — nothing added to the developer workflow.',
    'CI passes, security passes, approved. The merge event fires the webhook.',
    'Code2Doc is invisible to the developer — it is a side-effect of the push.',
  ],
  merge:[
    'Walk this timeline slowly — each timestamp is real and reproducible.',
    'Ask: "What are your developers doing during these 57 seconds?"',
    'The LLM call (Claude) is the only step that leaves the local network.',
  ],
  cicd:[
    'Code2Doc runs as a parallel concern — it never blocks CI or deployment.',
    'No new GitHub Actions workflow added — it hooks into the existing push event.',
    'Show that CD and Release are normal delivery gates, completely unchanged.',
  ],
  pipeline:[
    'Emphasise the Approval Gate — no documentation is published without human sign-off.',
    'Steps 1–6 (AI pipeline) run locally: only Claude step leaves the network.',
    'Steps 7–10 are human-controlled: the reviewer can edit, approve, or reject the draft.',
  ],
  after:[
    'Same Confluence URL as the "Before" screen — v12 → v13, Section 3 updated.',
    'The strikethrough shows exactly what changed. Full audit trail in SQLite.',
    'GitHub also got the commit to docs/ — two sources of truth, both current.',
  ],
  chat:[
    'This answers natural-language questions from always-current documentation.',
    'The knowledge base re-indexes on every pipeline run — never stale.',
    'Ask: "What would it mean for your ops team to query docs like this?"',
  ],
  impact:[
    'Focus on the audit trail row — compliance teams need this for SOC 2 / ISO 27001.',
    'ROI: 20 devs × 4.5 h/week × $75/hr = ~$270K/year in documentation overhead.',
    '"0% doc drift after 3 months" is the number that gets CFOs to engage.',
  ],
};

/* ── Styles ── */
const s=document.createElement('style');
s.textContent=`
#pres-drawer{
  position:fixed;bottom:var(--nav-h);left:0;right:0;
  height:160px;background:#111c30;border-top:2px solid var(--cyan);
  z-index:85;padding:14px 26px 10px;
  transform:translateY(100%);transition:transform .35s cubic-bezier(.22,1,.36,1);
}
#pres-drawer.show{transform:none}
body.present #pres-drawer{bottom:0}
#pres-hd{display:flex;align-items:center;gap:10px;margin-bottom:10px}
#pres-screen-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--cyan)}
#pres-next-label{font-size:11px;color:rgba(255,255,255,.3);margin-left:auto}
#pres-notes{display:flex;flex-direction:column;gap:4px}
.pn{font-size:12.5px;color:rgba(255,255,255,.78);padding-left:14px;position:relative;line-height:1.5}
.pn::before{content:'›';position:absolute;left:0;color:var(--cyan);font-weight:700}
#pres-hint{
  position:fixed;right:20px;font-size:10.5px;font-family:var(--mono);
  color:rgba(255,255,255,.3);z-index:86;background:#111c30;
  border:1px solid var(--navy-700);border-radius:5px;padding:3px 9px;
  bottom:calc(var(--nav-h) + 162px);display:none;
}
#pres-drawer.show~#pres-hint{display:block}
`;
document.head.appendChild(s);

/* ── DOM ── */
const drawer=document.createElement('div');
drawer.id='pres-drawer';
drawer.innerHTML=`
<div id="pres-hd">
  <span id="pres-screen-label"></span>
  <span id="pres-next-label"></span>
</div>
<div id="pres-notes"></div>`;
document.body.appendChild(drawer);

const hint=document.createElement('div');
hint.id='pres-hint';
hint.textContent='S · hide notes';
document.body.appendChild(hint);

/* ── Sync ── */
function syncNotes(i){
  const sc=SCREENS[i],next=SCREENS[i+1];
  const notes=sc?NOTES[sc.id]||[]:[];
  document.getElementById('pres-screen-label').textContent=sc?`Slide ${i+1} — ${sc.title}`:'';
  document.getElementById('pres-next-label').textContent=next?`Up next: ${next.title}`:'Last slide';
  document.getElementById('pres-notes').innerHTML=notes.map(n=>`<div class="pn">${n}</div>`).join('');
}

/* ── Toggle ── */
let shown=false;
function toggle(){
  shown=!shown;
  drawer.classList.toggle('show',shown);
  if(shown)syncNotes(state.current);
}
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.key==='s'||e.key==='S'){e.preventDefault();toggle();}
});

/* ── Follow navigation ── */
const obs=new MutationObserver(muts=>{
  for(const m of muts){
    if(m.attributeName==='class'&&m.target.classList.contains('screen')&&m.target.classList.contains('active')){
      if(shown)syncNotes(state.current);
    }
  }
});
document.querySelectorAll('.screen').forEach(el=>obs.observe(el,{attributes:true}));

})();
