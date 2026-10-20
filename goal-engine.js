(function(root){
'use strict';
function create(data){
 const width=data.maxTarget+1,raw=typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(data.thresholds,'base64')):Uint8Array.from(atob(data.thresholds),c=>c.charCodeAt(0));
 const thresholds=new Uint16Array(21*width),view=new DataView(raw.buffer);if(raw.length!==thresholds.length*2)throw Error('Incomplete goal table.');
 for(let i=0;i<thresholds.length;i++)thresholds[i]=view.getUint16(i*2,true);
 function bank(rounds,needed,pot){
  if(!Number.isInteger(rounds)||rounds<1||rounds>20||!Number.isInteger(needed)||!Number.isSafeInteger(pot)||pot<0||needed>data.maxTarget)throw Error('Goal state outside table.');
  if(needed<=0||pot>=needed)return true;
  const key=rounds*width+needed,ranges=data.exceptions[key];return ranges?ranges.some(([lo,hi])=>pot>=lo&&pot<=hi):pot>=thresholds[key];
 }
 return{target:data.maxTarget,bank,thresholds,exceptions:data.exceptions};
}
root.BankGoals={create};if(typeof module!=='undefined')module.exports=root.BankGoals;
})(typeof globalThis!=='undefined'?globalThis:this);
