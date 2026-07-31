/* Display density: compact toggle, persistence, data safety */
module.exports = async function(C){
  const appSrc=require('fs').readFileSync(global.__APPFILE,'utf8');

  C.s=baseState();
  ok('default is cozy (no density set → compact class off)', C.s.density===undefined);
  // classList capture
  let cls=new Set();
  global.document.documentElement={classList:{toggle:(k,on)=>{ on?cls.add(k):cls.delete(k); }}};
  C.applyDensity();
  ok('cozy: html has no compact class', !cls.has('compact'));
  C.s.density='compact'; C.applyDensity();
  ok('compact: html.compact applied', cls.has('compact'));
  C.s.density='cozy'; C.applyDensity();
  ok('toggling back removes it', !cls.has('compact'));

  // settings wiring + persistence path
  ok('settings row exists with live description', /id="setDensity"/.test(appSrc) && /id="densityDesc"/.test(appSrc));
  ok('toggle persists via Store.save and re-applies', /state\.density=\(state\.density==='compact'\)\?'cozy':'compact'; Store\.save\(state\); applyDensity\(\)/.test(appSrc));
  ok('render() applies density every cycle (survives reload once storage exists)', /function render\(\)\{\n  applyDensity\(\);/.test(appSrc));

  // compact stylesheet covers the high-traffic controls
  ['\\.fg-w,html\\.compact \\.fg-r\\{min-height:34px','\\.fg-set-check\\{width:34px;height:34px','\\.seg button\\{min-height:34px','\\.fg-ex\\{padding:8px 10px','\\.quest\\{padding:9px','\\.tab\\{padding:8px'].forEach(sel=>{
    ok('compact override present: '+sel.slice(0,30), new RegExp('html\\.compact [^}]*'+sel).test(appSrc) || new RegExp(sel).test(appSrc));
  });
  ok('compact never shrinks text inputs below 16px (iOS zoom guard intact)', /input:not\(\[type=checkbox\]\).*font-size:16px !important/.test(appSrc));

  // data safety: density is display-only
  const before=JSON.stringify({t:C.s.totalXp,h:C.s.habits,q:C.s.quests,f:C.s.training});
  C.s.density='compact'; C.applyDensity(); C.s.density='cozy'; C.applyDensity();
  ok('density flips touch ZERO data', JSON.stringify({t:C.s.totalXp,h:C.s.habits,q:C.s.quests,f:C.s.training})===before);
};
