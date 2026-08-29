
const state = {
  players: [],
  teamCount: 10,
  teams: [],
  history: [],
  selectedTeam: 0,
  view: "best",
  filter: "ALL",
  limit: 25,
  scoring: "half",
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function buildTeams(n) {
  const old = state.teams;
  state.teams = Array.from({ length: n }, (_, i) => old[i] || {
    name: `Team ${i + 1}`,
    manager: `Manager ${i + 1}`,
    me: i === 0,
  });
  if (!state.teams.some(t => t.me)) state.teams[0].me = true;
}
function cp(){return state.history.length+1}
function rd(p){return Math.ceil(p/state.teamCount)}
function slot(p){const x=(p-1)%state.teamCount;return rd(p)%2?x:state.teamCount-1-x}
function label(p){return `${rd(p)}.${String((p-1)%state.teamCount+1).padStart(2,"0")}`}
function me(){return Math.max(0,state.teams.findIndex(t=>t.me))}
function nextMe(){for(let p=cp();p<state.teamCount*25;p++)if(slot(p)===me())return p;return cp()}
function roster(i){return state.players.filter(p=>p.owner===i)}
function cnt(i){const c={QB:0,RB:0,WR:0,TE:0,DEF:0,K:0};roster(i).forEach(p=>c[p.pos]++);return c}

function extScore(p){
  const vals=[Math.max(0,100-p.adp*.55)], weights=[1];
  if(p.espn_rank){vals.push(Math.max(0,100-p.espn_rank*1.65));weights.push(.8)}
  if(p.fantasypros_ecr){vals.push(Math.max(0,100-p.fantasypros_ecr*4));weights.push(1)}
  let sum=0,w=0;vals.forEach((v,i)=>{sum+=v*weights[i];w+=weights[i]});
  return sum/w;
}
function rosterBonus(pos){
  const c=cnt(me()),n=roster(me()).length;
  if(pos==="RB")return c.RB<2?8:c.RB<4?3:0;
  if(pos==="WR")return c.WR<2?8:c.WR<5?3:0;
  if(pos==="QB")return c.QB?-10:n>=4?5:n>=2?1:-6;
  if(pos==="TE")return c.TE?-8:n>=3?4:0;
  if(pos==="DEF")return n>=10&&!c.DEF?2:-12;
  if(pos==="K")return n>=12&&!c.K?2:-15;
  return 0;
}
function tierBonus(p){
  if(!p.espn_rank)return 0;
  const same=state.players.filter(x=>x.owner==null&&x.pos===p.pos&&x.espn_rank&&x.espn_rank>p.espn_rank&&x.espn_rank<=p.espn_rank+3).length;
  return same<=1?4:0;
}
function valueBonus(p){return cp()>p.adp?Math.min(8,(cp()-p.adp)*.3):0}
function scoringBonus(p){
  if(state.scoring==="ppr"&&p.pos==="WR")return 2;
  if(state.scoring==="std"&&p.pos==="RB")return 2;
  return 0;
}
function pickScore(p){return Math.round(Math.max(1,Math.min(99,extScore(p)+rosterBonus(p.pos)+tierBonus(p)+valueBonus(p)+scoringBonus(p))))}
function coverage(p){return 1+(p.espn_rank?1:0)+(p.fantasypros_ecr?1:0)}
function danger(p){return p.adp<=cp()+Math.max(4,Math.round((nextMe()-cp())*.7))}
function why(p){
  if(cp()-p.adp>8)return "Market value has fallen well past ADP.";
  if(tierBonus(p)>0)return "Near the edge of a meaningful positional tier.";
  const c=cnt(me());
  if((p.pos==="RB"&&c.RB<2)||(p.pos==="WR"&&c.WR<2))return "Strong external value plus a core roster need.";
  return "Best blend of external value and live roster context.";
}
function available(){return state.players.filter(p=>p.owner==null)}
function recommendations(){return available().map(p=>({...p,score:pickScore(p)})).sort((a,b)=>b.score-a.score||a.adp-b.adp).slice(0,3)}

function renderRecs(){
  $("#recs").innerHTML=recommendations().map((p,i)=>{
    const c=coverage(p);
    return `<div class="rec ${i===0?"best":""}">
      <div class="recTop"><strong>${i===0?"★ ":""}${p.name}</strong><span class="badge">${p.pos} · ${p.nfl}</span></div>
      <div class="scoreBig">${p.score}</div>
      <div class="why">${why(p)}</div>
      ${danger(p)?'<div class="danger">⚠ Unlikely to survive to your next turn</div>':""}
      <div class="confidence"><span>Source confidence</span><span class="dots"><i class="dot on"></i><i class="dot ${c>=2?"on":""}"></i><i class="dot ${c>=3?"on":""}"></i></span><span>${c}/3</span></div>
    </div>`;
  }).join("");
}
function filtered(){
  const q=$("#search").value.toLowerCase().trim();
  let a=available().filter(p=>(state.filter==="ALL"||p.pos===state.filter)&&(!q||p.name.toLowerCase().includes(q)||p.nfl.toLowerCase().includes(q)));
  if(state.view==="targets")a=a.filter(p=>p.target);
  a.sort((a,b)=>pickScore(b)-pickScore(a)||a.adp-b.adp);
  if(state.view==="best")a=a.slice(0,25);
  return a;
}
function renderBoard(){
  const all=filtered(), shown=state.view==="all"?all.slice(0,state.limit):all;
  const q=$("#search").value.trim();

  if(shown.length){
    $("#board").innerHTML=shown.map(p=>`<div class="row">
      <div class="rank">${p.adp ?? "—"}</div>
      <div><div class="name">${p.name}</div><div class="muted">Bye ${p.bye||"—"}${p.fantasypros_ecr?` · FP ECR ${p.fantasypros_ecr}`:""}</div></div>
      <div class="pos">${p.pos}</div><div>${p.nfl}</div><div class="pickScore">${p.unranked ? "—" : pickScore(p)}</div>
      <div>${p.espn_rank||"—"}</div><div class="sourceCount">${p.unranked ? "0/3" : coverage(p)+"/3"}</div>
      <div class="actions"><button class="star ${p.target?"on":""}" data-target="${p.id}">★</button><button class="draft" data-draft="${p.id}">Draft</button><button data-other="${p.id}">Other</button></div>
    </div>`).join("");
  } else if(q && state.view!=="targets"){
    $("#board").innerHTML=`<div class="customSearch">
      <div>
        <div class="customTitle">Can't find “${escapeHtml(q)}”?</div>
        <div class="muted">No problem. Add literally any player to the board — backups, rookies, practice-squad chaos, whatever.</div>
      </div>
      <button class="btn primary" id="quickAddSearch">+ Add “${escapeHtml(q)}”</button>
    </div>`;
    $("#quickAddSearch").addEventListener("click",()=>openPlayerDialog(q));
  } else {
    $("#board").innerHTML='<div style="padding:28px;text-align:center;color:#7e8998;font-size:11px">No players match this view.</div>';
  }

  $("#showing").textContent=state.view==="best"
    ?`Top ${shown.length} by live Pick Score`
    :state.view==="targets"
      ?`${shown.length} saved targets`
      :`Showing ${shown.length} of ${all.length} available`;
  $("#more").style.display=state.view==="all"&&shown.length<all.length?"inline-flex":"none";
}
function renderTeams(){
  const cur=slot(cp());
  $("#teamList").innerHTML=state.teams.map((t,i)=>`<div class="team ${i===cur?"active":""} ${t.me?"me":""}" data-team="${i}">
    <div class="teamNum">${i+1}</div><div><div>${t.name}${t.me?" · YOU":""}</div><div class="muted">${t.manager}</div></div><div class="muted">${roster(i).length}</div>
  </div>`).join("");
}
function renderRoster(){
  const a=roster(state.selectedTeam),t=state.teams[state.selectedTeam];
  $("#rosterTitle").textContent=t.name+" roster";
  $("#roster").innerHTML=a.length?a.map(p=>`<div class="rosterPlayer"><span><b>${p.pos}</b> ${p.name}</span><span class="muted">${p.nfl} · bye ${p.bye||"—"}</span></div>`).join(""):'<div class="muted">No players drafted yet.</div>';
}
function renderHistory(){
  $("#history").innerHTML=state.history.length?[...state.history].reverse().slice(0,10).map((h,j)=>`<div class="hist"><b>${label(state.history.length-j)}</b> ${h.player.name} → ${state.teams[h.owner].name}</div>`).join(""):'<div class="muted">Draft has not started.</div>';
}
function renderPulse(){
  const p=cp(),own=slot(p),nm=nextMe();
  $("#clockMetric").textContent=state.teams[own].name;$("#pickMetric").textContent=label(p);$("#nextMetric").textContent=label(nm);$("#awayMetric").textContent=Math.max(0,nm-p);$("#targetMetric").textContent=state.players.filter(x=>x.target&&x.owner==null).length;
  $("#clockName").textContent=state.teams[own].name;$("#clockMeta").textContent=state.teams[own].manager+" · Draft slot "+(own+1);
  const last=state.history.slice(-5).map(x=>x.player.pos),c={};last.forEach(x=>c[x]=(c[x]||0)+1);const hot=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];
  $("#runAlert").innerHTML=hot&&hot[1]>=3?`<div class="alert"><b>${hot[0]} run:</b> ${hot[1]} of the last ${last.length} selections. Positional scarcity may be accelerating.</div>`:"";
}
function render(){renderPulse();renderRecs();renderBoard();renderTeams();renderRoster();renderHistory();$("#undo").disabled=!state.history.length}
function byId(id){return state.players.find(x=>x.id===id)}
function draft(id,owner=slot(cp())){const p=byId(id);if(!p||p.owner!=null)return;p.owner=owner;p.target=false;state.history.push({player:p,owner});state.selectedTeam=owner;render()}


