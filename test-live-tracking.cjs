'use strict';
const assert=require('node:assert/strict');
const {Corpus,Follower,heardWords}=require('./dist/assets/recitation.js');
const q=require('./dist/assets/quran.json');
const corpus=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const pos=(s,a,w=0)=>corpus.position(s,a,w);
const words=(s,a,w=0,n=10)=>corpus.words.slice(pos(s,a,w),pos(s,a,w)+n).map(w=>w.forms[0]);
const locate=text=>corpus.locate(heardWords(text));

// A first distinctive live result already carries exact source-word coordinates.
let f=new Follower(corpus);f.beginSearch();
let r=f.feed('ولا تجادلوا أهل');
assert.equal(r.candidate.pos,pos(29,46));assert.equal(r.preview.operations.length,3);
assert.equal(r.preview.focusPos,pos(29,46,2));
assert.equal(f.states.size,0);assert.equal(f.locating,true);assert.equal(f.locateBuffer.length,0);
// Revisions must retract the old provisional reveal, not accumulate it.
r=f.feed('ولا تجادلوا أهل الكتاب إلا بالتي هي أحسن');assert.equal(r.preview.operations.filter(o=>o.type==='read').length,8);
r=f.feed('ولا تجادلوا أهل');assert.equal(r.preview.operations.length,3);
assert.equal(f.states.size,0);assert.equal(f.outcomes.length,0);assert.equal(f.failures.size,0);
// A bad middle token can be located from surrounding evidence, not certified.
const noisy='ولا تجادلوا أهل شيء إلا بالتي هي أحسن';
assert.equal(locate(noisy).pos,pos(29,46));assert.equal(locate(noisy).edits,1);
r=f.feed(noisy);assert(r.preview.operations.some(o=>o.type==='error'&&o.pos===pos(29,46,3)));
assert(!r.preview.operations.some(o=>o.type==='read'&&o.pos===pos(29,46,3)));assert.equal(f.states.size,0);
r=f.feed(noisy,{final:true});assert.equal(r.location.sura,29);assert.equal(f.state(r.location.index).errors.has(3),true);
assert.equal(f.state(r.location.index).read.has(3),false);assert.equal(f.pos,pos(29,46,8));
// Consecutive partial results after a final start at its end and stay reversible.
r=f.feed('إلا الذين ظلموا');assert.equal(r.preview.startPos,pos(29,46,8));
assert.equal(r.preview.focusPos,pos(29,46,10));assert.equal(f.pos,pos(29,46,8));
r=f.feed('إلا الذين',{final:true});assert.equal(f.pos,pos(29,46,10));
// A result reaching a verse boundary exposes operations from BOTH verses.
const c=new Corpus([{sura:1,aya:1,text:'الحمد لله رب العالمين'},{sura:1,aya:2,text:'الرحمن الرحيم'},{sura:1,aya:3,text:'ملك يوم الدين'}]);
f=new Follower(c);r=f.feed('الحمد لله رب العالمين الرحمن الرحيم');
assert.equal(r.preview.operations.filter(o=>o.type==='read').length,6);assert.equal(f.outcomes.length,0);
// Warsh's source words remain the authority, including at live resynchronisation.
for(const [s,a,oldWord,wrongWord] of [[1,3,'ملك','مالك'],[2,258,'ننشرها','ننشزها']]){
 const unit=corpus.units[corpus.byReference.get(`${s}:${a}`)],i=unit.words.findIndex(w=>w.forms.includes(oldWord));assert(i>=0);
 f=new Follower(corpus,{index:corpus.byReference.get(`${s}:${a}`),word:i,strict:true});
 r=f.feed([wrongWord,...unit.words.slice(i+1,i+4).map(w=>w.forms[0])].join(' '),{final:true});
 assert.equal(r.type,'mismatch');assert.equal(f.pos,pos(s,a,i));assert.equal(f.state(r.index).read.has(i),false);
}
// Repeated formulas, a single word, and unrelated speech never trigger a jump.
for(const text of ['فبأي آلاء ربكما تكذبان','الحمد لله رب العالمين','بسم الله الرحمن الرحيم','الله','هذا اختبار لخدمة الصوت في الهاتف'])assert.notEqual(locate(text).status,'found',text);
// A target appearing in two near-identical passages is still ambiguous.
const repeated=new Corpus([{sura:1,aya:1,text:'تلك آيات الكتاب المبين العظيم الرحمن الرحيم'},{sura:2,aya:1,text:'تلك آيات الكتاب المبين العظيم الرحمن الرحيم'}]);
assert.equal(repeated.locate(heardWords('تلك آيات خطأ المبين العظيم الرحمن الرحيم')).status,'ambiguous');
// Long uninterrupted results retain the opening words instead of clipping to
// the last 64 tokens (the Warsh debt verse contains 128 source words).
f=new Follower(corpus);f.beginSearch();
const debt=corpus.units[corpus.byReference.get('2:281')];
r=f.feed(debt.words.map(w=>w.forms[0]).join(' '),{final:true});
assert.equal(r.location.word,0);assert.equal(f.state(r.location.index).read.size,debt.words.length);
f=new Follower(corpus);f.beginSearch();r=f.feed(words(2,281,0,180).join(' '),{final:true});
assert.equal(r.location.word,0);assert.equal(f.pos,pos(2,281)+180);
// Passage-only mode cannot be widened by either live or final noisy search.
f=new Follower(corpus,{start:pos(1,1),end:pos(2,1)});f.beginSearch();
assert.equal(f.feed(noisy).type,'locating');assert.equal(f.feed(noisy,{final:true}).type,'locating');assert.equal(f.states.size,0);
// Broad deterministic regression: an exact excerpt must never jump elsewhere.
for(let n=0;n<400;n++){
 const index=Math.floor(n*corpus.units.length/400),start=corpus.starts[index],text=corpus.words.slice(start,start+9).map(w=>w.forms[0]).join(' '),found=locate(text);
 if(found.status==='found')assert.equal(found.pos,start,`wrong target ${corpus.units[index].sura}:${corpus.units[index].aya}`);
}
console.log('PASS: first-result live positioning; reversible cross-verse previews; noisy locator without crediting skipped words; Warsh-only word authority; ambiguous excerpts wait; live scope boundaries; 400 Quran-wide exact-location regressions.');
