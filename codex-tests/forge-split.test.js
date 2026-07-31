/* 6-day energy split + family picker + breathing bloom + wish concierge */
module.exports = async function(C){
  const appSrc=require('fs').readFileSync(global.__APPFILE,'utf8');

  // ---- program shape ----
  const days=Object.keys(C.F_LIFT_DAYS);
  ok('6 lift days: Leg/Push/Pull × A/B', days.length===6 && ['Leg A','Leg B','Push A','Push B','Pull A','Pull B'].every(k=>days.includes(k)));
  let maxEx=0, badEnergy=[], missingInfo=[], blockEnergies=[];
  days.forEach(d=>C.F_LIFT_DAYS[d].blocks.forEach(b=>{
    maxEx=Math.max(maxEx,b.exercises.length);
    const be=b.exercises.reduce((x,e)=>x+(e.e||0),0); blockEnergies.push(be);
    b.exercises.forEach(e=>{ if(!(e.e>0)) badEnergy.push(e.ex); if(!C.EX_INFO[e.ex]) missingInfo.push(e.ex); });
  }));
  ok('HARD CAP: no block exceeds 3 exercises', maxEx<=3);
  ok('every exercise carries an energy value', badEnergy.length===0);
  ok('every block within the tank (40–100)', blockEnergies.every(be=>be>=40&&be<=100));
  ok('the fixed Leg B B1 lands at 86 (was a 110 overload)', C.F_LIFT_DAYS['Leg B'].blocks[0].exercises.reduce((x,e)=>x+e.e,0)===86);
  ok('Barbell Glute Bridge dropped from Leg B (confirmed cut)', !JSON.stringify(C.F_LIFT_DAYS['Leg B']).includes('Barbell Glute Bridge'));
  ok('every programmed exercise has an ⓘ how-to (incl. 12 new)', missingInfo.length===0);
  ok('readiness weights cover all 6 day names', /"Push B": 1\.0, "Pull A": 1\.0/.test(appSrc));

  // ---- variant cycling + picker ----
  C.s=baseState(); const f=C.fgState();
  ok('no history → family defaults to A', C.fgNextVariant('Leg')==='A' && C.fgNextVariant('Push')==='A');
  f.sessions.push({id:'s1',date:C.today(),type:'Leg A',kind:'lift'});
  ok('last Leg A → Leg defaults to B (auto-cycle)', C.fgNextVariant('Leg')==='B');
  f.sessions.push({id:'s2',date:C.today(),type:'Leg B',kind:'lift'});
  ok('last Leg B → cycles back to A', C.fgNextVariant('Leg')==='A');
  ok('old un-suffixed history ("Push") does not confuse the cycle', (f.sessions.push({id:'s3',date:C.today(),type:'Push'}), C.fgNextVariant('Push')==='A'));
  C.renderForgePicker(); const pk=(global.__els['forge-picker']||{}).innerHTML||'';
  ok('picker shows 3 lift families (not 6 cards)', (pk.match(/fg-ab/g)||[]).length===3);
  ok('family card starts the selected variant', /data-fgstart="Leg A"/.test(pk) && !/data-fgstart="Leg B"/.test(pk));
  ok('A/B toggle present with active variant marked', /data-fgvariant="Leg"/.test(pk) && /class="on">A</.test(pk));
  C.forgeOnClick(tgt('[data-fgvariant]',{fgvariant:'Leg'}));
  ok('tapping the toggle flips Leg to B', C.fgNextVariant('Leg')==='B');
  ok('non-lift cards unchanged (Circuit/Cardio/Sport/Recovery)', ['Circuit','Cardio','Sport','Recovery'].every(k=>new RegExp('data-fgstart="'+k+'"').test((global.__els['forge-picker']||{}).innerHTML)));

  // ---- session: energy chip + travel fallback + migration ----
  C.s=baseState();
  await C.forgeStart('Push B');
  ok('Push B session builds (new day live)', C.fgState().active.type==='Push B' && C.fgState().active.blocks.length===3);
  ok('energy carried onto session exercises', C.fgState().active.blocks[0].exercises.every(e=>e.e>0));
  C.renderForgeSession();
  ok('block label shows ⚡ energy total', /⚡ 72/.test((global.__els['forge-session']||{}).innerHTML));
  C.s=baseState(); C.fgState().travel=true;
  await C.forgeStart('Push A');
  ok('travel mode maps "Push A" → travel "Push" day', C.fgState().active && C.fgState().active.blocks.length>0);
  C.s=baseState(); C.fgState().active={type:'Push',kind:'lift',blocks:[]};
  C.migrateState();
  ok('migration renames an old active "Push" → "Push A"', C.fgState().active.type==='Push A');

  // ---- breathing bloom ----
  ok('petals carry the breathe class with staggered delays', /class="vpetal" style="animation-delay:/.test(appSrc));
  ok('breathe animation defined + reduced-motion respected', /@keyframes vbreathe/.test(appSrc) && /prefers-reduced-motion/.test(appSrc));

  // ---- wish concierge ----
  C.s=baseState();
  global.__TOAST=''; global.__els['wishInput']=global.__els['wishInput']||null;
  const wi=global.__els['wishInput']|| (global.__els['wishInput']=Object.assign({},{value:''}));
  // offline: fetch undefined → guard
  global.fetch=undefined;
  (global.__els['wishInput']).value='a spa day with the wife';
  await C.onWish();
  ok('offline wish declines with manual pricing guidance', /AI unavailable/.test(global.__TOAST||'') && /3–5/.test(global.__TOAST||''));
  // online: mock the AI
  global.fetch=async()=>({ ok:true, status:200, headers:{get:()=>'application/json'},
    json:async()=>({content:[{type:'text',text:JSON.stringify({name:'Spa day with Jo',virtue:'compassion',cost:12,why:'Shared rest that tends the two of you.'})}]}) });
  await C.onWish();
  const wm=(global.__els['wishMount']||{}).innerHTML||'';
  ok('wish weighed: card shows name + virtue + cost', /Spa day with Jo/.test(wm) && /Compassion/.test(wm) && /12/.test(wm));
  const acc=global.__els['wishAccept'];
  ok('accept handler attached', acc && typeof acc.onclick==='function');
  acc.onclick();
  const d=C.s.shop.desires[C.s.shop.desires.length-1];
  ok('accept adds the desire with virtue + cost', d && d.name==='Spa day with Jo' && d.cost===12 && d.virtue==='compassion');
  // malformed AI response → graceful decline
  global.fetch=async()=>({ ok:true,status:200,headers:{get:()=>'application/json'},json:async()=>({content:[{type:'text',text:'not json'}]}) });
  global.__TOAST=''; (global.__els['wishInput']).value='another wish';
  await C.onWish();
  ok('malformed AI reply declines gracefully', /Couldn/.test(global.__TOAST||''));
  global.fetch=undefined;
};
