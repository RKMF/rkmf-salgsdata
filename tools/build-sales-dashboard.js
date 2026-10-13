const fs = require('fs');
const path = require('path');

const files = {
  2023: path.join(__dirname, '..', 'tixly-daily-source-data', '2023-total-daily.csv'),
  2024: path.join(__dirname, '..', 'tixly-daily-source-data', '2024-total-daily.csv'),
  2025: path.join(__dirname, '..', 'tixly-daily-source-data', '2025-total-daily.csv'),
  2026: path.join(__dirname, '..', 'tixly-daily-source-data', '2026-total-daily.csv')
};
const eventFiles = {
  2023: path.join(__dirname, '..', 'tixly-daily-source-data', '2023-event-map.csv'),
  2024: path.join(__dirname, '..', 'tixly-daily-source-data', '2024-event-map.csv'),
  2025: path.join(__dirname, '..', 'tixly-daily-source-data', '2025-event-map.csv'),
  2026: path.join(__dirname, '..', 'tixly-daily-source-data', '2026-event-map.csv')
};
const venueDailyFiles = {
  2023: {stang:path.join(__dirname, '..', 'tixly-daily-source-data', '2023-stangholmen-daily.csv'), rh:path.join(__dirname, '..', 'tixly-daily-source-data', '2023-risorhuset-daily.csv'), kirka:path.join(__dirname, '..', 'tixly-daily-source-data', '2023-risor-kirke-daily.csv')},
  2024: {stang:path.join(__dirname, '..', 'tixly-daily-source-data', '2024-stangholmen-daily.csv'), rh:path.join(__dirname, '..', 'tixly-daily-source-data', '2024-risorhuset-daily.csv'), kirka:path.join(__dirname, '..', 'tixly-daily-source-data', '2024-risor-kirke-daily.csv')},
  2025: {stang:path.join(__dirname, '..', 'tixly-daily-source-data', '2025-stangholmen-daily.csv'), rh:path.join(__dirname, '..', 'tixly-daily-source-data', '2025-risorhuset-daily.csv'), kirka:path.join(__dirname, '..', 'tixly-daily-source-data', '2025-risor-kirke-daily.csv')},
  2026: {stang:path.join(__dirname, '..', 'tixly-daily-source-data', '2026-stangholmen-daily.csv'), rh:path.join(__dirname, '..', 'tixly-daily-source-data', '2026-risorhuset-daily.csv'), kirka:path.join(__dirname, '..', 'tixly-daily-source-data', '2026-risor-kirke-daily.csv')}
};
const festivalStart = {2023:'2023-06-27', 2024:'2024-06-25', 2025:'2025-06-24', 2026:'2026-06-23'};

