'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {Corpus,Follower,heardWords,sourceWords}=require('./dist/assets/recitation.js');
const q=JSON.parse(fs.readFileSync('dist/assets/quran.json','utf8'));
const started=performance.now();
const corpus=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text,label:`${sura}:${aya}`})));
for(let i=0;i<q.length;i++){const marker=String.fromCharCode(0xfbff+q[i][1]);assert.equal(corpus.units[i].text,q[i][2].endsWith(marker)?q[i][2].slice(0,-1).trimEnd():q[i][2]);assert(!corpus.units[i].words.some(w=>w.raw===marker),'Source verse-number glyph is never a recited word')}
const index=(s,a)=>corpus.byReference.get(s+':'+a);
const phrase=(s,a,word=0,count=10)=>corpus.words.slice(corpus.position(s,a,word),corpus.position(s,a,word)+count).map(w=>w.forms[0]).join(' ');
// Exact distinctive phrases can locate any full-verse offset in the corpus.
for(const [s,a,w] of [[2,93,3],[29,46,0],[36,12,4],[55,14,0],[112,1,0],[114,1,0],[2,281,20]]){
 const located=corpus.locate(heardWords(phrase(s,a,w,14)));
 assert.equal(located.status,'found',`${s}:${a}:${w}`);
 assert.equal(located.pos,corpus.position(s,a,w));
}
// Repeated verses and invocations must wait for disambiguating recitation.
assert.equal(corpus.locate(heardWords('فبأي آلاء ربكما تكذبان')).status,'ambiguous');
assert.equal(corpus.locate(heardWords('الحمد لله رب العالمين')).status,'ambiguous');
assert.equal(corpus.locate(heardWords('بسم الله الرحمن الرحيم')).status,'waiting');
assert.equal(corpus.locate(heardWords('أعوذ بالله من الشيطان')).status,'waiting');
assert.equal(corpus.locate(heardWords('بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم')).pos,corpus.position(1,1));
// Interim speech can suggest a position but cannot reveal words or count errors.
let follower=new Follower(corpus,{index:index(2,1)});follower.beginSearch();
let r=follower.feed(phrase(29,46,4,8));
assert.equal(r.candidate.reference.sura,29);assert.equal(follower.index,index(2,1));assert.equal(follower.states.size,0);
r=follower.feed(phrase(29,46,4,8),{final:true});assert.equal(r.location.sura,29);assert.equal(r.location.word,4);
assert.equal(follower.state(index(29,46)).read.has(0),false,'Unrecited prefix is not credited');
assert.equal(follower.state(index(29,46)).read.has(4),true);
// A single incorrect/omitted word is red while later correct words continue.
const small=new Corpus([{sura:1,aya:1,text:'الحمد لله رب العالمين'},{sura:1,aya:2,text:'الرحمن الرحيم'},{sura:1,aya:3,text:'ملك يوم الدين'}]);
follower=new Follower(small);
r=follower.feed('الحمد لله رب الناس الرحمن الرحيم',{final:true});
assert.equal(r.continued,true);assert.equal(follower.index,2);assert(follower.state(0).errors.has(3));assert.equal(follower.state(1).errors.size,0);
assert.equal(follower.outcomes[0].hasErrors,true);assert.equal(follower.outcomes[0].assisted,true);
follower=new Follower(small);r=follower.feed('الحمد رب العالمين الرحمن الرحيم',{final:true});
assert(follower.state(0).errors.has(1));assert.equal(follower.index,2);assert.equal(follower.state(0).read.has(1),false);
// Error at a chunk boundary: wait for a following anchor, then continue unchanged ASR.
follower=new Follower(small);r=follower.feed('الحمد لله رب الناس',{final:true});assert.equal(r.type,'mismatch');assert.equal(follower.cursor,3);
r=follower.feed('الرحمن الرحيم',{final:true});assert.equal(r.continued,true);assert.equal(follower.index,2);assert(follower.state(0).errors.has(3));
// A correct retry repairs the pending position, without duplicating old tail words.
follower=new Follower(small);follower.feed('الحمد لله رب الناس',{final:true});
r=follower.feed('العالمين الرحمن الرحيم',{final:true});assert.equal(follower.index,2);assert.equal(follower.state(0).errors.size,0);
// A different Warsh word is never silently certified as correct.
r=follower.feed('مالك يوم الدين',{final:true});assert.equal(r.continued,true);assert(follower.state(2).errors.has(0));assert.equal(follower.outcomes[2].hasErrors,true);
// No later anchor means no arbitrary skip. Interim hypotheses never add failures.
follower=new Follower(small);
for(let i=0;i<5;i++)follower.feed('الحمد لله رب الناس');
assert.equal(follower.snapshot().attempts,0);assert.equal(follower.states.size,0);
for(let i=1;i<=3;i++){r=follower.feed('الحمد لله رب الناس',{final:true});assert.equal(r.type,'mismatch');assert.equal(r.attempts,i)}
assert.deepEqual(r.hints,[3]);assert.equal(follower.index,0);
// Search buffers join final chunks and restarting the microphone permits a new location.
follower=new Follower(corpus);follower.beginSearch();assert.equal(follower.feed('الحمد لله رب العالمين',{final:true}).type,'locating');
r=follower.feed('الرحمن الرحيم',{final:true});assert.equal(r.location.sura,1);assert.equal(follower.outcomes.length,2);
follower.beginSearch();r=follower.feed(phrase(36,12,3,12),{final:true});assert.equal(r.location.sura,36);
// Long ASR finals and half-verse starts retain their exact source coordinates.
follower=new Follower(corpus);follower.beginSearch();r=follower.feed(phrase(2,281,25,55),{final:true});assert.equal(r.location.sura,2);assert.equal(r.location.aya,281);
assert.equal(r.location.word,25);
console.log(`PASS: Quran-wide unique location; repeated-verse ambiguity; interim safety; continuing past substitutions/omissions; chunk-boundary recovery; unrecited words remain uncredited. ${Math.round(performance.now()-started)} ms including full-corpus index.`);
// A chosen passage can disambiguate a short phrase without leaving its bounds.
const scopedCorpus=new Corpus([{sura:1,aya:1,text:'الحمد لله رب العالمين'},{sura:1,aya:2,text:'الرحمن الرحيم'},{sura:2,aya:1,text:'الحمد لله رب العالمين'}]);
const scoped=new Follower(scopedCorpus,{start:0,end:4});scoped.beginSearch();
assert.equal(scoped.feed('الحمد',{final:true}).type,'progress');assert.equal(scoped.cursor,1);
assert.equal(scoped.feed('لله رب العالمين الرحمن الرحيم',{final:true}).complete,true);assert.equal(scoped.pos,4);assert.equal(scoped.state(1).read.size,0);
const bounded=new Follower(scopedCorpus,{start:2,end:4});bounded.beginSearch();bounded.feed('رب العالمين',{final:true});assert.equal(bounded.complete,true);assert.equal(bounded.state(0).read.has(0),false);
const strict=new Follower(small,{strict:true});strict.feed('الحمد لله رب الناس الرحمن الرحيم',{final:true});assert.equal(strict.index,0);assert.equal(strict.cursor,3);assert.equal(strict.state(1).read.size,0);
strict.ignoreWord(0,3);assert.equal(strict.state(0).ignored.has(3),true);assert.equal(strict.state(0).read.has(3),false);assert.equal(strict.pos,4);
const matchesText=corpus.search('ولا تجادلوا أهل الكتاب');assert(matchesText.some(r=>r.sura===29&&r.aya===46));
assert.equal(corpus.search('٢٩:٤٦')[0].aya,46);assert.deepEqual(corpus.search('999:1'),[]);
console.log('PASS: scoped recitation stays within exact word boundaries; short scoped speech; strict correction mode; false-flag dismissal without machine certification; global text and verse-reference search.');
