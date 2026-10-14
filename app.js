(() => {
'use strict';
const config = window.SERRINHA_CONFIG || {};
const $ = id => document.getElementById(id);
const fmtNum = (n, digits=1) => Number.isFinite(n) ? n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits}) : '—';
const fmtVal = (n,unit,dec=1) => Number.isFinite(n) ? `${fmtNum(n,dec)} ${unit}` : '—';
const tz = config.TIME_ZONE || 'America/Sao_Paulo';
const dayKey = iso => new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const shortDate = iso => new Intl.DateTimeFormat('pt-BR',{timeZone:tz,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
const shortTime = iso => new Intl.DateTimeFormat('pt-BR',{timeZone:tz,hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
const niceDay = key => {const [y,m,d]=key.split('-');return `${d}/${m}/${y}`};
const valid = row => Number.isFinite(Number(row.temperature)) && Number.isFinite(Number(row.humidity)) && Number.isFinite(Number(row.wifi_rssi)) && +row.humidity>=0 && +row.humidity<=100 && !Number.isNaN(Date.parse(row.created_at));
const round = (v,d=1) => Number(v.toFixed(d));
function dewPoint(t,h){if(!Number.isFinite(t)||!Number.isFinite(h)||h<=0)return NaN;const a=17.625,b=243.04,g=Math.log(h/100)+a*t/(b+t);return b*g/(a-g)}
let client, chart, rows=[], statsPeriod='day',chartHours=24, loading=false, refreshTimer;
function state(label,good=false){$('connection').textContent=`● ${label}`;$('connection').classList.toggle('ok',good)}
function notice(message){$('warning').textContent=message;$('warning').classList.toggle('hidden',!message)}
function showDash(on){$('auth').classList.toggle('hidden',on);$('dashboard').classList.toggle('hidden',!on);$('logout').classList.toggle('hidden',!on)}
function when(v){return v?shortDate(v):'—'}
function metrics(list){const nums=(field)=>list.map(x=>+x[field]).filter(Number.isFinite);const extrema=field=>{
 const sorted=list.filter(x=>Number.isFinite(+x[field]));if(!sorted.length)return {min:NaN,max:NaN,avg:NaN,minWhen:null,maxWhen:null};let min=sorted[0],max=sorted[0],sum=0;for(const x of sorted){let n=+x[field];sum+=n;if(n<+min[field])min=x;if(n>+max[field])max=x}return {min:+min[field],max:+max[field],avg:sum/sorted.length,minWhen:min.created_at,maxWhen:max.created_at}};
 return {t:extrema('temperature'),h:extrema('humidity')};}
function renderStats(){const today=dayKey(new Date());const month=today.slice(0,7);const list=statsPeriod==='day'?rows.filter(r=>dayKey(r.created_at)===today):statsPeriod==='month'?rows.filter(r=>dayKey(r.created_at).startsWith(month)):rows;
 const m=metrics(list);
 [['tmin',m.t.min,'°C'],['tmax',m.t.max,'°C'],['tavg',m.t.avg,'°C'],['hmin',m.h.min,'%'],['hmax',m.h.max,'%'],['havg',m.h.avg,'%']].forEach(([id,v,u])=>$(id).textContent=fmtVal(v,u));
 for(const [id,v] of [['tminWhen',m.t.minWhen],['tmaxWhen',m.t.maxWhen],['hminWhen',m.h.minWhen],['hmaxWhen',m.h.maxWhen]])$(id).textContent=when(v);
}
function renderCurrent(){const x=rows[rows.length-1];if(!x){notice('Ainda não existem leituras para este dispositivo.');state('Sem leituras');return;}
 $('tempNow').textContent=fmtNum(+x.temperature);$('humidityNow').textContent=fmtNum(+x.humidity);$('dewNow').textContent=fmtNum(dewPoint(+x.temperature,+x.humidity));$('rssiNow').textContent=String(x.wifi_rssi);$('lastSeen').textContent=shortDate(x.created_at);
 const age=(Date.now()-Date.parse(x.created_at))/60000;const online=age<=15&&age>=-5;state(online?'ESP32 online':'ESP32 offline',online);$('humidityLabel').textContent=+x.humidity>=70?'Umidade elevada':+x.humidity>=60?'Acima da faixa recomendada':'Dentro da faixa de referência';$('humidityFill').style.width=Math.max(0,Math.min(100,+x.humidity))+'%';$('wifiLabel').textContent=+x.wifi_rssi>=-60?'Sinal muito bom':+x.wifi_rssi>=-70?'Sinal bom':+x.wifi_rssi>=-80?'Sinal fraco':'Sinal muito fraco';
 if(!online)notice('Sem nova leitura há mais de 15 minutos. Verifique a alimentação e a conexão do ESP32.');else notice('');
 $('coverage').textContent=`${rows.length.toLocaleString('pt-BR')} leituras disponíveis`;
}
function measureExposure(list){let observed=0,o60=0,o70=0;for(let i=1;i<list.length;i++){let prev=list[i-1],cur=list[i];let dt=Date.parse(cur.created_at)-Date.parse(prev.created_at);if(dt<=0||dt>10*60*1000)continue;observed+=dt;if(+prev.humidity>60)o60+=dt;if(+prev.humidity>70)o70+=dt;}return {observed,o60,o70};}
function renderExposure(){const now=Date.now(),last24=rows.filter(x=>Date.parse(x.created_at)>=now-86400000);const exp=measureExposure(last24);const pct=n=>exp.observed?100*n/exp.observed:NaN;
 const p60=pct(exp.o60),p70=pct(exp.o70);$('over60').textContent=Number.isFinite(p60)?fmtNum(p60,0)+'%':'—';$('over70').textContent=Number.isFinite(p70)?fmtNum(p70,0)+'%':'—';$('fill60').style.width=(Number.isFinite(p60)?p60:0)+'%';$('fill70').style.width=(Number.isFinite(p70)?p70:0)+'%';
 // Expected cadence: 1 reading every five minutes. Arrival count capped at 100%.
 const expected=288;const p=Math.min(100,last24.length/expected*100);$('availability').textContent=fmtNum(p,0)+'%';$('fillAvailability').style.width=p+'%';
}
function bucketChart(list,maxBuckets=260){if(!list.length)return [];const first=Date.parse(list[0].created_at),last=Date.parse(list[list.length-1].created_at);const size=Math.max(300000,Math.ceil((last-first+1)/maxBuckets/300000)*300000);const groups=new Map();for(const r of list){let k=Math.floor(Date.parse(r.created_at)/size)*size;let g=groups.get(k)||{t:0,h:0,c:0,ts:k};g.t+=+r.temperature;g.h+=+r.humidity;g.c++;groups.set(k,g)}return [...groups.values()].sort((a,b)=>a.ts-b.ts).map(g=>({ts:g.ts,t:round(g.t/g.c),h:round(g.h/g.c)}));}
function renderChart(){if(typeof Chart==='undefined'){notice('Não foi possível carregar a biblioteca de gráficos. Confira a conexão com a internet.');return;}const cutoff=Date.now()-chartHours*3600000;const list=rows.filter(x=>Date.parse(x.created_at)>=cutoff);const b=bucketChart(list);const labels=b.map(x=>chartHours===24?shortTime(x.ts):new Intl.DateTimeFormat('pt-BR',{timeZone:tz,day:'2-digit',month:'2-digit',hour:'2-digit'}).format(new Date(x.ts)));
 if(chart)chart.destroy();chart=new Chart($('historyChart'),{type:'line',data:{labels,datasets:[{label:'Umidade (%)',data:b.map(x=>x.h),borderColor:'#73c9b2',backgroundColor:'#73c9b2',yAxisID:'humidity',tension:.25,pointRadius:0,borderWidth:2,spanGaps:false},{label:'Temperatura (°C)',data:b.map(x=>x.t),borderColor:'#e3bb78',backgroundColor:'#e3bb78',yAxisID:'temperature',tension:.25,pointRadius:0,borderWidth:2,spanGaps:false}]},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{backgroundColor:'#102125'}},scales:{x:{ticks:{color:'#92a6a9',maxTicksLimit:8},grid:{color:'#30414755'}},humidity:{type:'linear',position:'left',min:0,max:100,ticks:{color:'#73c9b2'},grid:{color:'#30414755'}},temperature:{type:'linear',position:'right',ticks:{color:'#e3bb78'},grid:{drawOnChartArea:false}}}}});}
function renderDays(){const groups=new Map();for(const r of rows){let k=dayKey(r.created_at);let a=groups.get(k)||[];a.push(r);groups.set(k,a)}const days=[...groups.keys()].sort().reverse().slice(0,14);$('dailyRows').innerHTML=days.length?days.map(k=>{const m=metrics(groups.get(k));return `<tr><td>${niceDay(k)}</td><td>${fmtVal(m.t.min,'°C')}</td><td>${fmtVal(m.t.max,'°C')}</td><td>${fmtVal(m.h.min,'%')}</td><td>${fmtVal(m.h.max,'%')}</td><td>${groups.get(k).length}</td></tr>`}).join(''):'<tr><td colspan="6">Sem dados disponíveis.</td></tr>';}
function render(){renderCurrent();renderStats();renderExposure();renderChart();renderDays();}
async function fetchAll(){if(loading)return;loading=true;try{
 // Keyset pagination; avoids the Supabase/PostgREST default 1000-row limit.
 let all=[],last=null,limit=1000,complete=false;const cap=100000;
 for(let i=0;i<cap/limit;i++){let q=client.from('sensor_readings').select('id,device_id,temperature,humidity,wifi_rssi,created_at').eq('device_id',config.DEVICE_ID).order('id',{ascending:false}).limit(limit);if(last!==null)q=q.lt('id',last);const {data,error}=await q;if(error)throw error;const batch=data||[];all.push(...batch);if(batch.length<limit){complete=true;break;}last=batch[batch.length-1].id;}
 rows=all.filter(valid).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));render();if(!complete)notice('O histórico ultrapassou 100.000 registros: os recordes exibidos consideram apenas os registros mais recentes. Para escala maior, use agregações SQL no Supabase.');
 }catch(err){console.error(err);notice('Não foi possível consultar o Supabase: '+(err.message||'erro desconhecido'));state('Erro ao consultar');}finally{loading=false;}}
