import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.join(here,'public');
const PORT=Number(process.env.PORT||3000);
const sources=[
 ['ADSB.fi open data','https://opendata.adsb.fi/api/v3/lat/-34.887504/lon/138.484094/dist/100'],
 ['ADSB.lol','https://api.adsb.lol/v2/point/-34.887504/138.484094/100'],
 ['Airplanes.live','https://api.airplanes.live/v2/point/-34.887504/138.484094/100'],
 ['ADSB One','https://api.adsb.one/v2/point/-34.887504/138.484094/100'],
];
let cache={time:0,data:null};
const json=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
async function getFlights(){
 if(cache.data && Date.now()-cache.time<12000)return cache.data;
 let failures=[];
 for (const [name,url] of sources){
  try{
   const rsp=await fetch(url,{signal:AbortSignal.timeout(7000),headers:{'User-Agent':'TennysonSky/1.0 personal dashboard'}});
   if(!rsp.ok)throw Error('HTTP '+rsp.status);
   const data=await rsp.json();
   if(!Array.isArray(data.ac))throw Error('Unexpected provider response');
   const value={source:name,receivedAt:new Date().toISOString(),aircraft:data.ac.map(a=>({hex:a.hex||'',flight:String(a.flight||'').trim(),lat:a.lat,lon:a.lon,alt_baro:a.alt_baro,alt_geom:a.alt_geom,gs:a.gs,track:a.track,baro_rate:a.baro_rate,seen_pos:a.seen_pos,category:a.category,type:a.t||a.type||''})).filter(a=>Number.isFinite(a.lat)&&Number.isFinite(a.lon))};
   cache={time:Date.now(),data:value};return value;
  }catch(e){failures.push(`${name}: ${e.message}`)}
 }
 throw Error(failures.join('; '));
}
// Optional airport arrival board, separate from ADS-B positions.
// Set AERODATABOX_RAPIDAPI_KEY as a Render secret environment variable.
let arrivalsCache={time:0,data:null};
async function getArrivals(){
 const key=process.env.AERODATABOX_RAPIDAPI_KEY;
 if(!key)return {configured:false,message:'Next 6 arrivals requires an arrivals data subscription. Add AERODATABOX_RAPIDAPI_KEY in Render to enable.'};
 if(arrivalsCache.data&&Date.now()-arrivalsCache.time<1800000)return arrivalsCache.data;
 // Request arrivals at YPAD over the next 12 hours (provider supports this time window).
 const url='https://aerodatabox.p.rapidapi.com/flights/airports/icao/YPAD?direction=Arrival&withLeg=true&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false&offsetMinutes=0&durationMinutes=720';
 const rsp=await fetch(url,{headers:{'X-RapidAPI-Key':key,'X-RapidAPI-Host':'aerodatabox.p.rapidapi.com'},signal:AbortSignal.timeout(12000)});
 if(!rsp.ok)throw Error('Airport arrivals provider returned HTTP '+rsp.status);
 const j=await rsp.json();
 if(!Array.isArray(j.arrivals))throw Error('Unexpected airport arrival response');
 const now=Date.now();
 const arrivals=j.arrivals.map(a=>{
   const movement=a.arrival||a.movement||{};
   const t=movement.revisedTime||movement.predictedTime||movement.scheduledTime;
   const flight=a.number||a.callSign||null;
   const time=t?.utc||t?.local;
   const ms=time?Date.parse(time):NaN;
   return {flight,origin:a.departure?.airport?.name||a.departure?.airport?.iata||null, ms, minutesToLand:Math.ceil((ms-now)/60000),arrivalLocal:Number.isFinite(ms)?new Date(ms).toLocaleTimeString('en-AU',{timeZone:'Australia/Adelaide',hour:'2-digit',minute:'2-digit'}):'',timeType:movement.revisedTime||movement.predictedTime?'estimated':'scheduled',status:a.status||''};
 }).filter(a=>Number.isFinite(a.ms)&&a.ms>=now-120000&&!/cancel|divert|landed|arrived/i.test(a.status)).sort((a,b)=>a.ms-b.ms).slice(0,6).map(({ms,...a})=>a);
 const data={configured:true,source:'AeroDataBox',arrivals};arrivalsCache={time:Date.now(),data};return data;
}
const mime={'.html':'text/html; charset=utf-8','.png':'image/png','.js':'application/javascript','.css':'text/css'};
http.createServer(async (req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/api/arrivals'){
   try{return json(res,200,await getArrivals())}catch(e){return json(res,503,{error:'Arrivals feed unavailable',message:e.message})}
  }
  if(u.pathname==='/api/flights'){
   try{return json(res,200,await getFlights())}catch(e){return json(res,503,{error:'Unable to retrieve real aircraft positions',details:e.message})}
  }
  const p=path.resolve(publicDir,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(!p.startsWith(publicDir+path.sep))return json(res,403,{error:'Forbidden'});
  const file=await fs.readFile(p);res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'public, max-age=3600'});res.end(file);
 }catch{json(res,404,{error:'Not found'})}
}).listen(PORT,()=>console.log(`Tennyson Live: http://localhost:${PORT}`));
