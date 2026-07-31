/* Core regression: timers, set entry, failsafes, alchemy scaling, logging */
module.exports = async function(C){
  // ---- timers ----
  C.s=baseState(); const f=C.fgState();
  C.fgRestOpen();
  ok('rest opens paused @180 with 5/10 steps', C.fgTimer && !C.fgTimer.running && C.fgTimer.total===180 && C.fgTimer.steps[0]===5);
  C.fgTimerAdjust(-10); ok('paused adjust sets total=remaining (170)', C.fgTimer.total===170);
  C.fgTimerStart(); ok('start does NOT touch the break default (decoupled)', f.restSec===undefined);
  C.fgTimerSet(60); ok('preset while running restarts at 60 running', C.fgTimer.total===60 && C.fgTimer.running);
  C.forgeOnClick(tgt('[data-fgtimermax]'));   // expand from the default-collapsed strip
  const bar=C.fgTimerBarHTML();
  ok('expanded bar has presets 30..180', /data-fgpreset="30"/.test(bar) && /data-fgpreset="180"/.test(bar));
  C.forgeOnClick(tgt('[data-fgtimermin]'));   // back to collapsed for later assertions
  C.fgTimerClose();
  // hold: per-exercise memory, pop paused
  f.active={type:Object.keys(C.F_LIFT_DAYS)[0],kind:'lift',blocks:[{name:'B',exercises:[{ex:'Wall Sit',target:'30-45s',unit:'sec',sets:[{done:false}]}]}]};
  C.fgHoldOpen(0,0); ok('hold pops paused @45 (parsed)', !C.fgTimer.running && C.fgTimer.total===45);
  C.fgTimerAdjust(-5); C.fgTimerStart();
  ok('hold start remembers per-exercise (holdSec=40)', f.active.blocks[0].exercises[0].holdSec===40);
  C.fgTimerClose(); C.fgHoldOpen(0,0); ok('hold reopens at remembered 40', C.fgTimer.total===40);
  C.fgTimerClose(); f.active=null;

  // ---- session flow: defaults, fill, check-all, failsafes, log-on-check ----
  C.s=baseState(); const f2=C.fgState(); const key=Object.keys(C.F_LIFT_DAYS)[0];
  await C.forgeStart(key);
  const ex=f2.active.blocks[0].exercises[0];
  ok('reps pre-filled from target', ex.sets.every(s=>s.reps===C.fgDefReps(ex.target)) && C.fgDefReps('6-8')==='6');
  ex.sets[0].weight='135'; ex.sets[0].reps='5';
  C.forgeOnClick(tgt('[data-fgfill]',{fgfill:'0:0'}));
  C.forgeOnClick(tgt('[data-fgcheckall]',{fgcheckall:'0:0'}));
  ok('check-all marks all done', ex.sets.every(s=>s.done));
  ok('check-all did not start the timer', !C.fgTimer || !C.fgTimer.running);
  // back preserves
  C.forgeOnClick(tgt('#fgBack'));
  ok('back preserves session', f2.screen==='picker' && !!f2.active);
  // switch guard: decline keeps
  global.__CONFIRM=false;
  const other=Object.keys(C.F_LIFT_DAYS).find(k=>k!==key);
  await C.forgeStart(other);
  ok('declined switch keeps in-progress', f2.active.type===key);
  global.__CONFIRM=true;
  // complete: logs only checked, toast reports count
  f2.screen='session'; const before=f2.log.length;
  await C.forgeComplete();
  const added=f2.log.length-before;
  ok('complete logs exactly the checked sets', added===ex.sets.length);
  ok('toast reports logged count', new RegExp('Logged '+added+' set').test(global.__TOAST||''));
  ok('empty-complete guard exists', /fgCheckedCount\(a\)/.test(String(C.forgeComplete)));

  // ---- alchemy: deterministic scaling + normalizer ----
  C.s=baseState();
  const N=C.fuelNormPortion;
  ok('norm "5 whole"+"eggs" -> 5 / whole eggs', N('5 whole','eggs').portion==='5' && N('5 whole','eggs').unit==='whole eggs');
  ok('norm "1/2"+"ea" -> 0.5', N('1/2','ea').portion==='0.5');
  C.fuelState().cache.unshift({name:'Pork lard',portion:'1.5',unit:'tbsp',cal:180,p:0,c:0,f:20,fib:0,sat:8});
  C.fuelQuickAdd(0); C.renderReview();
  const it=C.fuelPending.items[0];
  it.portion='1'; C.fuelScaleItem(it);
  ok('1.5→1 tbsp = 120 cal (deterministic)', it.cal===120);
  it.portion='1.5'; C.fuelScaleItem(it);
  ok('round-trip returns exactly 180', it.cal===180 && it.f===20);
  it.cal=210; C.fuelRebase(it); it.portion='1'; C.fuelScaleItem(it);
  ok('manual correction re-baselines (210@1.5 → 140@1)', it.cal===140);

  // ---- coach thread containment ----
  C.s=baseState();
  // set chat via C if exposed; render and check capping structure exists in markup
  const cc=String(C.renderCoach);
  ok('coach thread capped container present in renderer', /fuel-coach-thread/.test(cc) && /fuelCoachClear/.test(cc));
};
