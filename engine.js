function bankEngine() {
  const bases=[20,35,55,80,115,165,240,360,550,900,1600];
  const sums=[3,4,5,6,8,9,10,11], counts=[2,2,4,4,4,4,2,2];
  const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
  const clock=()=>typeof performance!=='undefined'?performance.timeOrigin+performance.now():Date.now();
  function hash(seed,r,k,p){let x=(seed^Math.imul(r+31,0x9e3779b1)^Math.imul(k+17,0x85ebca6b)^Math.imul(p+9,0xc2b2ae35))>>>0;x=Math.imul(x^x>>>16,0x7feb352d);x=Math.imul(x^x>>>15,0x846ca68b);return((x^x>>>16)>>>0)/4294967296;}
  const families=['fixed','adaptive','chaser','reactive','matcher','strategic','noisy'];
  const models=families.flatMap((family,f)=>bases.map((base,j)=>({family,base,f,j})));
  const modelVersion=2;
  const scenarios=['Learned mix','Earlier banking','Later banking','Bank reactions','Strategic opposition'];
  const chance=[{face:5,count:6},{face:0,count:6},...sums.map((s,j)=>({face:[1,2,3,4,11,17,23,29][j],count:counts[j]}))];
  function normalize(a){const m=Math.max(...a),w=a.map(v=>Math.exp(v-m)),z=w.reduce((a,b)=>a+b,0);return w.map(v=>v/z);}
  function weights(p){const mean=p.style==='cautious'?60:p.style==='bold'?300:130;return normalize(bases.map((x,i)=>-(Math.log(x/mean)**2)/1.5+(p.style==='learn'?(p.evidence?.[i]||0):0)));}
  function modelWeights(p,scenario=0){
    const mean=scenario===1?60:scenario===2?350:p.style==='cautious'?60:p.style==='bold'?300:130;
    const prior=scenario===3?[.03,.07,.05,.45,.3,.07,.03]:scenario===4?[.02,.05,.12,.1,.21,.48,.02]:[.16,.27,.13,.14,.08,.17,.05];
    const evidence=p.style==='learn'&&p.modelVersion===modelVersion&&p.modelEvidence?.length===models.length?p.modelEvidence:null;
    const w=normalize(models.map((m,k)=>Math.log(prior[m.f])-(Math.log(m.base/mean)**2)/1.5+(scenario===0&&evidence?evidence[k]:0)));
    if(scenario||!evidence)return w;
    const broad=normalize(models.map(m=>Math.log(prior[m.f])-(Math.log(m.base/mean)**2)/1.5));
    return w.map((v,i)=>.9*v+.1*broad[i]);
  }
  function leaders(scores){let first=-Infinity,second=-Infinity,index=-1;for(let i=0;i<scores.length;i++){const v=scores[i];if(v>first){second=first;first=v;index=i;}else if(v>second)second=v;}return{first,second,index};}
  function potentialLeaders(scores,active,pot){let first=-Infinity,second=-Infinity,index=-1;for(let i=0;i<scores.length;i++){const v=scores[i]+(active[i]?pot:0);if(v>first){second=first;first=v;index=i;}else if(v>second)second=v;}return{first,second,index};}
  function adjusted(base,gap,remaining){return base*clamp(1+gap/(220*Math.sqrt(remaining)),.55,3.5);}
  function fastHazard(pot,gap,remaining,base){if(remaining===1&&pot<gap)return .015;const t=adjusted(base,gap,remaining);return .025+.95/(1+Math.exp(-Math.log(Math.max(1,pot)/t)/.48));}
  function hazard(pot,scores,i,remaining,base){const t=leaders(scores),lead=t.index===i?t.second:t.first;return fastHazard(pot,lead-scores[i],remaining,base);}
  function modelHazard(m,pot,scores,i,remaining,context={},top=leaders(scores)){
    if(m.family==='noisy')return .13;
    const sigmoid=t=>.025+.95/(1+Math.exp(-Math.log(Math.max(1,pot)/Math.max(1,t))/.48));
    if(m.family==='fixed')return sigmoid(m.base);
    const active=context.active||scores.map(()=>true),banked=context.banked||scores.map(()=>0),last=context.lastBank??-1;
    const other=top.index===i?top.second:top.first;
    const potential=context.potentialTop||potentialLeaders(scores,active,pot);
    const gap=(potential.index===i?potential.second:potential.first)-(scores[i]+(active[i]?pot:0));
    let h=m.family==='chaser'?sigmoid(m.base*clamp(1+gap/(100*Math.sqrt(remaining)),.25,8)):fastHazard(pot,gap,remaining,m.base);
    if(m.family==='reactive'&&last>=0&&last!==i)h=Math.max(h,.8);
    if(m.family==='matcher'||m.family==='strategic'){
      if(scores.length===2){const j=1-i;if(active[j]&&scores[i]>=scores[j])return .005;if(!active[j]&&scores[i]+pot>scores[j])return .995;}
      if(m.family==='matcher'){let rival=-1,best=-Infinity;for(let j=0;j<scores.length;j++)if(j!==i&&scores[j]-(banked[j]||0)>best){best=scores[j]-(banked[j]||0);rival=j;}if(last===rival)h=Math.max(h,.97);else h*=.25;}
    }
    if(['chaser','strategic'].includes(m.family)&&remaining===1){
      if(scores[i]+pot<=other)return .005;
      if(!active.some((v,j)=>j!==i&&v))return .995;
    }
    return clamp(h,.005,.995);
  }
  function observe(p,pot,scores,i,remaining,banked,context={}){
    if(p.style!=='learn')return;
    if(!p.evidence)p.evidence=bases.map(()=>0);
    bases.forEach((b,j)=>{const h=hazard(pot,scores,i,remaining,b);p.evidence[j]=p.evidence[j]*.997+Math.log(banked?h:1-h);});
    let m=Math.max(...p.evidence);p.evidence=p.evidence.map(v=>v-m);
    if(p.modelVersion!==modelVersion||p.modelEvidence?.length!==models.length){p.modelEvidence=models.map(()=>0);p.modelVersion=modelVersion;p.modelObservations=0;}
    const top=leaders(scores);context={...context,potentialTop:leaders(scores.map((v,j)=>v+((context.active?.[j]??true)?pot:0)))};
    models.forEach((model,j)=>{const h=modelHazard(model,pot,scores,i,remaining,context,top);p.modelEvidence[j]=p.modelEvidence[j]*.995+Math.log(banked?h:1-h);});
    m=Math.max(...p.modelEvidence);p.modelEvidence=p.modelEvidence.map(v=>Math.max(-60,v-m));
    p.observations=(p.observations||0)+1;p.modelObservations=(p.modelObservations||0)+1;
  }
  function modelSummary(p){const w=modelWeights(p),totals=families.map((family,f)=>({family,weight:w.reduce((sum,v,i)=>sum+(models[i].f===f?v:0),0)})).sort((a,b)=>b.weight-a.weight);return{...totals[0],observations:p.modelObservations||0,families:totals};}
  function reward(scores){let max=-Infinity,ties=0;for(const v of scores){if(v>max){max=v;ties=1;}else if(v===max)ties++;}return scores[0]===max?1/ties:0;}
  function transition(pot,rolls,a,b){if(rolls<3)return{pot:pot+(a+b===7?70:a+b),bust:false};if(a+b===7)return{pot:0,bust:true};return{pot:a===b?pot*2:pot+a+b,bust:false};}
  function hittingTable(target){const v=new Float64Array(target+1);for(let b=target-1;b>=0;b--){let total=b===0?0:6*(2*b>=target?1:v[2*b]);for(let j=0;j<sums.length;j++)total+=counts[j]*(b+sums[j]>=target?1:v[b+sums[j]]);v[b]=total/(b===0?30:36);}v[target]=1;return v;}
  function coarseHittingTable(target,step,up){
    const end=up?Math.floor(target/step):Math.ceil(target/step),v=new Float64Array(end+1);
    for(let b=end-1;b>=0;b--){let total=0,self=0;const twice=2*b;if(twice===b)self+=6;else total+=6*(twice>=end?1:v[twice]);for(let j=0;j<sums.length;j++){const next=b+(up?Math.ceil(sums[j]/step):Math.floor(sums[j]/step));if(next===b)self+=counts[j];else total+=counts[j]*(next>=end?1:v[next]);}v[b]=total/(36-self);}v[end]=1;return v;
  }
  function reachModel(target){
    const goal=Math.max(0,Math.ceil(target));if(goal<=16384)return{goal,exact:true,table:hittingTable(goal)};
    const step=Math.ceil(goal/4096);return{goal,exact:false,step,lower:coarseHittingTable(goal,step,false),upper:coarseHittingTable(goal,step,true)};
  }
  function reachAt(model,pot){
    if(pot>=model.goal)return{lower:1,upper:1,exact:true};
    if(model.exact){const value=model.table[pot];return{lower:value,upper:value,exact:true};}
    const lower=model.lower[Math.min(model.lower.length-1,Math.floor(pot/model.step))],upper=model.upper[Math.min(model.upper.length-1,Math.ceil(pot/model.step))];return{lower,upper,exact:false};
  }
  function leadTarget(s){let other=-Infinity;for(let i=1;i<s.players.length;i++)other=Math.max(other,s.players[i].score);return Math.max(0,other-s.players[0].score+1);}
  function reachMetric(s){const target=leadTarget(s),value=s.pot>=target?{lower:1,upper:1,exact:true}:reachAt(reachModel(target),s.pot);return{...value,target,pot:s.pot,alreadyReached:s.pot>=target};}
  function exactEnd(s){if(s.rolls<3)return null;if(s.round!==s.rounds||!s.players[0].active||s.players.slice(1).some(p=>p.active))return null;const scores=s.players.map(p=>p.score),other=Math.max(...scores.slice(1)),tied=scores.slice(1).filter(v=>v===other).length;const bank=scores[0]+s.pot>other?1:scores[0]+s.pot===other?1/(tied+1):0,bust=scores[0]>other?1:scores[0]===other?1/(tied+1):0,target=Math.max(0,other-scores[0]+1);if(target>250000)return{action:bank===1?'BANK':'ROLL',bank,roll:null,exact:true,target};const table=hittingTable(target),at=x=>x>=target?1:bust+(1-bust)*table[x];let roll=6*bust+6*at(2*s.pot);for(let j=0;j<sums.length;j++)roll+=counts[j]*at(s.pot+sums[j]);roll/=36;return{action:bank===1?'BANK':'ROLL',bank,roll,exact:true,target};}
  function guaranteed(s){
    if(s.rolls<3||!s.players[0].active)return null;
    if(s.round===s.rounds&&s.players.slice(1).filter(p=>p.active).length===1&&s.players.slice(1).every(p=>s.players[0].score>p.score))return{action:'WAIT',bank:null,roll:1,exact:true,samples:0,guarantee:'final-shadow',reason:'Only one opponent remains active and your existing score already leads everyone. Stay in, then match their BANK before the next roll to preserve the win.'};
    if(s.players.length!==2)return null;
    const me=s.players[0],op=s.players[1];
    if(op.active&&me.score>op.score)return{action:'WAIT',bank:null,roll:1,exact:true,samples:0,guarantee:'shadow',reason:'Stay in while your opponent stays in. If they BANK, match it before the next roll. This preserves your lead through every remaining round.'};
    if(!op.active&&me.score+s.pot>op.score)return{action:'BANK',bank:1,roll:null,exact:true,samples:0,guarantee:'lock',reason:'Bank to secure a lead. In later rounds, stay in until your opponent BANKs, then match their bank to preserve it.'};
    return null;
  }
  function prepare(s){return{round:s.round,rounds:s.rounds,initialRound:s.round,initialStep:s.rolls,pot:s.pot,step:s.rolls,scores:s.players.map(p=>p.score),active:s.players.map(p=>p.active),banked:s.players.map(p=>p.banked||0),lastBank:s.lastBank??-1,done:false,guarded:false};}
  function makeWorld(seed,post,stratum){return{seed,stratum,styles:post.map((w,i)=>{let x=hash(seed,-11,-7,i);for(let j=0;j<w.length;j++){x-=w[j];if(x<=0)return w.length===bases.length?{family:'adaptive',base:bases[j]}:models[j];}return w.length===bases.length?{family:'adaptive',base:bases.at(-1)}:models.at(-1);})};}
  function dice(g,w){if(g.round===g.initialRound&&g.step===g.initialStep&&w.stratum!==undefined)return[1+Math.floor(w.stratum/6),1+w.stratum%6];return[1+Math.floor(6*hash(w.seed,g.round,g.step,0)),1+Math.floor(6*hash(w.seed,g.round,g.step,1))];}
  function nextRound(g,w){if(g.round===g.rounds){g.done=true;return;}g.round++;g.pot=0;g.step=0;g.active.fill(true);g.banked.fill(0);g.lastBank=-1;for(let j=0;j<3;j++){const[a,b]=dice(g,w);g.pot+=a+b===7?70:a+b;g.step++;}}
  function bankAt(g,i){g.scores[i]+=g.pot;g.banked[i]=g.pot;g.active[i]=false;g.lastBank=i;}
  function advance(g,action,w){
    if(g.done)return;
    if(g.active[0]&&action===0)bankAt(g,0);
    for(;;){
      if(!g.active.some(Boolean)){nextRound(g,w);return;}
      const top=leaders(g.scores),remaining=g.rounds-g.round+1;g.potentialTop=potentialLeaders(g.scores,g.active,g.pot);
      const n=g.active.length,offset=Math.floor(hash(w.seed,g.round,g.step,500)*Math.max(1,n-1));
      let changed=false;
      for(let k=0;k<n-1;k++){
        const i=1+(k+offset)%(n-1);if(!g.active[i])continue;
        const m=typeof w.styles[i]==='number'?{family:'adaptive',base:w.styles[i]}:w.styles[i];
        const h=modelHazard(m,g.pot,g.scores,i,remaining,g,top);
        if(hash(w.seed,g.round,g.step,i+10)<h){bankAt(g,i);changed=true;break;}
      }
      if(changed){if(g.active[0])return;continue;}
      const[a,b]=dice(g,w),sum=a+b;g.pot=sum===7?0:a===b?g.pot*2:g.pot+sum;g.step++;g.lastBank=-1;
      if(sum===7){nextRound(g,w);return;}
      if(g.step>=183||!Number.isSafeInteger(g.pot)){g.guarded=true;nextRound(g,w);return;}
      if(g.active[0])return;
    }
  }
  function soloValue(g,cache){
    if(g.active[0]&&g.scores.length===2&&((g.active[1]&&g.scores[0]>g.scores[1])||(!g.active[1]&&g.scores[0]+g.pot>g.scores[1])))return 1;
    if(g.round!==g.rounds||!g.active[0])return null;
    if(g.active.filter(Boolean).length===2&&g.scores.slice(1).every(v=>g.scores[0]>v))return 1;
    let other=-Infinity,ties=0;for(let i=1;i<g.active.length;i++){if(g.active[i])return null;other=Math.max(other,g.scores[i]);}
    const target=other-g.scores[0]+1;if(g.pot>=target)return 1;if(target>6000)return null;
    for(let i=1;i<g.scores.length;i++)if(g.scores[i]===other)ties++;
    const bust=g.scores[0]===other?1/(ties+1):0;
    let table=cache.get(target);if(!table){if(cache.size>=32)cache.delete(cache.keys().next().value);table=hittingTable(target);cache.set(target,table);}
    return bust+(1-bust)*table[g.pot];
  }
  function policyAction(g,p){
    let other=-Infinity,banked=-Infinity,opponents=0;for(let i=1;i<g.scores.length;i++){other=Math.max(other,g.scores[i]);if(g.active[i])opponents++;else banked=Math.max(banked,g.scores[i]);}
    if(g.round===g.rounds&&opponents===1&&g.scores[0]>other)return 1;
    if(g.scores.length===2){if(g.active[1]&&g.scores[0]>=g.scores[1])return 1;if(!g.active[1]&&g.scores[0]+g.pot>g.scores[1])return 0;}
    const final=g.round===g.rounds;if(final&&!opponents)return g.scores[0]+g.pot>other?0:1;
    if(final&&g.scores[0]+g.pot<=other)return 1;
    if(p.patient&&opponents===g.active.length-1&&opponents)return 1;
    const current=g.round===g.initialRound,rem=g.rounds-g.round+1;
    let t=current?p.threshold:adjusted(p.future,other-g.scores[0],rem);
    if(current&&p.adaptive)t=adjusted(p.threshold,other-g.scores[0],rem);
    if(p.competitive&&Number.isFinite(banked)&&rem<=3)t=Math.max(t,(banked-g.scores[0]+1)/Math.sqrt(rem));
    if(p.reactive&&g.lastBank>=0&&g.scores[0]+g.pot>other)t=Math.min(t,g.pot);
    if(current&&p.reach){if(g.pot>=p.reach.goal)t=Math.min(t,p.reach.goal);else if(reachAt(p.reach,g.pot).lower>=p.reachRisk)t=Math.max(t,p.reach.goal);}
    return g.pot>=t?0:1;
  }
  function rollout(g,w,p,cache){for(let k=0;k<Math.max(450,(g.rounds-g.round+1)*(g.active.length+12))&&!g.done;k++){const exact=soloValue(g,cache);if(exact!==null)return exact;advance(g,policyAction(g,p),w);}if(!g.done)g.guarded=true;return reward(g.scores);}
  function key(g){return g.round+':'+g.pot+':'+g.lastBank+':'+g.scores.join(',')+':'+g.active.map(v=>v?'1':'0').join('')+':'+g.banked.join(',');}
  function node(){return{n:[0,0],sum:[0,0],squares:[0,0],child:[new Map(),new Map()]};}
  function choose(n,fallback,training){const total=n.n[0]+n.n[1];if(!training){if(Math.min(...n.n)<10||total<36)return fallback;return n.sum[1]/n.n[1]>n.sum[0]/n.n[0]?1:0;}if(!n.n[fallback])return fallback;if(!n.n[1-fallback])return 1-fallback;const u=a=>n.sum[a]/n.n[a]+.62*Math.sqrt(Math.log(total+1)/n.n[a]);return u(1)>u(0)?1:0;}
  function walk(g,w,p,root,action,training,ctx){let n=root,a=action,depth=0;const path=[];for(;;){path.push([n,a]);advance(g,a,w);let value=g.done?reward(g.scores):soloValue(g,ctx.cache);if(value===null){if(depth>=10)value=rollout(g,w,p,ctx.cache);else{const k=key(g);let child=n.child[a].get(k);if(!child){if(training&&ctx.nodes<ctx.maxNodes){child=node();n.child[a].set(k,child);ctx.nodes++;}value=rollout(g,w,p,ctx.cache);}else{n=child;a=choose(n,policyAction(g,p),training);depth++;continue;}}}if(training)for(const[n,a]of path){n.n[a]++;n.sum[a]+=value;n.squares[a]+=value*value;}ctx.guarded+=g.guarded?1:0;return value;}}
  function one(s,p,action,seed,post,stratum,ctx){const g=prepare(s),w=makeWorld(seed,post,stratum);advance(g,action,w);const value=g.done?reward(g.scores):rollout(g,w,p,ctx.cache);ctx.guarded+=g.guarded?1:0;return value;}
  function plans(s,targetAware=true){
    let other=-Infinity;for(let i=1;i<s.players.length;i++)other=Math.max(other,s.players[i].score);
    const thresholds=[s.pot+1,55,100,180,320,550,1000,2200,other-s.players[0].score+1],out=[];
    for(const t of new Set(thresholds.map(v=>Math.max(s.pot+1,v))))for(const future of[100,250,550,1200])out.push({threshold:t,future,adaptive:false,competitive:true});
    for(const future of[55,100,180,320,550,1000,1800])out.push({threshold:future,future,adaptive:true,competitive:true});
    for(const future of[100,250,550,1200])out.push({threshold:future,future,adaptive:true,competitive:true,reactive:true,patient:true});
    if(targetAware&&s.round<s.rounds){const goal=leadTarget(s);if(goal>s.pot){const reach=reachModel(goal),base=clamp(24*s.players.length*Math.sqrt(s.rounds),100,1400);for(const reachRisk of[.25,.5,.75])for(const future of[100,250,550])out.push({threshold:base,future,adaptive:true,competitive:true,reactive:true,patient:true,reach,reachRisk});}}
    return out;
  }
  function analyzePart(s,options={},progress=()=>{}){
    const started=clock(),exact=exactEnd(s),lock=exact?null:guaranteed(s);if(lock)return{...lock,elapsed:clock()-started};const bankLoses=s.round===s.rounds&&s.players.slice(1).some(p=>p.score>s.players[0].score+s.pot);if(exact&&exact.roll!==null)return{...exact,samples:0,elapsed:clock()-started};
    const until=options.deadline||started+(options.budgetMs||4000),span=Math.max(20,until-started),seed=options.seed??1234567;
    const stratum=(t,salt)=>((13*t+Math.floor(hash(seed,0,0,salt)*36))%36);
    const work=options.work;const keepGoing=(phase,count,time)=>work?count<(work[phase]||1):clock()<time;
    const policyUntil=started+span*.14,treeUntil=started+span*.56,tuneUntil=started+span*.68;
    const ctx={cache:new Map(),nodes:1,maxNodes:options.maxNodes||24000,guarded:0},post=s.players.map(p=>modelWeights(p)),stress=scenarios.map((_,i)=>s.players.map(p=>modelWeights(p,i))),all=plans(s,options.targetAware!==false&&s.targetAware!==false),records=all.map((p,i)=>({p,i,n:0,b:0,r:0}));
    let pool=records.slice(),trial=0,searchGames=0,evaluatedOutcomes=0,nextProgress=started;
    const report=phase=>{const now=clock();if(now>=nextProgress){progress({phase,elapsed:now-started,nodes:ctx.nodes,games:searchGames,outcomes:evaluatedOutcomes});nextProgress=now+160;}};
    do{for(let batch=0;batch<12;batch++){const t=trial++,worldseed=(seed+Math.imul(t+1,104729))>>>0;for(const rec of pool){rec.b+=one(s,rec.p,0,worldseed,post,stratum(t,101),ctx);rec.r+=one(s,rec.p,1,worldseed,post,stratum(t,101),ctx);rec.n++;searchGames+=2;}if(work?trial>=work.policy:clock()>=policyUntil)break;}if(pool.length>4){const take=Math.max(1,Math.ceil(pool.length/4)),keep=new Set([...pool.slice().sort((a,b)=>b.b/b.n-a.b/a.n).slice(0,take),...pool.slice().sort((a,b)=>b.r/b.n-a.r/a.n).slice(0,take)]);pool=[...keep];}report('Finding banking plans');}while(keepGoing('policy',trial,policyUntil));
    const candidates=pool.filter(r=>r.n>0),bp=candidates.slice().sort((a,b)=>b.b/b.n-a.b/a.n)[0].p,rp=candidates.slice().sort((a,b)=>b.r/b.n-a.r/a.n)[0].p;
    const roots=[node(),node()],selected=[bp,rp];let treeTrials=0;
    do{for(let k=0;k<(work?1:12);k++){const t=treeTrials++,worldseed=(seed^0x71bca321)+Math.imul(t+1,13007);for(let a=0;a<2;a++){walk(prepare(s),makeWorld(worldseed,post,stratum(t,211)),selected[a],roots[a],a,true,ctx);searchGames++;}}report('Searching future decisions');}while(keepGoing('tree',treeTrials,treeUntil));
    const tune=[{d:0,d2:0,n:0},{d:0,d2:0,n:0}];let tuning=0;
    do{for(let k=0;k<(work?1:12);k++){const t=tuning++,worldseed=(seed^0x439bef81)+Math.imul(t+1,65537);for(let a=0;a<2;a++){const tree=walk(prepare(s),makeWorld(worldseed,post,stratum(t,307)),selected[a],roots[a],a,false,ctx),base=one(s,selected[a],a,worldseed,post,stratum(t,307),ctx),d=tree-base;tune[a].d+=d;tune[a].d2+=d*d;tune[a].n++;searchGames+=2;}}report('Checking search improvements');}while(keepGoing('tune',tuning,tuneUntil));
    const useTree=tune.map(t=>t.d/t.n>Math.sqrt(Math.max(0,t.d2/t.n-(t.d/t.n)**2)/t.n));
    let n=0,b=0,r=0,b2=0,r2=0,d=0,d2=0,validation=0;
    const sensitivity=scenarios.map(name=>({name,n:0,b:0,r:0,d:0,d2:0}));
    do{
      const t=validation++,scenario=t%4===3?1+(Math.floor(t/4)%4):0,worldseed=(seed^0xb83a1375)+Math.imul(t+1,99991),v=[0,0];
      for(const outcome of chance)for(let a=0;a<2;a++){
        const value=useTree[a]?walk(prepare(s),makeWorld(worldseed,stress[scenario],outcome.face),selected[a],roots[a],a,false,ctx):one(s,selected[a],a,worldseed,stress[scenario],outcome.face,ctx);
        v[a]+=outcome.count*value/36;
      }
      const delta=v[1]-v[0],group=sensitivity[scenario];group.n++;group.b+=v[0];group.r+=v[1];group.d+=delta;group.d2+=delta*delta;
      if(scenario===0){b+=v[0];r+=v[1];b2+=v[0]*v[0];r2+=v[1]*v[1];d+=delta;d2+=delta*delta;n++;}
      evaluatedOutcomes+=chance.length;
      report('Checking chance outcomes and opponent assumptions');
    }while(keepGoing('validation',validation,until));
    const fallbackThreshold=clamp(24*s.players.length*Math.sqrt(s.rounds),100,1400);
    const fallbackAction=policyAction(prepare(s),{threshold:fallbackThreshold,future:fallbackThreshold,adaptive:true,competitive:true,reactive:true,patient:true})===0?'BANK':'ROLL';
    return{n,b,r,b2,r2,d,d2,fallbackAction,sensitivity,enumeratedOutcomes:validation*chance.length,nodes:ctx.nodes,searchGames,plans:all.length,treeTrials,useTree,guarded:ctx.guarded,exact:!!exact,exactAction:exact?.action,bankLoses,elapsed:clock()-started};
  }

  function combine(parts){
    const exact=parts.find(p=>p.exact&&p.samples===0);if(exact)return{...exact,workers:1};
    const totals={n:0,b:0,r:0,b2:0,r2:0,d:0,d2:0,nodes:0,searchGames:0,treeTrials:0,guarded:0,enumeratedOutcomes:0};
    for(const p of parts)for(const k of Object.keys(totals))totals[k]+=p[k]||0;
    const n=totals.n,bank=totals.b/n,roll=totals.r/n,se=Math.sqrt(Math.max(0,totals.d2/n-(totals.d/n)**2)/Math.max(1,n-1)),bankMargin=1.96*Math.sqrt(Math.max(0,totals.b2/n-bank*bank)/Math.max(1,n-1)),rollMargin=1.96*Math.sqrt(Math.max(0,totals.r2/n-roll*roll)/Math.max(1,n-1));
    const sensitivity=scenarios.map((name,i)=>{let n=0,b=0,r=0,d=0,d2=0;for(const p of parts){const g=p.sensitivity?.[i];if(g){n+=g.n;b+=g.b;r+=g.r;d+=g.d;d2+=g.d2;}}const delta=n?d/n:0;return{name,n,bank:n?b/n:null,roll:n?r/n:null,delta,margin:n>1?1.96*Math.sqrt(Math.max(0,d2/n-delta*delta)/(n-1)):1};});
    const reliable=sensitivity.filter(g=>g.n>=24),modelSensitive=reliable.some(g=>g.delta>g.margin)&&reliable.some(g=>g.delta< -g.margin);
    const close=Math.abs(roll-bank)<=1.96*se,bankLoses=parts.some(p=>p.bankLoses);
    let priorTieBreak=false;let action=parts.find(p=>p.exactAction)?.exactAction||(bankLoses?'ROLL':roll>bank?'ROLL':'BANK'),robustTieBreak=false;
    if(close&&!bankLoses&&!parts.some(p=>p.exactAction)){
      const fallback=parts.find(p=>p.fallbackAction)?.fallbackAction;
      if(fallback){priorTieBreak=action!==fallback;action=fallback;}
    }
    return{action,bankLoses,bank,roll,se,bankMargin,rollMargin,close,sensitivity,modelSensitive,robustTieBreak,priorTieBreak,modelRange:reliable.length?[Math.min(...reliable.map(g=>g.delta)),Math.max(...reliable.map(g=>g.delta))]:null,samples:n,workers:parts.length,nodes:totals.nodes,searchGames:totals.searchGames,treeTrials:totals.treeTrials,enumeratedOutcomes:totals.enumeratedOutcomes,treeUsed:parts.some(p=>p.useTree?.some(Boolean)),plans:Math.max(...parts.map(p=>p.plans||0)),guarded:totals.guarded,elapsed:Math.max(...parts.map(p=>p.elapsed)),exact:parts.some(p=>p.exact),agreement:parts.filter(p=>(p.r>p.b?'ROLL':'BANK')===action).length};
  }
  function analyze(s,quality='deep',progress=()=>{}){return combine([analyzePart(s,{budgetMs:quality==='deep'?4000:1000},progress)]);}
  return{reachModel,reachAt,reachMetric,leadTarget,bases,models,families,modelVersion,modelWeights,modelHazard,modelSummary,scenarios,chance,guaranteed,weights,observe,hazard,transition,exactEnd,analyzePart,combine,analyze,reward,prepare,advance,makeWorld,policyAction,hittingTable};
}
if(typeof module!=='undefined')module.exports=bankEngine;
