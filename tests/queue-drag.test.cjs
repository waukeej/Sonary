const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function fixture() {
  const handlers={}, timers=new Map(); let timerId=0, result, swipeResult;
  const classes=()=>({add(){},remove(){}});
  const list={children:[],scrollTop:0,addEventListener:(n,f)=>handlers[n]=f,
    getBoundingClientRect:()=>({top:0,bottom:500}),setPointerCapture(){},hasPointerCapture:()=>false,
    insertBefore(item,next){this.children=this.children.filter(x=>x!==item);this.children.splice(next?this.children.indexOf(next):this.children.length,0,item);},
    append(item){this.insertBefore(item,null);},querySelectorAll(){return this.children;}};
  list.children=[0,1,2].map(i=>({dataset:{queueIndex:i},classList:classes(),isConnected:true,style:{setProperty(){},removeProperty(){}},
    get nextElementSibling(){return list.children[list.children.indexOf(this)+1]||null;},
    getBoundingClientRect(){return {top:list.children.indexOf(this)*78,height:70,width:300};},
    closest(selector){return selector==='.sonary-queue-item'?this:null;}}));
  const source=fs.readFileSync(path.join(__dirname,'../static/js/queue-modal.js'),'utf8');
  const block=source.slice(source.indexOf('    let draggedItem = null;'),source.indexOf("    document.dispatchEvent(new Event('sonary:queue-ready'))"));
  vm.runInNewContext(block,{list,panel:{classList:classes()},Date,Math,Number,
    setTimeout:f=>{timers.set(++timerId,f);return timerId;},clearTimeout:id=>timers.delete(id),
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},
    window:{addEventListener:(n,f)=>handlers[n]=f,SonaryPlayer:{reorder:order=>{result=Array.from(order);},swipeQueue:(at,dir)=>{swipeResult=[at,dir];}}}});
  const event=(target,y,type='mouse')=>({target,clientX:10,clientY:y,button:0,pointerId:1,pointerType:type,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}});
  const hold=()=>{for(const f of [...timers.values()])f();timers.clear();};
  return {list,handlers,event,hold,result:()=>result,swipe:()=>swipeResult};
}
test('mouse drag commits C/A/B and suppresses the release click',()=>{
  const f=fixture(), c=f.list.children[2];
  f.handlers.pointerdown(f.event(c,175));f.handlers.pointermove(f.event(c,5));f.handlers.pointerup(f.event(c,5));
  assert.deepEqual(f.result(),[2,0,1]);
  const click=f.event(c,5);f.handlers.click(click);assert.equal(click.stopped,true);
});
test('touch hold reorders, while a swipe before hold remains normal scrolling',()=>{
  const f=fixture(), c=f.list.children[2];
  const touch=y=>({identifier:7,clientX:10,clientY:y});
  f.handlers.touchstart({target:c,touches:[touch(175)]});
  f.handlers.touchmove({touches:[touch(120)],preventDefault(){assert.fail('Swipe was blocked');}});
  f.hold();assert.equal(f.result(),undefined);
  const handle={closest:selector=>selector==='.sonary-drag-handle'?handle:selector==='.sonary-queue-item'?c:null};
  f.handlers.touchstart({target:handle,touches:[touch(175)]});f.hold();
  let prevented=false;f.handlers.touchmove({touches:[touch(5)],preventDefault(){prevented=true;}});
  f.handlers.touchend({type:'touchend',changedTouches:[touch(5)]});
  assert.equal(prevented,true);assert.deepEqual(f.result(),[2,0,1]);
});
test('ordinary control click does not start drag',()=>{
  const f=fixture();const button={closest:()=>({})};
  f.handlers.pointerdown(f.event(button,175));f.hold();f.handlers.pointerup(f.event(button,5));
  assert.equal(f.result(),undefined);
});

test('horizontal gestures commit only beyond threshold; body never starts reorder',()=>{
  for(const [dx,expected] of [[-100,'left'],[100,'right'],[-25,undefined]]) {
    const f=fixture(),target=f.list.children[0];
    const point=x=>({identifier:7,clientX:x,clientY:30});
    f.handlers.touchstart({target,touches:[point(150)]});f.hold();
    f.handlers.touchmove({touches:[point(150+dx)],preventDefault(){}});
    f.handlers.touchend({type:'touchend',changedTouches:[point(150+dx)]});
    assert.equal(f.result(),undefined);assert.deepEqual(f.swipe(),expected?[0,expected]:undefined);
  }
});
