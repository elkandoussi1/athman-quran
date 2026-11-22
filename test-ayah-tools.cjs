'use strict';
// v37: reciters, Warsh→Hafs ayah map, bundled tafsirs and word meanings.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=f=>JSON.parse(fs.readFileSync(path.join('dist/assets',f),'utf8'));
const warsh=read('quran.json'),hafs=read('hafs/quran.json');
const count=(q,s)=>q.filter(v=>v[0]===s).length;

// 1) The Warsh→Hafs map covers every ayah of both riwayat, in order.
const map=read('warsh-hafs.json');
assert.equal(map.length,114);
for(let s=1;s<=114;s++){
 const row=map[s-1];assert.equal(row.length,count(warsh,s),`Warsh count, surah ${s}`);
 let prev=0;const covered=new Set();
 for(const v of row){const [lo,hi]=Array.isArray(v)?v:[v,v];assert(lo<=hi);assert(lo>=prev,`monotone ${s}`);prev=hi;for(let h=lo;h<=hi;h++)covered.add(h)}
 for(let h=s===1?2:1;h<=count(hafs,s);h++)assert(covered.has(h),`Hafs ${s}:${h} unmapped`);
}
assert.deepEqual(map[0],[2,3,4,5,6,7,7]);          // الفاتحة: البسملة آية في حفص لا في ورش
assert.deepEqual(map[1][0],[1,2]);                  // الٓمٓ ذلك الكتاب
assert.deepEqual(map[17][98],[103,104]);            // الكهف 99 ورش = 103–104 حفص
assert.equal(map[1][253],255);assert.equal(map[1][254],256); // ورش يعدّ «الله لا إله إلا هو الحي القيوم» آية

// 2) Warsh timings: one start/end pair per ayah, in order, for every reciter.
for(const id of ['qazabri','kouchi','husary','jazairi']){
 const t=read(`audio/warsh-${id}.json`);assert.equal(t.unit,'cs');assert(t.folder.startsWith('https://cdn.mp3quran.net/audio/'));
 for(let s=1;s<=114;s++){
  const row=t.surahs[s-1];assert.equal(row.length,2*count(warsh,s),`${id} ${s}`);
  for(let i=0;i<row.length;i+=2){assert(row[i]<row[i+1],`${id} ${s}:${i/2+1} empty`);if(i)assert(row[i]>=row[i-2],`${id} ${s} order`)}
 }
}

// 3) Bundled tafsirs: Hafs numbering, no surah intro leaking into an ayah.
for(const id of ['muyassar','jalalayn','gharib']){
 for(let s=1;s<=114;s++){
  const d=read(`tafsir/${id}/${s}.json`);assert.equal(d.ayahs.length,count(hafs,s),`${id} ${s}`);
  if(id==='muyassar'){assert(d.intro.startsWith('تسمية السورة'),`intro ${s}`);assert(d.ayahs.every(t=>t&&!t.includes('تسمية السورة')),`muyassar ${s}`)}
 }
}

// 4) The browser module, run against the files on disk.
function load(riwaya){
 const ctx={console,URL,Response,setTimeout,clearTimeout,setInterval,clearInterval,
  localStorage:{getItem:()=>null,setItem(){}},
  ATHMAN_RIWAYA:{id:riwaya},QURAN_DATA:{surahs:Array.from({length:114},(_,i)=>({name:'س'+(i+1),ayahs:count(riwaya==='hafs'?hafs:warsh,i+1)}))},
  fetch:async url=>{const file=path.join('dist',String(url).replace(/^assets\//,'assets/'));return {ok:fs.existsSync(file),status:fs.existsSync(file)?200:404,json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))}}};
 ctx.globalThis=ctx;vm.createContext(ctx);
 vm.runInContext(fs.readFileSync('dist/assets/ayah-tools.js','utf8').replace("typeof window==='object'?window:globalThis","globalThis"),ctx);
 return ctx.ATHMAN_AYAH;
}
(async()=>{
 const W=load('warsh'),H=load('hafs');
 assert.equal(W.RIWAYA,'warsh');assert.equal(H.RIWAYA,'hafs');
 assert.equal(W.reciters().length,4);assert(W.reciters().every(r=>r.type==='surah'));
 assert(H.reciters().length>=8);assert(H.reciters().every(r=>r.type==='ayah'));
 assert.equal(W.TAFSIRS[0].id,'muyassar');assert(W.TAFSIRS.some(t=>t.id==='ibn-atiyya')&&W.TAFSIRS.some(t=>t.id==='qurtubi')&&W.TAFSIRS.some(t=>t.id==='ibn-ashur'));
 // Warsh and Hafs spellings reduce to the same letters.
 assert.equal(W.skeleton('يُومِنُونَ'),W.skeleton('يُؤۡمِنُونَ'));
 assert.equal(W.skeleton('اَ۬لصَّلَوٰةَ'),W.skeleton('ٱلصَّلَوٰةَ'));
 assert.equal(W.core('وَالذِينَ'),W.core('ٱلَّذِينَ'));
 // Tafsir of Warsh 2:1 covers Hafs 2:1–2 with the surah intro.
 let r=await W.tafsir('muyassar',2,1);assert.deepEqual([...r.hafs],[1,2]);assert.equal(r.parts.length,2);assert(r.intro.includes('البقرة'));
 r=await W.tafsir('muyassar',1,1);assert.deepEqual([...r.hafs],[2,2]);assert(r.parts[0].text.includes('الثناء'));
 r=await H.tafsir('muyassar',1,1);assert(r.parts[0].text.includes('أبتدئ'));
 // Grouped ayahs are shown once with their range.
 r=await H.tafsir('muyassar',96,3);assert.equal(r.parts[0].from,1);assert(r.parts[0].to>=3);
 r=await W.tafsir('jalalayn',2,255);assert(r.parts[0].text.length>50);
 // Word meanings: the tapped Warsh word finds its Hafs gharib entry.
 let m=await W.meanings(2,2,'يُومِنُونَ');const best=m.filter(e=>e.score===3);assert.equal(best.length,1);assert.equal(W.skeleton(best[0].meaning),W.skeleton('يصدقون'));
 m=await H.meanings(2,2,'ٱلۡكِتَٰبُ');assert(m.some(e=>e.score>=2&&e.meaning.includes('القرآن')));
 m=await W.meanings(2,4,'بِالْغَيْبِ');assert(m.length>0);
 console.log('PASS: Warsh→Hafs map covers both riwayat; Warsh timings for 4 reciters; bundled Muyassar/Jalalayn/Gharib; tafsir and word meanings resolve across riwayat.');
})().catch(e=>{console.error(e);process.exitCode=1});
