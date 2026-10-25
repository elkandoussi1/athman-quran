'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {groupEighths,eighthIds,isReviewed,setReviewed}=require('./dist/assets/divisions.js');
const raw=fs.readFileSync('dist/assets/data.js','utf8');
const d=JSON.parse(raw.slice('window.QURAN_DATA='.length,-1));
const q=JSON.parse(fs.readFileSync('dist/assets/quran.json','utf8'));
const halves=groupEighths(d.eighths,4,'half'),quarters=groupEighths(d.eighths,2,'quarter');
for(const [parts,size,total] of [[halves,4,120],[quarters,2,240]]){
 assert.equal(parts.length,total);
 for(let h=1;h<=60;h++){
  const children=parts.filter(p=>p.hizb===h);
  assert.equal(children.length,8/size);
  assert.deepEqual(children.map(p=>p.pos),Array.from({length:8/size},(_,i)=>i+1));
  assert.deepEqual(children.flatMap(eighthIds),Array.from({length:8},(_,i)=>(h-1)*8+i+1));
 }
 // Exact character coverage, including shared verses at internal boundaries.
 const chunks=q.map(()=>[]);
 for(const part of parts){
  const first=d.eighths[part.firstEighth-1],last=d.eighths[part.lastEighth-1];
  assert.equal(part.startIndex,first.startIndex);assert.equal(part.startOffset,first.startOffset);
  assert.equal(part.endIndex,last.endIndex);assert.equal(part.endOffset,last.endOffset);
  for(let i=part.startIndex;i<=part.endIndex;i++){
   const start=i===part.startIndex?part.startOffset:0;
   const end=i===part.endIndex&&part.endOffset!==null?part.endOffset:q[i][2].length;
   chunks[i].push(q[i][2].slice(start,end));
  }
 }
 chunks.forEach((parts,i)=>assert.equal(parts.join(''),q[i][2],`Verse coverage ${q[i][0]}:${q[i][1]}`));
}
assert.deepEqual(halves.slice(0,2).map(p=>p.firstEighth),[1,5]);
assert.deepEqual(quarters.slice(0,4).map(p=>p.firstEighth),[1,3,5,7]);
// A half review updates its two quarters and four eighths, preserving existing records.
const completed=new Set([480]);
setReviewed(halves[0],completed,true);
assert.deepEqual([...completed],[480,1,2,3,4]);
assert(isReviewed(halves[0],completed));assert(isReviewed(quarters[0],completed));assert(isReviewed(quarters[1],completed));
assert(!isReviewed(quarters[2],completed));
setReviewed(quarters[1],completed,false);
assert(!isReviewed(halves[0],completed));assert(isReviewed(quarters[0],completed));assert(completed.has(480));
assert.deepEqual([...completed],[480,1,2]);
console.log('PASS: 120 halves and 240 quarters; all 60 hizbs; exact Quran character coverage; shared review state preserves existing progress.');
