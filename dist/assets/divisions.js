/* Derive halves and quarters from the exact, verified eighth boundaries. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.QURAN_DATA){
  root.QURAN_DATA.halves=api.groupEighths(root.QURAN_DATA.eighths,4,'half');
  root.QURAN_DATA.quarters=api.groupEighths(root.QURAN_DATA.eighths,2,'quarter');
  root.ATHMAN_DIVISIONS=api;
 }
})(typeof window==='object'?window:null,function(){
 'use strict';
 function groupEighths(eighths,size,kind){
  return Array.from({length:eighths.length/size},(_,i)=>{
   const first=eighths[i*size],last=eighths[(i+1)*size-1];
   return {...first,id:i+1,pos:Math.floor((first.pos-1)/size)+1,kind,size,
    firstEighth:first.id,lastEighth:last.id,endSura:last.endSura,endAya:last.endAya,
    endIndex:last.endIndex,endOffset:last.endOffset};
  });
 }
 function eighthIds(part){
  const first=part.firstEighth||part.id,last=part.lastEighth||part.id;
  return Array.from({length:last-first+1},(_,i)=>first+i);
 }
 function isReviewed(part,completed){return eighthIds(part).every(id=>completed.has(id))}
 function setReviewed(part,completed,reviewed){for(const id of eighthIds(part)){if(reviewed)completed.add(id);else completed.delete(id)}}
 // The mark is structural, including boundaries inside an ayah. Its source
 // word offset must never be included among the words to be recognized.
 function markersForVerse(eighths,unit,tokenize){
  return eighths.filter(e=>e.sura===unit.sura&&e.aya===unit.aya).map(e=>({id:e.id,hizb:e.hizb,part:e.pos,word:tokenize(unit.text.slice(0,e.startOffset)).length}));
 }
 return {groupEighths,eighthIds,isReviewed,setReviewed,markersForVerse};
});
