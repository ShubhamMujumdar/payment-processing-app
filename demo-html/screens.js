(function(){
'use strict';
if(!window.App)return;
const {Hooks,SCREENS,state}=window.App;
const Q=id=>document.querySelector(`[data-id="${id}"]`);
function set(id,html){const el=Q(id);if(el)el.innerHTML=`<div class="si">${html}</div>`;}
const lbl=t=>`<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--brand);margin-bottom:8px">${t}</div>`;
const h1=t=>`<div style="font-size:26px;font-weight:800;color:var(--gray-900);line-height:1.25;margin-bottom:8px">${t}</div>`;
const sub=t=>`<div style="font-size:13.5px;color:var(--gray-600);max-width:600px;line-height:1.65;margin-bottom:22px">${t}</div>`;
const kpi=(v,c,l)=>`<div style="flex:1;background:var(--white);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px"><div style="font-size:28px;font-weight:700;color:${c};font-family:var(--mono);line-height:1">${v}</div><div style="font-size:12px;color:var(--gray-500);margin-top:4px">${l}</div></div>`;
const tag=(c,bg,t)=>`<span style="background:${bg};color:${c};padding:2px 8px;border-radius:100px;font-size:11px;font-weight:600">${t}</span>`;

/* ── Introduction / Overview ── */
Hooks.hero=()=>set('hero',`
${lbl('Code2Doc · AI Documentation Automation')}
${h1('Documentation that writes itself.')}
${sub('A developer lowered the minimum payment threshold from $100 to $50. Sixty seconds later, Confluence was updated, GitHub got the commit, and the ops team got the email. Nobody wrote a word of documentation.')}
<div style="display:flex;gap:12px;margin:0 0 26px">
${kpi('57s','var(--brand)','Change Detected → Approved → Published')}
${kpi('1','var(--warn)','Manual step — human approval only')}
${kpi('10','var(--brand)','AI + review stages')}
${kpi('100%','var(--pass)','Local AI — data stays private')}
</div>
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--gray-500);margin-bottom:12px">Workflow — How a code change becomes a documentation update</div>
<div style="display:flex;align-items:stretch;gap:0;margin-bottom:16px;border-radius:10px;overflow:hidden;border:1px solid var(--gray-200)">
<div style="flex:1;padding:14px 12px;background:var(--brand-bg);text-align:center">
<div style="font-size:12px;font-weight:700;color:var(--brand);margin-bottom:6px">Change Detected</div>
<div style="font-size:11px;color:var(--gray-600);margin-bottom:8px;line-height:1.45">AI analyzes code &amp; document changes, identifies impact scope</div>
<span style="font-size:10px;background:rgba(20,52,203,.1);color:var(--brand);border-radius:100px;padding:3px 9px;font-weight:600">AI-Assisted</span>
</div>
<div style="display:flex;align-items:center;padding:0 10px;background:var(--gray-50);color:var(--gray-400);font-size:18px;font-weight:700;flex-shrink:0">→</div>
<div style="flex:1;padding:14px 12px;background:rgba(247,182,0,.04);text-align:center;position:relative;border-left:2px solid rgba(247,182,0,.4);border-right:2px solid rgba(247,182,0,.4)">
<div style="position:absolute;top:0;left:50%;transform:translateX(-50%);background:var(--warn);color:#fff;font-size:9px;font-weight:700;padding:2px 10px;border-radius:0 0 6px 6px;letter-spacing:.06em;white-space:nowrap">ONLY MANUAL STEP</div>
<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px;margin-top:12px">Validated &amp; Approved</div>
<div style="font-size:11px;color:var(--gray-600);margin-bottom:8px;line-height:1.45">SME / Reviewer validates AI recommendations, edits or approves draft</div>
<span style="font-size:10px;background:rgba(247,182,0,.15);color:#92400e;border-radius:100px;padding:3px 9px;font-weight:600">Human Review</span>
</div>
<div style="display:flex;align-items:center;padding:0 10px;background:var(--gray-50);color:var(--gray-400);font-size:18px;font-weight:700;flex-shrink:0">→</div>
<div style="flex:1;padding:14px 12px;background:rgba(34,197,94,.04);text-align:center">
<div style="font-size:12px;font-weight:700;color:#16a34a;margin-bottom:6px">Published</div>
<div style="font-size:11px;color:var(--gray-600);margin-bottom:8px;line-height:1.45">Approved updates pushed to Confluence, GitHub committed, ops notified</div>
<span style="font-size:10px;background:rgba(34,197,94,.1);color:var(--pass);border-radius:100px;padding:3px 9px;font-weight:600">Automated</span>
</div>
</div>
<div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--gray-100)">
<span style="font-size:13px;color:var(--gray-500)">Press <strong style="font-family:var(--mono)">→</strong> to walk through the story.</span>
<span style="font-size:11px;font-weight:600;color:var(--pass);padding:4px 10px;border:1px solid rgba(34,197,94,.3);border-radius:6px">● Live demo</span>
</div>
`);

/* ── KM Role-Based KPI Dashboard ── */
Hooks.kmdash=(function(){
var _ar='';
var kd={"Executive / Product Leadership":{d:"For Product Managers, Product Leadership and Solution Managers focused on value, readiness, adoption and coverage.",s:82,p:"Priority: increase release documentation readiness",t:["KM-01","KM-03","KM-04","KM-05","KM-10","KM-12","KM-17","KM-18"],k:[["Knowledge Coverage","86%","+6% vs last month",86,"up","Products/services with complete docs"],["Freshness Compliance","78%","-4% risk",78,"down","Pages reviewed within SLA"],["AI Update Adoption","64%","+12% uplift",64,"up","AI drafts accepted by authors"],["Search Success","91%","+3%",91,"up","Answers found without escalation"],["Release Readiness","73%","7 launches at risk",73,"flat","Releases with linked current docs"],["Teams Decisions Captured","128","+21 decisions",72,"up","Decisions/actions persisted"],["Knowledge Graph Coverage","69%","+9%",69,"up","Services mapped to docs/code/incidents"],["Top Knowledge Gaps","24","Needs triage",58,"flat","Open gaps from requests/search misses"]],w:[["Stale product documentation in payment authorization stream","Risk"],["7 launch workstreams missing approved runbooks","Warn"],["High search volume for settlement flows indicates demand","Good"],["AI-assisted updates pending author approval","Warn"]],tr:[68,72,74,77,80,82],i:[["410h","Estimated SME time saved"],["18%","Lower documentation cycle variance"],["34","New graph relationships"]]},"Developer / Architect":{d:"For Developers, Architects and Engineers focused on code-to-doc automation, API quality and technical discovery.",s:76,p:"Priority: reduce PR-to-doc lag",t:["KM-03","KM-04","KM-07","KM-10","KM-12","KM-15","KM-18"],k:[["PR-to-Doc Automation","71%","+14%",71,"up","Merged PRs generating doc suggestions"],["Documentation Lag","2.8d","Target <2d",62,"down","Merge to approved update"],["API Doc Completeness","84%","+5%",84,"up","APIs with current docs"],["Chat with Document Usage","1.9k","+22%",78,"up","Natural language queries"],["CI/CD Doc Compliance","68%","Needs lift",68,"flat","Releases linked to notes"],["Broken Link Rate","3.7%","-1.1%",86,"up","Broken links across pages"],["Reusable Asset Discovery","59%","+8%",59,"up","Component reuse via graph"],["Tech Debt Doc Score","72%","Stable",72,"flat","Code-doc consistency health"]],w:[["12 merged PRs have unapproved AI doc suggestions","Warn"],["Checkout API docs have high chat query volume","Good"],["CI/CD release notes missing for 5 builds","Risk"],["Knowledge graph missing topology for 3 services","Warn"]],tr:[54,59,63,67,72,76],i:[["2.8d","Current documentation lag"],["1.9k","Doc chat queries"],["12","Pending PR-driven updates"]]},"Program / Project Manager":{d:"For Program and Project Managers focused on delivery readiness, approval throughput, actions and SLA visibility.",s:79,p:"Priority: unblock approval bottlenecks",t:["KM-05","KM-06","KM-08","KM-12","KM-15","KM-17"],k:[["Documentation Completion","81%","+7%",81,"up","Project artifacts completed"],["Open Content Requests","46","9 overdue",64,"flat","Reader/team requests"],["Approval Cycle Time","3.4d","Target 2d",58,"down","Draft to publish"],["SLA Compliance","88%","+2%",88,"up","Reviews and approvals on time"],["Action Items Captured","93","+18",77,"up","Teams actions persisted"],["Decision Traceability","74%","+6%",74,"up","Decisions linked to docs/releases"],["Release Doc Readiness","69%","Risk",69,"flat","Projects with approved release docs"],["Project KM Health","79%","Stable",79,"flat","Composite delivery confidence"]],w:[["Two programs have overdue content requests","Risk"],["Approval queue concentrated with 4 reviewers","Warn"],["Release readiness improved for digital onboarding","Good"],["Decisions not linked for 3 steering meetings","Warn"]],tr:[65,68,72,74,78,79],i:[["46","Open content requests"],["3.4d","Approval cycle time"],["93","Captured actions"]]},"Product Ops / Business Ops":{d:"For Product Ops and Business Ops focused on adoption, self-service, templates and operating cadence.",s:84,p:"Priority: convert search misses into content backlog",t:["KM-06","KM-07","KM-10","KM-12","KM-19"],k:[["Monthly Active KM Users","5.8k","+16%",88,"up","Active consumers/authors"],["Self-Service Rate","82%","+5%",82,"up","Questions resolved without SME"],["Search Abandonment","7.4%","-2.1%",84,"up","Searches without useful click"],["Article Engagement","4.6/5","+0.2",92,"up","Views, likes, feedback"],["Template Adoption","61%","+10%",61,"up","Use of standard templates"],["Lifecycle Compliance","79%","Stable",79,"flat","Review/expiry governance"],["Missing Content Signals","39","Needs backlog",61,"flat","Demand-led gaps"],["Productivity Saved","520h","+90h",86,"up","Estimated time saved"]],w:[["High abandonment on dispute handling queries","Warn"],["Runbook template adoption growing in ops teams","Good"],["39 gap signals need product owner routing","Warn"],["Knowledge self-service above target for onboarding","Good"]],tr:[70,73,75,79,82,84],i:[["82%","Self-service rate"],["520h","Productivity saved"],["39","Missing content signals"]]},"KM Admin / Space Admin":{d:"For KM administrators and space admins managing connector health, approvals, auditability, permissions and freshness.",s:73,p:"Priority: fix failed connector syncs",t:["KM-05","KM-08","KM-09","KM-11","KM-12","KM-13","KM-16"],k:[["Connector Health","87%","3 degraded",87,"flat","GitHub, ServiceNow, SharePoint, Teams"],["Failed Syncs","31","+8",54,"down","Connector failures"],["Pending Approvals","112","Aging queue",52,"down","Suggestions awaiting review"],["Audit Completeness","96%","+1%",96,"up","Actor/time/state trails"],["Permission Exceptions","14","Needs review",66,"flat","Potential page-level issues"],["Stale Content Count","286","-22",72,"up","Outdated pages"],["Expiry Forecast","74","Next 30 days",63,"flat","Pages nearing expiry"],["Credential Rotation","91%","Healthy",91,"up","Connectors within policy"]],w:[["ServiceNow connector experiencing intermittent sync failures","Risk"],["112 approvals pending across 9 spaces","Warn"],["14 permission exceptions require review","Warn"],["Audit trail completeness remains strong","Good"]],tr:[69,71,74,72,75,73],i:[["31","Failed syncs"],["96%","Audit completeness"],["286","Stale pages"]]},"Legal / Risk / Compliance":{d:"For Legal, Risk and Compliance focused on evidence traceability, restricted content, audit and regulatory freshness.",s:80,p:"Priority: close restricted-page exceptions",t:["KM-08","KM-09","KM-12","KM-18"],k:[["Audit Trail Completeness","97%","+1%",97,"up","Evidence of changes/approvals"],["Restricted Page Violations","6","Needs action",55,"down","Unauthorized access attempts"],["Policy Freshness","83%","+4%",83,"up","Policies reviewed within SLA"],["Regulatory Coverage","76%","Stable",76,"flat","Required artifacts available"],["Evidence Traceability","81%","+7%",81,"up","Docs linked to approvals/incidents"],["Approval Compliance","89%","+2%",89,"up","Required reviewers completed"],["Sensitive Exposure Risk","Medium","6 findings",62,"flat","Combined permission/content risk"],["Exception Closure Time","4.1d","Target 3d",58,"down","Risk item closure speed"]],w:[["6 restricted page violations require investigation","Risk"],["Evidence traceability improving through graph links","Good"],["Regulatory artifacts need update for 4 products","Warn"],["Approval compliance above baseline","Good"]],tr:[72,74,77,78,79,80],i:[["97%","Audit completeness"],["6","Restrictions breached"],["81%","Evidence traceability"]]},"Marketing / Commercialization":{d:"For Product Marketing and Commercialization focused on launch readiness, playbooks, GTM assets and partner enablement.",s:77,p:"Priority: improve launch playbook readiness",t:["KM-01","KM-10","KM-12","KM-19"],k:[["Launch Content Readiness","72%","8 gaps",72,"flat","Assets ready for launch"],["Product Assets Published","148","+19",84,"up","Approved GTM assets"],["Sales Playbook Adoption","63%","+11%",63,"up","Playbook consumption"],["Template Usage","68%","+9%",68,"up","Standard artifact templates"],["Product Info Searches","2.4k","+26%",82,"up","Demand for product details"],["Missing Product Content","27","Backlog",59,"flat","Unanswered searches/requests"],["Time to Publish","2.6d","Target 2d",66,"down","Draft to approved asset"],["Partner Coverage","74%","+4%",74,"up","Partner-facing content coverage"]],w:[["8 launch content gaps for upcoming releases","Warn"],["High search demand for pricing and packaging","Good"],["27 missing-content signals need GTM backlog routing","Warn"],["Sales playbook adoption trending upward","Good"]],tr:[60,64,69,71,74,77],i:[["148","Assets published"],["2.4k","Product info searches"],["27","Missing content signals"]]},"AI & Knowledge Intelligence":{d:"Demo-friendly differentiator view for AI updates, PR-to-doc automation, Teams decision capture and graph growth.",s:85,p:"Priority: scale AI acceptance with human approval",t:["KM-03","KM-04","KM-05","KM-07","KM-12","KM-17","KM-18"],k:[["AI Draft Acceptance","67%","+15%",67,"up","AI suggestions approved"],["AI Draft Rejection","11%","-3%",89,"up","Rejected suggestions"],["Suggestion Accuracy","82%","+8%",82,"up","Author-rated precision"],["PR-to-Doc Automation","74%","+16%",74,"up","Code changes producing drafts"],["Teams Extraction Accuracy","79%","+10%",79,"up","Decisions/actions captured"],["Graph Growth","1.3k","+210",86,"up","New graph nodes/edges"],["Hours Saved by AI","690h","+140h",91,"up","Estimated effort avoided"],["Freshness Improvement","23%","+6%",83,"up","Reduction in stale content"]],w:[["Human approval remains the critical path for AI scale","Warn"],["PR-to-doc automation is demo-ready for hero journey","Good"],["Teams extraction accuracy needs tuning for decisions","Warn"],["Knowledge graph growth accelerating discovery","Good"]],tr:[61,68,73,78,82,85],i:[["690h","AI hours saved"],["1.3k","Graph growth"],["67%","AI acceptance"]]}};
function kmLoad(r,btn){
  _ar=r;
  document.querySelectorAll('#km-tabs .tab').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  var d=kd[r],el=function(id){return document.getElementById(id);};
  el('km-role').textContent=r;
  el('km-desc').textContent=d.d;
  el('km-score').textContent=d.s;
  el('km-ring').style.setProperty('--v',d.s);
  el('km-priority').textContent=d.p;
  el('km-tags').innerHTML=d.t.map(function(x){return'<span>'+x+'</span>';}).join('');
  el('km-cards').innerHTML=d.k.map(function(k){return'<div class="card"><div class="name">'+k[0]+'</div><div class="value">'+k[1]+'</div><div class="delta '+k[4]+'">'+k[2]+'</div><div class="bar" style="--w:'+k[3]+'%"><i></i></div><div class="meta">'+k[5]+'</div></div>';}).join('');
  el('km-watch').innerHTML=d.w.map(function(w){return'<div class="row"><div><b>'+w[0]+'</b><br><span>Recommended action: review in role cockpit</span></div><div class="status '+w[1]+'">'+w[1]+'</div></div>';}).join('');
  el('km-chart').innerHTML=d.tr.map(function(v,i){return'<div class="col"><i style="--h:'+(v*2)+'px"></i>P'+(i+1)+'</div>';}).join('');
  var cells=[1,1,2,1,3,2,1,2,3,4,2,1,3,2,1,2,3,5,4,2,1];
  el('km-heat').innerHTML=cells.map(function(c,i){return'<div class="cell c'+c+'">'+(i+1)+'</div>';}).join('');
  el('km-insights').innerHTML=d.i.map(function(x){return'<div class="insight"><b>'+x[0]+'</b><span>'+x[1]+'</span></div>';}).join('');
}
return function(){
  var el=Q('kmdash');if(!el)return;
  el.innerHTML='<div class="km-dash"><header><div class="eyebrow">Knowledge Management Platform</div><div class="title">Role-Based KPI Dashboard</div><div class="sub">Switch personas to view role-specific KPI tiles, dummy current state, watchlist, trends, freshness and business signals mapped to KM-01 through KM-19.</div></header><nav class="tabs" id="km-tabs"></nav><main><section class="hero"><div class="panel"><h2 id="km-role"></h2><div class="desc" id="km-desc"></div><div class="tags" id="km-tags"></div></div><div class="panel scorebox"><div class="ring" id="km-ring"><b id="km-score"></b></div><div><h3>Knowledge Health Score</h3><div class="desc">Composite of adoption, freshness, automation, governance and business value.</div><span class="pill" id="km-priority"></span></div></div></section><section class="grid" id="km-cards"></section><section class="two"><div class="panel"><h3>High-Priority Watchlist</h3><div id="km-watch"></div></div><div class="panel"><h3>Monthly KPI Trend</h3><div class="chart" id="km-chart"></div></div></section><section class="two"><div class="panel"><h3>Knowledge Freshness Heatmap</h3><div class="heat" id="km-heat"></div></div><div class="panel"><h3>Business / Platform Signals</h3><div class="insights" id="km-insights"></div></div></section><div class="foot">Dummy values only. Actual implementation should source telemetry from KM platform events, GitHub/Jenkins, Teams decision capture, ServiceNow, SharePoint/OneDrive ingestion, audit history and the knowledge graph.</div></main></div>';
  var tabs=document.getElementById('km-tabs');
  Object.keys(kd).forEach(function(r,n){
    var btn=document.createElement('button');
    btn.className='tab'+(r===_ar||(!_ar&&n===0)?' active':'');
    btn.textContent=r;
    btn.onclick=function(){kmLoad(r,btn);};
    tabs.appendChild(btn);
    if(btn.classList.contains('active'))kmLoad(r,btn);
  });
};
})();

Hooks.before=()=>set('before',`
${lbl('Current State · Before the Fix')}
${h1('The docs are wrong. Nobody knows yet.')}
${sub('<em>payment-service-technical-design</em> was last updated 3 months ago. Section 3 still says the minimum is $100.')}
<div style="background:var(--white);border:1px solid var(--gray-200);border-radius:10px;overflow:hidden">
<div style="background:#0052cc;padding:8px 14px;display:flex;align-items:center;gap:10px"><span style="color:#fff;font-size:13px;font-weight:700">Confluence</span><span style="color:rgba(255,255,255,.55);font-size:11px">KnowledgeHub › payment-service-technical-design</span><span style="margin-left:auto;background:rgba(255,255,255,.12);color:rgba(255,255,255,.7);font-size:10px;padding:2px 8px;border-radius:4px;font-family:var(--mono)">v12 · edited 3mo ago</span></div>
<div style="padding:20px">
<div style="font-size:19px;font-weight:700;color:var(--gray-900);margin-bottom:14px">Payment Service — Technical Design</div>
<div style="font-size:12px;font-weight:600;color:var(--gray-700);margin-bottom:8px">§3 — Payment Request Entity</div>
<table style="width:100%;border-collapse:collapse;font-size:12.5px">
<tr style="background:var(--gray-50)"><th style="padding:7px 10px;text-align:left;border:1px solid var(--gray-200)">Field</th><th style="padding:7px 10px;text-align:left;border:1px solid var(--gray-200)">Constraint</th><th style="padding:7px 10px;text-align:left;border:1px solid var(--gray-200)">Business Rule</th><th style="padding:7px 10px;border:1px solid var(--gray-200)">Status</th></tr>
<tr><td style="padding:7px 10px;border:1px solid var(--gray-200)">amount</td><td style="padding:7px 10px;border:1px solid var(--gray-200);font-family:var(--mono);font-size:11.5px">@DecimalMin("100.00")</td><td style="padding:7px 10px;border:1px solid var(--gray-200)">Minimum payment: $100</td><td style="padding:7px 10px;border:1px solid var(--gray-200)">${tag('var(--fail)','rgba(239,68,68,.1)','⚠ STALE')}</td></tr>
<tr><td style="padding:7px 10px;border:1px solid var(--gray-200)">currency</td><td style="padding:7px 10px;border:1px solid var(--gray-200);font-family:var(--mono);font-size:11.5px">@NotNull</td><td style="padding:7px 10px;border:1px solid var(--gray-200)">ISO 4217 required</td><td style="padding:7px 10px;border:1px solid var(--gray-200)">${tag('var(--pass)','rgba(34,197,94,.1)','✓ Current')}</td></tr>
</table>
<div style="margin-top:10px;font-size:11.5px;color:rgba(239,68,68,.75);font-style:italic">Code changed last week. This page was not updated.</div>
</div></div>
`);

Hooks.change=()=>set('change',`
${lbl('The Code Change')}
${h1('One annotation. $50. Fifty-seven seconds to documented.')}
${sub('Shubham Mujumdar lowers the minimum payment threshold. Code2Doc detects it automatically.')}
<div style="background:#1e1e2e;border-radius:10px;overflow:hidden;font-family:var(--mono);font-size:12.5px">
<div style="background:#252535;padding:9px 14px;font-size:11px;color:#7c7c9c;display:flex;justify-content:space-between"><span>📄 src/main/java/com/payment/dto/PaymentRequestDTO.java</span><span>commit abc1234</span></div>
<div style="padding:10px 0">
${[['41',' ','@Data','#64748b',''],['43',' ','public class PaymentRequestDTO {','#64748b',''],['44','-','  @DecimalMin(value = "100.00", message = "Amount must be at least 100.00")','#fca5a5','background:rgba(239,68,68,.12)'],['44','+','  @DecimalMin(value = "50.00",  message = "Amount must be at least 50.00")','#86efac','background:rgba(34,197,94,.12)'],['45',' ','  private BigDecimal amount;','#64748b',''],['46',' ','}','#64748b','']].map(([ln,s,code,c,bg])=>`<div style="display:flex;padding:2px 14px;gap:8px;${bg}"><span style="min-width:20px;color:#4a5568">${ln}</span><span style="min-width:12px;color:${c}">${s}</span><span style="color:${c}">${code}</span></div>`).join('')}
</div></div>
<div style="display:flex;gap:14px;margin-top:14px">
<div style="flex:1;background:var(--white);border:1px solid rgba(239,68,68,.25);border-radius:8px;padding:12px 14px"><div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--fail);margin-bottom:4px">Before</div><div style="font-size:13px;font-family:var(--mono)">"100.00"</div><div style="font-size:11.5px;color:var(--gray-500);margin-top:2px">Minimum payment: $100</div></div>
<div style="flex:1;background:var(--white);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:12px 14px"><div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--pass);margin-bottom:4px">After</div><div style="font-size:13px;font-family:var(--mono)">"50.00"</div><div style="font-size:11.5px;color:var(--gray-500);margin-top:2px">Minimum payment: $50</div></div>
</div>
`);

Hooks.pr=()=>set('pr',`
${lbl('Pull Request · GitHub')}
${h1('Code ships. Documentation automation wakes up.')}
${sub('PR #142 is reviewed, approved, and merged to <code style="background:var(--gray-100);padding:1px 5px;border-radius:3px;font-family:var(--mono)">development</code>. This push is the trigger.')}
<div style="background:var(--white);border:1px solid var(--gray-200);border-radius:10px;overflow:hidden">
<div style="padding:14px 18px;border-bottom:1px solid var(--gray-200);display:flex;align-items:center;gap:10px">${tag('#16a34a','rgba(34,197,94,.1)','✓ Merged')}<div><div style="font-size:14px;font-weight:600;color:var(--gray-900)">feat: lower minimum payment threshold to $50</div><div style="font-size:11.5px;color:var(--gray-500);margin-top:2px">PR #142 · Shubham Mujumdar · <code style="font-family:var(--mono)">feature/lower-min-payment → development</code></div></div></div>
<div style="padding:12px 18px;font-size:12px;color:var(--gray-600);border-bottom:1px solid var(--gray-100);display:flex;gap:16px"><span>👤 Shubham Mujumdar</span><span>🗂 1 file · +1 −1</span><span>📅 Aug 24 · 09:41:02</span></div>
<div style="padding:12px 18px;display:flex;flex-direction:column;gap:6px">
${[['CI — tests passed (2m 14s)'],['Security scan — 0 vulnerabilities'],['Code review — approved']].map(([t])=>`<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--gray-700)"><span style="color:var(--pass)">✓</span>${t}</div>`).join('')}
</div></div>
<div style="margin-top:12px;background:rgba(20,52,203,.05);border:1px solid rgba(20,52,203,.2);border-radius:8px;padding:12px 16px;font-size:13px;color:var(--gray-700)"><strong style="color:var(--brand)">Code2Doc webhook fires on merge.</strong> The push event is detected. The AI pipeline starts. A draft is prepared for human review before anything is published.</div>
`);

Hooks.merge=()=>set('merge',`
${lbl('Pipeline Triggered · Timeline')}
${h1('57 seconds from merge to documented.')}
${sub('From the moment the push lands, Code2Doc runs its full AI pipeline — then waits for human approval before publishing.')}
<div style="margin-top:16px">
${[['09:41:02','Push detected','development · commit abc1234 · PaymentRequestDTO.java','AI-Assisted'],['09:41:02','Diff extracted','1 file · @DecimalMin("100.00") → @DecimalMin("50.00")','AI-Assisted'],['09:41:05','LLM analysis','Claude: "Lower minimum payment threshold — validation rule change"','AI-Assisted'],['09:41:12','Confluence queried','3 semantic queries · 8 candidate sections from Chroma','AI-Assisted'],['09:41:19','Sections re-ranked','bge-reranker-v2-m3 · Section 3 scored 0.94','AI-Assisted'],['09:41:22','Draft sent for review','Doc owner notified · awaiting human approval','Human Review'],['09:41:55','Reviewer approves','Draft accepted · publish authorised','Human Review'],['09:41:56','Confluence updated','payment-service-technical-design · v12 → v13','Automated'],['09:41:57','GitHub committed','docs/payment-service-technical-design.md pushed','Automated'],['09:41:59','Email dispatched','ops-team@cognizant.com · platform-sre@cognizant.com','Automated']].map(([t,title,detail,cls],i,a)=>{
const isHuman=cls==='Human Review',isAuto=cls==='Automated';
const clsColor=isHuman?'var(--warn)':isAuto?'var(--pass)':'var(--brand)';
const clsBg=isHuman?'rgba(245,158,11,.1)':isAuto?'rgba(34,197,94,.1)':'rgba(20,52,203,.08)';
return`
<div class="tl-item">${i<a.length-1?'<div class="tl-line"></div>':''}
<div class="tl-dot">✓</div>
<div style="flex:1;padding-bottom:2px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:13px;font-weight:600;color:var(--gray-900)">${title}</span><span style="font-size:11px;font-family:var(--mono);color:var(--gray-400)">${t}</span><span style="font-size:10px;padding:1px 7px;border-radius:100px;font-weight:600;background:${clsBg};color:${clsColor}">${cls}</span></div><div style="font-size:11.5px;color:var(--gray-500);margin-top:1px">${detail}</div></div></div>`;}).join('')}
</div>
`);

Hooks.cicd=()=>set('cicd',`
${lbl('CI/CD · GitHub Actions')}
${h1('Code quality gates run in parallel.')}
${sub('While Code2Doc analyzes documentation impact, the standard CI/CD pipeline runs independently. They never block each other.')}
<div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
${[['✓','pass','CI — Build & Test','2m 14s','JUnit · 247 tests passed'],['✓','pass','Security Scan','1m 52s','0 vulnerabilities · OWASP clean'],['▶','cyan','CD — Deploy to Staging','running…','Building Docker image'],['·','gray','Release — Production','waiting','Awaiting staging sign-off']].map(([ic,st,name,t,d])=>`
<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;background:var(--white);border:1px solid ${st==='pass'?'rgba(34,197,94,.25)':st==='cyan'?'rgba(247,182,0,.25)':'var(--gray-200)'};border-radius:8px">
<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;background:${st==='pass'?'rgba(34,197,94,.1)':st==='cyan'?'rgba(247,182,0,.1)':'var(--gray-100)'};color:${st==='pass'?'var(--pass)':st==='cyan'?'var(--warn)':'var(--gray-400)'}">${ic}</div>
<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--gray-900)">${name}</div><div style="font-size:11.5px;color:var(--gray-500);margin-top:1px">${d}</div></div>
<div style="font-size:11px;font-family:var(--mono);color:var(--gray-400)">${t}</div></div>`).join('')}
</div>
<div style="margin-top:12px;font-size:12.5px;color:var(--gray-500)">Code2Doc is a parallel concern — no dependency on CI/CD, no shared state.</div>
`);

Hooks.pipeline=()=>{
  const AI_STEPS=[
    [1,'Webhook received','Merge event fires on development branch · commit abc1234 detected','0.3s'],
    [2,'Diff extracted','1 file changed · @DecimalMin("100.00") → @DecimalMin("50.00")','0.4s'],
    [3,'LLM analysis','Claude: "Lower minimum payment threshold — business rule change"','6.8s'],
    [4,'Semantic search','3 Chroma queries · 8 candidate sections retrieved from knowledge base','7.1s'],
    [5,'Re-ranking','bge-reranker-v2-m3 · Section 3 scored 0.94 — highest relevance','6.6s'],
    [6,'Draft generated','Proposed update: §3 @DecimalMin value and business rule description','3.2s'],
  ];
  const HUMAN_STEPS=[
    [7,'Review request sent','Doc owner notified · draft diff attached · approve or reject required','—'],
    [8,'Human validates','Reviewer inspects AI-generated draft · edits if needed · final decision','human'],
    [9,'Human-in-the-Loop Publishing','Confluence v12→v13 · GitHub commit pushed · no auto-publish ever','on approve'],
    [10,'Notify & audit','Ops email dispatched · full audit trail written to SQLite','on approve'],
  ];
  set('pipeline',`
${lbl('Code2Doc · AI-Assisted Document Review & Controlled Publishing')}
${h1('AI drafts it. Humans approve it. Nothing ships without sign-off.')}
${sub('Every doc update proposal goes through a human review gate. The AI does the research and drafting — the decision is always yours.')}
<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:0;margin-top:18px;align-items:start">
<div>
<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--brand);margin-bottom:8px;padding-left:2px">AI Pipeline — AI-Assisted</div>
<div id="hitl-ai" style="display:flex;flex-direction:column;gap:5px"></div>
</div>
<div id="hitl-gate" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 10px;opacity:0;transition:opacity .5s">
<div style="width:2px;height:30px;background:linear-gradient(to bottom,var(--brand),var(--warn))"></div>
<div class="gate-badge" style="background:var(--warn);color:#fff;border-radius:6px;padding:5px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap">Approval Gate</div>
<div style="width:2px;height:30px;background:linear-gradient(to bottom,var(--warn),var(--pass))"></div>
</div>
<div>
<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--warn);margin-bottom:8px;padding-left:2px">Human Review — Only Manual Step</div>
<div id="hitl-human" style="display:flex;flex-direction:column;gap:5px"></div>
</div>
</div>
<div id="hitl-done" style="display:none;margin-top:14px;background:rgba(34,197,94,.05);border:1px solid rgba(34,197,94,.25);border-radius:8px;padding:10px 16px;font-size:12.5px;color:var(--gray-700)">
  <strong style="color:var(--pass)">✓ Published.</strong> Confluence v13 · GitHub commit · Ops notified. Full audit trail in SQLite.
  <span style="float:right;font-size:11px;font-family:var(--mono);color:var(--gray-400)">57s total</span>
