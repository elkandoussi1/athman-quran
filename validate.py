"""Check the meaningful invariants of a complete, locally bundled Quran index."""
import json,pathlib,re,unicodedata
p=pathlib.Path(__file__).parent/'dist'
d=json.loads((p/'assets/data.js').read_text()[len('window.QURAN_DATA='):-1])
q=json.loads((p/'assets/quran.json').read_text())
assert [h['id'] for h in d['hizbs']]==list(range(1,61))
assert [e['id'] for e in d['eighths']]==list(range(1,481))
assert len(d['surahs'])==114 and len(q)==6214
assert sum(s['ayahs'] for s in d['surahs'])==len(q)
for h in d['hizbs']:
 es=[e for e in d['eighths'] if e['hizb']==h['id']]
 assert len(es)==8 and [e['pos'] for e in es]==list(range(1,9))
assert len([e for e in d['eighths'] if e['partial']])==12
# Each letter of each Quran verse must appear exactly once across the 480 reader ranges.
pieces={i:[] for i in range(len(q))}
for e in d['eighths']:
 assert q[e['startIndex']][:2]==[e['sura'],e['aya']]
 assert q[e['endIndex']][:2]==[e['endSura'],e['endAya']]
 for i in range(e['startIndex'],e['endIndex']+1):
  a=e['startOffset'] if i==e['startIndex'] else 0
  b=e['endOffset'] if i==e['endIndex'] and e['endOffset'] is not None else len(q[i][2])
  assert 0<=a<b<=len(q[i][2]),(e['id'],i,a,b)
  pieces[i].append(q[i][2][a:b])
for i,parts in pieces.items():
 assert ''.join(parts)==q[i][2],('Quran coverage mismatch',q[i][:2])
# Verify the specifically requested first eight and first four hizb starts.
assert [(e['sura'],e['aya']) for e in d['eighths'][:8]]==[(1,1),(2,16),(2,25),(2,33),(2,41),(2,53),(2,59),(2,66)]
assert [(h['sura'],h['aya']) for h in d['hizbs'][:4]]==[(1,1),(2,75),(2,141),(2,201)]
for f in ['index.html','assets/style.css','assets/app.js','assets/data.js','assets/quran.json','assets/fonts.css','assets/warsh.ttf','manifest.webmanifest','assets/icon.svg','sw.js']:
 assert (p/f).is_file(),f
print('PASS: complete 60/480/114 index; first starts match; all 6,214 verse texts covered exactly once, including the 12 internal boundaries; assets present.')
