/* Word matching for memorisation practice; not a pronunciation/tajwid assessor. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ATHMAN_RECITATION=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function normalize(text){
  return String(text).normalize('NFKD').replace(/ۦ/g,'ي').replace(/ۥ/g,'و')
   .replace(/\p{M}/gu,'').replace(/[ٱأإآ]/g,'ا').replace(/[ىے]/g,'ي')
   .replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/[ءـ]/g,'')
   .replace(/[^\p{L}\p{N}]/gu,'').replace(/ة/g,'ه');
 }
 function hamzaSeat(raw,index){
  const before=raw.slice(0,index),after=raw.slice(index+1),previous=before.match(/([\p{L}])([\p{M}ـ]*)$/u),following=after.match(/^[\p{M}ـ]*/u)?.[0]||'';
  const marks=previous?.[2]||'',base=marks.includes('ٰ')?'ا':previous?.[1],next=after.replace(/^[\p{M}ـ]+/u,'')[0];
  if((base==='ا'||base==='و'&&!/[َُِ]/u.test(marks))&&!/[ٍِٖ]/u.test(following))return '';
  if(normalize(before).match(/^(و?ب|فب)$/u)&&/[َ]/u.test(following)&&next==='ا')return '';
  if(/[يے]/u.test(base||'')||/[ٍِٖ]/u.test(marks+following))return 'ي';
  if(/[ٌُٞ]/u.test(marks+following))return 'و';
  if(/[ًَٗ]/u.test(marks+following))return next==='ا'?'':'ا';
  return '';
 }
 function variants(raw){
  // Dagger alifs are orthographic: e.g. سَمَٰوَٰت / سماوات, ذَٰلِكَ / ذلك.
  let forms=[''];
  raw=String(raw);
  for(let i=0;i<raw.length;i++){
   const c=raw[i],freeHamza=c==='ء'||c==='ٔ'&&(raw[i-1]==='ـ'||/[يے]ْ$/u.test(raw.slice(0,i))),seat=freeHamza?hamzaSeat(raw,i):'';
   if(c==='ٰ'||c==='ۥ'||c==='ۦ'){
    const letter=c==='ٰ'?'ا':c==='ۥ'?'و':'ي';
    forms=[...new Set(forms.flatMap(s=>c==='ٰ'&&raw[i-1]==='و'?[s,s+letter,s.slice(0,-1)+'ا']:[s,s+letter]))].slice(0,16);
   }
   else if(seat)forms=[...new Set(forms.flatMap(s=>[s+c,s+seat+c]))].slice(0,16);
   else forms=forms.map(s=>s+c);
  }
  const result=new Set();
  for(const form of forms){
   let word=normalize(form);
   // Explicit Quranic spellings, without changing the displayed source text.
   word=word.replace(/صلوه$/,'صلاه').replace(/زكوه$/,'زكاه').replace(/حيوه$/,'حياه');
   if(word)result.add(word);
   // The zero-marked alif after final waw is silent in this source rasm,
   // including singular تَتْلُواْ. Do not strip a pronounced dual alif.
   if(/و[\p{M}ـ]*ا[ْ۟۠][\p{M}ـ]*$/u.test(raw)&&word.endsWith('وا'))result.add(word.slice(0,-1));
   if(word.endsWith('توريه'))result.add(word.replace(/توريه$/u,'توراه'));
   if(/ربو?اا?$/u.test(word)&&/رِّبَوٰ/u.test(raw))result.add(word.replace(/ربو?اا?$/u,'ربا'));
   // Conventional ASR spelling gives the hamza its own ya seat in شيئًا.
   // This is an orthographic alias for the same source word, not a riwaya swap.
   if(/[يے]ْٔ/u.test(form)&&word.endsWith('شيا'))result.add(word.slice(0,-3)+'شييا');
  }
  return [...result];
 }
 const heardWords=text=>String(text).split(/\s+/u).map(normalize).filter(Boolean);
 const sourceWords=text=>String(text).split(/\s+/u).map(s=>s.replace(/[^\p{L}\p{M}ـ]/gu,'')).filter(s=>normalize(s));
 const matches=(word,heard)=>word.forms.includes(heard);
 function matchSeverity(word,heard){
  if(!heard)return 'partial';
  if(heard.length<3)return word.forms.some(form=>form.includes(heard))?'partial':'error';
  for(const form of word.forms){
   const length=Math.max(form.length,heard.length);if(length>40)continue;
   let row=Array.from({length:heard.length+1},(_,i)=>i);
   for(let i=1;i<=form.length;i++){const next=[i];for(let j=1;j<=heard.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(form[i-1]===heard[j-1]?0:1));row=next}
   if(length>=3&&row[heard.length]/length<=.34)return 'partial';
  }
  return 'error';
 }
 const joins=(a,b,heard)=>a.forms.some(x=>b.forms.some(y=>x+y===heard));
 const openings=new Set([2,3,7,10,11,12,13,14,15,19,20,26,27,28,29,30,31,32,36,38,40,41,42,43,44,45,46,50,68]);
 const spelled=new Set(['الم','الر','المر','المص','كهيعص','طه','طس','طسم','يس','ص','حم','عسق','ق','ن']);
 const letterNames={ا:['الف'],ل:['لام'],م:['ميم'],ر:['را'],ك:['كاف'],ه:['ها','هاء'],ي:['يا','ياء'],ع:['عين'],ص:['صاد'],ط:['طا','طاء'],س:['سين'],ح:['حا','حاء'],ق:['قاف'],ن:['نون']};
 function wordInfo(raw,unit,index){
  const forms=variants(raw),key=normalize(raw);
  const opening=index<2&&openings.has(unit.sura)&&(unit.aya===1||(unit.sura===42&&unit.aya===2))&&spelled.has(key);
  if(opening){let names=[''];for(const c of key)names=names.flatMap(prefix=>letterNames[c].map(name=>prefix+normalize(name)));forms.push(...names)}
  return {raw,forms:[...new Set(forms)],letterNames:opening};
 }
 const introductions=['أعوذ بالله من الشيطان الرجيم','بسم الله الرحمن الرحيم'].map(heardWords);
 // These aliases belong to the opening invocation only. They never change
 // Quran word variants or certify الرحيم as the different source word الرجيم.
 const openingForms=[...new Set([
  ...['اعوذ','اعود','اعوز'].flatMap(first=>['الرجيم','الرحيم'].map(last=>[first,'بالله','من','الشيطان',last])),
  ...['الرحمن','الرحمان'].map(middle=>['بسم','الله',middle,'الرحيم'])
 ].flatMap(words=>words.slice(0,-1).map((_,i)=>words.slice(i).join(''))))];
 function openingBoundary(heard){
  let from=0,introduction=false;
  while(from<heard.length){
   let complete=0,fragment=0,partial=false;
   for(const form of openingForms){
    let text='';
    for(let i=from;i<heard.length;i++){
     text+=heard[i];
     if(text===form){complete=Math.max(complete,i-from+1);break}
     if(!form.startsWith(text))break;
     fragment=Math.max(fragment,i-from+1);
     if(i===heard.length-1)partial=true;
    }
   }
   if(complete){from+=complete;introduction=true;continue}
   if(partial)return {from,waiting:true,introduction:true};
   // The service can omit the invocation's last word, or overlap a final
   // fragment with the next result. Its recognizable prefix is still not a
   // Quran-location anchor; keep the following ayah words available intact.
   if(fragment){
    const text=heard.slice(from,from+fragment).join(''),next=heard[from+fragment];
    const strong=text.includes('الشيطان')||/^(اعوذ|اعود|اعوز)بالله|^بسمالله/u.test(text);
    const restart=fragment>=2&&next&&openingForms.some(form=>form.startsWith(next));
    if(strong||restart){from+=fragment;introduction=true;continue}
   }
   break;
  }
  const explicit=/^(اعوذ|اعود|اعوز)بالله|^بسمالله/u.test(heard.slice(0,from).join(''));
  return {from,waiting:introduction&&from===heard.length,introduction,explicit};
 }
 class Session{
  constructor(units){
   this.units=units.map(u=>({...u,words:sourceWords(u.text).map((raw,i)=>wordInfo(raw,u,i))})).filter(u=>u.words.length);
   this.index=0;this.cursor=0;this.pending=[];this.errorIndex=null;
   this.failures=new Map();this.hints=new Map();this.peeked=new Set();this.outcomes=[];
  }
  get complete(){return this.index>=this.units.length}
  snapshot(){
   const unit=this.units[this.index];
   return {index:this.index,total:this.units.length,cursor:this.cursor,complete:this.complete,
    unit,wordCount:unit?.words.length||0,errorIndex:this.errorIndex,
    attempts:this.failures.get(this.index+':'+this.errorIndex)||0,
    hints:[...(this.hints.get(this.index)||[])].sort((a,b)=>a-b),peeked:this.peeked.has(this.index),
    outcomes:this.outcomes.slice()};
  }
  feed(transcript,{final=false}={}){
   if(this.complete)return {type:'complete',...this.snapshot()};
   let heard=[...this.pending,...heardWords(transcript)];
   if(!heard.length)return {type:'empty',...this.snapshot()};
   let index=this.index,cursor=this.cursor,at=0,pending=[],error=null;
   const finished=[];
   const unit=this.units[index];
   // A new utterance may resume at the current word or repeat the whole verse.
   if(heard.length&&cursor>0&&!matches(unit.words[cursor],heard[0])&&matches(unit.words[0],heard[0]))cursor=0;
   while(at<heard.length&&index<this.units.length){
    const current=this.units[index],words=current.words,word=words[cursor];
    // Invocation is optional, including a new surah in the same speech result.
    // An incomplete invocation waits for more speech and never fails by silence.
    if(cursor===0&&(index===0||(current.aya===1&&current.sura!==this.units[index-1]?.sura))&&!matches(word,heard[at])){
     const remaining=heard.length-at;
     const intro=introductions.find(intro=>intro.slice(0,Math.min(intro.length,remaining)).every((w,i)=>w===heard[at+i]));
     if(intro){if(remaining<intro.length){pending=heard.slice(at);break}at+=intro.length;continue}
    }
    let take=0,advance=0;
    let joined='';
    for(let n=1;n<=Math.min(5,heard.length-at);n++){joined+=heard[at+n-1];if(matches(word,joined)){take=n;advance=1;break}}
    if(!take&&cursor+1<words.length&&joins(word,words[cursor+1],heard[at])){take=1;advance=2}
    if(!take){
     const tail=heard.slice(at),joinedTail=tail.join('');
     if((word.letterNames||tail.length===1&&['و','ف','ب','ل','ك','ال','يا'].includes(tail[0]))&&word.forms.some(w=>w.startsWith(joinedTail))){pending=tail;break}
     error={index,word:cursor};break;
    }
    at+=take;cursor+=advance;
    if(cursor===words.length){finished.push(index);index++;cursor=0}
   }
   if(!final)return {type:'interim',previewIndex:index,previewCursor:cursor,previewError:!!error,...this.snapshot()};
   for(const i of finished)this.outcomes.push({index:i,assisted:this.peeked.has(i)||(this.hints.get(i)?.size||0)>0});
   this.index=index;this.cursor=cursor;this.pending=pending;this.errorIndex=null;
   let autoHint=false;
   if(error){
    this.errorIndex=error.word;
    const key=index+':'+error.word,count=Math.min(3,(this.failures.get(key)||0)+1);
    this.failures.set(key,count);
    if(count===3){const hints=this.hints.get(index)||new Set();autoHint=!hints.has(error.word);hints.add(error.word);this.hints.set(index,hints)}
   }
   return {type:error?'mismatch':this.complete?'complete':finished.length?'matched':'progress',autoHint,finished,...this.snapshot()};
  }
  hint(){
   if(this.complete)return this.snapshot();
   const hints=this.hints.get(this.index)||new Set(),words=this.units[this.index].words;
   let i=this.errorIndex??this.cursor;while(i<words.length&&hints.has(i))i++;
   if(i<words.length)hints.add(i);this.hints.set(this.index,hints);return this.snapshot();
  }
  peek(){if(!this.complete)this.peeked.has(this.index)?this.peeked.delete(this.index):this.peeked.add(this.index);return this.snapshot()}
  skip(){
   if(!this.complete){this.outcomes.push({index:this.index,assisted:true});this.index++;this.cursor=0;this.pending=[];this.errorIndex=null}
   return this.snapshot();
  }
 }
 // A shared, local index of the official text. Positions are full-verse word offsets.
 function consume(words,pos,heard,at){
  const word=words[pos];if(!word)return null;
  let joined='';
  for(let n=1;n<=Math.min(5,heard.length-at);n++){joined+=heard[at+n-1];if(matches(word,joined))return {take:n,advance:1}}
  if(words[pos+1]&&joins(word,words[pos+1],heard[at]))return {take:1,advance:2};
  return null;
 }
 function scan(words,pos,heard,at,limit=24,end=words.length){
  const start=pos,from=at,pairs=[];
  while(at<heard.length&&pos<end&&pos-start<limit){
   const step=consume(words,pos,heard,at);if(!step)break;
   if(pos+step.advance>end)break;
   pairs.push(at+':'+pos);at+=step.take;pos+=step.advance;
  }
  return {pos,at,count:pos-start,take:at-from,chars:heard.slice(from,at).join('').length,pairs};
 }
 // Location evidence may bridge a small ASR gap. Only exact words contribute
 // evidence; a bridged word is never certified as recited by this search.
 function locateTrace(words,pos,heard,at,end){
  const start=pos,from=at;let count=0,chars=0,edits=0,heardCount=0,pairs=[];
  while(at<heard.length&&pos<end&&pos-start<512){
   const run=scan(words,pos,heard,at,512-(pos-start),end);
   count+=run.count;chars+=run.chars;heardCount+=run.take;pairs.push(...run.pairs);pos=run.pos;at=run.at;
   if(at===heard.length||pos===end||edits===2)break;
   const bridges=[];
   for(let skip=0;skip<=2-edits&&pos+skip<end;skip++)for(let extra=0;extra<=2-edits&&at+extra<heard.length;extra++){
    if(!skip&&!extra)continue;
    const next=scan(words,pos+skip,heard,at+extra,8,end),cost=Math.max(skip,extra);
    if(next.count>=2&&next.chars>=6)bridges.push({skip,extra,cost,...next});
   }
   bridges.sort((a,b)=>a.cost-b.cost||b.chars-a.chars||a.skip-b.skip);
   const next=bridges[0];if(!next)break;
   edits+=next.cost;pos+=next.skip;at+=next.extra;
  }
  return {pos,at,count,chars,edits,heardCount,pairs,take:at-from};
 }
 class Corpus{
  constructor(units){
   const cache=new Map();
   this.units=units.map(u=>{
    const marker=String.fromCharCode(0xfbff+u.aya),text=u.text.endsWith(marker)?u.text.slice(0,-1).trimEnd():u.text;
    return {...u,text,words:sourceWords(text).map((raw,i)=>{
     const opening=i<2&&openings.has(u.sura)&&(u.aya===1||u.sura===42&&u.aya===2),key=(opening?'opening:':'word:')+raw;
     if(!cache.has(key))cache.set(key,wordInfo(raw,u,i));return {...cache.get(key)};
    })};
   }).filter(u=>u.words.length);
   this.words=[];this.starts=[];this.byReference=new Map();this.byForm=new Map();
   this.units.forEach((u,index)=>{
    this.starts.push(this.words.length);this.byReference.set(u.sura+':'+u.aya,index);
    u.words.forEach((w,word)=>{
     w.index=index;w.word=word;w.pos=this.words.length;this.words.push(w);
     for(const form of w.forms){const positions=this.byForm.get(form)||[];positions.push(w.pos);this.byForm.set(form,positions)}
    });
   });
   this.starts.push(this.words.length);
  }
  position(sura,aya,word=0){const index=this.byReference.get(sura+':'+aya);return index===undefined?null:this.starts[index]+Math.min(Math.max(0,word),this.units[index].words.length-1)}
  reference(pos){const word=this.words[Math.min(pos,this.words.length-1)];return word?{index:word.index,word:word.word,sura:this.units[word.index].sura,aya:this.units[word.index].aya}:null}
  seeds(heard,at){
   const result=new Set();let joined='';
   for(let n=1;n<=Math.min(5,heard.length-at);n++){joined+=heard[at+n-1];for(const p of this.byForm.get(joined)||[])result.add(p)}
   const token=heard[at];
   for(let split=1;split<token.length;split++)for(const p of this.byForm.get(token.slice(0,split))||[])if(this.words[p+1]?.forms.includes(token.slice(split)))result.add(p);
   return result;
  }
  locate(heard,{start=0,end=this.words.length}={}){
   const candidates=[];let from=0,openingFrom=0;
   const scoped=start>0||end<this.words.length;
   if(!scoped){const opening=openingBoundary(heard);if(opening.waiting)return {status:'waiting',invocation:true};if(opening.explicit)from=opening.from;else openingFrom=opening.from}
   // Short/repeated formulas are not enough to choose a Quran location.
   for(let at=from;at<heard.length-(scoped?0:1);at++){
    for(const pos of this.seeds(heard,at)){
     if(pos<start||pos>=end)continue;
     const match=locateTrace(this.words,pos,heard,at,end);
     let evidenceCount=match.count,evidenceChars=match.chars,evidenceHeard=match.heardCount;
     if(at<openingFrom){
      // A bare invocation suffix can also be real Quran text. Preserve that
      // source start only when distinct words OUTSIDE the opening support it.
      evidenceCount=0;evidenceChars=0;evidenceHeard=0;
      for(const pair of match.pairs){
       const [h,p]=pair.split(':').map(Number);if(h<openingFrom)continue;
       const step=consume(this.words,p,heard,h);evidenceCount+=step.advance;evidenceHeard+=step.take;evidenceChars+=heard.slice(h,h+step.take).join('').length;
      }
     }
     if(scoped){if(match.count<1||match.chars<2||match.at!==heard.length&&match.pos!==end)continue}
     else if(match.edits){if(evidenceCount<4||evidenceChars<16||evidenceHeard/(heard.length-Math.max(at,openingFrom))<.7)continue}
     else if(evidenceCount<2||evidenceChars<12&&!(evidenceCount>=4&&evidenceChars>=10))continue;
     if(heard.length-match.at>2)continue;
     candidates.push({pos,heardStart:at,...match,endPos:match.pos,startPos:pos,score:match.chars+match.count*2-match.edits*6});
    }
   }
   if(!candidates.length)return {status:'waiting'};
   candidates.sort((a,b)=>b.score-a.score||b.count-a.count||a.heardStart-b.heardStart);
   const best=candidates[0],pairs=new Set(best.pairs);
   const alternatives=candidates.filter(c=>!c.pairs.some(p=>pairs.has(p))&&c.score>=best.score-3);
   if(alternatives.length)return {status:'ambiguous',alternatives:alternatives.length+1};
   return {status:'found',pos:best.startPos,heardStart:best.heardStart,matched:best.count,edits:best.edits,score:best.score,endPos:best.endPos,reference:this.reference(best.startPos)};
  }
  search(text,{limit=40}={}){
   const value=String(text).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).trim(),reference=value.match(/^(\d{1,3})\s*[:：]\s*(\d{1,3})$/);
   if(reference){const pos=this.position(+reference[1],+reference[2]);return pos===null?[]:[{pos,...this.reference(pos)}]}
   const heard=heardWords(value);if(!heard.length)return [];
   const results=[],seen=new Set();
   for(const pos of this.seeds(heard,0)){
    if(scan(this.words,pos,heard,0,128).at!==heard.length)continue;
    const ref=this.reference(pos);if(seen.has(ref.index))continue;seen.add(ref.index);results.push({pos,...ref});
    if(results.length>=limit)break;
   }
   return results.sort((a,b)=>a.pos-b.pos);
  }
 }
 function anchor(words,pos,heard,at,end=words.length,wide=false){
  const candidates=[];
  for(let skip=0;skip<=(wide?32:8)&&pos+skip<end;skip++)for(let extra=0;extra<=(wide?24:4)&&at+extra<heard.length;extra++){
   if(!skip&&!extra)continue;
   const found=scan(words,pos+skip,heard,at+extra,8,end);
   if(found.count<2||found.chars<8)continue;
   if(skip>8&&(found.count<4||found.chars<16))continue;
   candidates.push({skip,extra,...found,cost:skip+extra});
  }
  candidates.sort((a,b)=>a.cost-b.cost||b.chars-a.chars||a.skip-b.skip);
  return candidates[0]||null;
 }
 function immediateAnchor(words,pos,heard,at,end){
  // After location is locked, one exact nearby word can carry the live cursor.
  // Never guess between two nearby occurrences or use a remote/page-wide hit.
  const candidates=[];
  for(let skip=1;skip<=2&&pos+skip<end;skip++){
   const found=scan(words,pos+skip,heard,at,8,end);
   if(!found.count||found.chars<2)continue;
   candidates.push({skip,extra:0,...found,cost:skip});
  }
  return candidates.length===1&&(candidates[0].chars>=3||candidates[0].skip===1)?candidates[0]:null;
 }
 function nearbyTail(words,pos,tail,end){
  if(!tail.length||tail.length>4)return false;
  for(let p=pos+1;p<Math.min(end,pos+7);p++){
   const run=scan(words,p,tail,0,8,end);
   if(run.count&&run.at===tail.length)return true;
  }
  return false;
 }
 function bridgeOperations(words,pos,heard,at,skip,extra){
  const table=Array.from({length:skip+1},()=>Array(extra+1).fill(null));table[0][0]={cost:0,matched:0,ops:[]};
  const put=(i,j,state)=>{const old=table[i][j];if(!old||state.cost<old.cost||state.cost===old.cost&&state.matched>old.matched)table[i][j]=state};
  for(let i=0;i<=skip;i++)for(let j=0;j<=extra;j++){
   const state=table[i][j];if(!state)continue;
   if(i<skip&&j<extra){
    const step=consume(words,pos+i,heard,at+j);
    if(step&&i+step.advance<=skip&&j+step.take<=extra)put(i+step.advance,j+step.take,{cost:state.cost,matched:state.matched+step.advance,ops:[...state.ops,...Array.from({length:step.advance},(_,n)=>({type:'read',pos:pos+i+n}))]});
    put(i+1,j+1,{cost:state.cost+1,matched:state.matched,ops:[...state.ops,{type:'error',pos:pos+i,kind:'substitution',heard:heard[at+j],severity:matchSeverity(words[pos+i],heard[at+j])}]});
   }
   if(i<skip)put(i+1,j,{cost:state.cost+1,matched:state.matched,ops:[...state.ops,{type:'error',pos:pos+i,kind:'omission',severity:'error'}]});
   // An extra ASR token has no corresponding source word to paint as wrong.
   if(j<extra)put(i,j+1,{cost:state.cost+1,matched:state.matched,ops:state.ops});
  }
  return table[skip][extra].ops;
 }
 function repeatTrace(words,start,heard,from,end){
  let pos=start,at=from,chars=0,edits=0;const positions=[];
  while(pos<end&&at<heard.length){
   const run=scan(words,pos,heard,at,512,end);
   for(let p=pos;p<run.pos;p++)positions.push(p);
   chars+=run.chars;pos=run.pos;at=run.at;
   if(pos===end||at===heard.length||edits>=2)break;
   const anchors=[];
   for(let skip=0;skip<=2-edits&&pos+skip<end;skip++)for(let extra=0;extra<=2-edits&&at+extra<heard.length;extra++){
    if(!skip&&!extra)continue;const next=scan(words,pos+skip,heard,at+extra,8,end);
    if(next.count>=2&&next.chars>=6)anchors.push({skip,extra,cost:Math.max(skip,extra),...next});
   }
   anchors.sort((a,b)=>a.cost-b.cost||b.chars-a.chars||a.skip-b.skip);
   let next=anchors[0];
   if(next&&anchors[1]&&next.cost===anchors[1].cost&&next.chars===anchors[1].chars&&next.pos!==anchors[1].pos)break;
   if(!next){const single=immediateAnchor(words,pos,heard,at,end);if(single&&single.skip<=2-edits)next={...single,cost:single.skip}}
   if(!next)break;
   edits+=next.cost;pos+=next.skip;at+=next.extra;
  }
  return {pos,at,chars,positions,count:positions.length};
 }
 function repeatedRun(corpus,frontier,heard,at,{start=0,end=corpus.words.length,replay=null,wasRead=()=>false}={}){
  // Repetition is local feedback, never a second Quran-wide location search.
  // Consider only the current/previous ayah, or a pinned unfinished repetition.
  const candidates=new Map(),index=corpus.reference(frontier)?.index;
  if(replay?.frontier===frontier&&replay.pos<frontier)candidates.set(replay.pos,true);
  for(const i of [index,index-1]){
   if(i<0)continue;const p=Math.max(start,corpus.starts[i]);
   if(p<frontier&&p<end&&wasRead(p))candidates.set(p,candidates.get(p)||false);
  }
  const found=[];
  for(const [p,pinned] of candidates){
   const limit=Math.min(frontier,end),exact=scan(corpus.words,p,heard,at,512,limit);
   const established=pinned||exact.count>=2&&exact.chars>=8;
   const run=established&&exact.at<heard.length&&exact.pos<limit?repeatTrace(corpus.words,p,heard,at,limit):{...exact,positions:Array.from({length:exact.count},(_,n)=>p+n)};
   // A unique exact short word may give feedback immediately. This path adds
   // no read credit, and ties between local ayahs still wait for more words.
   if(!pinned&&(!run.count||run.chars<2))continue;
   const unclear=run.at<heard.length&&run.pos<frontier;
   if(unclear&&!established)continue;
   found.push({...run,start:p,pinned,unclear});
  }
  found.sort((a,b)=>b.count-a.count||b.chars-a.chars||Number(b.pinned)-Number(a.pinned));
  if(!found.length)return null;
  if(found[1]&&found[0].count===found[1].count&&found[0].chars===found[1].chars&&!found[0].pinned)return {ambiguous:true};
  return found[0];
 }
 function align(corpus,start,heard,{end=corpus.words.length,strict=false,speech=false,scopeStart=0,wasRead=()=>false,replay=null}={}){
  const words=corpus.words,operations=[],repeated=[],localReads=new Set();let pos=start,at=0,pending=[],error=null,errorSeverity=null,autoIntro=false,fragment=false,nextReplay=replay,repeatAmbiguous=false;
  while(at<heard.length&&pos<end){
   const word=words[pos],step=consume(words,pos,heard,at);
   if(speech){
    const repeat=repeatedRun(corpus,pos,heard,at,{start:scopeStart,end,replay:nextReplay,wasRead:p=>localReads.has(p)||wasRead(p)});
    if(repeat?.ambiguous&&!step){pending=heard.slice(at).slice(-32);fragment=true;repeatAmbiguous=true;break}
    // Prefer normal forward reading unless a longer exact phrase disambiguates
    // an ayah that begins with the same word as the next one.
    if(repeat&&(!step||repeat.count>=2&&repeat.chars>=8&&repeat.count>scan(words,pos,heard,at,512,end).count)){
     repeated.push(...repeat.positions);
     at=repeat.at;nextReplay=repeat.pos<pos?{pos:repeat.pos,frontier:pos}:null;
     if(repeat.unclear){repeatAmbiguous=true;break}
     continue;
    }
   }
   if(step&&pos+step.advance<=end){for(let n=0;n<step.advance;n++){operations.push({type:'read',pos:pos+n});localReads.add(pos+n)}pos+=step.advance;at+=step.take;nextReplay=null;repeated.length=0;continue}
   if(word.word===0&&(pos===start||corpus.units[word.index].aya===1)){
    const remaining=heard.length-at,intro=introductions.find(intro=>intro.slice(0,Math.min(intro.length,remaining)).every((w,i)=>w===heard[at+i]));
    if(intro){if(remaining<intro.length){pending=heard.slice(at);autoIntro=true;fragment=true;break}at+=intro.length;continue}
   }
   const tail=heard.slice(at),joinedTail=tail.join('');
   if((word.letterNames||tail.length===1&&['و','ف','ب','ل','ك','ال','يا'].includes(tail[0]))&&word.forms.some(w=>w.startsWith(joinedTail))){pending=tail;fragment=true;break}
   let next=strict?null:anchor(words,pos,heard,at,end);
   if(!next&&speech&&!strict){const fast=immediateAnchor(words,pos,heard,at,end);next=(heard.length-at<=2?fast:null)||anchor(words,pos,heard,at,end,true)||fast}
   if(!next){error=pos;errorSeverity=matchSeverity(word,heard[at]);pending=tail.slice(-24);break}
   // Resume only at an exact later anchor; skipped words remain explicit errors.
   const bridge=bridgeOperations(words,pos,heard,at,next.skip,next.extra);operations.push(...bridge);for(const op of bridge)if(op.type==='read')localReads.add(op.pos);
   pos+=next.skip;at+=next.extra;
  }
  return {pos,operations,error,errorSeverity,errorHeard:error===null?null:heard[at],pending,autoIntro,fragment,at,replay:nextReplay,repeatAmbiguous,
   repetition:repeated.length?{positions:[...new Set(repeated)],focusPos:repeated.at(-1)}:null};
 }
 class Follower{
  constructor(corpus,{index=0,word=0,start=0,end=corpus.words.length,strict=false}={}){
   this.corpus=corpus;this.units=corpus.units;this.pos=(corpus.starts[index]||0)+word;this.focusPos=this.pos;
   this.locating=false;this.locked=false;this.acquisition=null;this.locateBuffer=[];this.pending=[];this.pendingFragment=false;this.errorIndex=null;this.errorPos=null;this.errorSeverity=null;
   this.observations=new Map();this.provisional=new Set();this.provisionalUnverified=new Set();this.live=null;this.replay=null;this.speechTail=[];this.speechTailPos=null;
   this.failures=new Map();this.hints=new Map();this.peeked=new Set();this.states=new Map();this.outcomes=[];this.changed=[];
   this.strict=strict;this.setRange(start,end);
  }
  get complete(){return this.pos>=this.end}
  get index(){return this.pos>=this.corpus.words.length?this.units.length:this.corpus.words[this.pos].index}
  get cursor(){return this.pos>=this.corpus.words.length?0:this.corpus.words[this.pos].word}
  state(index){return this.states.get(index)||{read:new Set(),errors:new Map(),unverified:new Set(),ignored:new Set(),complete:false,partial:false}}
  editable(index){if(!this.states.has(index))this.states.set(index,{read:new Set(),errors:new Map(),unverified:new Set(),ignored:new Set(),complete:false,partial:false});return this.states.get(index)}
  setRange(start,end){this.start=Math.max(0,Math.min(this.corpus.words.length-1,Number.isInteger(start)?start:0));this.end=Math.max(this.start+1,Math.min(this.corpus.words.length,Number.isInteger(end)?end:this.corpus.words.length));if(this.pos<this.start||this.pos>=this.end){this.pos=this.start;this.focusPos=this.pos}this.pending=[];this.replay=null;this.speechTail=[];this.speechTailPos=null;return this}
  seek(sura,aya,word=0){const pos=this.corpus.position(sura,aya,word);if(pos===null||pos<this.start||pos>=this.end)return false;this.pos=pos;this.focusPos=pos;this.pending=[];this.pendingFragment=false;this.speechTail=[];this.speechTailPos=null;this.locating=false;this.locked=true;this.acquisition=null;this.live=null;this.replay=null;this.provisional.clear();this.provisionalUnverified.clear();this.observations.clear();this.errorIndex=null;this.errorPos=null;this.errorSeverity=null;this.changed=[];return true}
  endUtterance(){
   if(this.live){
    // Keep interim-only continuity across a mobile service restart. These words
    // remain provisional: they are neither read credit nor journal events.
    for(const op of this.live.operations){
     if(op.type==='read'){this.provisional.add(op.pos);this.provisionalUnverified.delete(op.pos)}
     else if(!this.provisional.has(op.pos))this.provisionalUnverified.add(op.pos);
    }
    this.pos=Math.min(this.end-1,this.live.endPos);this.focusPos=this.live.focusPos;this.replay=this.live.replay;this.live=null;
    if(this.errorPos!==null&&this.errorPos<this.pos){this.errorPos=null;this.errorIndex=null;this.errorSeverity=null}
   }
   if(this.acquisition){this.pos=Math.min(this.end-1,this.acquisition.lastPos??this.acquisition.pos);this.focusPos=this.acquisition.focusPos??this.pos;this.locating=false;this.acquisition=null;this.locateBuffer=[];this.pending=[];this.pendingFragment=false}
   return this.snapshot();
  }
  ignoreWord(index,word){
   const state=this.editable(index);state.errors.delete(word);state.ignored.add(word);
   const pos=this.corpus.starts[index]+word;if(this.errorPos===pos){this.pos=Math.min(this.end,this.pos+1);this.errorPos=null;this.errorIndex=null;this.errorSeverity=null;this.pending=[]}
   const outcome=this.outcomes.find(o=>o.index===index);if(outcome){outcome.hasErrors=state.errors.size>0;outcome.assisted=true}
   this.changed=[index];return this.snapshot();
  }
  snapshot(){
   const index=this.index,unit=this.units[index];
   const pendingError=this.errorPos!==null&&!this.states.get(index)?.errors.has(this.errorIndex)?1:0;
   const partialCount=[...this.states.values()].reduce((sum,s)=>sum+[...s.errors.values()].filter(e=>e.severity==='partial').length,0)+(pendingError&&this.errorSeverity==='partial'?1:0);
   return {index,total:this.units.length,cursor:this.cursor,complete:this.complete,unit,wordCount:unit?.words.length||0,
    focusPos:this.focusPos,locating:this.locating,locked:this.locked,errorIndex:this.errorIndex,errorSeverity:this.errorSeverity,partialCount,attempts:this.failures.get(this.errorPos)||0,
    hints:[...(this.hints.get(index)||[])],peeked:this.peeked.has(index),outcomes:this.outcomes.slice(),changed:this.changed.slice(),
    errorCount:pendingError+[...this.states.values()].reduce((sum,s)=>sum+s.errors.size,0)};
  }
  beginSearch(){if(this.complete)this.pos=this.start;this.locating=true;this.locked=false;this.acquisition=null;this.locateBuffer=[];this.pending=[];this.pendingFragment=false;this.speechTail=[];this.speechTailPos=null;this.live=null;this.replay=null;this.provisional.clear();this.provisionalUnverified.clear();this.observations.clear();this.errorIndex=null;this.errorPos=null;this.errorSeverity=null;this.changed=[];return this.snapshot()}
  feed(transcript,{final=false,speech=false,confidence=null}={}){
   const incoming=heardWords(transcript);if(!incoming.length)return {type:'empty',...this.snapshot()};
   let start=this.pos,heard=incoming,location=null,overlap=false;
   if(this.locating){
    const buffer=[...this.locateBuffer,...incoming].slice(-512),found=this.acquisition||this.corpus.locate(buffer,{start:this.start,end:this.end});
    if(found.status!=='found'){
     if(final)this.locateBuffer=buffer;
     return {type:'locating',ambiguous:found.status==='ambiguous',invocation:!!found.invocation,...this.snapshot()};
    }
    if(!this.acquisition){this.acquisition={...found,leading:buffer.slice(0,found.heardStart)};this.locked=true}
    start=found.pos;const leading=this.acquisition.leading;
    heard=leading.every((w,i)=>buffer[i]===w)?buffer.slice(leading.length):buffer;location=found.reference;
    if(final){this.locating=false;this.locateBuffer=[];this.acquisition=null}
   }else{
    if(this.complete)return {type:'complete',...this.snapshot()};
    const first=Math.max(this.start,this.corpus.starts[this.index]);
    // A retry may begin at the failing word or at the start of its verse.
    if(speech&&!this.replay&&!this.pendingFragment&&!consume(this.corpus.words,start,incoming,0)){
     // Some services repeat a confirmed suffix in the next final chunk. Match
     // that local overlap, including mid-ayah retries, without rewinding credit.
     let best=null;
     for(let p=Math.max(this.start,this.pos-24);p<this.pos;p++){
      // Ayah-start repetitions have their own feedback cursor. Do not consume
      // them as an invisible duplicate suffix before that path can see them.
      const w=this.corpus.words[p];
      if(p===Math.max(this.start,this.corpus.starts[w.index])&&(this.states.get(w.index)?.read.has(w.word)||this.provisional.has(p)))continue;
      const run=scan(this.corpus.words,p,incoming,0,512,this.end);
      const repeatedLast=p===this.pos-1&&run.count===1&&run.at===incoming.length;
      if(!repeatedLast&&(run.count<2||run.chars<8)||run.at<incoming.length&&run.pos<this.pos)continue;
      if(!best||run.count>best.count||run.count===best.count&&p>best.start)best={...run,start:p};
     }
     if(best){start=best.start;overlap=true}
    }
    if(!speech&&!overlap&&this.cursor>0&&!consume(this.corpus.words,start,incoming,0)&&consume(this.corpus.words,first,incoming,0))start=first;
    else if(!overlap&&this.pending.length&&(!speech||this.pendingFragment)&&!consume(this.corpus.words,start,incoming,0))heard=[...this.pending,...incoming];
   }
   const alignOptions={end:this.end,strict:this.strict,speech,scopeStart:this.start,replay:this.replay,wasRead:p=>{const w=this.corpus.words[p];return !!this.states.get(w.index)?.read.has(w.word)||this.provisional.has(p)}};
   let result=align(this.corpus,start,heard,alignOptions);
   if(speech&&!this.strict&&!overlap&&!location&&this.speechTailPos===start&&this.speechTail.length){
    const combined=[...this.speechTail,...heard],candidate=align(this.corpus,start,combined,alignOptions);
    const reads=r=>r.operations.filter(op=>op.type==='read').length;
    if(candidate.pos>result.pos||candidate.pos===result.pos&&reads(candidate)>reads(result)){result=candidate;heard=combined}
   }
   // Once located, only ordered nearby anchors may recover synchronisation.
   // A repeated phrase elsewhere in the Quran must never relocate this session.
   if(!final){
    const ref=this.corpus.reference(result.pos),read=result.operations.filter(op=>op.type==='read');
    if(this.acquisition){this.acquisition.lastPos=result.pos;this.acquisition.focusPos=read.at(-1)?.pos??start}
    this.live={endPos:overlap?Math.max(this.pos,result.pos):result.pos,focusPos:read.at(-1)?.pos??this.focusPos,operations:result.operations,replay:result.replay};
    return {type:'interim',candidate:location?{pos:start,reference:location,matched:read.length,endPos:result.pos}:null,
     preview:{startPos:start,endPos:result.pos,focusPos:read.at(-1)?.pos??start,operations:result.operations,location,repetition:result.repetition,consumed:result.at,heardCount:heard.length},
     previewIndex:result.pos===this.corpus.words.length?this.units.length:ref.index,previewCursor:ref?.word||0,previewError:result.error!==null,...this.snapshot()};
   }
   this.live=null;this.replay=result.replay;
   let unclear=result.repeatAmbiguous?1:0;
   if(speech){
    this.speechTail=[];this.speechTailPos=null;
    if(!this.strict&&result.error!==null&&nearbyTail(this.corpus.words,result.pos,result.pending,this.end)){
     // Buffer only exact nearby source fragments, not old rejected/noisy text.
     // This joins single-word service finals without counting them as retries.
     this.speechTail=result.pending.slice();this.speechTailPos=result.pos;
     result.error=null;result.errorSeverity=null;unclear++;
    }
    const numeric=typeof confidence==='number'&&Number.isFinite(confidence)&&confidence>0?confidence:null,observed=new Map();
    const assess=(pos,token,kind)=>{
     // A missing ASR word is not proof that the reader omitted it. Only a
     // specific plausible heard token creates a review flag, and a red flag
     // needs the same clear mismatch in independent confident final results.
     if(kind==='omission'||!token||numeric!==null&&numeric<.55)return null;
     if(observed.has(pos))return observed.get(pos);
     const signature=kind+':'+token,old=this.observations.get(pos),same=old?.signature===signature,count=same?old.count+1:1;
     const confident=(same?old.confident:0)+(numeric!==null&&numeric>=.7?1:0);
     this.observations.set(pos,{signature,count,confident});
     const severity=matchSeverity(this.corpus.words[pos],token)==='partial'||confident<2||numeric===null||numeric<.7?'partial':'error';
     observed.set(pos,severity);return severity;
    };
    result.operations=result.operations.map(op=>{
     if(op.type!=='error')return op;
     const severity=assess(op.pos,op.heard,op.kind);if(severity)return {...op,severity};
     unclear++;return {type:'unheard',pos:op.pos};
    });
    if(result.error!==null){
     const severity=assess(result.error,result.errorHeard,'substitution');
     if(severity)result.errorSeverity=severity;
     else{unclear++;result.error=null;result.errorSeverity=null}
    }
   }
   this.pos=overlap?Math.max(this.pos,result.pos):result.pos;this.pending=speech&&!result.fragment?[]:result.pending;this.pendingFragment=result.fragment;this.errorIndex=null;this.errorPos=null;this.errorSeverity=null;const changed=new Set(),newErrors=new Map();
   for(const op of result.operations){
    const w=this.corpus.words[op.pos],state=this.editable(w.index);changed.add(w.index);this.focusPos=op.pos;
    // Display traversal and recitation credit are deliberately separate.
    // Passing a source word must not leave a blank hole in a completed line.
    if(op.type==='unheard'){if(!state.read.has(w.word))state.unverified.add(w.word);continue}
    state.unverified.delete(w.word);this.provisionalUnverified.delete(op.pos);
    state.ignored.delete(w.word);
    if(op.type==='error'){state.errors.set(w.word,{kind:op.kind,severity:op.severity});newErrors.set(op.pos,op.severity)}
    else{state.read.add(w.word);this.provisional.delete(op.pos);this.observations.delete(op.pos);if(speech)this.failures.delete(op.pos);if(!newErrors.has(op.pos))state.errors.delete(w.word)}
   }
   if(location&&!result.operations.length)this.focusPos=start;
   let autoHint=false;
   if(result.error!==null){
    const w=this.corpus.words[result.error];this.errorPos=result.error;this.errorIndex=w.word;this.errorSeverity=result.errorSeverity;changed.add(w.index);this.focusPos=result.error;
    if(speech||this.states.get(w.index)?.errors.has(w.word))this.editable(w.index).errors.set(w.word,{kind:'unmatched',severity:result.errorSeverity});
    const count=Math.min(3,(this.failures.get(result.error)||0)+1);this.failures.set(result.error,count);
    if(count===3){const hints=this.hints.get(w.index)||new Set();autoHint=!hints.has(w.word);hints.add(w.word);this.hints.set(w.index,hints)}
   }
   const finished=[];
   for(const i of changed){
    const state=this.editable(i),end=this.corpus.starts[i+1];
    if(this.pos>=end&&(state.read.has(this.units[i].words.length-1)||state.errors.has(this.units[i].words.length-1))){
     state.complete=true;state.partial=new Set([...state.read,...state.errors.keys()]).size<this.units[i].words.length;
     let outcome=this.outcomes.find(o=>o.index===i);
     if(!outcome){outcome={index:i};this.outcomes.push(outcome);finished.push(i)}
     Object.assign(outcome,{hasErrors:state.errors.size>0,partial:state.partial,assisted:this.peeked.has(i)||(this.hints.get(i)?.size||0)>0||state.errors.size>0||state.partial});
    }
   }
   this.changed=[...changed];
   const events=[...new Set(result.operations.filter(op=>op.type!=='unheard').map(op=>op.pos))].map(pos=>({type:newErrors.has(pos)?newErrors.get(pos)==='partial'?'uncertain':'error':'read',...this.corpus.reference(pos)}));
   if(result.error!==null)events.push({type:result.errorSeverity==='error'?'error':'uncertain',...this.corpus.reference(result.error)});
   return {type:result.error!==null?'mismatch':this.complete?'complete':result.repetition&&!events.length?'repeated':newErrors.size?'continued':unclear&&!events.length?'unclear':finished.length?'matched':'progress',events,location,finished,unclear,continued:newErrors.size>0,definiteErrors:events.some(e=>e.type==='error'),autoHint,repetition:result.repetition,...this.snapshot()};
  }
  hint(){if(!this.complete){const hints=this.hints.get(this.index)||new Set();let i=this.errorIndex??this.cursor;while(i<this.units[this.index].words.length&&hints.has(i))i++;if(i<this.units[this.index].words.length)hints.add(i);this.hints.set(this.index,hints)}return this.snapshot()}
  peek(){if(!this.complete)this.peeked.has(this.index)?this.peeked.delete(this.index):this.peeked.add(this.index);return this.snapshot()}
  skip(){if(!this.complete){const i=this.index,outcome=this.outcomes.find(o=>o.index===i);if(outcome)outcome.assisted=true;else this.outcomes.push({index:i,assisted:true,partial:true});this.pos=Math.min(this.end,this.corpus.starts[i+1]);this.focusPos=Math.min(this.pos,this.end-1);this.pending=[];this.replay=null;this.errorIndex=null;this.errorPos=null;this.changed=[i]}return this.snapshot()}
 }

 // One instance per native recognition cycle. Read the entire result snapshot:
 // interim entries can be revised, removed, or finalized independently.
 class SpeechInput{
  constructor(follower){this.follower=follower;this.finals=new Set();this.finalCursor=0;this.liveKey='';this.choices=new Map()}
  choose(result,prefix=''){
   const alternatives=Array.from(result).slice(0,3).filter(a=>typeof a?.transcript==='string'&&a.transcript.trim());
   if(!alternatives.length)return {transcript:'',confidence:null};
   const top=alternatives[0],confidence=a=>Number.isFinite(a.confidence)&&a.confidence>0?a.confidence:null,topConfidence=confidence(top);
   if(alternatives.length===1)return {transcript:top.transcript,confidence:topConfidence};
   let protectOpening=false;
   if(this.follower.locating&&!this.follower.acquisition&&this.follower.start===0&&this.follower.end===this.follower.corpus.words.length){
    const opening=openingBoundary(heardWords(prefix+' '+top.transcript));
    if(opening.waiting)return {transcript:top.transcript,confidence:topConfidence};
    protectOpening=opening.introduction;
   }
   if(!this.follower.locating&&!this.follower.replay){
    const heard=heardWords(prefix+' '+top.transcript),run=scan(this.follower.corpus.words,this.follower.pos,heard,0,512,this.follower.end);
    if(run.at===heard.length)return {transcript:top.transcript,confidence:topConfidence};
   }
   let best=top,bestScore=-Infinity,topLocation=null;
   for(let i=0;i<alternatives.length;i++){
    const a=alternatives[i],value=confidence(a);
    if(i&&value!==null&&value<.55)continue;
    if(i&&topConfidence!==null&&(value===null||value<topConfidence-.12))continue;
    // A shallow read-only probe can pin its own acquisition but never mutate
    // the real follower's state, failures, provisional words, or journal.
    const probe=Object.assign(Object.create(Follower.prototype),this.follower,{acquisition:this.follower.acquisition?{...this.follower.acquisition}:null,live:null});
    const preview=probe.feed(prefix+' '+a.transcript,{speech:true}).preview;
    const location=preview?.location;
    // Do not turn an invocation/undecided ayah in the primary speech result
    // into a remote Quran location merely because a lower alternative fits.
    if(i===0&&protectOpening&&!location)return {transcript:top.transcript,confidence:topConfidence};
    if(i===0)topLocation=location;
    else if(topLocation&&location&&(topLocation.sura!==location.sura||topLocation.aya!==location.aya||topLocation.word!==location.word))continue;
    const ops=preview?.operations||[],reads=ops.filter(op=>op.type==='read').length+(preview?.repetition?.positions.length||0),errors=ops.filter(op=>op.type!=='read').length;
    if(i===0&&reads&&!errors&&preview.consumed===preview.heardCount)return {transcript:top.transcript,confidence:topConfidence};
    const score=reads*4-errors*3-(preview?.endPos===preview?.startPos?2:0)-i*.5;
    if(score>bestScore+1){best=a;bestScore=score}
   }
   return {transcript:best.transcript,confidence:confidence(best)};
  }
  update(results){
   const commits=[],parts=[],confidences=[];let hadSpeech=false;
   for(let i=this.finalCursor;i<results.length;i++){
    const result=results[i];
    if(result.isFinal&&this.finals.has(i))continue;
    const prefix=result.isFinal?'':parts.join(' '),f=this.follower;
    const context=[f.pos,f.start,f.end,f.strict,f.locating,f.acquisition?.pos,f.replay?.pos].join(':');
    const signature=JSON.stringify(Array.from(result).slice(0,3).map(a=>[a?.transcript,a?.confidence]));
    const cached=this.choices.get(i),chosen=cached?.signature===signature&&cached.prefix===prefix&&cached.context===context?cached.chosen:this.choose(result,prefix);
    this.choices.set(i,{signature,prefix,context,chosen});
    const hasText=!!chosen.transcript.trim();if(hasText)hadSpeech=true;
    if(result.isFinal){
     this.finals.add(i);this.choices.clear();while(this.finals.has(this.finalCursor))this.finalCursor++;
     if(hasText)commits.push(this.follower.feed(chosen.transcript,{final:true,speech:true,confidence:chosen.confidence}));
    }else if(hasText){parts.push(chosen.transcript);if(chosen.confidence!==null)confidences.push(chosen.confidence)}
   }
   for(const i of this.choices.keys())if(i>=results.length)this.choices.delete(i);
   const key=parts.join('\n'),changed=commits.length>0||key!==this.liveKey;this.liveKey=key;
   let live=null;
   if(key&&changed&&!this.follower.complete)live=this.follower.feed(parts.join(' '),{speech:true,confidence:confidences.length?Math.min(...confidences):null});
   // Removing all interim entries retracts the pending live hypothesis.
   if(!key)this.follower.live=null;
   return {commits,preview:live?.preview||null,locating:live?.type==='locating',ambiguous:!!live?.ambiguous,invocation:!!live?.invocation,hadSpeech,changed};
  }
 }

 return {normalize,variants,heardWords,sourceWords,matchSeverity,Session,Corpus,Follower,SpeechInput};
});
