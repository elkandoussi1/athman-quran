'use strict';
// v33: conventional-spelling aliases must ADD forms, never replace the literal word.
const assert=require('node:assert/strict');
const {Corpus,Follower,variants,normalize}=require('./dist/assets/recitation.js');
const q=require('./dist/assets/quran.json');
const corpus=new Corpus(q.map(([sura,aya,text])=>({sura,aya,text})));
const options={final:true,speech:true,confidence:.93};
// Al-Haqqa 69:31 «ثُمَّ اَ۬لْجَحِيمَ صَلُّوهُ» was matched only as «صلاه» (prayer).
assert(variants('صَلُّوهُ').includes(normalize('صلوه')));
let f=new Follower(corpus);f.seek(69,30);
const r=f.feed('خذوه فغلوه ثم الجحيم صلوه ثم في سلسلة',options);
const u=corpus.byReference.get('69:31');
assert.equal(r.errorCount,0);assert.equal(f.state(u).errors.size,0);assert.equal(f.state(u).read.size,3);
// The Quranic waw-rasm of الصلاة / الزكاة / الحياة still accepts both spellings.
for(const [raw,plain] of [['اُ۬لصَّلَوٰةَ','الصلاة'],['اُ۬لزَّكَوٰةَ','الزكاة'],['اِ۬لْحَيَوٰةِ','الحياة']]){
 assert(variants(raw).includes(normalize(plain)),raw);
}
// Whole-Quran sweep: reciting every surah in ordinary ASR spelling, in 10-word
// final chunks, produces no false error flags.
const asr=raw=>raw.replace(/ٰ/g,'ا').replace(/ۥ/g,'و').replace(/ۦ/g,'ي').replace(/\p{M}/gu,'').replace(/ٱ/g,'ا').replace(/ءا(?=\p{L})/gu,'آ').replace(/[ۜ۞۩]/g,'');
let errors=0;
for(let sura=1;sura<=114;sura++){
 const first=corpus.byReference.get(sura+':1');let last=first;while(corpus.units[last+1]?.sura===sura)last++;
 const start=corpus.position(sura,1,0),end=corpus.position(sura,corpus.units[last].aya,0)+corpus.units[last].words.length;
 f=new Follower(corpus);f.seek(sura,1);const words=corpus.words.slice(start,end).map(w=>asr(w.raw));
 for(let i=0;i<words.length;i+=10)f.feed(words.slice(i,i+10).join(' '),options);
 for(let x=first;x<=last;x++)errors+=f.state(x).errors.size;
 assert(f.pos>=end-1,`surah ${sura} reached its end`);
}
assert.equal(errors,0,'no false errors across the whole Quran');
console.log('PASS: literal forms kept beside spelling aliases (69:31); full-Quran ASR-spelling sweep with zero false errors.');
