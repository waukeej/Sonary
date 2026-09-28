const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function fixture(saved, volume) {
  const handlers={}, audioHandlers={}, storage=new Map(saved ? [['sonary-player:1',JSON.stringify(saved)]] : []);
  const element=()=>({dataset:{},src:'/cover',style:{setProperty(){}},setAttribute(){},toggleAttribute(){},querySelector(){return element();}});
  const bar=element();bar.dataset.playerUser='1';bar.querySelectorAll=()=>[element(),element(),element()];
  let audio;
  const context={console,Date,JSON,Number,Math,String,Boolean,Promise,Event:class{},
    Audio:class{constructor(){audio=this;this.paused=true;this.currentTime=0;this.duration=60;this.volume=1;this.muted=false;}addEventListener(n,f){const previous=audioHandlers[n];audioHandlers[n]=()=>{previous?.();f();};}pause(){this.paused=true;audioHandlers.pause?.();}play(){this.paused=false;audioHandlers.play?.();audioHandlers.playing?.();return Promise.resolve();}removeAttribute(){this.src='';}load(){}},
    document:{querySelector:s=>s==='.player-bar'?bar:null,querySelectorAll:()=>[],addEventListener:(n,f)=>handlers[n]=f},
    sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    localStorage:{getItem:()=>volume || null,setItem:(k,v)=>{volume=v;}},
    fetch:async url=>({ok:true,redirected:false,json:async()=>url.startsWith('/playlist/')?[1,2].map(id=>({id,audio_url:`/audio/${id}`})):{id:Number(url.split('/')[2]),audio_url:`/audio/${url.split('/')[2]}`}})};
  context.window={addEventListener:(n,f)=>handlers[n]=f};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../static/js/player.js'),'utf8'),context);
  return {api:context.window.SonaryPlayer,audio,handlers,audioHandlers,state:()=>JSON.parse(storage.get('sonary-player:1')),volume:()=>volume};
}
test('one player handles play/pause, queue order, next, ended and playlist playback',async()=>{
  const f=fixture();await f.handlers.DOMContentLoaded();
  await f.api.playTrack(1);assert.equal(f.audio.src,'/audio/1');assert.equal(f.audio.paused,false);
  await f.api.playTrack(1);assert.equal(f.audio.paused,true);
  await f.api.enqueue(2);assert.deepEqual(f.state().ids,[1,2]);
  f.api.next();assert.equal(f.audio.src,'/audio/2');
  await f.api.playPlaylist(1);assert.equal(f.audio.src,'/audio/1');
  f.audioHandlers.ended();assert.equal(f.audio.src,'/audio/2');
  f.audioHandlers.ended();assert.equal(f.audio.paused,true);
});
test('navigation preserves playing intent and restores queue and position',async()=>{
  const f=fixture();await f.api.playTrack(1);f.audio.currentTime=23;f.handlers.pagehide();
  assert.equal(f.state().playing,true);assert.equal(f.audio.paused,true);
  const restored=fixture(f.state());await restored.handlers.DOMContentLoaded();restored.audio.onloadedmetadata();
  assert.equal(restored.audio.currentTime,23);assert.equal(restored.audio.paused,false);
  assert.deepEqual(restored.state().ids,[1]);
});

test('volume and mute share audio state, restore nonzero level and persist locally',async()=>{
  const f=fixture(); f.api.setVolume(.37); assert.equal(f.audio.volume,.37);
  f.api.toggleMute(); assert.equal(f.audio.muted,true);
  const restored=fixture(null,f.volume()); assert.equal(restored.audio.muted,true);
  restored.api.toggleMute(); assert.equal(restored.audio.volume,.37); assert.equal(restored.audio.muted,false);
  restored.api.setVolume(0); restored.api.toggleMute(); assert.equal(restored.audio.volume,.37);
  await restored.api.playTrack(1); await restored.api.playTrack(2); assert.equal(restored.audio.volume,.37);
  restored.api.setVolume(5); assert.equal(restored.audio.volume,1);
  restored.api.setVolume(-1); assert.equal(restored.audio.volume,0);
});

test('queue reorder retains current audio position and next follows new order',async()=>{
  const f=fixture(); await f.api.playTrack(1); await f.api.enqueue(2); await f.api.enqueue(3);
  f.audio.currentTime=32; f.api.reorder([2,0,1]);
  assert.deepEqual(f.state().ids,[3,1,2]); assert.equal(f.state().index,1);
  assert.equal(f.audio.currentTime,32); assert.equal(f.audio.src,'/audio/1'); assert.equal(f.audio.paused,false);
  f.api.next(); assert.equal(f.audio.src,'/audio/2');
});
