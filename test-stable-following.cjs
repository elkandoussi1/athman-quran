'use strict';
const assert=require('node:assert/strict');
const {Corpus,Follower,normalize,variants,matchSeverity}=require('./dist/assets/recitation.js');
const q=require('./dist/assets/quran.json'),corpus=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const at=(s,a,w=0)=>corpus.position(s,a,w),idx=(s,a)=>corpus.byReference.get(`${s}:${a}`);
const phrase=(s,a,w=0,n=8)=>corpus.words.slice(at(s,a,w),at(s,a,w)+n).map(w=>w.forms[0]).join(' ');
let f=new Follower(corpus);f.beginSearch();
let r=f.feed('ولا تجادلوا أهل');assert.equal(r.candidate.pos,at(29,46));assert.equal(f.locked,true);
// Even a revised, globally unique hypothesis cannot move the first anchor.
r=f.feed('قل هو الله أحد');assert.equal(r.candidate.reference.sura,29);assert.equal(f.states.size,0);
r=f.feed(phrase(29,46,0,8),{final:true});assert.equal(r.location.sura,29);assert.equal(f.locating,false);
const original=corpus.locate.bind(corpus);let searches=0;corpus.locate=(...args)=>{searches++;return original(...args)};
const cursor=f.pos;
for(const final of [false,true]){r=f.feed('قل هو الله أحد الله الصمد',{final});assert.equal(r.location??r.candidate??null,null);assert.equal(f.pos,cursor);assert.equal(f.state(idx(112,1)).read.size,0)}
assert.equal(searches,0,'Following never runs a global locator, including on a mismatch');
// An explicit new search is the only way to acquire a remote location again.
f.beginSearch();r=f.feed('قل هو الله أحد الله الصمد',{final:true});assert.equal(r.location.sura,112);assert.equal(searches,1);
corpus.locate=original;
// A microphone interruption keeps the provisional position, without certifying
// its words. Resuming follows locally rather than searching the Quran again.
f=new Follower(corpus);f.beginSearch();f.feed('ولا تجادلوا أهل');f.endUtterance();
assert.equal(f.locked,true);assert.equal(f.locating,false);assert.equal(f.pos,at(29,46,3));assert.equal(f.states.size,0);
r=f.feed(phrase(29,46,3,6),{final:true});assert.equal(r.location,null);assert.equal(f.pos,at(29,46,9));assert.equal(f.state(idx(29,46)).read.has(0),false);
// Following is ordered across verse/surah boundaries, without reacquisition.
f=new Follower(corpus);f.beginSearch();f.feed(phrase(29,58,0,20),{final:true});
let next=f.pos;r=f.feed(corpus.words.slice(next,next+30).map(w=>w.forms[0]).join(' '),{final:true});assert.equal(r.location,null);assert.equal(f.pos,next+30);
// Common conventional hamza spellings match their official Warsh source;
// aliases do not equate different base words from another narration.
for(const [raw,asr] of [['تَسْـَٔلُواْ','تسألوا'],['مُسْتَهْزِءُونَ','مستهزئون'],['سَيِّـَٔاتِكُمْ','سيئاتكم'],['خَٰطِـِٔينَ','خاطئين'],['رُءُوسَكُمْ','رؤوسكم'],['أَنۢبِـُٔونِے','أنبئوني'],['بِـَٔايَٰتِ','بآيات'],['لَهُۥ','له'],['عَلَيْهِۦ','عليه']])assert(variants(raw).includes(normalize(asr)),`${raw} / ${asr}`);
assert(!variants('مَلِك').includes(normalize('مالك')));assert(!variants('نُنشِرُهَا').includes(normalize('ننشزها')));
for(const [raw,asr] of [['كَمِشْكَوٰةٍ','كمشكاة'],['اَ۬لتَّوْر۪يٰةَ','التوراة'],['اَ۬لرِّبَوٰٓاْ','الربا']])assert(variants(raw).includes(normalize(asr)),`${raw} / ${asr}`);
// Character-level resemblance changes the flag, never the read credit.
assert.equal(matchSeverity({forms:['الكتاب']},'الكتا'),'partial');assert.equal(matchSeverity({forms:['الكتاب']},'شي'),'error');
f=new Follower(corpus);f.seek(29,46);
r=f.feed('ولا تجادلوا أهل الكتا إلا شيء هي أحسن إلا الذين ظلموا منهم',{final:true});
const state=f.state(idx(29,46));assert.equal(state.errors.get(3)?.severity,'partial');assert.equal(state.errors.get(5)?.severity,'error');
assert.equal(state.errors.has(4),false,'Correct words inside a recovered gap must not be flagged');assert(state.read.has(4));assert.equal(state.read.has(3),false);assert.equal(state.read.has(5),false);
assert(r.events.some(e=>e.word===3&&e.type==='uncertain'));assert(r.events.some(e=>e.word===5&&e.type==='error'));
// An unresolved close word is yellow, can be dismissed, and can be repaired.
f=new Follower(corpus,{index:idx(29,46),word:3});r=f.feed('الكتا',{final:true});assert.equal(r.errorSeverity,'partial');assert.equal(r.partialCount,1);assert.equal(r.definiteErrors,false);
r=f.feed('الكتاب إلا بالتي',{final:true});assert.equal(r.errorIndex,null);assert.equal(f.state(idx(29,46)).errors.size,0);
console.log('PASS: pinned first hypothesis; no Quran-wide search after lock; explicit reacquisition; sticky microphone resume; sequential passage following; Warsh hamza/sila aliases; separate partial/error flags; exact words inside noisy gaps stay unflagged.');