function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}
function openPlayerDialog(prefill=""){
  $("#newName").value=prefill;
  $("#newNFL").value="";
  $("#newPos").value="QB";
  $("#newADP").value=300;
  $("#playerDialog").showModal();
  setTimeout(()=>$("#newNFL").focus(),0);
}

function mount(){
  document.querySelector("#app").innerHTML=`
  <div class="shell">
    <div class="top"><div><h1>Fantasy Draft Command Center</h1><div class="muted">Consensus intelligence · live draft context · transparent recommendations</div></div>
      <div class="settings"><select id="teamsN"><option>8</option><option selected>10</option><option>12</option><option>14</option></select><select id="scoring"><option value="std">Standard</option><option value="half" selected>Half PPR</option><option value="ppr">PPR</option></select><button class="btn" id="methodBtn">How scoring works</button><button class="btn" id="leagueBtn">League</button><button class="btn" id="addBtn">+ Player</button></div>
    </div>
    <div class="metrics"><div class="metric hero"><b id="clockMetric"></b><span>On clock · <i id="pickMetric"></i></span></div><div class="metric"><b id="nextMetric"></b><span>Your next pick</span></div><div class="metric"><b id="awayMetric"></b><span>Picks away</span></div><div class="metric"><b id="targetMetric"></b><span>Saved targets</span></div><div class="metric"><b>Aug 28</b><span>Data snapshot</span></div></div>
    <div class="grid"><section class="panel"><div class="heroRec"><div class="eyebrow">Recommended right now</div><div id="recs" class="recs"></div></div>
      <div class="tools"><input id="search" placeholder="Search player or NFL team"><div class="tabs"><button class="tab on" data-view="best">Best Available</button><button class="tab" data-view="targets">My Targets</button><button class="tab" data-view="all">All Available</button></div></div>
      <div class="positions"><button class="chip on" data-pos="ALL">ALL</button><button class="chip" data-pos="RB">RB</button><button class="chip" data-pos="WR">WR</button><button class="chip" data-pos="QB">QB</button><button class="chip" data-pos="TE">TE</button><button class="chip" data-pos="DEF">DST</button><button class="chip" data-pos="K">K</button></div>
      <div class="head"><div>ADP</div><div>Player</div><div>Pos</div><div>NFL</div><div>Pick</div><div>ESPN</div><div>Sources</div><div>Action</div></div><div id="board"></div><div class="footer"><span class="muted" id="showing"></span><button class="btn" id="more">Show 25 more</button></div>
    </section><aside class="panel"><div class="side"><div class="sideTitle">Draft pulse</div><div class="clock"><strong id="clockName"></strong><span class="muted" id="clockMeta"></span></div><div id="runAlert"></div></div>
      <div class="side"><div class="sideTitle">Intelligence sources</div><div class="sourceBox"><strong>FantasyPros ECR</strong><span class="muted">Consensus signal where explicitly captured</span></div><div class="sourceBox"><strong>Live draft market</strong><span class="muted">ADP is the baseline market signal</span></div><div class="sourceBox"><strong>ESPN positional tiers</strong><span class="muted">RB/WR scarcity signal where captured</span></div></div>
      <div class="side"><div class="sideTitle">League</div><div id="teamList" class="teamList"></div></div><div class="side"><div class="sideTitle" id="rosterTitle">Roster</div><div id="roster"></div></div><div class="side"><div class="sideTitle">Recent picks</div><div id="history" class="history"></div><button class="btn" id="undo" style="width:100%;margin-top:7px">Undo last pick</button></div>
    </aside></div>
  </div>
  <dialog id="methodDialog"><div class="modal"><h3>How Pick Score works</h3><div class="formula"><p><b>External value:</b> ADP baseline, plus ESPN and FantasyPros signals where available.</p><p><b>Roster fit:</b> Adjusts close calls for your current build.</p><p><b>Scarcity:</b> Rewards players near the end of a tier.</p><p><b>Turn probability:</b> Warns when a player is unlikely to survive to your next pick.</p><p><b>Live draft behavior:</b> Detects positional runs without blindly chasing them.</p><p><b>Confidence:</b> Shows how many external data signals are actually present. Missing source data is not invented.</p></div><div class="modalActions"><button class="btn primary" data-close="methodDialog">Got it</button></div></div></dialog>
  <dialog id="leagueDialog"><div class="modal"><h3>League setup</h3><div class="muted" style="margin-bottom:10px">Draft order runs top to bottom. Mark your team.</div><div id="teamEditor" class="editor"></div><div class="modalActions"><button class="btn" data-close="leagueDialog">Cancel</button><button class="btn primary" id="saveLeague">Save</button></div></div></dialog>
  <dialog id="playerDialog"><form class="modal" id="playerForm"><h3>Add missing player</h3><div class="form"><label>Name<input id="newName" required></label><label>NFL team<input id="newNFL" maxlength="4" required></label><label>Position<select id="newPos"><option>QB</option><option>RB</option><option>WR</option><option>TE</option><option>DEF</option><option>K</option></select></label><label>Approx. ADP<input id="newADP" type="number" value="220" min="1" max="999"></label></div><div class="modalActions"><button type="button" class="btn" data-close="playerDialog">Cancel</button><button class="btn primary">Add</button></div></form></dialog>`;
}

