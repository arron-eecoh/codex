/* PWA: manifest presence + head wiring + icon assets */
module.exports = async function(C){
  const fs=require('fs'), path=require('path');
  const ROOT=path.dirname(global.__APPFILE);
  const html=fs.readFileSync(global.__APPFILE,'utf8');
  const head=html.slice(0, html.indexOf('</head>'));

  // ---- head wiring ----
  ok('manifest is linked in <head>', /<link\s+rel="manifest"\s+href="manifest\.webmanifest">/.test(head));
  const themeMeta=head.match(/<meta\s+name="theme-color"\s+content="([^"]+)">/);
  ok('theme-color meta present', !!themeMeta);
  const bgVar=(html.match(/--bg:\s*(#[0-9a-fA-F]{3,8})/)||[])[1];
  ok('theme-color matches the app --bg background', !!themeMeta && !!bgVar && themeMeta[1].toLowerCase()===bgVar.toLowerCase());
  ok('apple-touch-icon linked', /<link\s+rel="apple-touch-icon"\s+href="icons\/apple-touch-icon\.png">/.test(head));
  ok('iOS standalone meta (apple-mobile-web-app-capable)', /name="apple-mobile-web-app-capable"\s+content="yes"/.test(head));
  ok('Android standalone meta (mobile-web-app-capable)', /name="mobile-web-app-capable"\s+content="yes"/.test(head));

  // ---- manifest file ----
  const mPath=path.join(ROOT,'manifest.webmanifest');
  ok('manifest.webmanifest exists at repo root', fs.existsSync(mPath));
  let man=null;
  try{ man=JSON.parse(fs.readFileSync(mPath,'utf8')); }catch(e){}
  ok('manifest parses as JSON', !!man);
  if(!man) return;
  ok('manifest display is standalone', man.display==='standalone');
  ok('manifest start_url stays same-origin relative', man.start_url==='.');
  ok('manifest background_color matches --bg', !!bgVar && String(man.background_color).toLowerCase()===bgVar.toLowerCase());
  ok('manifest theme_color matches --bg', !!bgVar && String(man.theme_color).toLowerCase()===bgVar.toLowerCase());
  ok('manifest names the app', man.name==="The Steward's Codex" && !!man.short_name);

  // ---- icons: declared, present on disk, real PNGs of the declared size ----
  const icons=Array.isArray(man.icons)?man.icons:[];
  ok('manifest declares 192 and 512 icons', icons.some(i=>i.sizes==='192x192') && icons.some(i=>i.sizes==='512x512'));
  ok('manifest declares a maskable icon', icons.some(i=>String(i.purpose||'').includes('maskable')));
  const pngSize=f=>{ const b=fs.readFileSync(f);
    if(b.length<24 || b.readUInt32BE(0)!==0x89504e47) return null;
    return {w:b.readUInt32BE(16), h:b.readUInt32BE(20)}; };
  for(const i of icons){
    const f=path.join(ROOT,i.src), want=parseInt(i.sizes,10);
    const dim=fs.existsSync(f)?pngSize(f):null;
    ok('icon asset '+i.src+' is a real '+i.sizes+' PNG', !!dim && dim.w===want && dim.h===want);
  }
  const apple=path.join(ROOT,'icons/apple-touch-icon.png');
  const ad=fs.existsSync(apple)?pngSize(apple):null;
  ok('apple-touch-icon.png is a real 180x180 PNG', !!ad && ad.w===180 && ad.h===180);
};
