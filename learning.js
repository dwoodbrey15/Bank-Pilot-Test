(function(root){
'use strict';
const N=root.BankNet||(typeof require==='function'?require('./neural.js'):null),clip=(x,a,b)=>Math.max(a,Math.min(b,x)),logp=(p,a)=>a?Math.log(Math.max(1e-8,p)):Math.log(Math.max(1e-8,1-p)),kinds=['fixed','adaptive','reactive','matcher','photo','random','teacher','chaser'];
function trajectories(model,league,config,seed,games=1){const random=N.rng(seed),samples=[],records=[];let forced=0;
 for(let game=0;game<games;game++){
  const n=config.minPlayers+Math.floor(random()*(config.maxPlayers-config.minPlayers+1)),rounds=config.rounds[Math.floor(random()*config.rounds.length)],s=new N.Game(N.hash(seed,game,17),n,rounds),all=random()<.5,learner=Math.floor(random()*n),lines=Array.from({length:n},()=>[]),policies=Array.from({length:n},(_,i)=>{if(all||i===learner||random()<.2)return{type:'current'};if(league.length&&random()<.4)return{type:'snapshot',net:league[Math.floor(random()*league.length)]};return{type:'script',kind:kinds[Math.floor(random()*kinds.length)],base:[40,70,100,150,200,300,500,900][Math.floor(random()*8)]};});
  if(config.randomStarts!==false&&random()<.2){s.round=1+Math.floor(random()*s.rounds);const scale=10**(2+6*random());for(const p of s.players)p.score=Math.floor(random()*scale);}
  const startRound=s.round;
  while(!s.finished){const actor=s.actor,policy=policies[actor];let action;
   if(policy.type==='current'){const x=N.features(s,actor),out=N.forward(model,x),proof=N.oracle(s,actor),label=N.teacher(s,actor)?1:0;action=proof?proof.action==='BANK':model.updates<3?(random()<.05?random()<.5:!!label):random()<out.p;const mask=proof?0:1;if(proof)forced++;lines[actor].push({x,a:action?1:0,old:logp(out.p,action),v:out.v,mask,label});}
   else if(policy.type==='snapshot'){const proof=N.oracle(s,actor);action=proof?proof.action==='BANK':random()<N.forward(policy.net,N.features(s,actor)).p;}
   else action=N.heuristic(s,actor,policy.kind,policy.base,random);
   s.step(action);
  }
  const result=s.returns();for(let actor=0;actor<n;actor++){const line=lines[actor];let gae=0,nextValue=0;for(let t=line.length-1;t>=0;t--){const row=line[t],r=t===line.length-1?result[actor]:0,delta=r+nextValue-row.v;gae=delta+.95*gae;row.adv=gae;row.ret=gae+row.v;nextValue=row.v;}samples.push(...line);}
  records.push({players:n,rounds,startRound,seed:s.seed,score:s.players.map(p=>String(p.score)),shares:result,events:s.events});
 }
 return{samples,records,forced};
}
function optimizer(model){return{step:0,m:N.gradients(model),v:N.gradients(model)};}
function serializeOptimizer(opt){return{step:opt.step,m:opt.m.map(l=>({w:Array.from(l.w),b:Array.from(l.b)})),v:opt.v.map(l=>({w:Array.from(l.w),b:Array.from(l.b)}))};}
function restoreOptimizer(model,data){if(!data)return optimizer(model);if(!Number.isSafeInteger(data.step)||data.step<0)throw Error('Invalid optimizer step.');const opt=optimizer(model);opt.step=data.step;for(const name of['m','v']){if(data[name]?.length!==5)throw Error('Invalid optimizer state.');for(let k=0;k<5;k++)for(const key of['w','b']){const a=data[name][k][key],target=opt[name][k][key];if(a?.length!==target.length||!a.every(v=>Number.isFinite(v)&&(name!=='v'||v>=0)))throw Error('Invalid optimizer values.');target.set(a);if(!target.every(Number.isFinite))throw Error('Optimizer exceeds float32 range.');}}return opt;}
function objective(row,out,warmup,bc){const p=clip(out.p,1e-8,1-1e-8),v=out.v,newLog=logp(p,row.a),ratio=Math.exp(clip(newLog-row.old,-30,30)),adv=row.normalAdv,active=!(adv>=0&&ratio>1.2||adv<0&&ratio<.8),mask=row.mask,entropy=-p*Math.log(p)-(1-p)*Math.log(1-p);let actor=0,loss=0;
 if(warmup){actor=p-row.label;loss=-(row.label*Math.log(p)+(1-row.label)*Math.log(1-p));}
 else{actor=mask*((active?-adv*ratio*(row.a-p):0)+.01*Math.log(p/(1-p))*p*(1-p))+bc*(p-row.label);loss=-mask*Math.min(ratio*adv,clip(ratio,.8,1.2)*adv)-.01*mask*entropy-bc*(row.label*Math.log(p)+(1-row.label)*Math.log(1-p));}
 return{dz:Float32Array.from([actor,.5*(v-row.ret)*v*(1-v)]),loss:loss+.25*(v-row.ret)**2,entropy,kl:row.mask*(row.old-newLog)};
}
function adam(model,opt,grad,count,lr){let sq=0;for(const l of grad)for(const name of['w','b'])for(const value of l[name])sq+=(value/count)**2;const scale=Math.min(1,.5/(Math.sqrt(sq)+1e-8));opt.step++;const b1=1-.9**opt.step,b2=1-.999**opt.step;
 for(let k=0;k<5;k++)for(const name of['w','b'])for(let j=0;j<grad[k][name].length;j++){const g=grad[k][name][j]/count*scale,m=opt.m[k][name][j]=.9*opt.m[k][name][j]+.1*g,v=opt.v[k][name][j]=.999*opt.v[k][name][j]+.001*g*g;model.layers[k][name][j]-=lr*(m/b1)/(Math.sqrt(v/b2)+1e-8);}
}
async function update(model,opt,samples,config={},progress=()=>{}){if(!samples.length)throw Error('No training samples.');const random=N.rng(8171+model.updates),mean=samples.reduce((s,r)=>s+r.adv,0)/samples.length,std=Math.sqrt(samples.reduce((s,r)=>s+(r.adv-mean)**2,0)/samples.length+1e-8);for(const r of samples)r.normalAdv=(r.adv-mean)/std;
 const warmup=model.updates<3,epochs=config.epochs||3,batchSize=config.batchSize||32,lr=config.lr||.0003,bc=warmup?0:.02*Math.max(0,1-model.updates/100);let loss=0,entropy=0,kl=0,seen=0,steps=0;
 epochLoop:for(let epoch=0;epoch<epochs;epoch++){for(let i=samples.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[samples[i],samples[j]]=[samples[j],samples[i]];}for(let start=0;start<samples.length;start+=batchSize){const grad=N.gradients(model),end=Math.min(samples.length,start+batchSize);let blockKL=0,blockActors=0;for(let i=start;i<end;i++){const row=samples[i],out=N.forward(model,row.x,true),o=objective(row,out,warmup,bc);N.backward(model,grad,out,o.dz);loss+=o.loss;entropy+=o.entropy;kl+=o.kl;blockKL+=o.kl;blockActors+=row.mask;seen++;}adam(model,opt,grad,end-start,lr);steps++;if(steps%4===0){progress({stage:warmup?'Warm-start imitation':'PPO update',fraction:(epoch+(end/samples.length))/epochs});await new Promise(r=>setTimeout(r,0));}if(!warmup&&blockActors>0&&blockKL/blockActors>.04)break epochLoop;}}
 model.updates++;return{loss:loss/seen,entropy:entropy/seen,kl:kl/seen,samples:samples.length,steps,warmup};
}
function evaluation(model,config,seed,index,reference=false){const n=2+index%11,rounds=[10,15,20][Math.floor(index/11)%3],s=new N.Game(N.hash(seed,index,61),n,rounds),random=N.rng(N.hash(seed,index,51)),seat=index%n,policies=Array.from({length:n},()=>({kind:kinds[Math.floor(random()*kinds.length)],base:[50,100,150,200,300,500,900][Math.floor(random()*7)]}));let decisions=0,milliseconds=0;
 while(!s.finished){const actor=s.actor;let bank;if(actor===seat){if(reference)bank=N.teacher(s,actor);else{const began=typeof performance!=='undefined'?performance.now():Date.now(),out=N.infer(model,s,actor);milliseconds+=(typeof performance!=='undefined'?performance.now():Date.now())-began;decisions++;bank=out.action==='BANK';}}else bank=N.heuristic(s,actor,policies[actor].kind,policies[actor].base,random);s.step(bank);}
 return{players:n,rounds,seed:s.seed,baseSeed:seed,index,modelUpdates:model.updates,seat,win:s.returns()[seat],baseline:1/n,decisions,milliseconds,scores:s.players.map(p=>String(p.score))};
}
root.BankLearning={trajectories,optimizer,serializeOptimizer,restoreOptimizer,objective,adam,update,evaluation};if(typeof module!=='undefined')module.exports=root.BankLearning;
})(typeof globalThis!=='undefined'?globalThis:this);
