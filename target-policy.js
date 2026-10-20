(function(root){
'use strict';
function create(solo){return{decide(state,seat=state.mySeat??0){if(state.rounds!==20||state.players.length<2||!state.players[seat])throw Error('The multiplayer solo-target policy requires a 20-round game.');return{...solo.advice({...state,players:[state.players[seat]]}),objective:'personal-score-target',target:2335};}};}
root.BankTarget={create};if(typeof module!=='undefined')module.exports=root.BankTarget;
})(typeof globalThis!=='undefined'?globalThis:this);
