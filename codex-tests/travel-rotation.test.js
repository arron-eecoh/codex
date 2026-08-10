/* Travel split integrity + monthly exercise rotation.
   Travel rule: strictly bodyweight + bands you stand on or hold — nothing that
   needs a pull-up bar, anchor point, doorway, or fastening to anything. */
module.exports = async function(C){
  const T=C.F_TRAVEL_DAYS, L=C.F_LIFT_DAYS, ALTS=C.F_EX_ALTS;
  const names=d=>d.blocks.flatMap(b=>b.exercises.map(e=>e.ex));

  // ---- six distinct travel days; A and B genuinely differ ----
  ok('travel split has all six days', ['Leg A','Leg B','Push A','Push B','Pull A','Pull B'].every(k=>T[k]));
  ok('travel Pull A and Pull B are different sessions', JSON.stringify(names(T['Pull A']))!==JSON.stringify(names(T['Pull B'])));
  ok('travel Push A and Push B are different sessions', JSON.stringify(names(T['Push A']))!==JSON.stringify(names(T['Push B'])));
  ok('travel Leg A and Leg B are different sessions', JSON.stringify(names(T['Leg A']))!==JSON.stringify(names(T['Leg B'])));

  // ---- travel-mode equipment ban: no anchors, bars, or fastening ----
  const BAN=/anchor|pull[- ]?up|chin[- ]?up|\bhang\b|doorway|door\b|attach|fasten|overhead point|secure (?:the )?band|\bbar\b|bench|trap bar|\bdb\b|dumbbell|kettlebell|\bkb\b|plate/i;
  let banHits=[];
  Object.keys(T).forEach(k=>T[k].blocks.forEach(b=>b.exercises.forEach(e=>{
    if(BAN.test(e.ex)||BAN.test(e.note||'')) banHits.push(k+': '+e.ex);
    if(!e.bw) banHits.push(k+': '+e.ex+' (not bw)');
    const pool=ALTS[e.ex]||[];
    pool.forEach(a=>{ if(BAN.test(a.ex)||BAN.test(a.note||'')) banHits.push(k+' alt: '+a.ex); });
  })));
  ok('every travel exercise AND its rotation alternate is bodyweight/self-held band'+(banHits.length?' — VIOLATIONS: '+banHits.join('; '):''), banHits.length===0);

  // ---- four rotations: every pool offers 3 alternates (A + B/C/D) ----
  const shortPools=Object.keys(ALTS).filter(k=>ALTS[k].length!==3);
  ok('every rotation pool has exactly 3 alternates'+(shortPools.length?' — SHORT: '+shortPools.join(', '):''), shortPools.length===0);

  // ---- rotation alternates never collide within a day, in ANY of the 4 rotations ----
  let dupes=[];
  const scan=(days,label)=>Object.keys(days).forEach(k=>{
    for(let r=0;r<4;r++){
      const rot=days[k].blocks.flatMap(b=>b.exercises.map(e=>{ const p=ALTS[e.ex]; return (r&&p&&p[r-1])?p[r-1].ex:e.ex; }));
      if(new Set(rot).size!==rot.length) dupes.push(label+' '+k+' rot'+String.fromCharCode(65+r));
    }
  });
  scan(T,'travel'); scan(L,'lift');
  ok('no duplicate exercises inside any day across rotations A-D'+(dupes.length?' — DUPES: '+dupes.join('; '):''), dupes.length===0);

  // ---- monthly rotation is deterministic from today()'s month ----
  // today() = real clock + state.clockOffset (days), so drive parity via clockOffset.
  C.s=baseState(); global.__CONFIRM=true;
  const goblet={ex:'Goblet Squat',sets:3,target:'6-8',unit:'reps',note:'x',e:38};
  const base=C.s.clockOffset||0;                    // harness pin (Rotation A month)
  const dayOfMonth=+C.today().slice(8,10);
  const flipOff=base+(33-dayOfMonth);               // always lands inside the following month
  const p0=C.fgMonthIdx(3);
  ok('harness pin lands in a Rotation A month', p0===0);
  C.s.clockOffset=flipOff;
  const p1=C.fgMonthIdx(3);
  ok('the following month advances to Rotation B', p1===1);
  const offA=base, offB=flipOff;                    // offA → Rotation A, offB → Rotation B

  C.s.clockOffset=offA;
  ok('Rotation A month serves the original exercise', C.fgMonthEx(goblet).ex==='Goblet Squat');
  C.s.clockOffset=offB;
  const rot=C.fgMonthEx(goblet);
  ok('Rotation B month serves the alternate, keeping sets + energy', rot.ex==='Heels Elevated Goblet Squat' && rot.sets===3 && rot.e===38);
  ok('exercise without a pool passes through untouched', C.fgMonthEx({ex:'Made Up Move',sets:3,target:'5',unit:'reps'}).ex==='Made Up Move');

  // rotation flows into a real session build
  C.s=baseState(); C.s.clockOffset=offB;
  await C.forgeStart('Leg A');
  const exNames=C.fgState().active.blocks.flatMap(b=>b.exercises.map(e=>e.ex));
  ok('Rotation B session builds with alternate exercises', exNames.indexOf('Heels Elevated Goblet Squat')>=0 && exNames.indexOf('Goblet Squat')<0);
  C.forgeCancel();
  C.s=baseState(); C.s.clockOffset=offA;
  await C.forgeStart('Leg A');
  const exNames2=C.fgState().active.blocks.flatMap(b=>b.exercises.map(e=>e.ex));
  ok('Rotation A session builds with the originals', exNames2.indexOf('Goblet Squat')>=0);
  C.forgeCancel();
  C.s=baseState();

  // ---- earned progression: advanced alternates gate on demonstrated strength ----
  const GATES=C.F_EX_GATES;
  ok('every gated exercise is a rotation alternate (no dead gates)',
    Object.keys(GATES).every(k=>Object.values(ALTS).some(p=>p.some(a=>a.ex===k))));
  ok('every gate prerequisite is a real exercise with a how-to',
    Object.keys(GATES).every(k=>C.EX_INFO[GATES[k].ex] && GATES[k].reps>0 && GATES[k].times>0));

  // an alternate must never equal ANOTHER slot's base in the same day —
  // otherwise a locked slot (serving its base) could duplicate an unlocked one
  let cross=[];
  const scanX=(days,label)=>Object.keys(days).forEach(k=>{ const base=names(days[k]);
    days[k].blocks.forEach(b=>b.exercises.forEach(e=>{ (ALTS[e.ex]||[]).forEach(a=>{
      if(base.indexOf(a.ex)>=0) cross.push(label+' '+k+': '+a.ex); }); })); });
  scanX(T,'travel'); scanX(L,'lift');
  ok('no alternate shadows another slot\'s base exercise in the same day'+(cross.length?' — CLASH: '+cross.join('; '):''), cross.length===0);

  // locked without history → familiar base + 🔒 note (Shrimp Squat is Skater's Rotation-B alt)
  C.s=baseState(); C.s.clockOffset=offB;
  const skater={ex:'Skater Squat',sets:3,target:'5-8/side',unit:'reps',note:'CAL skill',bw:true,e:30};
  const locked=C.fgMonthEx(skater);
  ok('advanced alternate stays locked without history — base served with 🔒 note',
    locked.ex==='Skater Squat' && /🔒 Shrimp Squat/.test(locked.note));

  // two solid sessions (all sets ≥6 reps, not maxed out) unlock it
  const fga=C.fgState();
  ['gs1','gs2'].forEach((sid,i)=>{
    fga.sessions.push({id:sid,date:'2026-0'+(i+1)+'-01',type:'Leg A',kind:'lift',rating:3,feelPhys:3,note:''});
    [6,7,6].forEach((r,si)=>fga.log.push({id:'g'+sid+si,sessionId:sid,date:'2026-0'+(i+1)+'-01',type:'Leg A',exercise:'Skater Squat',setIdx:si+1,weight:0,reps:r,bw:true,notes:''}));
  });
  ok('unlocks after demonstrated strength (2 solid sessions)', C.fgMonthEx(skater).ex==='Shrimp Squat');

  // sessions rated "maxed out" (feelPhys 5) do NOT count toward unlocking
  C.s=baseState(); C.s.clockOffset=offB;
  const fgb=C.fgState();
  ['gx1','gx2'].forEach((sid,i)=>{
    fgb.sessions.push({id:sid,date:'2026-0'+(i+1)+'-02',type:'Leg A',kind:'lift',rating:5,feelPhys:5,note:''});
    [8,8].forEach((r,si)=>fgb.log.push({id:'h'+sid+si,sessionId:sid,date:'2026-0'+(i+1)+'-02',type:'Leg A',exercise:'Skater Squat',setIdx:si+1,weight:0,reps:r,bw:true,notes:''}));
  });
  ok('maxed-out sessions do not count toward unlocking', C.fgMonthEx(skater).ex==='Skater Squat');
  C.s=baseState();

  // ---- HARDWIRED: every exercise, in every day and every rotation, ships a real ⓘ how-to ----
  // This is the permanent guarantee: add any exercise (base or alternate) without an
  // EX_INFO entry of substance and the build fails — no month or cycle can skip it.
  const allNames=new Set();
  [T,L].forEach(D=>Object.keys(D).forEach(k=>D[k].blocks.forEach(b=>b.exercises.forEach(e=>allNames.add(e.ex)))));
  Object.keys(ALTS).forEach(k=>ALTS[k].forEach(a=>allNames.add(a.ex)));
  const noInfo=[...allNames].filter(n=>!(C.EX_INFO[n]&&C.EX_INFO[n].length>=60));
  ok('every exercise in every rotation has a real how-to ('+allNames.size+' checked)'+(noInfo.length?' — MISSING: '+noInfo.slice(0,10).join(', ')+(noInfo.length>10?' …':''):''), noInfo.length===0);

  // picker shows which of the four rotations is live
  const src=require('fs').readFileSync(global.__APPFILE,'utf8');
  ok('picker names the active rotation (A-D) and the monthly refresh', /String\.fromCharCode\(65\+fgMonthIdx\(3\)\)/.test(src) && /refresh on the 1st/.test(src));
};