</div>
`);
  function renderStep(containerId,steps,accent,delay){
    const c=document.getElementById(containerId);if(!c)return;
    steps.forEach(([num,title,detail,t],i)=>{
      const d=document.createElement('div');
      d.id=`hitl-${num}`;
      d.style.cssText=`display:flex;align-items:flex-start;gap:10px;padding:9px 12px;background:var(--white);border:1px solid var(--gray-200);border-radius:8px;opacity:.25;transition:opacity .4s,border-color .4s`;
      d.innerHTML=`<div id="hitl-ic-${num}" style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;background:var(--gray-100);color:var(--gray-400);transition:all .3s;margin-top:1px">${num}</div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:var(--gray-900)">${title}</div><div style="font-size:11px;color:var(--gray-500);margin-top:1px;line-height:1.45">${detail}</div></div><div style="font-size:10px;font-family:var(--mono);color:var(--gray-400);white-space:nowrap;padding-top:2px">${t}</div>`;
      c.appendChild(d);
    });
  }
  renderStep('hitl-ai',AI_STEPS,'var(--brand)',0);
  renderStep('hitl-human',HUMAN_STEPS,'var(--pass)',0);

  function activateStep(num,accent){const el=document.getElementById(`hitl-${num}`),ic=document.getElementById(`hitl-ic-${num}`);if(!el)return;el.style.opacity='1';el.style.borderColor=accent==='ai'?'rgba(20,52,203,.3)':'rgba(245,158,11,.4)';ic.style.background=accent==='ai'?'rgba(20,52,203,.1)':'rgba(245,158,11,.12)';ic.style.color=accent==='ai'?'var(--brand)':'var(--warn)';ic.textContent='⋯';}
  function doneStep(num,isHuman){const el=document.getElementById(`hitl-${num}`),ic=document.getElementById(`hitl-ic-${num}`);if(!el)return;el.style.borderColor=isHuman?'rgba(34,197,94,.3)':'rgba(20,52,203,.3)';ic.style.background=isHuman?'rgba(34,197,94,.1)':'rgba(20,52,203,.1)';ic.style.color=isHuman?'var(--pass)':'var(--brand)';ic.textContent='✓';}

  const DELAYS=[300,700,1100,2000,2900,3700];
  AI_STEPS.forEach(([num],i)=>setTimeout(()=>{if(i>0)doneStep(AI_STEPS[i-1][0],false);activateStep(num,'ai');if(i===AI_STEPS.length-1)setTimeout(()=>{doneStep(num,false);const g=document.getElementById('hitl-gate');if(g)g.style.opacity='1';setTimeout(()=>{HUMAN_STEPS.forEach(([hnum],j)=>setTimeout(()=>{if(j>0)doneStep(HUMAN_STEPS[j-1][0],true);activateStep(hnum,'human');if(j===HUMAN_STEPS.length-1)setTimeout(()=>{doneStep(hnum,true);const d=document.getElementById('hitl-done');if(d)d.style.display='block';},900);},j*900));},400);},600);},DELAYS[i]));
};

Hooks.after=()=>set('after',`
${lbl('Result · Confluence Updated')}
${h1('Section 3 is correct. Automatically.')}
${sub('Code2Doc published v13 of <em>payment-service-technical-design</em>. The table now reflects $50. GitHub has the commit. Ops has the email.')}
<div style="background:var(--white);border:1px solid var(--gray-200);border-radius:10px;overflow:hidden">
<div style="background:#0052cc;padding:8px 14px;display:flex;align-items:center;gap:10px"><span style="color:#fff;font-size:13px;font-weight:700">Confluence</span><span style="color:rgba(255,255,255,.55);font-size:11px">KnowledgeHub › payment-service-technical-design</span><span style="margin-left:auto;background:rgba(34,197,94,.25);color:#86efac;font-size:10px;padding:2px 8px;border-radius:4px;font-family:var(--mono)">v13 · updated just now ✓</span></div>
<div style="padding:20px">
<div style="font-size:19px;font-weight:700;color:var(--gray-900);margin-bottom:14px">Payment Service — Technical Design</div>
<div style="font-size:12px;font-weight:600;color:var(--gray-700);margin-bottom:8px">§3 — Payment Request Entity ${tag('var(--pass)','rgba(34,197,94,.1)','updated by Code2Doc')}</div>
<table style="width:100%;border-collapse:collapse;font-size:12.5px">
<tr style="background:var(--gray-50)"><th style="padding:7px 10px;text-align:left;border:1px solid var(--gray-200)">Field</th><th style="padding:7px 10px;text-align:left;border:1px solid var(--gray-200)">Constraint</th><th style="padding:7px 10px;text-align:left;border:1px solid var(--gray-200)">Business Rule</th><th style="padding:7px 10px;border:1px solid var(--gray-200)">Status</th></tr>
<tr style="background:rgba(34,197,94,.04)"><td style="padding:7px 10px;border:1px solid var(--gray-200)">amount</td><td style="padding:7px 10px;border:1px solid var(--gray-200);font-family:var(--mono);font-size:11.5px"><span style="text-decoration:line-through;color:var(--fail);opacity:.6">"100.00"</span> → <span style="color:var(--pass);font-weight:600">"50.00"</span></td><td style="padding:7px 10px;border:1px solid var(--gray-200)"><span style="text-decoration:line-through;color:var(--fail);opacity:.6">Min $100</span> → <span style="color:var(--pass);font-weight:600">Min $50</span></td><td style="padding:7px 10px;border:1px solid var(--gray-200)">${tag('var(--pass)','rgba(34,197,94,.1)','✓ UPDATED')}</td></tr>
<tr><td style="padding:7px 10px;border:1px solid var(--gray-200)">currency</td><td style="padding:7px 10px;border:1px solid var(--gray-200);font-family:var(--mono);font-size:11.5px">@NotNull</td><td style="padding:7px 10px;border:1px solid var(--gray-200)">ISO 4217 required</td><td style="padding:7px 10px;border:1px solid var(--gray-200)">${tag('var(--pass)','rgba(34,197,94,.1)','✓ Current')}</td></tr>
</table></div></div>
<div style="display:flex;gap:10px;margin-top:12px">
<div style="flex:1;background:var(--white);border:1px solid rgba(34,197,94,.2);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--gray-700)"><span style="color:var(--pass);font-weight:600">✓ GitHub</span> — <code style="font-family:var(--mono)">docs/payment-service-technical-design.md</code> committed</div>
<div style="flex:1;background:var(--white);border:1px solid rgba(34,197,94,.2);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--gray-700)"><span style="color:var(--pass);font-weight:600">✓ Email</span> — ops-team@cognizant.com · platform-sre@cognizant.com</div>
</div>
`);

Hooks.chat=()=>{
  set('chat',`
