#!/usr/bin/env node
/* EECOH Codex — durable test harness.
   Usage: node codex-harness.js [suite.js ...]   (no args = run all codex-tests/*.test.js)
   Extracts the last <script> from eecoh-rpg-habit-tracker.html, boots it against a
   DOM stub, and exposes internals on global.C for suites. Lives in outputs/ so it
   survives /tmp wipes. */
'use strict';
const fs=require('fs'), path=require('path');
const ROOT=__dirname;
const __APPFILE=fs.existsSync(path.join(ROOT,'index.html'))?path.join(ROOT,'index.html'):path.join(ROOT,'eecoh-rpg-habit-tracker.html');
global.__APPFILE=__APPFILE;
const APP=__APPFILE;

/* ---------- DOM / env stubs ---------- */
function mkEl(){ const cs=new Set(); const o={
  value:'',_h:'',textContent:'',className:'',disabled:false,style:{},dataset:{},files:[],
  classList:{add:c=>cs.add(c),remove:c=>cs.delete(c),toggle:c=>cs.has(c)?cs.delete(c):cs.add(c),contains:c=>cs.has(c)},
  addEventListener(){},removeEventListener(){},focus(){},click(){},appendChild(){},removeChild(){},parentNode:null,
  querySelector(){return mkEl()},querySelectorAll(){return[]},closest(){return null},
  getBoundingClientRect(){return{width:390,height:60,left:0,top:0}},scrollTop:0,scrollHeight:999};
  Object.defineProperty(o,'innerHTML',{get(){return o._h},set(v){o._h=v}}); return o; }
const els={};
global.__els=els;
global.document={ getElementById:id=>els[id]||(els[id]=mkEl()), querySelector:()=>mkEl(), querySelectorAll:()=>[],
  addEventListener(){}, documentElement:mkEl(), createElement:()=>mkEl(), body:mkEl() };
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.window={};                       // AudioContext absent by default; suites may add
let NOW=1_000_000; global.__setNow=t=>{NOW=t}; global.__addNow=d=>{NOW+=d};
Date.now=()=>NOW;
global.setInterval=()=>1; global.clearInterval=()=>{};
global.setTimeout=(fn)=>{ if(typeof fn==='function') fn(); return 0; };
global.fetch=undefined;                 // suites mock as needed

/* ---------- boot ---------- */
const html=fs.readFileSync(APP,'utf8');
const m=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if(!m.length){ console.error('No <script> found in app'); process.exit(2); }
let src=m[m.length-1][1];
src+="\n;commit=function(){ try{ typeof recordDailyMetrics==='function'&&recordDailyMetrics(); }catch(e){} };";
src+="\n;try{ Store.save=function(st){ try{ if(st&&typeof st==='object'){ st._rev=(st._rev||0)+1; st._savedAt=Date.now(); } }catch(e){} global.__SAVED=st; try{ Cloud.push(); }catch(e){} }; }catch(e){}";
src+="\n;try{ toast=function(a,b){ global.__TOAST=String(a)+' | '+String(b); }; }catch(e){}";
src+="\n;try{ uiConfirm=function(){ return Promise.resolve(global.__CONFIRM!==false); }; }catch(e){}";
src+="\n;try{ uiPrompt=function(){ return Promise.resolve(global.__PROMPT||null); }; }catch(e){}";
// expose broadly: every top-level function declaration + known state accessors
const fnNames=[...src.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)/gm)].map(x=>x[1]);
const constNames=[...src.matchAll(/^const ([A-Z][A-Z0-9_]+)\s*=/gm)].map(x=>x[1]);
const expose=[...new Set([...fnNames,...constNames,'Cloud','Store'])].filter(n=>!/^_/.test(n));
src+="\n;global.C={ get s(){return state}, set s(v){state=v}, get fgTimer(){return typeof fgTimer!=='undefined'?fgTimer:undefined}, set fgTimer(v){fgTimer=v}, get fuelPending(){return typeof fuelPending!=='undefined'?fuelPending:undefined}, set fuelPending(v){fuelPending=v}, "
  + expose.map(n=>`get ${n}(){ try{return ${n}}catch(e){return undefined} }`).join(',') + " };";
try{ eval(src); }catch(e){ console.error('BOOT THREW:', e.message); process.exit(2); }

/* ---------- suite runner ---------- */
/* Pin baseState's clock (via clockOffset, which today() honors) to the first
   20 days of an EVEN month → monthly exercise rotation is deterministically
   Rotation A for every suite, regardless of when the harness runs. Suites
   advancing the clock a few days stay inside the pinned month. */
const ROT_PIN=(function(){ const now=new Date(); now.setHours(12,0,0,0);
  for(let off=0;off<70;off++){ const d=new Date(now); d.setDate(d.getDate()+off);
    if(((d.getFullYear()*12+d.getMonth())%2===0) && d.getDate()<=20) return off; }
  return 0; })();
global.baseState=function(){ const tr=global.C.trainingSeed();
  return {player:{name:'T',createdAt:'2026-06-01'},totalXp:0,stats:{body:0,energy:0,mind:0,craft:0,bond:0},tokens:0,wards:0,
    habits:[],log:[],shop:{desires:[],customOfferings:[],redeemed:[],goal:null},quests:[],
    fortune:{mode:'off',actions:0,crits:0,boons:0,vouchers:[],ledger:[]},training:tr,clockOffset:ROT_PIN,version:1}; };
global.tgt=function(sel,ds){ return {target:{closest:q=>q===sel?{dataset:ds||{}}:null}}; };
let PASS=0,FAIL=0; const fails=[];
global.ok=function(name,cond){ if(cond){PASS++;} else {FAIL++; fails.push(name);} };
global.section=function(){};

(async()=>{
  await new Promise(r=>setImmediate(r)); await new Promise(r=>setImmediate(r));
  const args=process.argv.slice(2);
  const dir=path.join(ROOT,'codex-tests');
  const suites=args.length?args:(fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith('.test.js')).map(f=>path.join(dir,f)):[]);
  if(!suites.length){ console.log('No suites found (codex-tests/*.test.js)'); process.exit(0); }
  for(const su of suites){
    const before=FAIL;
    try{ await require(path.resolve(su))(global.C); }
    catch(e){ FAIL++; fails.push(path.basename(su)+' THREW: '+e.message); }
    console.log((FAIL>before?'✗':'✓')+' '+path.basename(su));
  }
  console.log('\n'+PASS+' passed, '+FAIL+' failed');
  if(fails.length){ console.log(fails.map(f=>'  FAIL: '+f).join('\n')); process.exit(1); }
})();
