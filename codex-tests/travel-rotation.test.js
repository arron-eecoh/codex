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

  // ---- rotation alternates never collide within a day (base set and alt set both unique) ----
  let dupes=[];
  const scan=(days,label)=>Object.keys(days).forEach(k=>{
    const base=names(days[k]);
    const rot=days[k].blocks.flatMap(b=>b.exercises.map(e=>{ const p=ALTS[e.ex]; return p&&p.length?p[0].ex:e.ex; }));
    if(new Set(base).size!==base.length) dupes.push(label+' '+k+' base');
    if(new Set(rot).size!==rot.length) dupes.push(label+' '+k+' rotB');
  });
  scan(T,'travel'); scan(L,'lift');
  ok('no duplicate exercises inside any day in either rotation'+(dupes.length?' — DUPES: '+dupes.join('; '):''), dupes.length===0);

  // ---- monthly rotation is deterministic from today()'s month ----
  // today() = real clock + state.clockOffset (days), so drive parity via clockOffset.
  C.s=baseState(); global.__CONFIRM=true;
  const goblet={ex:'Goblet Squat',sets:3,target:'6-8',unit:'reps',note:'x',e:38};
  const base=C.s.clockOffset||0;                    // harness pin (Rotation A month)
  const dayOfMonth=+C.today().slice(8,10);
  const flipOff=base+(33-dayOfMonth);               // always lands inside the following month
  const p0=C.fgMonthIdx(1);
  C.s.clockOffset=flipOff;
  const p1=C.fgMonthIdx(1);
  ok('consecutive months flip the rotation', p0!==p1);
  const offA=p0===0?base:flipOff, offB=p0===0?flipOff:base;   // offA → Rotation A, offB → Rotation B

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

  // picker shows which rotation is live
  const src=require('fs').readFileSync(global.__APPFILE,'utf8');
  ok('picker names the active rotation and the monthly refresh', /Rotation '\+\(fgMonthIdx\(1\)\?'B':'A'\)/.test(src) && /refresh on the 1st/.test(src));
};