function wire(){
  $("#board").addEventListener("click",e=>{
    const b=e.target.closest("button"); if(!b)return;
    if(b.dataset.target){const p=byId(b.dataset.target);p.target=!p.target;render()}
    if(b.dataset.draft)draft(b.dataset.draft);
    if(b.dataset.other){
      const p=byId(b.dataset.other),a=prompt(`Draft ${p.name} to team 1-${state.teamCount}`,slot(cp())+1),i=Number(a)-1;
      if(Number.isInteger(i)&&i>=0&&i<state.teamCount)draft(b.dataset.other,i)
    }
  });
  $("#search").addEventListener("input",()=>{state.limit=25;renderBoard()});
  $$(".tab").forEach(b=>b.addEventListener("click",()=>{$$(".tab").forEach(x=>x.classList.remove("on"));b.classList.add("on");state.view=b.dataset.view;state.limit=25;renderBoard()}));
  $$(".chip").forEach(b=>b.addEventListener("click",()=>{$$(".chip").forEach(x=>x.classList.remove("on"));b.classList.add("on");state.filter=b.dataset.pos;state.limit=25;renderBoard()}));
  $("#more").addEventListener("click",()=>{state.limit+=25;renderBoard()});
  $("#teamList").addEventListener("click",e=>{const t=e.target.closest("[data-team]");if(t){state.selectedTeam=+t.dataset.team;renderRoster()}});
  $("#undo").addEventListener("click",()=>{const h=state.history.pop();if(h){h.player.owner=null;render()}});
  $("#scoring").addEventListener("change",e=>{state.scoring=e.target.value;render()});
  $("#methodBtn").addEventListener("click",()=>$("#methodDialog").showModal());

  $("#leagueBtn").addEventListener("click",()=>{
    $("#teamEditor").innerHTML=state.teams.map((t,i)=>`<div class="teamEdit"><b>${i+1}</b><input value="${t.name}" data-name="${i}"><input value="${t.manager}" data-manager="${i}"><button type="button" class="btn meBtn ${t.me?"primary":""}" data-me="${i}">${t.me?"ME ✓":"ME"}</button></div>`).join("");
    $("#leagueDialog").showModal();
  });
  $("#teamEditor").addEventListener("click",e=>{const b=e.target.closest("[data-me]");if(!b)return;$$('#teamEditor [data-me]').forEach(x=>{x.classList.remove("primary");x.textContent="ME"});b.classList.add("primary");b.textContent="ME ✓"});
  $("#saveLeague").addEventListener("click",()=>{
    $$("#teamEditor [data-name]").forEach(x=>state.teams[+x.dataset.name].name=x.value||`Team ${+x.dataset.name+1}`);
    $$("#teamEditor [data-manager]").forEach(x=>state.teams[+x.dataset.manager].manager=x.value||"Manager");
    const m=$("#teamEditor [data-me].primary");state.teams.forEach(t=>t.me=false);state.teams[m?+m.dataset.me:0].me=true;state.selectedTeam=me();$("#leagueDialog").close();render();
  });
  $("#teamsN").addEventListener("change",e=>{
    const n=+e.target.value;
    if(state.history.length&&!confirm("Changing league size resets this draft. Continue?")){e.target.value=state.teamCount;return}
    state.teamCount=n;state.history=[];state.players.forEach(p=>p.owner=null);buildTeams(n);state.selectedTeam=me();render();
  });
  $("#addBtn").addEventListener("click",()=>openPlayerDialog(""));
  $("#playerForm").addEventListener("submit",e=>{
    e.preventDefault();const name=$("#newName").value.trim(),nfl=$("#newNFL").value.trim().toUpperCase(),position=$("#newPos").value;let adp=Math.max(1,+$("#newADP").value||220);
    const id=`custom-${Date.now()}`;state.players.push({id,adp,name,nfl,pos:position,bye:null,owner:null,target:false,espn_rank:null,fantasypros_ecr:null,unranked:true});
    $("#playerDialog").close();e.target.reset();$("#newADP").value=220;render();
  });
  $$("[data-close]").forEach(b=>b.addEventListener("click",()=>$("#"+b.dataset.close).close()));
}

async function init(){
  mount();
  try{
    const res=await fetch("/data/players.json");
    const data=await res.json();
    state.players=data.players.map((p,i)=>({...p,id:`p-${i}`,owner:null,target:false,unranked:false}));
    buildTeams(state.teamCount);
    wire();
    render();
  }catch(err){
    document.querySelector("#app").innerHTML=`<div class="loading">Could not load player data. ${err.message}</div>`;
  }
}
init();
