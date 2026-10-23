import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const site=process.env.FINANZAS_PAGES_URL;
const api=process.env.FINANZAS_SUPABASE_URL;
const key=process.env.FINANZAS_SUPABASE_PUBLISHABLE_KEY;
assert(site?.startsWith('https://'),'Missing GitHub Pages deployment URL');
assert.equal(api,'https://kkuihohwneefcctohcrs.supabase.co','Wrong Supabase URL');
assert(key?.startsWith('sb_publishable_'),'Missing Supabase publishable key');
const url=new URL(site);
assert.equal(url.host,'zatzuro.github.io');
assert.equal(url.pathname,'/zatzuro-ZT-IF-N-95/');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(target,options={},attempts=1){
 let last;
 for(let i=0;i<attempts;i++){
  try{
   const r=await fetch(target,{...options,redirect:'follow',signal:AbortSignal.timeout(15000)});
   if(r.ok || i===attempts-1 || ![404,429,500,502,503,504].includes(r.status))return r;
   last=new Error('HTTP '+r.status);
  }catch(e){last=e;if(i===attempts-1)throw e;}
  await sleep(2000);
 }
 throw last;
}
const htmlRes=await request(url.toString(),{},10);
assert.equal(htmlRes.status,200,'Production HTML unavailable');
const html=await htmlRes.text();
assert.match(html,/<div\s+id=["']root["']/, 'React mount not found');
const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+\.js)["']/g)].map(m=>m[1]);
const styles=[...html.matchAll(/<link\b[^>]*href=["']([^"']+\.css)["']/g)].map(m=>m[1]);
assert(scripts.length>0&&styles.length>0,'Missing production asset references');
for(const path of [...scripts,...styles]){
 const asset=new URL(path,url);
 assert.equal(asset.origin,url.origin,'Unexpected asset host');
 assert(asset.pathname.startsWith(url.pathname),'Asset escaped Pages project root');
 const response=await request(asset.toString());
 assert.equal(response.status,200,'Live asset unavailable');
}
console.log('PASS live HTTP: HTML, production JS and CSS.');
const anonymous=await request(new URL('/rest/v1/financial_source_observations?select=id&limit=1',api).toString(),{headers:{apikey:key,Accept:'application/json'}});
if(anonymous.status===200){
 const rows=await anonymous.json();
 assert(Array.isArray(rows) && rows.length===0,'P0: financial data visible to anonymous visitor');
}else assert([401,403].includes(anonymous.status),'Unexpected anonymous API response '+anonymous.status);
console.log('PASS live privacy: anonymous cannot read financial observations.');
const browser=['google-chrome','google-chrome-stable','chromium-browser','chromium'].find(bin=>{
 const r=spawnSync(bin,['--version'],{encoding:'utf8',timeout:5000});
 return !r.error && r.status===0;
});
assert(browser,'Chrome is not installed in GitHub runner');
const out=spawnSync(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions','--virtual-time-budget=10000','--dump-dom',url.toString()],{encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
assert.equal(out.status,0,'Headless browser did not load the page');
const dom=out.stdout||'';
assert(dom.includes('Ingresar al dashboard'),'Login form failed to render');
assert(dom.includes('Correo electrónico') && dom.includes('Contraseña'),'Login inputs missing');
assert(!dom.includes('Configuración pública de Supabase pendiente'),'Production Supabase settings missing');
assert(!dom.includes('class="fs-app"'),'Private dashboard rendered anonymously');
console.log('PASS live browser: anonymous visitor sees only a login gate.');
console.log('Authenticated owner login not tested: credentials are private.');
