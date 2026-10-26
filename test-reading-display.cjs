'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {Corpus,Follower,SpeechInput,sourceWords}=require('./dist/assets/recitation.js');
const {markersForVerse}=require('./dist/assets/divisions.js');
const q=require('./dist/assets/quran.json');
const d=JSON.parse(fs.readFileSync('dist/assets/data.js','utf8').slice('window.QURAN_DATA='.length,-1));
const corpus=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const idx=(s,a)=>corpus.byReference.get(`${s}:${a}`),at=(s,a,w=0)=>corpus.position(s,a,w);
const options={final:true,speech:true,confidence:.93};
const words=(s,a)=>corpus.units[idx(s,a)].words.map(w=>w.forms.at(-1));
// Photo: وسخر between والأرض and الشمس was left as an empty hole.
const verse=corpus.units[idx(29,61)],gap=verse.words.findIndex(w=>w.forms.includes('وسخر'));
assert(gap>=0);const speech=words(29,61).filter((_,i)=>i!==gap).join(' ');
let f=new Follower(corpus);f.seek(29,61);let r=f.feed(speech,options);
assert.equal(f.pos,at(29,62));assert(f.state(idx(29,61)).unverified.has(gap));
assert.equal(f.state(idx(29,61)).read.has(gap),false);
assert.equal(r.events.some(e=>e.aya===61&&e.word===gap),false,'Display traversal is neither read credit nor an asserted mistake');
assert.equal(r.errorCount,0);assert.equal(r.definiteErrors,false);
// A matching retry repairs the display flag and only then earns read credit.
f.seek(29,61,gap);r=f.feed(words(29,61).slice(gap,gap+3).join(' '),options);
assert.equal(f.state(idx(29,61)).unverified.has(gap),false);assert(f.state(idx(29,61)).read.has(gap));
// Photo: a whole earlier ayah can be traversed by local recovery. It must be
// displayable, while the next unread ayah remains untouched and uncredited.
f=new Follower(corpus);f.seek(29,53);r=f.feed(words(29,54).join(' '),options);
assert.equal(f.pos,at(29,55));
assert.equal(f.state(idx(29,53)).unverified.size,corpus.units[idx(29,53)].words.length);
assert.equal(f.state(idx(29,53)).read.size,0);assert(!f.outcomes.some(o=>o.index===idx(29,53)));
assert.equal(f.state(idx(29,55)).unverified.size,0);assert.equal(f.state(idx(29,55)).read.size,0);
// Live gaps retract with revisions and survive an interim-only restart as
// provisional display, without certified states or journal events.
f=new Follower(corpus);f.seek(29,61);const stream=new SpeechInput(f);
const result=text=>Object.assign([{transcript:text,confidence:.93}],{isFinal:false});
let batch=stream.update([result(speech)]);assert(batch.preview.operations.some(op=>op.pos===at(29,61,gap)&&op.type!=='read'));
assert.equal(f.states.size,0);batch=stream.update([]);f.endUtterance();assert.equal(f.provisionalUnverified.size,0);assert.equal(f.pos,at(29,61));
stream.update([result(speech)]);f.endUtterance();assert(f.provisionalUnverified.has(at(29,61,gap)));assert.equal(f.states.size,0);assert.equal(f.outcomes.length,0);
f.beginSearch();assert.equal(f.provisionalUnverified.size,0);
// A pending flag belongs to its original word; advancing provisionally must
// not paint a word with the same ordinal in the following ayah.
f=new Follower(corpus);f.seek(29,61,gap);f.feed('شيء',options);
f.feed(words(29,61).slice(gap+1).join(' '),{speech:true});f.endUtterance();
assert.equal(f.snapshot().errorIndex,null);assert(f.state(idx(29,61)).errors.has(gap));assert.equal(f.state(idx(29,62)).errors.size,0);
// An acquired middle-of-ayah start must never reveal the unrecited prefix.
f=new Follower(corpus);f.beginSearch();r=f.feed(words(29,61).slice(gap+1).join(' '),options);
assert.equal(r.location.word,gap+1);assert.equal(f.state(idx(29,61)).unverified.has(gap),false);
// A strict stop does not reveal future words past the unresolved position.
f=new Follower(corpus,{index:idx(29,61),strict:true});f.feed(speech,options);
assert.equal(f.pos,at(29,61,gap));assert.equal(f.state(idx(29,61)).unverified.size,0);
// All 480 Moroccan eighths have a structural mark at the exact source word,
// including all 12 internal-ayah boundaries and starts without a raw glyph.
const markers=corpus.units.flatMap(unit=>markersForVerse(d.eighths,unit,sourceWords).map(m=>({...m,sura:unit.sura,aya:unit.aya})));
assert.equal(markers.length,480);assert.equal(new Set(markers.map(m=>m.id)).size,480);
for(const e of d.eighths){
 const m=markers.find(m=>m.id===e.id),unit=corpus.units[idx(e.sura,e.aya)];
 assert.equal(m.word,sourceWords(q[e.startIndex][2].slice(0,e.startOffset)).length);
 assert(m.word>=0&&m.word<unit.words.length);assert.equal(m.hizb,e.hizb);assert.equal(m.part,e.pos);
 if(e.partial)assert(m.word>0);
}
assert.deepEqual(markers.find(m=>m.id===322),{id:322,hizb:41,part:2,word:0,sura:29,aya:60});
console.log('PASS: passed words/whole ayahs remain displayable without false credit; gaps repair on exact retry; reversible live gaps; interim restart; unrecited prefixes and future words stay hidden; all 480 eighth marks use exact Warsh source offsets.');
