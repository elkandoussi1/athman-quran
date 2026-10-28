'use strict';
const assert=require('node:assert/strict'),matcher=require('./dist/assets/recitation-matcher.js');
const {Corpus,Follower,SpeechInput,normalize}=require('./dist/assets/recitation.js');
const {Journal}=require('./dist/assets/recitation-diagnostics.js');
assert.equal(matcher.normalize('ٱلرَّحْمَٰنِ ۞'),'الرحمن');assert.equal(matcher.normalize('رَحْمَة'),'رحمه');
assert.equal(matcher.compare('الصراط','السراط').kind,'phonetic');assert.equal(matcher.compare('الطيبات','التيبات').kind,'phonetic');
for(const [a,b] of [['رب','لب'],['بم','مم'],['قل','كل'],['حمد','خمد'],['فصل','وصل']])assert.equal(matcher.compare(a,b).kind,'different',a+' must not collapse into '+b);
let a=matcher.alignWindow(['الحمد','لله','رب','العالمين','الرحمن','الرحيم'],0,['الحمد','لله']);assert.equal(a.newCursor,2);assert.equal(a.ops.length,2,'unspoken future source words are not missing');
a=matcher.alignWindow(['الحمد','لله','رب','العالمين'],0,['ضجيج','الحمد','لله']);assert.equal(a.newCursor,2);assert.equal(a.ops[0].type,'extra');
a=matcher.alignWindow(['الصراط','المستقيم','الذين','أنعمت'],0,['السراط','المستقيم','الذين','انعمت']);assert.equal(a.near,1);assert.equal(a.exact,3);assert.equal(a.newCursor,4);
a=matcher.alignWindow(['الحمد','لله'],0,['كلام','آخر','بعيد']);assert.equal(a.newCursor,0);assert(!a.ops.some(op=>op.type==='match'));
assert.deepEqual(matcher.characterEdits('الصراط','السراط'),[{type:'substitution',expectedIndex:2,heardIndex:2,expected:'ص',heard:'س'}]);
// No adjacent exact anchors, but a pinned local sequence contains genuine
// alternating anchors. Similar words stay yellow and never gain read credit.
const corpus=new Corpus([{sura:1,aya:1,text:'الصراط المستقيم الطيبات العالمين الصادقين المسلمين'},{sura:2,aya:1,text:'الصراط المستقيم الطيبات العالمين الصادقين المسلمين'}]);
let f=new Follower(corpus);f.seek(1,1);let r=f.feed('السراط المستقيم التيبات العالمين السادقين المسلمين',{final:true,speech:true,confidence:.95});
assert.equal(f.pos,6);assert.deepEqual([...f.state(0).read],[1,3,5]);assert.equal(r.definiteErrors,false);assert.equal(f.state(1).read.size,0);
for(const error of f.state(0).errors.values())assert.equal(error.severity,'partial');
f=new Follower(corpus,{strict:true});f.seek(1,1);r=f.feed('السراط المستقيم التيبات العالمين السادقين المسلمين',{final:true,speech:true,confidence:.95});assert.equal(f.pos,0);assert.equal(f.state(0).read.size,0);
f=new Follower(corpus,{start:0,end:3});f.seek(1,1);f.feed('السراط المستقيم التيبات العالمين السادقين المسلمين',{final:true,speech:true,confidence:.95});assert(f.pos<=3);assert.equal(f.state(1).read.size,0);
f=new Follower(corpus);f.seek(1,1);for(let n=0;n<3;n++)r=f.feed('السراط',{final:true,speech:true,confidence:.99});assert.equal(r.definiteErrors,false);assert.equal(f.state(0).read.size,0);
const twins=new Corpus([{sura:1,aya:1,text:'الحمد لله رب العالمين'},{sura:2,aya:1,text:'الحمد لله رب العالمين'}]);
const found=twins.locate(['الحمد','لله','رب','العالمين']);assert.equal(found.status,'ambiguous');assert.equal(found.choices.length,2);assert.deepEqual(found.choices.map(c=>c.reference.sura),[1,2]);
f=new Follower(twins);f.beginSearch();const input=new SpeechInput(f),result=Object.assign([{transcript:'الحمد لله رب العالمين',confidence:.9}],{isFinal:false});const batch=input.update([result]);assert.equal(batch.choices.length,2);assert.equal(f.states.size,0);
const scoped=twins.locate(['الحمد','لله','رب','العالمين'],{start:twins.position(2,1),end:twins.words.length});assert.equal(scoped.status,'found');assert.equal(scoped.reference.sura,2);
const journal=new Journal({limit:2,now:()=>123});assert.equal(journal.record({transcript:'secret'}),null);assert.equal(journal.records.length,0);journal.setEnabled(true);
const source=[{raw:'الصراط',forms:['الصراط']},{raw:'المستقيم',forms:['المستقيم']}];journal.record({transcript:'السراط المستقيم',expected:source,confidence:.6,kind:'final',reference:{sura:1,aya:1,word:0}});assert.equal(journal.records[0].differences[0].similarity,'phonetic');assert.equal(journal.records[0].diacritics.evaluated,false);assert.equal(journal.records[0].interpretation,'needs-comparison-with-spoken-audio');
journal.record({transcript:'الحمد لله',stage:'locating'});journal.record({transcript:'الرحمن الرحيم'});assert.equal(journal.records.length,2);assert.equal(journal.dropped,1);const exported=journal.export({browser:'test'});assert.equal(exported.audioIncluded,false);assert.equal(exported.containsTranscripts,true);journal.setEnabled(false);assert.equal(journal.records.length,0);
// Normalization remains compatible with the established Warsh authority.
for(const word of ['إِلَٰهِكُمْ','شَيْـًٔا','تَتْلُواْ','رَحْمَة'])assert.equal(matcher.normalize(word),normalize(word));
console.log('PASS: bounded semi-global phonetic alignment; no future omissions; pinned-only recovery; uncertain words uncredited; strict/range safety; contextual ambiguity choices; opt-in bounded diagnostics and character differences.');
