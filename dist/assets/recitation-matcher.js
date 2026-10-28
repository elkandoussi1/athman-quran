/* Bounded text alignment. Phonetic resemblance is uncertainty, never read credit. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ATHMAN_MATCHER=api})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 function normalize(value){return String(value||'').normalize('NFKD').replace(/ۦ/g,'ي').replace(/ۥ/g,'و').replace(/\p{M}/gu,'').replace(/[ٱأإآ]/g,'ا').replace(/[ىے]/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/[ءـ]/g,'').replace(/[^\p{L}\p{N}]/gu,'').replace(/ة/g,'ه')}
 const families=[['س','ص'],['ت','ط'],['ذ','ز','ظ','ث']];
 const canonical=new Map(families.flatMap(group=>group.map(letter=>[letter,group[0]])));
 const phonetic=value=>[...normalize(value)].map(letter=>canonical.get(letter)??letter).join('');
 function distance(a,b,{phoneticCost=false}={}){
  a=normalize(a).slice(0,48);b=normalize(b).slice(0,48);let row=Float64Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){const next=new Float64Array(b.length+1);next[0]=i;for(let j=1;j<=b.length;j++){const same=a[i-1]===b[j-1],close=!same&&canonical.has(a[i-1])&&canonical.get(a[i-1])===canonical.get(b[j-1]),cost=same?0:(close&&phoneticCost ? 0.45 : 1);next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+cost)}row=next}
  return row[b.length];
 }
 function compare(expected,heard){
  const h=normalize(heard),forms=(Array.isArray(expected)?expected:expected?.forms||[expected]).map(normalize).filter(Boolean);
  if(!h||!forms.length)return {kind:'different',score:0};if(forms.includes(h))return {kind:'exact',score:1};
  let score=0,kind='different';
  for(const e of forms){const length=Math.max(e.length,h.length);if(length>48)continue;
   const literal=1-distance(e,h)/length,weighted=1-distance(e,h,{phoneticCost:true})/length;
   const close=Math.min(e.length,h.length)>=3&&phonetic(e)===phonetic(h)&&weighted>=.65;
   const near=Math.min(e.length,h.length)>=4&&literal>=.7;
   if(weighted>score){score=weighted;kind=close?'phonetic':near?'near':'different'}
  }
  return {kind,score:Math.max(0,score)};
 }
 function alignWindow(expected,start,heard,{windowSize=32,maxHeard=32}={}){
  start=Math.max(0,Math.min(expected.length,Number.isInteger(start)?start:0));
  const e=expected.slice(start,start+Math.min(48,windowSize)),h=heard.slice(0,Math.min(48,maxHeard)),m=e.length,n=h.length;
  if(!n||!m)return {ops:[],newCursor:start,consumed:0,exact:0,near:0,cost:0};
  const dp=Array.from({length:m+1},()=>new Float64Array(n+1)),back=Array.from({length:m+1},()=>Array(n+1)),scores=Array.from({length:m},()=>Array(n));
  for(let i=1;i<=m;i++){dp[i][0]=i*1.1;back[i][0]='miss'}for(let j=1;j<=n;j++){dp[0][j]=j*.9;back[0][j]='extra'}
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){
   const score=compare(e[i-1],h[j-1]);scores[i-1][j-1]=score;
   const substitution=dp[i-1][j-1]+(score.kind==='exact'?0:score.kind==='different'?1.35:.55),skip=dp[i-1][j]+1.1,extra=dp[i][j-1]+.9;
   dp[i][j]=Math.min(substitution,skip,extra);back[i][j]=dp[i][j]===substitution?'pair':dp[i][j]===extra?'extra':'miss';
  }
  // Free trailing source text: future words must never become "missed" merely
  // because a short utterance was compared with a longer source window.
  let end=0;for(let i=1;i<=m;i++)if(dp[i][n]<dp[end][n]-1e-8)end=i;
  let i=end,j=n;const ops=[];
  while(i||j){const move=back[i][j];if(move==='pair'){const score=scores[i-1][j-1];ops.push({type:score.kind==='exact'?'match':score.kind==='different'?'miss':'near',e:start+i-1,h:j-1,heard:h[j-1],...score});i--;j--}else if(move==='miss'){ops.push({type:'miss',e:start+i-1,h:null,kind:'omission',score:0});i--}else{ops.push({type:'extra',e:null,h:j-1,heard:h[j-1],score:0});j--}}
  ops.reverse();return {ops,newCursor:start+end,consumed:n,exact:ops.filter(op=>op.type==='match').length,near:ops.filter(op=>op.type==='near').length,cost:dp[end][n]};
 }
 function characterEdits(expected,heard){
  const a=normalize(expected).slice(0,40),b=normalize(heard).slice(0,40),dp=Array.from({length:a.length+1},()=>new Uint8Array(b.length+1));
  for(let i=0;i<=a.length;i++)dp[i][0]=i;for(let j=0;j<=b.length;j++)dp[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  const edits=[];let i=a.length,j=b.length;
  while(i||j){if(i&&j&&dp[i][j]===dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1)){if(a[i-1]!==b[j-1])edits.push({type:'substitution',expectedIndex:i-1,heardIndex:j-1,expected:a[i-1],heard:b[j-1]});i--;j--}else if(i&&dp[i][j]===dp[i-1][j]+1){edits.push({type:'missing',expectedIndex:i-1,expected:a[i-1]});i--}else{edits.push({type:'extra',heardIndex:j-1,heard:b[j-1]});j--}}
  return edits.reverse();
 }
 return {version:31,normalize,phonetic,distance,compare,alignWindow,characterEdits};
});
