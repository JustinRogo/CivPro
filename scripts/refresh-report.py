"""Report changed bytes and changed Connecticut discovery URLs, never publish."""
import json, re, urllib.request
from pathlib import Path
from urllib.parse import urljoin
approved=json.loads(Path('sources/snapshots/manifest.json').read_text())
candidate=json.loads(Path('candidate/sources/manifest.json').read_text())
report={'sources':[], 'discovery':None, 'publication':'No automatic publication; review required'}
for new in candidate:
    old=next(x for x in approved if x['name']==new['name'])
    report['sources'].append({'name':new['name'],'changed':old['sha256']!=new['sha256'],'before':old['sha256'],'after':new['sha256'],'url':new['url']})
url='https://www.ctd.uscourts.gov/court-info/local-rules-and-orders'
try:
    with urllib.request.urlopen(url,timeout=60) as response: html=response.read().decode('utf-8')
    links=[urljoin(url,x) for x in re.findall(r'href=[\"\']([^\"\']+)[\"\']',html) if re.search(r'local.*rules.*\.pdf',x,re.I)]
    known=next(x['url'] for x in approved if x['name']=='ctd')
    report['discovery']={'url':url,'localRulesLinks':links,'registeredLinkPresent':known in links}
except Exception as error: report['discovery']={'error':str(error),'coverage':'Discovery could not be checked'}
Path('candidate/refresh-report.json').write_text(json.dumps(report,indent=2)+'\n')
Path('candidate/refresh-report.md').write_text('# Official source review\n\n'+''.join(f"- {x['name']}: {'CHANGED — adapter review required' if x['changed'] else 'same source bytes'}\n" for x in report['sources'])+'\nDiscovery details are in refresh-report.json. No data was published.\n')
print(json.dumps(report,indent=2))
