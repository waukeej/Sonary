const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

function cropEnvironment(mode='cover',parent=false) {
  const listeners={}, controls={};
  const classes=new Set(parent?['modal-open']:[]);
  const element=(id)=>({id,hidden:true,dataset:{},value:'100',
    addEventListener(type,callback){listeners[id+':'+type]=callback;},
    getContext(){return context;},getBoundingClientRect(){return {width:400,height:400};},setPointerCapture(){},
    toBlob(callback){callback({});},
    querySelector(selector){return controls[selector];},querySelectorAll(){return [controls.cancel,controls.close];}});
  const context=new Proxy({}, {get:()=>()=>{}});
  const nodes={mediaCropModal:element('modal'),mediaCropCanvas:element('canvas'),mediaCropZoom:element('zoom')};
  ['[data-media-crop-rotate]','[data-media-crop-apply]','cancel','close'].forEach(id=>controls[id]=element(id));
  const input={dataset:{mediaCrop:mode},name:'qa',files:[{size:100}],value:'chosen',closest(){return this;},dispatchEvent(){}};
  const sandbox={window:{SonaryModal:{open(modal){modal.hidden=false;},close(modal,done){modal.hidden=true;done?.();}}},
    document:{body:{classList:{add(c){classes.add(c);},remove(c){classes.delete(c);}}},getElementById(id){return nodes[id];},querySelectorAll(){return [];},createElement(){return element('output');},addEventListener(type,callback){listeners[type]=callback;}},
    URL:{createObjectURL(){return 'blob:qa';},revokeObjectURL(){}},Image:class{constructor(){this.width=1200;this.height=800;}set src(value){this.onload();}},
    File:class{},DataTransfer:class{constructor(){this.files=[];this.items={add:file=>this.files.push(file)};}},CustomEvent:class{}};
  vm.runInNewContext(read('static/js/media-crop.js'),sandbox);
  listeners.DOMContentLoaded();
  const open=()=>listeners.change({target:{closest:()=>input}});
  return {open,classes,listeners,controls,input,nodes};
}
for(const mode of ['avatar','cover']) {
  test(`${mode} crop drag/zoom/rotate/apply preserves parent lock and restores its own lock`,()=>{
    const app=cropEnvironment(mode,true);app.open();assert.ok(app.classes.has('media-crop-open'));
    app.listeners['canvas:pointerdown']({clientX:10,clientY:10,pointerId:1});
    app.listeners['canvas:pointermove']({clientX:20,clientY:40});app.listeners['canvas:pointerup']();
    app.nodes.mediaCropZoom.value='150';app.listeners['zoom:input']();
    app.listeners['[data-media-crop-rotate]:click']();app.listeners['[data-media-crop-apply]:click']();
    assert.equal(app.classes.has('media-crop-open'),false);assert.ok(app.classes.has('modal-open'));assert.equal(app.input.files.length,1);
  });
}
for(const close of ['cancel','close','escape','backdrop']) {
  test(`crop ${close} restores scroll without altering parent modal state`,()=>{
    const app=cropEnvironment();app.open();
    if(close==='escape')app.listeners.keydown({key:'Escape',preventDefault(){},stopImmediatePropagation(){}});
    else if(close==='backdrop')app.listeners['modal:click']({target:app.nodes.mediaCropModal});
    else app.listeners[close+':click']();
    assert.equal(app.classes.size,0);assert.equal(app.nodes.mediaCropModal.hidden,true);assert.equal(app.input.value,'');
  });
}
test('crop viewport CSS provides scroll and meaningful low-height crop area',()=>{
  const css=read('static/css/app-unified.css');
  assert.match(css,/\.media-crop-window[^}]*max-height: calc\(100dvh - 40px\)[^}]*overflow-y: auto/);
  assert.match(css,/\.media-crop-modal[^}]*overflow-y: auto/);
  assert.match(css,/@media \(max-height: 640px\)[\s\S]*max\(240px/);
});
test('action row is two columns, outside real tracks, and uses existing flows only',()=>{
  const html=read('templates/diary.html');const row=html.split('class="diary-action-row"')[1].split('</section>')[0];
  assert.ok(row.includes('data-create-track-card')&&row.includes('data-delete-track-action'));
  assert.ok(!row.includes('data-track-id')&&!row.includes('class="track-card'));
  assert.ok(html.indexOf('diary-action-row')<html.indexOf('id="diaryTrackList"'));
  assert.match(read('static/css/app-unified.css'),/\.diary-action-row[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(read('static/js/delete-mode.js'),/#diaryTrackList > \.track-card\[data-track-id\]/);
  assert.match(read('static/js/delete-mode.js'),/data-delete-track-action[^\n]*enterMode/);
  assert.match(read('static/js/creation-modal.js'),/data-create-track-card/);
});
test('playlist uses only compact toolbar selection controls and a profile-style track component',()=>{
  const html=read('templates/playlist-id.html');
  assert.ok(html.includes('data-playlist-add')&&html.includes('data-playlist-remove'));
  assert.ok(!html.includes('data-playlist-add-action')&&!html.includes('data-playlist-remove-action'));
  assert.ok(!html.includes('class="diary-action-row"'));
  const row=read('templates/components/cards/playlist_track_row.html');
  assert.match(row,/profile_track_card\(track, context='playlist'\)/);
  const picker=read('templates/components/cards/track_picker_item.html');
  assert.match(picker,/profile_track_card\(track, context='picker'\)/);
  assert.ok(!picker.includes('bi-play')&&!picker.includes('bi-heart')&&!picker.includes('bi-plus')&&!picker.includes('bi-music-note-list'));
  const detail=read('static/js/playlist-detail.js');
  assert.match(detail,/insertBefore\(modeActions, editActions\.querySelector\('\.playlist-more-wrap'\)\)/);
  assert.match(detail,/querySelector\('\.playlist-track-remove-confirm'\)\.disabled = count === 0/);
  assert.match(detail,/tracks\/remove/);
});
