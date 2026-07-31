/* Theming layer + workout CSV export */
module.exports = async function(C){
  // ---- workout CSV ----
  C.s=baseState();
  global.__TOAST='';
  try{ C.exportWorkoutCSV(); }catch(e){}
  ok('empty log guarded (no file, clear message)', /No workouts logged yet/.test(global.__TOAST||''));
  const src=String(C.exportWorkoutCSV);
  ok('workout CSV carries the full set schema', ['date','session_type','exercise','set','weight','reps','bodyweight','session_id'].every(c=>src.indexOf(c)>=0));
  ok('workout CSV reads the forge log (not habits)', /forge\.log|forge\|\|\{\}\)\.log/.test(src) && !/state\.habits/.test(src));

  // ---- theming: defaults ----
  C.s=baseState(); C.migrateState();
  ok('migrate sets default theme homestead', C.s.theme && C.s.theme.id==='homestead');
  ok('L() serves homestead words', C.L('token')==='Fallow' && C.L('tokenIcon')==='🌾');

  // ---- preset switch: words change, data does not ----
  const before=JSON.stringify({habits:C.s.habits,quests:C.s.quests,tokens:C.s.tokens,training:Object.keys(C.s.training)});
  C.s.theme={id:'mythic'};
  ok('mythic lexicon live (Gold 🪙, Armory, Sagas)', C.L('token')==='Gold' && C.L('tokenIcon')==='🪙' && C.L('shop_title')==='Armory' && C.L('quests_eyebrow')==='Sagas');
  const after=JSON.stringify({habits:C.s.habits,quests:C.s.quests,tokens:C.s.tokens,training:Object.keys(C.s.training)});
  ok('THEME CHANGES TOUCH ZERO DATA', before===after);

  // ranks swap per theme, same ladder length
  ok('rank names themed (Squire I not Seedling I)', C.rankNameOf(0)==='Squire' && C.rankLabel(1).indexOf('Squire')===0);
  C.s.theme={id:'athlete'};
  ok('athlete ranks (Rookie → Legend)', C.rankNameOf(0)==='Rookie' && C.rankNameOf(7)==='Legend');

  // themed render sites
  C.s.tokens=7; C.renderTokens();
  ok('shop balance renders themed currency', /7 Chips/.test((global.__els['shopBalance']||{}).textContent||''));
  C.s.theme={id:'stoic'};
  const appSrc=require('fs').readFileSync(global.__APPFILE,'utf8');
  ok('seal button labels routed through L() in the app source', /btn\.textContent=L\('seal_done'\)/.test(appSrc) && /btn\.textContent=L\('seal_cta'\)/.test(appSrc));
  ok('offerings header routed through L()', /esc\(L\('offerings'\)\)/.test(appSrc));

  // ---- custom theme: merge over homestead, bad ranks dropped ----
  C.s.theme={id:'custom',lex:{token:'Knots',tokenIcon:'⚓',shop_title:'The Chandlery'}};
  ok('custom lex overrides what it defines', C.L('token')==='Knots' && C.L('shop_title')==='The Chandlery');
  ok('custom lex falls back to homestead for missing keys', C.L('quests_eyebrow')==='Milestones' && C.L('seal_cta').length>0);
  ok('short/absent custom ranks fall back to defaults', C.rankNameOf(2)==='Cultivator');

  // ---- custom generation guard (no AI in harness) ----
  global.__TOAST=''; global.__PROMPT='sailing, jazz';
  await C.generateCustomTheme();
  ok('without AI available, custom generation declines gracefully', /need AI|preset/i.test(global.__TOAST||''));

  // applyTheme never throws on the stub DOM
  let threw=false; try{ C.applyTheme(); }catch(e){ threw=true; }
  ok('applyTheme is safe on any DOM', !threw);

  // token payout toast themed (source check)
  ok('token earn toast routed through L()', /L\('tokenIcon'\)/.test(String(C.award)));
};
