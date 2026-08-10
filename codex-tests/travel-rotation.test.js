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

  // picker shows which of the four rotations is live
  const src=require('fs').readFileSync(global.__APPFILE,'utf8');
  ok('picker names the active rotation (A-D) and the monthly refresh', /String\.fromCharCode\(65\+fgMonthIdx\(3\)\)/.test(src) && /refresh on the 1st/.test(src));
};