${lbl('AI Assistant · Documentation Q&A')}
${h1('Ask anything. Get answers from live docs.')}
${sub('The Code2Doc knowledge base is always current. Query it like a colleague who has read every document.')}
<div style="background:var(--white);border:1px solid var(--gray-200);border-radius:10px;overflow:hidden">
<div style="padding:10px 16px;border-bottom:1px solid var(--gray-200);font-size:13px;font-weight:600;color:var(--gray-800);display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:var(--pass);display:inline-block"></span>Code2Doc Assistant · payment-service knowledge base</div>
<div style="padding:16px;display:flex;flex-direction:column;gap:12px;min-height:220px">
<div style="align-self:flex-end;max-width:80%"><div style="padding:10px 14px;background:var(--brand);color:#fff;border-radius:12px 12px 3px 12px;font-size:13px;line-height:1.5">What's the current minimum payment amount?</div></div>
<div style="align-self:flex-start;max-width:92%"><div style="padding:10px 14px;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:12px 12px 12px 3px;font-size:13px;line-height:1.6;color:var(--gray-800)"><span id="ct"></span><span id="cc" style="display:inline-block;width:2px;height:13px;background:var(--brand);vertical-align:text-bottom;margin-left:1px;animation:blink 1s step-end infinite"></span></div>
<div style="font-size:10.5px;color:var(--gray-400);margin-top:3px">Source: payment-service-technical-design · §3 · v13 (updated today)</div></div>
</div></div>
<style>@keyframes blink{50%{opacity:0}}</style>
`);
  const txt='The minimum payment amount is $50.00, set by @DecimalMin("50.00") on the amount field in PaymentRequestDTO. This was updated today from $100.00 following commit abc1234 by Shubham Mujumdar. Confluence page payment-service-technical-design (Section 3, v13) now reflects this change.';
  const el=document.getElementById('ct'),cur=document.getElementById('cc');
  let i=0;const iv=setInterval(()=>{if(!el){clearInterval(iv);return;}if(i<txt.length)el.textContent+=txt[i++];else{clearInterval(iv);if(cur)cur.style.display='none';}},16);
};

Hooks.impact=()=>set('impact',`
${lbl('Business Impact')}
${h1('Seconds instead of days. Every time.')}
${sub('Code2Doc eliminates an entire class of risk: decisions made on stale documentation.')}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0">
${[['Without Code2Doc','var(--fail)','rgba(239,68,68,.15)',[['Update latency','Hours to days'],['Process','Manual, error-prone'],['Doc coverage','~30% after 3 months'],['Audit trail','None'],['Ops confidence','Low']]],['With Code2Doc','var(--pass)','rgba(34,197,94,.15)',[['Update latency','57 seconds'],['Process','AI-Assisted + Human Approval'],['Doc coverage','100% for covered repos'],['Audit trail','Full SQLite log'],['Ops confidence','High']]]].map(([title,c,bg,rows])=>`
<div style="background:var(--white);border:1px solid ${bg};border-radius:10px;padding:18px">
<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${c};margin-bottom:12px">${title}</div>
${rows.map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--gray-100);font-size:12.5px;color:var(--gray-700)"><span>${k}</span><span style="font-weight:600;font-family:var(--mono);color:${c}">${v}</span></div>`).join('')}
</div>`).join('')}
</div>
<div style="background:linear-gradient(135deg,rgba(20,52,203,.06) 0%,rgba(247,182,0,.04) 100%);border:1px solid rgba(20,52,203,.2);border-radius:var(--radius-lg);padding:16px 20px;font-size:13px;color:var(--gray-700);box-shadow:var(--shadow-xs)"><strong style="color:var(--brand)">ROI estimate:</strong> A 20-person org spending 4.5 h/week per developer on documentation overhead = ~$300K/year. Code2Doc targets 80%+ of that. <span style="color:var(--pass);font-weight:600">→ $240K recovered.</span></div>
`);

const cur=SCREENS[state.current];
if(Hooks[cur.id])Hooks[cur.id]();

})();
