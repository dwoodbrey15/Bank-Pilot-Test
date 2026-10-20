(function(root){
'use strict';
const medians=[0,97,200,308,422,531,650,770,887,1002,1120,1241,1364,1487,1609,1730,1849,1969,2090,2212,2335];
const defaults={future:.4,blend:0,shadow:true,reactive:false,finalWait:true,leadDiscount:0};
function create(solo,parameters={}){
 const config={...defaults,...parameters};
 function decide(state,seat=state.mySeat??0){
  if(state.rounds!==20||state.players.length<2||!state.players[seat])throw Error('Requires a 20-round multiplayer game.');
  const me=state.players[seat],rivals=state.players.filter((_,i)=>i!==seat),active=rivals.filter(p=>p.active),rounds=21-state.round,pot=state.pot;
  const leader=Math.max(...rivals.map(p=>p.score)),lead=me.score-leader,final=rounds===1;
  if(rivals.length===1&&!active.length&&me.score+pot>leader)return{action:'BANK',reason:'heads-up-lock',needed:0};
  if(config.shadow&&active.length===rivals.length&&lead>0)return{action:'WAIT',reason:'shadow-all-active',needed:null};
  if(final&&active.length===1&&lead>0)return{action:'WAIT',reason:'final-shadow',needed:0};
  if(final&&active.length===0)return{action:me.score+pot>leader?'BANK':'ROLL',reason:'final-last-active',needed:Math.max(0,leader-me.score+1)};
  if(config.finalWait&&final&&active.some(p=>p.score>=me.score))return{action:'WAIT',reason:'higher-rival-active',needed:Math.max(0,leader-me.score+1)};
  if(config.reactive&&state.lastBank>=0&&state.lastBank!==seat&&me.score+pot>leader)return{action:'BANK',reason:'bank-response',needed:0};
  const raw=leader+1+config.future*medians[rounds-1]-me.score;
  let needed=Math.ceil((1-config.blend)*raw+config.blend*(2335-me.score));
  if(lead>0)needed=Math.ceil(needed-config.leadDiscount*lead*(1-(rounds-1)/19));
  if(needed<=0)return{action:'BANK',reason:'relative-goal-met',needed:0};
  const scaled=needed>solo.target,lookupNeeded=scaled?solo.target:needed,lookupPot=scaled?Math.floor(pot*solo.target/needed):pot;
  return{action:solo.bank(rounds,lookupNeeded,lookupPot)?'BANK':'ROLL',reason:'relative-target',needed,scaled,rounds,config};
 }
 return{decide,config};
}
root.BankMultiplayer={create,defaults,medians};if(typeof module!=='undefined')module.exports=root.BankMultiplayer;
})(typeof globalThis!=='undefined'?globalThis:this);
