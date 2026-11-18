'use strict';
// v36: Hafs 'an 'Asim data and engine — text, Madani quarters, recitation and tajweed.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {Corpus,Follower}=require('./dist/assets/recitation.js');
const T=require('./dist/assets/tajweed-warsh.js');
const q=require('./dist/assets/hafs/quran.json');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('dist/assets/hafs/data.js','utf8'),sandbox);
const D=sandbox.window.QURAN_DATA;
// Kufi count: 6236 ayahs; Al-Fatiha 7 with the basmala as ayah 1; Al-Baqara 286.
assert.equal(q.length,6236);assert.equal(D.surahs.reduce((n,s)=>n+s.ayahs,0),6236);
assert.equal(D.surahs[0].ayahs,7);assert.equal(D.surahs[1].ayahs,286);assert.equal(q[0][2].replace(/\p{M}/gu,'').split(' ').slice(0,2).join(' '),'بسم ٱلله'.replace(/\p{M}/gu,''));
// Every verse ends with the private verse-number glyph the reader replaces, and no ۞ remains.
for(const [s,a,t] of q){assert.equal(t.at(-1),String.fromCharCode(0xfbff+a));assert(!t.includes('۞'))}
// 60 hizbs × 4 quarters, contiguous and covering the whole Quran.
assert.equal(D.unitsPerHizb,4);assert.equal(D.hizbs.length,60);assert.equal(D.eighths.length,240);
D.eighths.forEach((u,i)=>{assert.equal(u.id,i+1);assert.equal(u.hizb,Math.floor(i/4)+1);assert.equal(u.pos,i%4+1);if(i)assert.equal(u.startIndex,D.eighths[i-1].endIndex+1)});
assert.equal(D.eighths[0].startIndex,0);assert.equal(D.eighths.at(-1).endIndex,6235);
// Well-known Madani rub' starts.
for(const [id,s,a] of [[2,2,26],[5,2,75],[9,2,142],[21,3,15],[238,90,1],[239,94,1],[240,100,9]])assert.deepEqual([D.eighths[id-1].sura,D.eighths[id-1].aya],[s,a],`rub ${id}`);
assert.equal(D.hizbs[59].sura,87);assert.equal(D.surahs[113].page,604);
// Recitation: every surah recited in ordinary ASR spelling — no false errors, every surah completed.
const corpus=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const asr=raw=>raw.replace(/ٰ/g,'ا').replace(/ۥ/g,'و').replace(/ۦ/g,'ي').replace(/\p{M}/gu,'').replace(/ٱ/g,'ا').replace(/ءا(?=\p{L})/gu,'آ').replace(/[ۜ۞۩]/g,'');
let errors=0;const opt={final:true,speech:true,confidence:.9};
for(let sura=1;sura<=114;sura++){
 const first=corpus.byReference.get(sura+':1');let last=first;while(corpus.units[last+1]?.sura===sura)last++;
 const start=corpus.position(sura,1,0),end=corpus.position(sura,corpus.units[last].aya,0)+corpus.units[last].words.length;
 const f=new Follower(corpus);f.seek(sura,1);const words=corpus.words.slice(start,end).map(w=>asr(w.raw));
 for(let i=0;i<words.length;i+=10)f.feed(words.slice(i,i+10).join(' '),opt);
 for(let x=first;x<=last;x++)errors+=f.state(x).errors.size;assert(f.pos>=end-1,`surah ${sura}`);
}
assert.equal(errors,0);
// Hafs mutashabih: Al-Baqara 2:123 read with the ending of 2:48 is flagged.
const f=new Follower(corpus);f.seek(2,123);f.feed('واتقوا يوما لا تجزي نفس عن نفس شيئا',opt);
const r=f.feed('ولا يقبل منها شفاعة ولا يؤخذ منها عدل',opt);assert.equal(r.mistake,true);
// Hafs tajweed: munfasil (4–5) separate from muttasil, no Warsh badal, ra thick after kasra with fatha.
const verse=(s,a)=>q.find(x=>x[0]===s&&x[1]===a)[2].split(/\s+/).filter(w=>/\p{L}/u.test(w)&&!/^[ﭐ-﷿]+$/u.test(w));
const rules=(s,a)=>{const w=verse(s,a);return w.map((x,i)=>T.analyze(x,{prev:w[i-1],next:w[i+1],last:i===w.length-1,riwaya:'hafs'}))};
let v=rules(2,4);assert.equal(v[2].find(p=>p.text.includes('ٓ')).rule,'munfasil','بِمَآ أُنزِلَ');
v=rules(2,6);assert.equal(v[3].find(p=>p.text.includes('ٓ')).rule,'muttasil','سَوَآءٌ');
v=rules(59,9);assert(!v.flat().some(p=>p.rule==='badal'));
v=rules(2,4);const akhira=v.find(w=>w.map(p=>p.text).join('').includes('خِرَةِ'));assert.equal(akhira.find(p=>p.text.startsWith('ر')).rule,'tafkhim');
assert.equal(akhira.find(p=>p.text.includes('ٓ')).rule,null,'ٱلۡأٓخِرَةِ: badal is natural in Hafs');
v=rules(2,6);assert.notEqual(v.find(w=>w.map(p=>p.text).join('').startsWith('تُنذِرۡ')).find(p=>p.text.startsWith('ر')).rule,'tafkhim','ra sakin after kasra is thin');
assert(v[0].some(p=>p.rule==='ghunna'),'إِنَّ');
console.log('PASS: Hafs data (6236 ayahs, 60 hizbs × 4 Madani quarters), full-Quran recitation with zero false errors, mutashabih alert, Hafs tajweed rules.');
