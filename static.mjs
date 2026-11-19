import {bindUndoShortcut} from './undo-shortcut.mjs';
import {zip} from './codec.mjs';
import {clearEdgeFragments} from './cleanup.mjs';
const $=id=>document.getElementById(id),W=370,H=320,stage=$('stage'),ctx=stage.getContext('2d');
const C=()=>Object.assign(document.createElement('canvas'),{width:W,height:H});
let sources=[],items=[],selected=0,drag=null,picking=false;
const current=()=>items[selected],defaults=()=>({key:false,color:'#ffffff',tol:35,edge:0,scale:100,x:0,y:0,text:'',font:36,textY:88,textColor:'#ffffff'});
function status(t){$('status').textContent=t}
function guard(fn){return async(...a)=>{try{await fn(...a)}catch(e){status(e.message)}}}
function base(img,sx=0,sy=0,sw=img.width,sh=img.height){const c=C(),k=Math.min((W-20)/sw,(H-20)/sh);c.getContext('2d').drawImage(img,sx,sy,sw,sh,(W-sw*k)/2,(H-sh*k)/2,sw*k,sh*k);const d=c.getContext('2d').getImageData(0,0,W,H);d.bounds={x:(W-sw*k)/2,y:(H-sh*k)/2,w:sw*k,h:sh*k};return d}
function make(data){return {original:data,override:new Int8Array(W*H),s:defaults(),history:[],clean:false}}
function snapshot(){const f=current();if(!f)return;f.history.push({override:f.override.slice(),s:{...f.s},clean:f.clean});if(f.history.length>20)f.history.shift()}
function pixels(f){let d=new ImageData(new Uint8ClampedArray(f.original.data),W,H),a=d.data,s=f.s;
 if(s.key){const rgb=s.color.match(/\w\w/g).map(x=>parseInt(x,16)),seen=new Uint8Array(W*H),q=new Int32Array(W*H);let head=0,tail=0;const add=p=>{if(seen[p])return;seen[p]=1;const k=p*4;if(a[k+3]===0||Math.hypot(a[k]-rgb[0],a[k+1]-rgb[1],a[k+2]-rgb[2])<=s.tol)q[tail++]=p};for(let x=0;x<W;x++){add(x);add((H-1)*W+x)}for(let y=0;y<H;y++){add(y*W);add(y*W+W-1)}while(head<tail){const p=q[head++];a[p*4+3]=0;const x=p%W,y=(p/W)|0;if(x)add(p-1);if(x<W-1)add(p+1);if(y)add(p-W);if(y<H-1)add(p+W)}}
 if(f.clean)clearEdgeFragments(d,f.original.bounds||{x:0,y:0,w:W,h:H});
 for(let n=0;n<s.edge;n++){const old=a.slice();for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const p=(y*W+x)*4+3;a[p]=Math.min(old[p],old[p-4],old[p+4],old[p-W*4],old[p+W*4])}}
 for(let p=0;p<f.override.length;p++)if(f.override[p]===1)a[p*4+3]=0;else if(f.override[p]===2)for(let k=0;k<4;k++)a[p*4+k]=f.original.data[p*4+k];return d;
}
function render(f){const c=C(),x=c.getContext('2d'),raw=C();raw.getContext('2d').putImageData(pixels(f),0,0);const s=f.s,k=s.scale/100;x.save();x.translate(W/2+s.x,H/2+s.y);x.scale(k,k);x.drawImage(raw,-W/2,-H/2);x.restore();if(s.text){x.font=`900 ${s.font}px system-ui,sans-serif`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=5;x.strokeStyle='#15202a';x.fillStyle=s.textColor;x.strokeText(s.text,W/2,H*s.textY/100,W-16);x.fillText(s.text,W/2,H*s.textY/100,W-16)}return c}
function draw(){ctx.clearRect(0,0,W,H);if(current())ctx.drawImage(render(current()),0,0)}
function thumbs(){const box=$('thumbs');box.replaceChildren();items.forEach((f,i)=>{const b=document.createElement('button');b.className=i===selected?'selected':'';const im=new Image();im.src=render(f).toDataURL();im.alt=`貼圖 ${i+1}`;b.append(im,document.createTextNode(String(i+1).padStart(2,'0')));b.onclick=()=>{selected=i;sync();thumbs()};box.append(b)})}
function sync(){const f=current();if(!f)return;for(const id of ['key','color','tol','edge','scale','text','font','textY','textColor']){if(id==='key')$(id).checked=f.s[id];else $(id).value=f.s[id]}$('selected').textContent=`02 編輯第 ${selected+1} 張`;$('tolLabel').value=f.s.tol;$('edgeLabel').value=f.s.edge;$('scaleLabel').value=Math.round(f.s.scale)+'%';draw()}
$('files').onchange=guard(async e=>{const files=[...e.target.files].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));if(!files.length)return;if(files.length>40)throw Error('最多匯入 40 張。');const next=[];for(const f of files){if(f.size>30*1024*1024)throw Error('單張圖片請小於 30 MB。');const im=await createImageBitmap(f);if(im.width*im.height>25000000){im.close();throw Error('圖片請小於 2500 萬像素。')}next.push(im)}sources.forEach(x=>x.close());sources=next;if(files.length>1)$('count').value='1';slice()});
function slice(){if(!sources.length)throw Error('請先匯入圖片。');if(items.length&&!confirm('重新裁切會清除目前編輯，確定繼續？'))return;items=[];if(sources.length>1||$('count').value==='1')items=sources.map(im=>make(base(im)));else{const [cols,rows]=({4:[2,2],6:[3,2],8:[4,2],9:[3,3],12:[4,3],16:[4,4]})[$('count').value],im=sources[0];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)items.push(make(base(im,x*im.width/cols,y*im.height/rows,im.width/cols,im.height/rows)))}selected=0;sync();thumbs();status(`已載入 ${items.length} 張靜態貼圖，請點選逐張編輯。`)}
$('slice').onclick=guard(slice);
for(const id of ['key','color','tol','edge','scale','text','font','textY','textColor']){$(id).addEventListener('focus',()=>snapshot());$(id).oninput=()=>{const f=current();if(!f)return;f.s[id]=id==='key'?$(id).checked:['color','text','textColor'].includes(id)?$(id).value:Number($(id).value);sync()};$(id).onchange=thumbs}
$('bg').onchange=()=>stage.className='stage '+$('bg').value;
$('pick').onclick=()=>{picking=true;status('點選畫布上的背景色。')};
$('allKey').onclick=()=>{const f=current();if(!f)return;for(const item of items){item.history.push({override:item.override.slice(),s:{...item.s},clean:item.clean});for(const k of ['key','color','tol','edge'])item.s[k]=f.s[k]}thumbs();draw();status('去背設定已套用全部，人物與文字位置仍各自保留。')};
$('clean').onclick=()=>{if(!current())return;snapshot();current().clean=true;draw();thumbs();status('已清理邊緣獨立碎圖；與角色相連的殘圖請使用橡皮擦。')};
$('undo').onclick=()=>{const f=current(),h=f?.history.pop();if(h){Object.assign(f,h);sync();thumbs()}};
$('reset').onclick=()=>{if(!current())return;snapshot();current().s=defaults();current().override.fill(0);current().clean=false;sync();thumbs()};
function point(e){const r=stage.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
function brush(p){const f=current(),s=f.s,k=s.scale/100,x=(p.x-W/2-s.x)/k+W/2,y=(p.y-H/2-s.y)/k+H/2,r=Number($('brush').value)/2/k;for(let yy=Math.max(0,Math.floor(y-r));yy<Math.min(H,y+r);yy++)for(let xx=Math.max(0,Math.floor(x-r));xx<Math.min(W,x+r);xx++)if((xx-x)**2+(yy-y)**2<=r*r)f.override[yy*W+xx]=$('tool').value==='erase'?1:2}
stage.onpointerdown=e=>{const f=current();if(!f)return;const p=point(e);snapshot();if(picking){const k=f.s.scale/100,x=Math.floor((p.x-W/2-f.s.x)/k+W/2),y=Math.floor((p.y-H/2-f.s.y)/k+H/2);if(x>=0&&x<W&&y>=0&&y<H){const a=f.original.data,o=(y*W+x)*4;f.s.color='#'+[a[o],a[o+1],a[o+2]].map(n=>n.toString(16).padStart(2,'0')).join('');f.s.key=true}picking=false;sync();thumbs();status('已吸取底色；可調整去背強度。');return}drag={p,last:p,x:f.s.x,y:f.s.y};stage.setPointerCapture(e.pointerId);if($('tool').value!=='move')brush(p);draw()};
stage.onpointermove=e=>{if(!drag)return;const p=point(e);if($('tool').value==='move'){current().s.x=drag.x+p.x-drag.p.x;current().s.y=drag.y+p.y-drag.p.y}else{const n=Math.ceil(Math.hypot(p.x-drag.last.x,p.y-drag.last.y)/2);for(let i=1;i<=n;i++)brush({x:drag.last.x+(p.x-drag.last.x)*i/n,y:drag.last.y+(p.y-drag.last.y)*i/n})}drag.last=p;draw()};
const stop=()=>{if(drag){drag=null;thumbs()}};stage.onpointerup=stop;stage.onpointercancel=stop;
const png=async c=>new Uint8Array(await(await new Promise(r=>c.toBlob(r,'image/png'))).arrayBuffer());
function download(data,name,type){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000)}
$('one').onclick=guard(async()=>{if(!current())throw Error('請先匯入圖片。');download(await png(render(current())),String(selected+1).padStart(2,'0')+'.png','image/png');status('已下載目前貼圖。')});
$('zip').onclick=guard(async()=>{if(!items.length)throw Error('請先匯入圖片。');status('正在打包 PNG…');const files=[];for(let i=0;i<items.length;i++)files.push([String(i+1).padStart(2,'0')+'.png',await png(render(items[i]))]);download(zip(files),'static-stickers.zip','application/zip');status(`已下載 ${items.length} 張透明 PNG（370 × 320），每張保留自己的編輯設定。`)});

// Zoom around the pointer, preserving the image point under the mouse.
let wheelAt=0,wheelItem=null;
stage.addEventListener('wheel',e=>{
 const f=current();if(!f||$('tool').value!=='move'||picking||drag||e.deltaY===0)return;
 e.preventDefault();
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?H:1);
 const old=f.s.scale,next=Math.max(30,Math.min(180,old*Math.exp(-Math.max(-100,Math.min(100,delta))*.0015)));
 if(next===old)return;
 const now=performance.now();if(wheelItem!==f||now-wheelAt>350)snapshot();wheelItem=f;wheelAt=now;
 const p=point(e),ratio=next/old;
 f.s.x=p.x-W/2-(p.x-W/2-f.s.x)*ratio;
 f.s.y=p.y-H/2-(p.y-H/2-f.s.y)*ratio;
 f.s.scale=next;sync();thumbs();
},{passive:false});
function cursor(){stage.style.cursor=$('tool').value==='move'?'grab':'crosshair'}
$('tool').addEventListener('change',cursor);cursor();

bindUndoShortcut(()=>{if(drag){drag=null;thumbs();}$('undo').click()});