function toggleSelected(group,attr,value){$(group).querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset[attr]===String(value)));}
async function init(){const ready=config.SUPABASE_URL?.startsWith('https://')&&config.SUPABASE_ANON_KEY&&!config.SUPABASE_ANON_KEY.startsWith('COLE_');if(!ready||!window.supabase){$('setup').classList.remove('hidden');state('Configuração pendente');return;}
 client=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
 $('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='';const {error}=await client.auth.signInWithPassword({email:$('email').value,password:$('password').value});if(error){$('loginError').textContent='Não foi possível entrar. Confira suas credenciais.';return;}showDash(true);fetchAll();});
 $('logout').addEventListener('click',async()=>{await client.auth.signOut();rows=[];showDash(false);state('Acesso privado')});
 $('refresh').addEventListener('click',fetchAll);
 $('statsRange').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{statsPeriod=b.dataset.period;toggleSelected('statsRange','period',statsPeriod);renderStats()}));
 $('chartRange').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{chartHours=Number(b.dataset.hours);toggleSelected('chartRange','hours',chartHours);renderChart()}));
 const {data:{session}}=await client.auth.getSession();showDash(!!session);if(session){fetchAll();}else state('Acesso privado');
 refreshTimer=setInterval(async()=>{const {data:{session}}=await client.auth.getSession();if(session)fetchAll()},60000);
}
window.addEventListener('load',init);
})();
