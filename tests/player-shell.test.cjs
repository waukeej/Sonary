const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('shell navigates a persistent frame and Back/Forward do not replace the runtime',()=>{
  const handlers={}, loads=[], entries=['/profile'];let at=0, bound=0;
  const location=new URL('http://localhost/profile');
  location.assign=()=>assert.fail('Unexpected top-level navigation');
  const update=value=>{location.href=new URL(value,location.href).href;};
  const frame={contentWindow:{location:{replace:value=>loads.push(value)}},addEventListener:(name,fn)=>handlers.load=fn};
  const player={bindDocument:()=>bound++};
  const context={URL,location,window:{SonaryPlayer:player},addEventListener:(name,fn)=>handlers[name]=fn,
    document:{getElementById:()=>frame,querySelector:()=>null},
    history:{replaceState:(state,title,value)=>{entries[at]=value;update(value);},pushState:(state,title,value)=>{entries.splice(++at);entries.push(value);update(value);}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../static/js/player-shell.js'),'utf8'),context);
  handlers.DOMContentLoaded();
  context.window.SonaryShell.go('/diary');context.window.SonaryShell.go('/playlist/1');
  update(entries[--at]);handlers.popstate();update(entries[++at]);handlers.popstate();
  assert.deepEqual(loads,['/diary','/playlist/1','/diary','/playlist/1']);
  assert.equal(context.window.SonaryPlayer,player);
});
