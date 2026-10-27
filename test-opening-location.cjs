'use strict';
const assert=require('node:assert/strict');
const {Corpus,Follower,SpeechInput,heardWords,normalize,variants}=require('./dist/assets/recitation.js');
const q=require('./dist/assets/quran.json'),c=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
// Source references use Warsh's civil numbering, not a Hafs screenshot number.
const target=c.units.find(u=>u.sura===30&&u.words[0].forms.includes('فاقم')&&u.words[3].forms.includes('حنيفا'));
const targetIndex=c.byReference.get(`${target.sura}:${target.aya}`),pos=c.starts[targetIndex],text=target.words.map(w=>w.forms[0]);
const nahl=c.byReference.get('16:98'),options={speech:true,final:true,confidence:.92};
const openings=['أعوذ','أعوذ بالله','أعوذ بالله من الشيطان','أعوذ بالله من الشيطان الرجيم','أعوذ بالله من الشيطان الرحيم','أعود بالله من الشيطان الرحيم','أعوز بالله من الشيطان الرجيم','بالله من الشيطان','بالله من الشيطان الرجيم','بالله من الشيطان الرحيم','من الشيطان الرجيم','الشيطان الرجيم','منالشيطان الرجيم','أعوذبالله من الشيطان الرجيم','أعوذ بالله منالشيطان الرجيم','أعوذ بالله من الشيطان الر','بسم الله الرحمن','بسم الله الرحمن الرحيم','بسم الله الرحمان الرحيم','الله الرحمن الرحيم','الرحمن الرحيم'];
for(const opening of openings){
 assert.equal(c.locate(heardWords(opening)).status,'waiting',opening);
 for(const final of [false,true]){
  const f=new Follower(c,{index:nahl});f.beginSearch();const initial=f.pos;
  let r=f.feed(opening,{speech:true,final,confidence:.92});
  assert.equal(r.type,'locating',opening);assert.equal(r.invocation,true);assert.equal(f.locked,false);assert.equal(f.acquisition,null);assert.equal(f.pos,initial);assert.equal(f.states.size,0);assert.equal(f.failures.size,0);
  // Distinctive verse words select the real passage immediately, in one event.
  r=f.feed(text.slice(0,4).join(' '),options);assert.equal(r.location.sura,30);assert.equal(r.location.aya,target.aya);assert.equal(r.location.word,0);assert.equal(f.pos,pos+4);assert.equal(r.errorCount,0);assert.equal(f.state(nahl).read.size,0);
 }
}
// Reproduce the photographed failure: an interim ending in الرحيم used to pin
// Nahl 98; later, more distinctive Rum words were trapped at that false anchor.
let f=new Follower(c,{index:nahl});f.beginSearch();let r=f.feed('بالله من الشيطان الرحيم',{speech:true});
assert.equal(f.locked,false);assert.equal(r.preview,undefined);
r=f.feed('بالله من الشيطان الرحيم فأقم وجهك للدين حنيفا فطرت الله التي فطر الناس عليها',options);
assert.equal(r.location.sura,30);assert.equal(r.location.aya,target.aya);assert.equal(f.pos,pos+10);assert.equal(r.errorCount,0);assert.equal(f.state(nahl).read.size,0);assert.equal(f.state(nahl).errors.size,0);
// The user's typed example includes an extra lam. That difference must not
// choose another surah or certify that changed token as the source word.
f=new Follower(c);f.beginSearch();r=f.feed('أعوذ بالله من الشيطان الرجيم فأقم وجهك للدين حنيفا فطرت الله للتي فطر الناس عليها',options);
assert.equal(r.location.sura,30);assert.equal(r.location.aya,target.aya);assert.equal(f.state(targetIndex).read.has(6),false);
// A missing last invocation word must not become an early Nahl anchor while
// the service has only emitted ONE word of the intended verse.
for(const opening of ['أعوذ بالله من الشيطان','بالله من الشيطان']){
 f=new Follower(c);f.beginSearch();r=f.feed(opening+' فأقم',{speech:true});assert.equal(r.type,'locating');assert.equal(f.locked,false);
 r=f.feed(opening+' '+text.slice(0,4).join(' '),options);assert.equal(r.location.sura,30);assert.equal(f.pos,pos+4);assert.equal(r.errorCount,0);
}
// Native result snapshots: final fragments, overlapping invocation suffixes,
// an ambiguous verse prefix, then one decisive live word, before any final.
const result=(text,isFinal=false)=>Object.assign([{transcript:text,confidence:.92}],{isFinal});
for(const chunks of [['أعوذ بالله','من الشيطان الرحيم'],['أعوذ بالله','بالله من الشيطان الرحيم'],['بالله من','من الشيطان الرحيم'],['بسم الله','الله الرحمن الرحيم']]){
 f=new Follower(c);f.beginSearch();const input=new SpeechInput(f),finals=[];
 for(const chunk of chunks){finals.push(result(chunk,true));const b=input.update(finals);assert(b.commits.every(x=>x.type==='locating'));assert.equal(f.locked,false);assert.equal(f.states.size,0)}
 let b=input.update([...finals,result(text.slice(0,3).join(' '))]);assert.equal(b.locating,true);assert.equal(b.ambiguous,true);assert.equal(f.locked,false,'فأقم وجهك للدين occurs twice in Rum');
 b=input.update([...finals,result(text.slice(0,4).join(' '))]);assert.equal(b.preview.location.sura,30);assert.equal(b.preview.location.aya,target.aya);assert.equal(b.preview.operations.length,4);assert.equal(f.locked,true);assert.equal(f.states.size,0);
 finals.push(result(text.slice(0,4).join(' '),true));input.update(finals);assert.equal(f.pos,pos+4);assert.equal(f.snapshot().errorCount,0);assert.equal(f.state(nahl).read.size,0);
}
// A lower ASR alternative must not turn the primary invocation into the
// similarly worded Quran instruction. Wait for real disambiguating verse words.
for(const top of ['بالله من الشيطان الرحيم','أعوذ بالله من الشيطان فأقم','أعوذ بالله من الشيطان الرجيم فأقم وجهك للدين']){
 f=new Follower(c);f.beginSearch();const input=new SpeechInput(f);
 const alternatives=Object.assign([{transcript:top,confidence:.94},{transcript:'فاستعذ بالله من الشيطان الرجيم',confidence:.92}],{isFinal:false});
 const batch=input.update([alternatives]);assert.equal(batch.locating,true);assert.equal(batch.preview,null);assert.equal(f.locked,false);assert.equal(f.states.size,0);
}
// An interruption after an invocation keeps search open. It never pins a
// Quran passage merely because the microphone service ended its cycle.
f=new Follower(c);f.beginSearch();f.feed('بالله من الشيطان الرحيم',{speech:true});f.endUtterance();assert.equal(f.locating,true);assert.equal(f.locked,false);r=f.feed(text.slice(0,4).join(' '),options);assert.equal(r.location.sura,30);
f=new Follower(c);f.beginSearch();f.feed('أعوذ بالله من الشيطان',options);f.endUtterance();r=f.feed('الرجيم '+text.slice(0,4).join(' '),options);assert.equal(r.location.sura,30);assert.equal(r.errorCount,0);
// Real Quran invocations remain legitimate text when a distinguishing source
// context is present. No global word alias equates الرحيم and الرجيم.
const nahlText=c.units[nahl].words.map(w=>w.forms[0]);
assert.equal(c.locate(heardWords(nahlText.join(' '))).reference.sura,16);
assert.equal(c.locate(heardWords('فاستعذ بالله من الشيطان الرجيم')).reference.aya,98);
assert.equal(c.locate(heardWords('أعوذ بك رب أن يحضرون')).reference.sura,23);
assert.equal(c.locate(heardWords('فأقم وجهك للدين القيم')).reference.sura,30);assert.notEqual(c.locate(heardWords('فأقم وجهك للدين القيم')).reference.aya,target.aya);
assert(!variants('الرجيم').includes(normalize('الرحيم')));
// If an apparent suffix is actually a mid-ayah start, distinguishing Quran
// context preserves its first source words instead of silently dropping them.
for(const ref of c.search('من الشيطان نزغ')){
 const sample=c.words.slice(ref.pos,ref.pos+10).map(w=>w.forms[0]).join(' ').replace(/الشيطن/gu,'الشيطان');
 const found=c.locate(heardWords(sample));assert.equal(found.status,'found');assert.equal(found.pos,ref.pos);
}
const nahlTail=c.words.slice(c.position(16,98,4),c.position(16,98,4)+12).map(w=>w.forms[0]).join(' ').replace(/الشيطن/gu,'الشيطان');
assert.equal(c.locate(heardWords(nahlTail)).pos,c.position(16,98,4));
// Opening handling is shared across the corpus, not a special-case Rum jump.
for(let n=0;n<80;n++){
 const p=c.starts[Math.floor(n*c.units.length/80)],sample=c.words.slice(p,p+12).map(w=>w.forms[0]).join(' '),clean=c.locate(heardWords(sample));
 if(clean.status!=='found')continue;
 const found=c.locate(heardWords('أعوذ بالله من الشيطان الرحيم '+sample));assert.equal(found.status,'found');assert.equal(found.pos,clean.pos);
}

// Once a real ayah is acquired, the existing no-remote-jump guarantee remains.
f=new Follower(c);f.beginSearch();f.feed(text.slice(0,4).join(' '),options);const frontier=f.pos,locate=c.locate;c.locate=()=>{throw Error('No global search after a real verse lock')};
r=f.feed('قل هو الله أحد الله الصمد',options);assert.equal(f.pos,frontier);assert.equal(f.state(c.byReference.get('112:1')).read.size,0);c.locate=locate;
// Explicit passage bounds remain authoritative even with an invocation.
f=new Follower(c,{start:pos,end:pos+target.words.length});f.beginSearch();r=f.feed('بالله من الشيطان الرحيم',options);assert.equal(r.type,'locating');assert.equal(f.locked,false);
r=f.feed(text.slice(0,10).join(' '),options);assert.equal(r.location.sura,30);assert(f.pos<=f.end);
console.log('PASS: invocation-only/suffix/overlap/merged speech never pins Nahl; first distinctive Rum hypothesis acquires the right Warsh eighth; service interruptions; legitimate Quran contexts; exact source-word authority; stable lock and scope boundaries.');
