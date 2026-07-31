/* Grove: lifetime accrual, tiers, quest crediting, bloom untouched */
module.exports = async function(C){
  // lifetime vs bloom: old effort counts in grove, not in the 14-day bloom
  C.s=baseState();
  const h={name:'Read',type:'build',stat:'mind',virtue:'wisdom',diff:'easy',completions:0,best:0,history:{}};
  for(let i=0;i<40;i++) h.history[C.dayShift(C.today(),-(30+i))]=true;   // 40 days, all >14d ago
  C.s.habits.push(h);
  const bloom=C.virtueData().find(v=>v.key==='wisdom');
  const grove=C.groveData().find(v=>v.key==='wisdom');
  ok('old effort invisible to the 14-day bloom', bloom.raw===0);
  ok('old effort fully counted by the grove (40×1 easy=40)', grove.raw===40);

  // tiers
  ok('tier ladder: 0=Seed, 30=Sprout, 80=Sapling, 250=Grove, 600=Old Growth',
     C.groveTier(0).name==='Seed' && C.groveTier(30).name==='Sprout' && C.groveTier(80).name==='Sapling'
     && C.groveTier(250).name==='Grove' && C.groveTier(600).name==='Old Growth');
  ok('progress-to-next computed (50 → 50% of Sprout→Sapling)', C.groveTier(50).pct===50 && C.groveTier(50).next==='Sapling');
  ok('top tier caps at 100%, no next', C.groveTier(999).pct===100 && C.groveTier(999).next===null);

  // grove never decays: adding nothing, moving time forward conceptually = same raw (pure fn of history)
  const again=C.groveData().find(v=>v.key==='wisdom');
  ok('grove is deterministic/stable', again.raw===40);

  // training feeds vitality lifetime
  const fg=C.fgState();
  for(let i=0;i<10;i++) fg.history[C.dayShift(C.today(),-(60+i))]=true;
  ok('old training days feed lifetime Vitality (10×2=20)', C.groveData().find(v=>v.key==='vitality').raw===20);

  // quest virtue crediting by scale
  C.s.quests.push({id:'g1',title:'Epic build',kind:'checklist',scale:'epic',virtue:'stewardship',awarded:true,steps:[]});
  C.s.quests.push({id:'g2',title:'Minor',kind:'count',scale:'minor',virtue:'stewardship',awarded:true,steps:[],target:1,progress:1});
  C.s.quests.push({id:'g3',title:'Unawarded',kind:'checklist',scale:'epic',virtue:'stewardship',awarded:false,steps:[]});
  const st=C.groveData().find(v=>v.key==='stewardship');
  ok('awarded quests credit their virtue by scale (20+3), unawarded do not', st.raw===23);

  // render
  C.renderGrove();
  const html=(global.__els['groveMount']||{}).innerHTML||'';
  ok('grove strip renders all six virtues with tiers', (html.match(/grove-card/g)||[]).length===6 && /Sapling/.test(html));
  ok('grove labeled as lifetime/never fades', /never fades/.test(html));

  // bloom render path unchanged (virtueData window intact)
  ok('bloom window constant untouched (14)', C.VIRTUE_WINDOW===14);
};
