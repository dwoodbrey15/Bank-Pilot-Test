importScripts('./engine.js','./neural.js','./learning.js');
onmessage=async e=>{try{const m=e.data,N=BankNet,L=BankLearning;
 if(m.type==='rollout'){const model=N.unpack(m.model),league=(m.league||[]).map(N.unpack),all={samples:[],records:[],forced:0};for(let i=0;i<m.games;i++){const r=L.trajectories(model,league,m.config,N.hash(m.seed,i,71),1);all.samples.push(...r.samples);all.records.push(...r.records);all.forced+=r.forced;postMessage({progress:{stage:'Self-play',games:i+1,total:m.games}});await new Promise(r=>setTimeout(r,0));}postMessage({type:'rollout',batch:all});}
 else if(m.type==='update'){const model=N.unpack(m.model),opt=L.restoreOptimizer(model,m.optimizer),metrics=await L.update(model,opt,m.samples,m.config,p=>postMessage({progress:p}));model.games+=(m.games||0);postMessage({type:'update',model:N.pack(model),optimizer:L.serializeOptimizer(opt),metrics});}
 else if(m.type==='evaluate'){const model=N.unpack(m.model),results=[];for(let i=m.start;i<m.end;i++){const actual=L.evaluation(model,m.config,m.seed,i),reference=L.evaluation(model,m.config,m.seed,i,true);results.push({actual,reference});postMessage({progress:{stage:'Evaluation',games:i-m.start+1,total:m.end-m.start}});await new Promise(r=>setTimeout(r,0));}postMessage({type:'evaluate',results});}
 else throw Error('Unknown training command.');
 }catch(error){postMessage({error:String(error.stack||error)});}};