function csvLine(line) {
  const out=[]; let cur='', quoted=false;
  for (let i=0;i<line.length;i++) {
    const c=line[i];
    if (c==='"') { if (quoted && line[i+1]==='"') { cur+='"'; i++; } else quoted=!quoted; }
    else if (c===',' && !quoted) { out.push(cur); cur=''; }
    else cur+=c;
  }
  out.push(cur); return out;
}
function parse(file) {
  return fs.readFileSync(file,'utf8').trim().split(/\r?\n/).slice(1)
    .map(csvLine).filter(r=>r[0] && !r[0].startsWith('Totalt'))
    .map(r=>({date:r[0], sold:Number(r[1]||0), tickets:Number(r[5]||0), revenue:Number(r[6]||0)}));
}
function parseVenue(file) {
  const rows=fs.readFileSync(file,'utf8').trim().split(/\r?\n/).map(csvLine);
  if (!rows.length || rows[0][0] !== 'Nr.') return parse(file);
  const byDate=new Map();
  for (const r of rows.slice(1).filter(r=>r[0] && !r[0].startsWith('Totalt'))) {
    const date=r[3].slice(0,10);
    const old=byDate.get(date)||{date,sold:0,tickets:0,revenue:0};
    old.sold+=Number(r[7]||0);
    old.tickets+=Number(r[9]||0);
    old.revenue+=Number(String(r[13]||0).replace(/\./g,'').replace(',','.'));
    byDate.set(date,old);
  }
  return [...byDate.values()].sort((a,b)=>a.date.split('.').reverse().join('').localeCompare(b.date.split('.').reverse().join('')));
}
function parseEvents(file) {
  return fs.readFileSync(file,'utf8').trim().split(/\r?\n/).slice(1)
    .map(csvLine).filter(r=>r[0] && !r[0].startsWith('Totalt'))
    .map(r=>({date:r[3].slice(0,10), name:r[1], venue:r[5], tickets:Number(r[9]||0), revenue:Number(String(r[11]||0).replace(/\./g,'').replace(',','.'))}));
}
function dayDiff(a,b) { return Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000); }
const data={}, events={};
for (const [year,file] of Object.entries(files)) {
  let cumT=0, cumS=0, cumR=0;
  data[year]=parse(file).map(r=>({
    ...r, x:dayDiff(r.date.split('.').reverse().join('-'), festivalStart[year]),
    cumTickets: (cumT+=r.tickets), cumSold: (cumS+=r.sold), cumRevenue: (cumR+=r.revenue)
  }));
  events[year]=parseEvents(eventFiles[year]).map(r=>({...r,x:dayDiff(r.date.split('.').reverse().join('-'),festivalStart[year])}));
}
const venueDaily={};
for (const [year, venues] of Object.entries(venueDailyFiles)) {
  venueDaily[year]={};
  for (const [venue,file] of Object.entries(venues)) {
    let cumTickets=0, cumSold=0, cumRevenue=0;
    venueDaily[year][venue]=parseVenue(file).map(r=>({...r,x:dayDiff(r.date.split('.').reverse().join('-'),festivalStart[year]),cumTickets:cumTickets+=r.tickets,cumSold:cumSold+=r.sold,cumRevenue:cumRevenue+=r.revenue}));
  }
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RKMF daglig salg — 2023–2026</title>
<style>
:root{color-scheme:dark;--bg:#071018;--panel:#0e1b28;--grid:#294050;--muted:#9db0bd;--text:#f4f7f8}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -20%,#1b3445 0,#071018 48%);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.wrap{max-width:1500px;margin:0 auto;padding:34px 34px 48px}.top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:20px}.eyebrow{color:#8ca8b8;text-transform:uppercase;letter-spacing:.14em;font-size:12px;font-weight:700}.title{font-size:clamp(26px,3.2vw,46px);font-weight:800;letter-spacing:-.04em;margin:7px 0 6px}.subtitle{color:var(--muted);font-size:15px}.guide{background:#122534;border:1px solid #3b6175;border-left:4px solid #7ff0bd;border-radius:13px;padding:15px 18px;margin:0 0 18px;box-shadow:0 10px 24px #0003}.guide-title{font-size:18px;font-weight:800;color:#f4f7f8;margin-bottom:5px}.note{color:#c7d7de;font-size:14px;line-height:1.5}.controls{display:flex;flex-wrap:wrap;gap:10px;background:rgba(14,27,40,.88);border:1px solid #274052;border-radius:16px;padding:12px;margin-bottom:16px;box-shadow:0 14px 30px #0004}.control{display:flex;align-items:center;gap:8px;background:#122534;border:1px solid #315064;border-radius:10px;padding:8px 12px;color:#b9cad3;font-size:13px}.control strong{color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:.07em}.control button,.control select,.year-filter select{border:0;background:transparent;color:#fff;font:inherit;cursor:pointer;outline:0}.control button.active{color:#7ff0bd;font-weight:800}.control select option,.year-filter select option{background:#10202c;color:#fff}.year-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.year-filter{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:#122534;border:1px solid #315064;border-radius:10px;padding:10px 12px;color:#b9cad3;font-size:12px}.year-filter strong{color:#fff;font-size:14px;margin-right:4px}.year-filter label{white-space:nowrap}.chart-card{background:linear-gradient(180deg,#0d1a27,#0a151f);border:1px solid #274052;border-radius:20px;padding:18px 18px 10px;box-shadow:0 24px 55px #0006}.chart-scroll{overflow-x:auto}.chart-wrap{min-width:980px;position:relative}.chart{width:100%;height:650px;display:block}.axis{fill:#9eb2bd;font-size:12px}.axisStrong{fill:#d4e1e7;font-size:13px;font-weight:700}.gridline{stroke:var(--grid);stroke-width:1}.zero{stroke:#66808f;stroke-width:1.5;stroke-dasharray:5 5}.line{fill:none;stroke-width:3.2;stroke-linejoin:round;stroke-linecap:round}.dot{stroke:#071018;stroke-width:2}.legend{display:flex;flex-wrap:wrap;gap:14px;padding:8px 2px 2px;color:#d7e2e7;font-size:13px}.legend span{display:inline-flex;align-items:center;gap:7px}.swatch{display:inline-block;width:24px;border-top:3px solid currentColor}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:15px}.stat{background:#112331;border:1px solid #284455;border-radius:13px;padding:12px 14px}.stat .y{font-weight:800;font-size:14px}.stat .v{font-size:21px;font-weight:800;margin-top:6px}.stat small{color:#8fa6b2}.stat .avg{color:#c8d8df;margin-top:4px}.tip{position:absolute;pointer-events:none;display:none;background:#f5fbfd;color:#10202a;border-radius:10px;padding:10px 12px;min-width:230px;box-shadow:0 14px 35px #0008;font-size:12px;line-height:1.45;z-index:3}.tip b{font-size:13px}.tip .r{display:flex;justify-content:space-between;gap:18px}.tip .r span:first-child{font-weight:700}.cross{stroke:#b8d7e3;stroke-width:1;stroke-dasharray:4 4;opacity:.75}.footer{color:#708996;font-size:12px;margin-top:14px}
@media(max-width:980px){.year-filters{grid-template-columns:repeat(2,1fr)}}
@media(max-width:720px){.wrap{padding:24px 15px}.top{display:block}.year-filters{grid-template-columns:1fr}.chart{height:540px}.stats{grid-template-columns:repeat(2,1fr)}.stat .v{font-size:17px}}
</style></head><body><main class="wrap">
<div class="top"><div><div class="eyebrow">Risør Kammermusikkfest</div><h1 class="title">Sammenligning av daglig salg</h1><div class="subtitle">2023–2026 · justert etter festivaldag · faktiske salgsdatoer</div></div></div>
<div class="guide"><div class="guide-title">Interaktiv sammenligning av daglig salg</div><div class="note" id="note">Hvert år har egne avkrysningsbokser. «Totalt» på viser alt, og valgte spillesteder trekkes da fra totalen. «Totalt» av viser bare valgte spillesteder. Festivaldag 0 er første festivaldag for hvert år.</div></div>
<div class="controls"><div class="control"><strong>Måleenhet</strong><button data-m="tickets" class="active">Billetter</button><button data-m="revenue">Omsetning</button></div><div class="control"><strong>Visning</strong><button data-v="cum" class="active">Akkumulert</button><button data-v="daily">Daglig</button></div><div class="control"><strong>Justering</strong><button data-a="festival" class="active">Festivaldag</button><button data-a="calendar">Kalenderdato</button></div></div>
<div class="year-filters"><div class="year-filter"><strong>2023</strong><label><input type="checkbox" data-year-total="2023" checked> Totalt</label><label><input type="checkbox" data-year="2023" data-year-venue="stang"> Stangholmen</label><label><input type="checkbox" data-year="2023" data-year-venue="rh"> Risørhuset</label><label><input type="checkbox" data-year="2023" data-year-venue="kirka"> Risør kirke</label></div><div class="year-filter"><strong>2024</strong><label><input type="checkbox" data-year-total="2024" checked> Totalt</label><label><input type="checkbox" data-year="2024" data-year-venue="stang"> Stangholmen</label><label><input type="checkbox" data-year="2024" data-year-venue="rh"> Risørhuset</label><label><input type="checkbox" data-year="2024" data-year-venue="kirka"> Risør kirke</label></div><div class="year-filter"><strong>2025</strong><label><input type="checkbox" data-year-total="2025" checked> Totalt</label><label><input type="checkbox" data-year="2025" data-year-venue="stang"> Stangholmen</label><label><input type="checkbox" data-year="2025" data-year-venue="rh"> Risørhuset</label><label><input type="checkbox" data-year="2025" data-year-venue="kirka"> Risør kirke</label></div><div class="year-filter"><strong>2026</strong><label><input type="checkbox" data-year-total="2026" checked> Totalt</label><label><input type="checkbox" data-year="2026" data-year-venue="stang"> Stangholmen</label><label><input type="checkbox" data-year="2026" data-year-venue="rh"> Risørhuset</label><label><input type="checkbox" data-year="2026" data-year-venue="kirka"> Risør kirke</label></div></div>
<section class="chart-card"><div class="chart-scroll"><div class="chart-wrap"><svg class="chart" role="img" aria-label="Interaktiv sammenligning av daglig salg"></svg><div class="tip"></div></div></div><div class="legend"></div><div class="stats"></div></section>
<div class="footer">Kilde: Tix-eksporter av daglig salg. Billetter og omsetning bruker rapportens netto-kolonner «Totalt».</div>
</main><script>
const DATA=${JSON.stringify(data)}; const EVENTS=${JSON.stringify(events)}; const VENUE_DAILY=${JSON.stringify(venueDaily)}; const START=${JSON.stringify(festivalStart)}; const END=${JSON.stringify({2023:'2023-07-02',2024:'2024-06-30',2025:'2025-06-29',2026:'2026-06-28'})};
const COLORS={2023:'#67b5ff',2024:'#c18cff',2025:'#ff6b63',2026:'#58e39c'};
const STYLES={2023:'',2024:'',2025:'',2026:''};
let metric='tickets', view='cum', align='festival';
const yearFilters=Object.fromEntries(Object.keys(DATA).map(year=>[year,{total:true,venues:new Set()}]));
const svg=document.querySelector('.chart'), tip=document.querySelector('.tip'), legend=document.querySelector('.legend'), stats=document.querySelector('.stats'), note=document.getElementById('note');
const fmtN=n=>new Intl.NumberFormat('nb-NO').format(Math.round(n)); const fmtKr=n=>fmtN(n)+' kr';
const parseDate=s=>{const [d,m,y]=s.split('.').map(Number);return new Date(Date.UTC(y,m-1,d));};
const ticketValue=r=>r.tickets;
const cumulativeTickets=r=>r.cumTickets;
function venueKey(v){const s=(v||'').toLowerCase();if(s.includes('stangholmen'))return 'stang';if(s.includes('risørhuset')||s.includes('inger johanne')||s.includes('risør rådhus')||s.includes('rådhus'))return 'rh';if(s.includes('kirke'))return 'kirka';return 'other'}
function eventRowsForCount(year){const start=Date.parse(START[year]+'T12:00:00Z'),end=Date.parse(END[year]+'T12:00:00Z'),seen=new Set();return EVENTS[year].filter(e=>{const day=Date.parse(e.date.split('.').reverse().join('-')+'T12:00:00Z'),name=e.name.toLowerCase(),key=[e.date,e.name,e.venue].join('|');if(day<start||day>end||/test|plassreservasjon|generalprøve/.test(name)||seen.has(key))return false;seen.add(key);return true})}
const CONCERT_COUNTS=Object.fromEntries(Object.keys(DATA).map(year=>{const rows=eventRowsForCount(year);const counts={total:rows.length,stang:0,rh:0,kirka:0};for(const e of rows){const key=venueKey(e.venue);if(key in counts)counts[key]++;}return [year,counts]}));
const CONCERT_COUNT_OVERRIDES={2025:{total:28,kirka:12}};
for(const [year,values] of Object.entries(CONCERT_COUNT_OVERRIDES))Object.assign(CONCERT_COUNTS[year],values);
function seriesFor(year){
  const config=yearFilters[year];
  if(config.total && config.venues.size===0) return DATA[year].map(r=>({...r,val:view==='cum'?(metric==='tickets'?cumulativeTickets(r):r.cumRevenue):(metric==='tickets'?ticketValue(r):r.revenue)}));
  const sources=VENUE_DAILY[year];
  if(!sources || config.venues.size===0 || [...config.venues].some(v=>!sources[v])) return [];
  const byDate=new Map();
  for(const venue of config.venues) for(const r of sources[venue]) {
    const old=byDate.get(r.date)||{date:r.date,x:r.x,sold:0,tickets:0,revenue:0};
    old.sold+=r.sold; old.tickets+=r.tickets; old.revenue+=r.revenue; byDate.set(r.date,old);
  }
  if(config.total) {
    let ct=0,cs=0,cr=0; return DATA[year].map(r=>{const removed=byDate.get(r.date)||{sold:0,tickets:0,revenue:0};const row={...r,sold:r.sold-removed.sold,tickets:r.tickets-removed.tickets,revenue:r.revenue-removed.revenue};row.cumTickets=ct+=row.tickets;row.cumSold=cs+=row.sold;row.cumRevenue=cr+=row.revenue;row.val=view==='cum'?(metric==='tickets'?row.cumTickets:row.cumRevenue):(metric==='tickets'?row.tickets:row.revenue);return row});
  }
  let ct=0,cs=0,cr=0;
  return DATA[year].map(base=>{
    const r=byDate.get(base.date)||{date:base.date,x:base.x,sold:0,tickets:0,revenue:0};
    return {...r,cumTickets:ct+=r.tickets,cumSold:cs+=r.sold,cumRevenue:cr+=r.revenue,val:view==='cum'?(metric==='tickets'?ct:cr):(metric==='tickets'?r.tickets:r.revenue)};
  });
}
function render(){
  const W=1360,H=650,L=76,R=32,T=28,B=78, pw=W-L-R, ph=H-T-B; const years=Object.keys(DATA);
  const series=years.map(y=>({y,rows:seriesFor(y)}));
  const points=series.flatMap(s=>s.rows.map(r=>({y:s.y,r,x:align==='festival'?r.x:parseDate(r.date).getTime()})));
  const xmin=Math.min(...points.map(p=>p.x)), xmax=Math.max(...points.map(p=>p.x));
  const shown=series;
  const ymax=Math.max(...shown.flatMap(s=>s.rows.map(r=>r.val)),1)*1.12; const x=p=>L+(p-xmin)/(xmax-xmin||1)*pw, y=v=>T+ph-(v/ymax)*ph;
  const ticks=[]; const step=align==='festival'?14:30; let first=Math.ceil(xmin/step)*step; for(let v=first;v<=xmax;v+=step) ticks.push(v);
  let out='';
  for(let i=0;i<=5;i++){const v=ymax*i/5; const yy=y(v); out+=\`<line class="gridline" x1="\${L}" x2="\${W-R}" y1="\${yy}" y2="\${yy}"/><text class="axis" x="\${L-12}" y="\${yy+4}" text-anchor="end">\${metric==='revenue'?fmtKr(v):fmtN(v)}</text>\`;}
  for(const tx of ticks){const xx=x(tx);out+=\`<line class="gridline" x1="\${xx}" x2="\${xx}" y1="\${T}" y2="\${T+ph}" opacity=".45"/><text class="axis" x="\${xx}" y="\${H-39}" text-anchor="middle">\${align==='festival'?(tx===0?'Festival':(tx>0?'+':'')+tx+' d'):new Date(tx).toLocaleDateString('nb-NO',{day:'2-digit',month:'2-digit'})}</text>\`;}
  out+=\`<line class="cross" id="crosshair" x1="\${L}" x2="\${L}" y1="\${T}" y2="\${T+ph}" style="display:none"/><line class="zero" x1="\${L}" x2="\${W-R}" y1="\${T+ph}" y2="\${T+ph}"/><text class="axisStrong" x="\${W/2}" y="\${H-12}" text-anchor="middle">\${align==='festival'?'Festivaldag (0 = første festivaldag)':'Kalenderdato'}</text><text class="axisStrong" transform="translate(17,\${H/2}) rotate(-90)" text-anchor="middle">\${view==='cum'?'Akkumulert ':''}\${metric==='revenue'?'Omsetning (kr)':'Billetter'}</text>\`;
  for(const s of shown){const d=s.rows.map(r=>\`\${x(align==='festival'?r.x:parseDate(r.date).getTime())},\${y(r.val)}\`).join(' ');out+=\`<polyline class="line \${STYLES[s.y]}" stroke="\${COLORS[s.y]}" points="\${d}" data-year="\${s.y}"/>\`; for(const r of s.rows) out+=\`<circle class="dot" cx="\${x(align==='festival'?r.x:parseDate(r.date).getTime())}" cy="\${y(r.val)}" r="3.2" fill="\${COLORS[s.y]}" data-year="\${s.y}" data-x="\${align==='festival'?r.x:parseDate(r.date).getTime()}"/>\`;}
  svg.setAttribute('viewBox',\`0 0 \${W} \${H}\`);svg.innerHTML=out;
  legend.innerHTML=years.map(yr=>\`<span style="color:\${COLORS[yr]}"><i class="swatch \${STYLES[yr]}"></i>\${yr}</span>\`).join('');
  stats.innerHTML=shown.map(s=>{const rows=s.rows,config=yearFilters[s.y];if(!rows.length)return \`<div class="stat"><div class="y" style="color:\${COLORS[s.y]}">\${s.y}</div><div class="v">ikke valgt</div><small>velg Totalt eller minst ett spillested</small></div>\`;const last=rows[rows.length-1],v=view==='cum'?(metric==='tickets'?last.cumTickets:last.cumRevenue):(metric==='tickets'?rows.reduce((a,r)=>a+r.tickets,0):rows.reduce((a,r)=>a+r.revenue,0));const label=config.total?(config.venues.size?'total minus valgte':'daglig rapport totalt'):'valgte spillesteder';const selectedConcerts=config.total?CONCERT_COUNTS[s.y].total-[...config.venues].reduce((sum,k)=>sum+(CONCERT_COUNTS[s.y][k]||0),0):[...config.venues].reduce((sum,k)=>sum+(CONCERT_COUNTS[s.y][k]||0),0);const average=selectedConcerts?v/selectedConcerts:0;const averageLabel=metric==='revenue'?fmtKr(average):fmtN(average)+' billetter';const showAverage=!(config.venues.size===1&&config.venues.has('stang')&&!config.total);const averageText=showAverage?' · snitt '+averageLabel+' per forestilling':'';return \`<div class="stat"><div class="y" style="color:\${COLORS[s.y]}">\${s.y}</div><div class="v">\${metric==='revenue'?fmtKr(v):fmtN(v)}</div><small>\${label} · \${selectedConcerts} forestillinger\${averageText}</small></div>\`}).join('');
  note.textContent='Hvert år har egne avkrysningsbokser. «Totalt» på viser alt, og valgte spillesteder trekkes da fra totalen. «Totalt» av viser bare valgte spillesteder. Festivaldag 0 er første festivaldag for hvert år.';
}
document.querySelectorAll('[data-year-total]').forEach(cb=>cb.onchange=()=>{yearFilters[cb.dataset.yearTotal].total=cb.checked;render()});
document.querySelectorAll('[data-year-venue]').forEach(cb=>cb.onchange=()=>{const config=yearFilters[cb.dataset.year];if(cb.checked)config.venues.add(cb.dataset.yearVenue);else config.venues.delete(cb.dataset.yearVenue);render()});
document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{metric=b.dataset.m;document.querySelectorAll('[data-m]').forEach(x=>x.classList.toggle('active',x===b));render()});
document.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{view=b.dataset.v;document.querySelectorAll('[data-v]').forEach(x=>x.classList.toggle('active',x===b));render()});
document.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{align=b.dataset.a;document.querySelectorAll('[data-a]').forEach(x=>x.classList.toggle('active',x===b));render()});
function hover(ev){const rect=svg.getBoundingClientRect(), sx=1360/rect.width, rawX=(ev.clientX-rect.left)*sx; const L=76,R=32,pw=1360-L-R, mx=Math.max(L,Math.min(1360-R,rawX)); const ss=Object.keys(DATA).map(y=>({y,rows:seriesFor(y)})).filter(s=>s.rows.length); if(!ss.length)return; const crosshair=svg.querySelector('#crosshair'); if(crosshair){crosshair.setAttribute('x1',mx);crosshair.setAttribute('x2',mx);crosshair.style.display='block'} const pts=ss.flatMap(s=>s.rows.map(r=>({r,x:(align==='festival'?r.x:parseDate(r.date).getTime())}))); const xmin=Math.min(...pts.map(p=>p.x)),xmax=Math.max(...pts.map(p=>p.x)); const target=xmin+(mx-L)/pw*(xmax-xmin); let best=pts.reduce((a,p)=>Math.abs(p.x-target)<Math.abs(a.x-target)?p:a,pts[0]); const rows=ss.map(({y:yr,rows:rs})=>{let r=rs.reduce((a,p)=>Math.abs((align==='festival'?p.x:parseDate(p.date).getTime())-best.x)<Math.abs((align==='festival'?a.x:parseDate(a.date).getTime())-best.x)?p:a,rs[0]);return {yr,r}}); const bx=Math.max(8,Math.min(rect.width-250,ev.clientX-rect.left+16)),by=Math.max(8,ev.clientY-rect.top-20); tip.style.display='block';tip.style.left=bx+'px';tip.style.top=by+'px';tip.innerHTML='<b>'+ (align==='festival'?((best.x>0?'+':'')+best.x+' festivaldag'):'Valgte datoer')+'</b>'+rows.map(({yr,r})=>{const dt=parseDate(r.date), day=dt.toLocaleDateString('nb-NO',{weekday:'long'});const val=r.val;return '<div class="r"><span style="color:'+COLORS[yr]+'">'+yr+' · '+day+'<br>'+r.date+'</span><strong>'+ (metric==='revenue'?fmtKr(val):fmtN(val))+'</strong></div>'}).join('');}
svg.addEventListener('mousemove',hover);svg.addEventListener('mouseleave',()=>{tip.style.display='none';const crosshair=svg.querySelector('#crosshair');if(crosshair)crosshair.style.display='none'}); render();
</script></body></html>`;

const output = path.join(__dirname, '..', 'outputs', 'rk-m-festival-sales-dashboard-2023-2026.html');
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output, html);
console.log(output);
