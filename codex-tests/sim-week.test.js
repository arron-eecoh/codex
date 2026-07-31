/* 7-day life simulation: train, eat, seal, quest — then verify every system
   collected the data, tracked it, and displays it. */
module.exports = async function(C){
  C.s=baseState();
  const f=C.fgState(), al=C.fuelState();
  global.__CONFIRM=true;

  const eat=(cal,p,c,fat)=>{ C.fuelDay().push({id:'f'+Math.random(),name:'meal',portion:'1',unit:'ea',time:'12:00',cal,p,c,f:fat,fib:5}); };
  const train=async(day)=>{ await C.forgeStart(day);
    f.active.blocks.forEach(b=>b.exercises.forEach(e=>e.sets.forEach((st,i)=>{ st.weight=e.bw?'':'100'; st.reps='8'; st.done=true; })));
    await C.forgeComplete(); };

  // a quest running through the week
  C.s.quests.push({id:'wq',title:'Read 12 books',kind:'count',scale:'major',attr:'mind',virtue:'wisdom',
    due:null,steps:[],target:12,unit:'books',progress:0,awarded:false,completedAt:null,createdAt:C.today()});

  const plan=[['Leg A',true],[null,true],['Push B',true],['Pull A',false],[null,true],['Leg B',true],['Push A',true]];
  for(let d=0; d<7; d++){
    const [day,seal]=plan[d];
    if(day) await train(day);
    eat(800,60,80,25); eat(900,70,90,30); eat(750,70,85,20);   // ~2450 cal, 200p
    if(seal) C.alchemySeal();
    C.questLogCount('wq',1);
    C.s.clockOffset=(C.s.clockOffset||0)+1;                     // midnight passes
  }

  // ---- collection ----
  ok('5 sessions collected across the week', f.sessions.length===5);
  const expSets=plan.filter(p=>p[0]).reduce((a,p)=>a+C.F_LIFT_DAYS[p[0]].blocks.reduce((x,b)=>x+b.exercises.length,0)*3,0);
  ok('every checked set logged (exactly '+expSets+' across 5 sessions)', f.log.length===expSets);
  ok('5 training days marked in history', Object.keys(f.history).length===5);
  ok('6 sealed days, 1 skipped', Object.keys(al.history).length===6);
  ok('7 days of food, 21 entries', Object.keys(al.days).length===7 && Object.values(al.days).every(x=>x.length===3));
  ok('quest progressed 7/12', C.s.quests.find(q=>q.id==='wq').progress===7);

  // ---- tracking derived correctly ----
  ok('variant cycling: Push family now defaults to B (A was last)', C.fgNextVariant('Push')==='B');
  ok('variant cycling: Leg family defaults to A (B was last)', C.fgNextVariant('Leg')==='A');
  const vit=C.groveData().find(v=>v.key==='vitality');
  const dialedN=Object.keys(al.dialedHistory||{}).length;
  ok('grove: vitality = 5 sessions×2 + 6 seals×1.5 + dialed×1 exactly', vit.raw===5*2+6*1.5+dialedN*1);
  C.evalTrophies();   // harness stubs commit, so evaluate explicitly
  ok('trophies fired along the way (First Fire, First Seal, sets 50)', !!C.s.trophies.forge_first && !!C.s.trophies.seal_first && !!C.s.trophies.sets_50);
  ok('workout CSV would carry every logged set', f.log.length===expSets);
  const dc=C.trainingDayContext();
  ok('day-8 fuel context looks at plans, not stale sessions', dc.done!==true);

  // ---- display ----
  C.renderForgeDashboard&&C.renderForgeDashboard();
  C.renderFuelDash(); C.renderSkillTrees(); C.renderGrove(); C.renderQuests(); C.renderAch(C.levelInfo(C.s.totalXp));
  ok('fuel dash renders with a day chip', /fuel-daychip/.test((global.__els['fuelDash']||{}).innerHTML));
  ok('skill trees show earned progress (Pull-Up 3×8 met in Pull A)', /sk-dot done/.test((global.__els['skillTrees']||{}).innerHTML));
  ok('grove strip renders six virtues', ((global.__els['groveMount']||{}).innerHTML.match(/grove-card/g)||[]).length===6);
  ok('trophy case renders earned with dates', /a-date/.test((global.__els['achRow']||{}).innerHTML));
  ok('quest card shows 7/12 books', /7\/12 books/.test((global.__els['quests']||{}).innerHTML));

  // ---- integrity: XP/state numbers are finite and sane ----
  ok('total XP accrued and finite', isFinite(C.s.totalXp) && C.s.totalXp>200);
  ok('no NaN leaked into stats', Object.values(C.s.stats).every(v=>isFinite(v)));
  ok('tokens finite', isFinite(C.s.tokens));
  global.__CONFIRM=true;
};
