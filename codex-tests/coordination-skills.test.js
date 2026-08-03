/* Forge⇄Alchemy coordination + skill trees */
module.exports = async function(C){
  // ---- day context classification ----
  C.s=baseState();
  let dc=C.trainingDayContext();
  ok('fresh state → fuels FOR the planned session (planned flag set)', (dc.id==='train'||dc.id==='heavy') && dc.planned===true);
  ok('rest modifiers exist and cut cal/carbs below train/heavy', C.F_DAY_MACROS.rest.cal<C.F_DAY_MACROS.train.cal && C.F_DAY_MACROS.rest.c<C.F_DAY_MACROS.train.c && C.F_DAY_MACROS.heavy.c>C.F_DAY_MACROS.train.c);
  const f=C.fgState();
  f.active={type:'Leg B',kind:'lift',blocks:[]};
  dc=C.trainingDayContext();
  ok('active Leg B (186 energy) → HEAVY day, in progress', dc.id==='heavy' && /in progress/.test(dc.label));
  f.active=null;
  f.sessions.push({id:'s1',date:C.today(),type:'Pull A',kind:'lift'});
  dc=C.trainingDayContext();
  ok('completed Pull A (141) → training day (not heavy)', dc.id==='train' && dc.done===true);
  f.sessions.push({id:'s2',date:C.today(),type:'Leg A',kind:'lift'});
  ok('two lifts in a day sum to heavy', C.trainingDayContext().id==='heavy');

  // ---- targets modulate; protein NEVER moves ----
  C.s=baseState();
  const base=C.fuelTargetsEff();          // rest or planned depending on dots; force rest by keeping no sessions
  const restDc=C.trainingDayContext();
  C.fgState().sessions.push({id:'s3',date:C.today(),type:'Leg B',kind:'lift'});
  const heavy=C.fuelTargetsEff();
  ok('heavy-day targets ≥ planned-day targets (equal only if plan was already heavy)', heavy.cal>=base.cal && heavy.c>=base.c);
  ok('PROTEIN FLOOR: protein identical across day types', heavy.p===base.p);
  ok('fibre untouched by day type', heavy.fib===base.fib);
  // exact math: heavy = base_targets*focus*1.08 cal
  const raw=C.fuelTargets(); const focus=C.F_FOCUS_MACROS[C.forgeFocus()]||C.F_FOCUS_MACROS.Strength;
  ok('heavy cal = base×focus×1.08 exactly', heavy.cal===Math.round(raw.cal*focus.cal*1.08));

  // ---- dashboard chip renders the day type ----
  C.renderFuelDash();
  ok('fuel dash shows the day chip (⚡ Heavy … +15% carbs)', /fuel-daychip heavy/.test((global.__els['fuelDash']||{}).innerHTML) && /\+15% carbs/.test((global.__els['fuelDash']||{}).innerHTML));

  // ---- coach receives training context ----
  const appSrc=require('fs').readFileSync(global.__APPFILE,'utf8');
  ok('coach prompts + menu scan carry TRAINING TODAY', (appSrc.match(/TRAINING TODAY: \$\{JSON\.stringify\(ctx\.training/g)||[]).length===3);
  ok('coach + menu ctx builders pass trainingDayContext()', (appSrc.match(/training:trainingDayContext\(\)/g)||[]).length===3);

  // ---- picker fuel note: unsealed yesterday with entries ----
  C.s=baseState();
  const al=C.fuelState(); const y=C.dayShift(C.today(),-1);
  al.days=al.days||{}; al.days[y]=[{name:'eggs',cal:300,p:20,c:2,f:20,fib:0}];
  C.renderForgePicker();
  ok('picker warns when yesterday logged food but never sealed', /unsealed/.test((global.__els['forge-picker']||{}).innerHTML));
  al.history[y]=true; C.renderForgePicker();
  ok('sealed yesterday → no warning', !/unsealed/.test((global.__els['forge-picker']||{}).innerHTML));

  // ---- skill trees ----
  C.s=baseState();
  C.renderSkillTrees();
  let sk=(global.__els['skillTrees']||{}).innerHTML||'';
  ok('5 capability lines render with stage dots', (sk.match(/sk-tree/g)||[]).length===5 && /sk-dot cur/.test(sk));
  ok('empty log → every line at stage 0 with Next criteria', !/sk-dot done/.test(sk) && /Next: <b>Pike Pushups · 3×8/.test(sk));
  // log a session that meets Pull-Up 3×5 but NOT 3×8
  const fg=C.fgState(); const sid='sim1';
  [5,5,6].forEach((r,i)=>fg.log.push({id:'l'+i,sessionId:sid,date:C.today(),type:'Pull A',exercise:'Pull-Up',setIdx:i+1,weight:'',reps:r,bw:true}));
  ok('Pull-Up 3×5 met → stage 1 earned', C.skillTreeState(C.SKILL_TREES.find(t=>t.id==='pull'))===1);
  // 2 good sets + 1 short set must NOT earn 3×8
  [8,8,6].forEach((r,i)=>fg.log.push({id:'m'+i,sessionId:'sim2',date:C.today(),type:'Pull A',exercise:'Pull-Up',setIdx:i+1,weight:'',reps:r,bw:true}));
  ok('2 of 3 sets at target does NOT earn the stage (no partial credit)', C.skillTreeState(C.SKILL_TREES.find(t=>t.id==='pull'))===1);
  // sets split across sessions must NOT combine
  fg.log.push({id:'x1',sessionId:'a',date:C.today(),exercise:'Skater Squat',setIdx:1,reps:8});
  fg.log.push({id:'x2',sessionId:'b',date:C.today(),exercise:'Skater Squat',setIdx:1,reps:8});
  fg.log.push({id:'x3',sessionId:'c',date:C.today(),exercise:'Skater Squat',setIdx:1,reps:8});
  ok('sets across different sessions do not combine', C.skillStageMet({ex:'Skater Squat',reps:8,sets:3})===false);
  // weighted criterion: bodyweight pull-ups never satisfy Weighted Pull-Up
  [5,5,5].forEach((r,i)=>fg.log.push({id:'w'+i,sessionId:'sim3',date:C.today(),exercise:'Pull-Up',setIdx:i+1,weight:'',reps:r}));
  ok('bodyweight sets cannot earn the WEIGHTED stage', C.skillStageMet({ex:'Pull-Up',reps:5,sets:3,weighted:true})===false);
  [5,5,5].forEach((r,i)=>fg.log.push({id:'v'+i,sessionId:'sim4',date:C.today(),exercise:'Pull-Up',setIdx:i+1,weight:25,reps:r}));
  ok('weighted sets earn it', C.skillStageMet({ex:'Pull-Up',reps:5,sets:3,weighted:true})===true);
  C.renderSkillTrees(); sk=(global.__els['skillTrees']||{}).innerHTML;
  ok('earned stages show as done dots + best-so-far chip', /sk-dot done/.test(sk) && /best so far: 8/.test(sk));
  // every tree stage references a real loggable movement with valid numbers
  ok('all stages structurally valid', C.SKILL_TREES.every(t=>t.stages.every(st=>st.ex&&st.reps>0&&st.sets>0)));
};
