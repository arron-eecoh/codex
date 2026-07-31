/* Quest engine v2: 4 kinds, progress, awards, pace, migration */
module.exports = async function(C){
  const D=id=>global.__els[id]||(global.__els[id]=null);

  // ---- migration: legacy quest gets kind=checklist and still works ----
  C.s=baseState();
  C.s.quests.push({id:'old1',title:'Legacy',track:'personal',scale:'standard',attr:null,due:null,
    steps:[{t:'a',done:true,diff:'standard',awarded:true},{t:'b',done:false,diff:'standard',awarded:false}],
    awarded:false,completedAt:null,createdAt:'2026-06-01'});
  C.migrateState();
  ok('legacy quest migrated to kind=checklist', C.s.quests[0].kind==='checklist');
  let qp=C.questProgress(C.s.quests[0]);
  ok('legacy checklist progress 1/2 = 50%', qp.pct===50 && qp.label==='1/2' && !qp.done);

  // ---- COUNT ----
  C.s=baseState();
  const cq={id:'c1',title:'Read 12 books',track:'personal',kind:'count',scale:'major',attr:'mind',
    due:null,steps:[],target:12,unit:'books',progress:0,awarded:false,completedAt:null,createdAt:C.today()};
  C.s.quests.push(cq);
  C.questLogCount('c1',1);
  ok('count +1 → 1/12, 8%', cq.progress===1 && C.questProgress(cq).pct===8);
  C.questLogCount('c1',10);
  ok('count custom +10 → 11/12, not done', cq.progress===11 && !C.questProgress(cq).done);
  const xpBefore=C.s.totalXp;
  C.questLogCount('c1',1);
  ok('reaching target completes + awards bounty once', cq.awarded===true && !!cq.completedAt && C.s.totalXp>xpBefore);
  const xpAfter=C.s.totalXp; C.questLogCount('c1',5);
  ok('overshoot does NOT re-award', C.s.totalXp===xpAfter && cq.awarded===true);
  ok('negative log clamps at 0 on a fresh quest', (()=>{ const q2={id:'c2',kind:'count',title:'x',target:5,progress:0,steps:[],createdAt:C.today()}; C.s.quests.push(q2); C.questLogCount('c2',-3); return q2.progress===0; })());

  // ---- TARGET (downward: 195 -> 185) ----
  C.s=baseState();
  const tq={id:'t1',title:'Cut to 185',kind:'target',track:'personal',scale:'standard',attr:'body',due:null,
    steps:[],tStart:195,tGoal:185,tCur:195,unit:'lb',checkins:[],awarded:false,completedAt:null,createdAt:C.today()};
  C.s.quests.push(tq);
  C.questCheckin('t1',190);
  ok('downward target: 190 → 50%', C.questProgress(tq).pct===50 && !C.questProgress(tq).done);
  C.questCheckin('t1',192);
  ok('regression is allowed and reflected (30%)', C.questProgress(tq).pct===30);
  ok('check-ins recorded with dates', tq.checkins.length===2 && tq.checkins[0].d===C.today());
  C.questCheckin('t1',184.5);
  ok('passing the goal completes (direction-aware)', tq.awarded===true);
  // upward target
  const uq={id:'t2',title:'PR',kind:'target',tStart:315,tGoal:405,tCur:315,steps:[],checkins:[],createdAt:C.today()};
  C.s.quests.push(uq); C.questCheckin('t2',360);
  ok('upward target: 360 of 315→405 = 50%', C.questProgress(uq).pct===50);

  // ---- CONSISTENCY (3×/wk for 2 weeks) ----
  C.s=baseState();
  const kq={id:'k1',title:'Write 3x/wk',kind:'consistency',track:'personal',scale:'standard',attr:'craft',due:null,
    steps:[],perWeek:3,weeks:2,ticks:[],weeksAwarded:[],awarded:false,completedAt:null,createdAt:C.today()};
  C.s.quests.push(kq);
  const x0=C.s.totalXp;
  C.questTick('k1'); C.questTick('k1');
  ok('2 ticks: week not yet satisfied', C.qWeeksSatisfied(kq)===0);
  C.questTick('k1');
  ok('3rd tick satisfies week 1 + pays the weekly bonus once', C.qWeeksSatisfied(kq)===1 && C.s.totalXp===x0+25);
  C.questTick('k1');
  ok('extra ticks in the same week do not bank or re-pay (anti-grind)', C.qWeeksSatisfied(kq)===1 && C.s.totalXp===x0+25);
  ok('progress label reads 1/2 wks @50%', C.questProgress(kq).label==='1/2 wks' && C.questProgress(kq).pct===50);
  // simulate week 2: backdate createdAt AND the existing ticks so they stay in week 0
  kq.createdAt=C.dayShift(C.today(),-7);
  kq.ticks=kq.ticks.map(()=>C.dayShift(C.today(),-7));
  C.questTick('k1'); C.questTick('k1'); C.questTick('k1');
  ok('week 2 satisfied completes the quest + bounty', C.qWeeksSatisfied(kq)===2 && kq.awarded===true);

  // ---- pace chip ----
  C.s=baseState();
  const pq={id:'p1',title:'Pace',kind:'count',target:100,progress:60,steps:[],unit:'',
    createdAt:C.dayShift(C.today(),-50), due:C.dayShift(C.today(),50),awarded:false,createdAtX:0};
  C.s.quests.push(pq);
  ok('60% at halfway = on pace', /on pace/.test(C.questPace(pq)));
  pq.progress=30;
  ok('30% at halfway = behind', /behind/.test(C.questPace(pq)));

  // ---- card renders per kind without throwing ----
  C.s=baseState();
  [cq,tq,kq].forEach(q=>{ q.pinned=true; C.s.quests.push(q); });   // pinned => expanded
  let html='';
  try{ html=C.s.quests.map(q=>C.questCard(q)).join(''); }catch(e){ html='THREW '+e.message; }
  ok('cards render for all kinds (controls present)', /data-qcount="c1:1"/.test(html) && /data-qcheckinadd="t1"/.test(html) && /data-qtick="k1"/.test(html) && !/THREW/.test(html));
  ok('count card shows progress label', /12 books|12\/12/.test(html));

  // ---- template prefill sanity: every template has valid fields for its kind ----
  const T=C.QUEST_TEMPLATES;
  ok('12 templates defined', T.length===12);
  ok('templates are internally valid', T.every(t=> t.kind==='checklist' || (t.kind==='count'&&t.target>0) || (t.kind==='target'&&isFinite(t.tStart)&&isFinite(t.tGoal)&&t.tStart!==t.tGoal) || (t.kind==='consistency'&&t.perWeek>=1&&t.weeks>=1)));
};
