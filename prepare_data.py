import json,pathlib,re,unicodedata,shutil,urllib.request,concurrent.futures
P=pathlib.Path(__file__).parent
R=P/'research';D=P/'dist'
R.mkdir(exist_ok=True);(D/'assets').mkdir(parents=True,exist_ok=True)
# Downloads are preparation-only; the shipped application makes no external requests.
BASE='https://raw.githubusercontent.com/smartmaker-devs/nuralhifz-data/main/data/'
for name in ['eighths.json','hizbs.json','surahs.json','quran_muhammadi.json']:
 if not (R/name).exists():(R/name).write_bytes(urllib.request.urlopen(BASE+name,timeout=60).read())
if not (R/'warsh-official/UthmanicWarsh_v2-1 data/warshData_v2-1.json').exists():
 import zipfile,io
 data=urllib.request.urlopen('https://download.qurancomplex.gov.sa/resources_dev/UthmanicWarsh_v2-1.zip',timeout=60).read()
 with zipfile.ZipFile(io.BytesIO(data)) as z:z.extractall(R/'warsh-official')
if not (R/'amiri.css').exists():
 url='https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Sans+Arabic:wght@400;600&display=swap'
 (R/'amiri.css').write_bytes(urllib.request.urlopen(url,timeout=30).read())
def read(f):return json.loads((R/f).read_text(encoding='utf-8-sig'))
E=read('eighths.json');H=read('hizbs.json');S=read('surahs.json');V=read('quran_muhammadi.json')
Q=read('warsh-official/UthmanicWarsh_v2-1 data/warshData_v2-1.json')
qmap={(v['sura_no'],v['aya_no']):v for v in Q};vmap={(v['sura'],v['aya']):v for v in V}
def norm(s):
 s=s.replace('ـ','').replace('ے','ي').replace('ى','ي').replace('ٱ','ا').replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ؤ','و').replace('ئ','ي')
 return ''.join(c for c in s if unicodedata.category(c).startswith('L') and not ('\ufc00'<=c<='\ufcff') and c not in 'ۥۦ')
def find_offset(boundary):
 if not boundary['partial_verse']:return 0
 k=(boundary['sura'],boundary['aya']);source=vmap[k]['text'][boundary['char_offset']:].lstrip(' ۞');target=qmap[k]['aya_text']
 needle=norm(' '.join(source.split()[:3]));full='';positions=[]
 for pos,ch in enumerate(target):
  for c in norm(ch):full+=c;positions.append(pos)
 idx=full.find(needle)
 if idx<0:raise ValueError((k,source,target,needle,full))
 pos=positions[idx]
 while pos>0 and not target[pos-1].isspace():pos-=1
 return pos
# Map the twelve internal boundaries by their text, not by offsets from a different edition.
starts={e['eighth_id']:find_offset(e['start']) for e in E}
qs=[]
for v in Q:qs.append([v['sura_no'],v['aya_no'],v['aya_text']])
qidx={(v[0],v[1]):i for i,v in enumerate(qs)}
# Titles are short labels; the reader always uses the unaltered KFGQPC text.
def label(e):
 b=e['start'];k=(b['sura'],b['aya']);s=qmap[k]['aya_text'][starts[e['eighth_id']]:]
 s=re.sub(r'[\ufc00-\ufcff]','',s).strip().lstrip('۞ ').strip();return ' '.join(s.split()[:5])
entries=[]
for e in E:
 b=e['start'];end=e['end'];num=e['eighth_id'];k=(b['sura'],b['aya'])
 entries.append({'id':num,'hizb':e['hizb'],'pos':e['pos_in_hizb'],'juz':e['juz'],'title':'الٓمٓ' if num==1 else label(e),'sura':b['sura'],'aya':b['aya'],'endSura':end['sura'],'endAya':end['aya'],'startIndex':qidx[k],'endIndex':qidx[(end['sura'],end['aya'])],'startOffset':starts[num],'endOffset':starts[num+1] if num<480 and E[num]['start']['partial_verse'] else None,'page':b['mushafma_page'],'partial':b['partial_verse']})
hizbs=[]
for h in H:
 es=entries[(h['number']-1)*8:h['number']*8];hizbs.append({'id':h['number'],'juz':h['juz'],'title':es[0]['title'],'sura':es[0]['sura'],'aya':es[0]['aya'],'endSura':es[-1]['endSura'],'endAya':es[-1]['endAya'],'page':h['first_page_mushafma'],'endPage':h['last_page_mushafma']})
surahs=[{'id':s['number'],'name':s['name_ar'],'ayahs':s['verse_count'],'revelation':'مكية' if s['revelation']=='makki' else 'مدنية','firstEighth':s['first_eighth_id'],'lastEighth':s['last_eighth_id'],'page':s['first_page_mushafma']} for s in S]
assert len(hizbs)==60 and len(entries)==480 and len(surahs)==114 and len(qs)==6214
for h in hizbs:assert len([e for e in entries if e['hizb']==h['id']])==8
(D/'assets/data.js').write_text('window.QURAN_DATA='+json.dumps({'hizbs':hizbs,'eighths':entries,'surahs':surahs},ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
(D/'assets/quran.json').write_text(json.dumps(qs,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
shutil.copyfile(R/'warsh-official/UthmanicWarsh_v2-1 font/uthmanic_warsh_v21.ttf',D/'assets/warsh.ttf')
css=(R/'amiri.css').read_text();faces=re.findall(r'(@font-face\s*\{.*?\})',css,re.S)
# Self-host Arabic fonts so the interface has no external runtime dependencies.
chosen=[f for f in faces if "'Amiri'" in f or 'font-weight: 400;' in f or 'font-weight: 600;' in f]
fontcss=[]
def download(item):
 i,f=item;u=re.search(r'url\((.*?)\)',f).group(1);name='ui-font-'+str(i)+'.ttf';dest=D/'assets'/name
 if not dest.exists():dest.write_bytes(urllib.request.urlopen(u,timeout=30).read())
 return f.replace(u,name)
for f in concurrent.futures.ThreadPoolExecutor().map(download,enumerate(chosen)):fontcss.append(f)
(D/'assets/fonts.css').write_text('\n'.join(fontcss)+"\n@font-face{font-family:Warsh;src:url('warsh.ttf') format('truetype');font-display:swap}",encoding='utf-8')
print('Validated: 60 hizbs, 480 eighths, 114 surahs, 6214 Warsh verses; 12 internal verse boundaries mapped by text.')
for h in hizbs[:4]:print(h['id'],h['title'])
for e in entries[:8]:print(e['pos'],e['title'])
