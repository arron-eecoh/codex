/* Cloud sync: local-first, rev-based merge, auth wiring — all offline-safe */
module.exports = async function(C){
  const fs=require('fs');
  const src=fs.readFileSync(global.__APPFILE,'utf8');

  // ---- save() stamps revisions and queues a push ----
  C.s=baseState(); const r0=C.s._rev||0;
  let pushed=0; const oPush=C.Cloud.push; C.Cloud.push=()=>{ pushed++; };
  await C.Store.save(C.s);
  ok('every save bumps _rev and stamps _savedAt', C.s._rev===r0+1 && typeof C.s._savedAt==='number');
  ok('every save queues a cloud push', pushed===1);
  C.Cloud.push=oPush;

  // ---- merge policy: strictly-newer remote wins; otherwise local wins and pushes ----
  const mkSb=(row)=>({ from:()=>({ select:()=>({ eq:()=>({ maybeSingle:async()=>({data:row,error:null}) }) }) }), auth:{} });
  C.s=baseState(); C.s._rev=5; C.s.totalXp=111;
  C.Cloud.sb=mkSb({state:Object.assign(baseState(),{_rev:9,totalXp:999}),rev:9});
  C.Cloud.session={user:{id:'u1',email:'a@b.c'},access_token:'tkn'};
  let pushes=0; C.Cloud.push=()=>{ pushes++; };
  await C.Cloud.pullMerge();
  ok('remote rev 9 > local 5 → remote adopted', C.Cloud.status==='synced' && C.s.totalXp===999);
  ok('adopted state carries the newer rev', C.s._rev>=9);

  C.s._rev=20;
  C.Cloud.sb=mkSb({state:Object.assign(baseState(),{_rev:3,totalXp:1}),rev:3});
  pushes=0; await C.Cloud.pullMerge();
  ok('local rev 20 > remote 3 → local kept and pushed up', C.s._rev===20 && C.s.totalXp===999 && pushes===1);

  C.Cloud.sb=mkSb(null); pushes=0; await C.Cloud.pullMerge();
  ok('no remote row yet → first push seeds the cloud', pushes===1);

  // ---- signed-out and unconfigured are safe no-ops ----
  C.Cloud.push=oPush;                                  // real (guarded) push back in place
  C.Cloud.sb=null; C.Cloud.session=null; pushes=0;
  C.Cloud.push=new Proxy(oPush,{apply(t,th,a){ const r=Reflect.apply(t,th,a); if(C.Cloud._t) pushes++; return r; }});
  await C.Cloud.pullMerge(); C.Cloud.push();
  ok('signed-out: pull and push are no-ops (local-only mode)', pushes===0 && !C.Cloud._t);
  // pin the REAL save contract in source (the harness stub mirrors it)
  ok('real Store.save bumps _rev and stamps _savedAt (source)', /s\._rev=\(s\._rev\|\|0\)\+1; s\._savedAt=Date\.now\(\)/.test(src));
  ok('real Store.save queues the cloud push (source)', /window\.storage\.set\(KEY, json\); \} \}catch\(e\)\{\}\n    try\{ Cloud\.push\(\); \}catch\(e\)\{\}/.test(src));

  // ---- init failure path → local mode, no throw ----
  const oFetch=global.fetch; global.fetch=async()=>{ throw new Error('offline'); };
  C.Cloud.status='synced'; await C.Cloud.init();
  ok('config unreachable → graceful local mode', C.Cloud.status==='local');
  global.fetch=oFetch;

  // ---- auth surfaces ----
  ok('AI calls attach the session JWT when present', /Authorization'\]='Bearer '\+_tk/.test(src));
  ok('Settings has the Account & Sync section (email, magic link, sync now, sign out)', ['cloudStatus','cloudEmailIn','btnMagic','btnSyncNow','btnSignOut'].every(id=>new RegExp('id="'+id+'"').test(src)));
  ok('boot starts the cloud AFTER local render (local-first)', /render\(\);\n  try\{ Cloud\.init\(\); \}catch\(e\)\{\}/.test(src));
  ok('magic-link redirect returns to the app itself', /emailRedirectTo:location\.origin\+location\.pathname/.test(src));

  C.Cloud.push=oPush; C.Cloud.sb=null; C.Cloud.session=null; C.Cloud.status='local';
};
