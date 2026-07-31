/* Trophy engine + shop earn-feedback + redemption pulse */
module.exports = async function(C){
  // ---- fresh state earns nothing except after first action ----
  C.s=baseState(); C.s.trophies={};
  C.evalTrophies();
  ok('fresh state earns no trophies', Object.keys(C.s.trophies).length===0);

  // habit action -> First Step
  C.s.habits.push({name:'x',type:'build',stat:'mind',diff:'standard',completions:1,best:1,history:{}});
  C.evalTrophies();
  ok('first action earns First Step, date-stamped today', C.s.trophies.first_step===C.today());
  ok('earn logged to chronicle + toasted', /First Step/.test(global.__TOAST||''));

  // ---- earn-once: re-eval does not re-toast/re-stamp ----
  global.__TOAST='';
  const stamp=C.s.trophies.first_step;
  C.evalTrophies();
  ok('already-earned trophies never re-fire', C.s.trophies.first_step===stamp && global.__TOAST==='');

  // ---- organ coverage ----
  C.s=baseState(); C.s.trophies={};
  const fg=C.fgState();
  fg.sessions=Array.from({length:25},(_,i)=>({id:'s'+i,date:C.dayShift(C.today(),-i),type:'Leg A',kind:'lift'}));
  fg.log=Array.from({length:50},(_,i)=>({id:'l'+i}));
  C.evalTrophies();
  ok('25 sessions earns First Fire + Tempered (not Forged)', !!C.s.trophies.forge_first && !!C.s.trophies.forge_25 && !C.s.trophies.forge_100);
  ok('50 sets earns On the Board', !!C.s.trophies.sets_50);

  const al=C.fuelState();
  for(let i=0;i<30;i++) al.history[C.dayShift(C.today(),-i)]=true;
  for(let i=0;i<10;i++) al.dialedHistory[C.dayShift(C.today(),-i)]=true;
  for(let i=0;i<7;i++) al.protocol.history[C.dayShift(C.today(),-i)]=true;
  C.evalTrophies();
  ok('alchemy: First Seal + Steady Table + Dialed In + Ritualist', !!C.s.trophies.seal_first && !!C.s.trophies.seal_30 && !!C.s.trophies.dialed_10 && !!C.s.trophies.proto_7);

  // quest shape trophies
  C.s.quests=[
    {id:'a',kind:'checklist',awarded:true,scale:'standard',steps:[]},
    {id:'b',kind:'count',awarded:true,scale:'standard',steps:[]},
    {id:'c',kind:'target',awarded:true,scale:'standard',steps:[]},
    {id:'d',kind:'consistency',awarded:true,scale:'epic',steps:[]}];
  C.evalTrophies();
  ok('quests: Journeyman + Many Roads (all 4 shapes) + Saga Closed (epic)', !!C.s.trophies.quest_first && !!C.s.trophies.quest_shapes && !!C.s.trophies.quest_epic);

  // comeback (hidden): 8-day gap in training history then a return
  C.s=baseState(); C.s.trophies={};
  const fg2=C.fgState();
  fg2.history[C.dayShift(C.today(),-20)]=true; fg2.history[C.dayShift(C.today(),-2)]=true;
  C.evalTrophies();
  ok('comeback trophy fires on 8+ day gap + return', !!C.s.trophies.comeback);

  // render: earned vs locked vs hidden
  C.s.trophies={first_step:'2026-07-01'};
  C.renderAch(C.levelInfo(0));
  const html=global.__els['achRow'].innerHTML;
  ok('earned trophy shows its date', /2026-07-01/.test(html));
  ok('locked visible trophies render (Forged shows how to earn)', /Forged/.test(html) && /100 Forge sessions/.test(html));
  ok('hidden trophy (The Return) NOT shown until earned', !/The Return/.test(html));
  ok('counter reads 1 / 22', (global.__els['achCount']||{}).textContent==='1 / '+C.TROPHY_DEFS.length);

  // ---- shop: earn feedback + zero-pay explanation ----
  ok('award() toasts token pay with balance context', /Fallow/.test(String(C.award)) && /balance/i.test(String(C.award)));
  // redemption pulse render
  C.s=baseState(); C.s.tokens=5; C.s.shop.desires=[{name:'Massage',cost:4}];
  C.s.shop.redeemed=[{name:'Old thing',cost:3,ts:Date.now()-16*86400000}];
  C.renderShop();
  const pulse=(global.__els['redeemPulse']||{}).innerHTML||'';
  ok('16 days since reward + affordable desire → nudge to claim', /16 days ago/.test(pulse) && /afford/.test(pulse));
  C.s.shop.redeemed=[{name:'Coffee',cost:2,ts:Date.now()}];
  C.renderShop();
  ok('recent reward → quiet line, no nudge', /today/.test((global.__els['redeemPulse']||{}).innerHTML) && !/afford a desire/.test((global.__els['redeemPulse']||{}).innerHTML));
};
