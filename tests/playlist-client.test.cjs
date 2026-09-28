const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
test('playlist operations reuse the existing CSRF/PRG transport and send explicit relationship IDs',async()=>{
  const calls=[];
  const window={SonaryDiary:{send:async(url,body)=>{calls.push({url,ids:body.getAll('track_ids')});return true;}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../static/js/playlist-client.js'),'utf8'),{window,FormData,document:{addEventListener(){}}});
  assert.equal(await window.SonaryPlaylists.submitIds('/playlist/7/tracks/remove','track_ids',['3','5']),true);
  assert.deepEqual(calls,[{url:'/playlist/7/tracks/remove',ids:['3','5']}]);
});
