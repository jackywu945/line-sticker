// 畫格穩定：每一格對準第一格，同時校正位置、角度與大小（相似變換）。
// 比對時每個像素的差異有上限（揮動的手、變化的表情不會把整體拉走），
// 所以會以「不動的身體」為準。

// 舊版只平移的函式保留，以免其他地方仍有引用。
export function estimateShift(reference,current,width=320,height=270,range=60){
 const points=[];
 for(let y=Math.round(height*.16);y<height*.43;y+=3)for(let x=Math.round(width*.39);x<width*.61;x+=3){const i=(y*width+x)*4;if(reference[i+3]>180)points.push([x,y,reference[i],reference[i+1],reference[i+2],reference[i+3]])}
 if(points.length<25)return {x:0,y:0,error:0};
 let best={x:0,y:0,error:Infinity};
 for(let dy=-range;dy<=range;dy++)for(let dx=-range;dx<=range;dx++){
  let sum=0;for(const [x,y,r,g,b,a] of points){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=width||yy>=height){sum+=1020;continue}const i=(yy*width+xx)*4;sum+=Math.abs(current[i]-r)+Math.abs(current[i+1]-g)+Math.abs(current[i+2]-b)+2*Math.abs(current[i+3]-a)}
  const error=sum/points.length+(Math.abs(dx)+Math.abs(dy))*.025;
  if(error<best.error)best={x:-dx,y:-dy,error};
 }
 return best;
}

// 把 RGBA 轉成「亮度＋不透明度」兩個通道，並建立 1、1/2、1/4 三層縮圖。
function planes(data,w,h){
 const L=new Float32Array(w*h),A=new Float32Array(w*h);
 for(let i=0,p=0;p<w*h;p++,i+=4){const a=data[i+3];A[p]=a;L[p]=a<8?0:(0.299*data[i]+0.587*data[i+1]+0.114*data[i+2])*(a/255)}
 const levels=[{L,A,w,h}];
 for(let k=0;k<2;k++){const s=levels[levels.length-1],nw=s.w>>1,nh=s.h>>1,nL=new Float32Array(nw*nh),nA=new Float32Array(nw*nh);
  for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){const a=(2*y)*s.w+2*x,b=a+1,c=a+s.w,d=c+1,o=y*nw+x;nL[o]=(s.L[a]+s.L[b]+s.L[c]+s.L[d])/4;nA[o]=(s.A[a]+s.A[b]+s.A[c]+s.A[d])/4}
  levels.push({L:nL,A:nA,w:nw,h:nh})}
 return levels;
}
function bilinear(arr,w,h,x,y){
 if(x<0||y<0||x>w-1||y>h-1)return -1;
 const x0=x|0,y0=y|0,x1=Math.min(x0+1,w-1),y1=Math.min(y0+1,h-1),fx=x-x0,fy=y-y0;
 return (arr[y0*w+x0]*(1-fx)+arr[y0*w+x1]*fx)*(1-fy)+(arr[y1*w+x0]*(1-fx)+arr[y1*w+x1]*fx)*fy;
}
// 參數 p={tx,ty,rot,scale}：第一格的點 q 對應到這一格的位置 = 中心 + scale·旋轉(q−中心) + 位移。
function cost(ref,cur,pts,p,f){
 const cx=ref.w/2,cy=ref.h/2,c=Math.cos(p.rot)*p.scale,s=Math.sin(p.rot)*p.scale,tx=p.tx*f,ty=p.ty*f;
 let sum=0;
 for(let k=0;k<pts.length;k++){const q=pts[k],x=q%ref.w,y=(q/ref.w)|0,dx=x-cx,dy=y-cy;
  const X=cx+c*dx-s*dy+tx,Y=cy+s*dx+c*dy+ty;
  let d;const l=bilinear(cur.L,cur.w,cur.h,X,Y);
  if(l<0)d=CAP;else{const a=bilinear(cur.A,cur.w,cur.h,X,Y);d=Math.min(CAP,Math.abs(ref.L[q]-l)+Math.abs(ref.A[q]-a))}
  sum+=d}
 return sum/Math.max(1,pts.length);
}
// 每個像素的差異最多只算 CAP：揮動的手、變化的表情怎麼對都對不上，封頂後就不會把整體拉走。
const CAP=60;
// 取樣範圍＝角色外框再往外多一圈（含透明處），這樣「縮小」或「放大」對不上時都會被扣分。
function samplePoints(lv,step){let x0=lv.w,y0=lv.h,x1=-1,y1=-1;for(let y=0;y<lv.h;y++)for(let x=0;x<lv.w;x++)if(lv.A[y*lv.w+x]>40){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
 if(x1<0)return [];const m=Math.round(lv.w*.05);x0=Math.max(0,x0-m);y0=Math.max(0,y0-m);x1=Math.min(lv.w-1,x1+m);y1=Math.min(lv.h-1,y1+m);
 const pts=[];for(let y=y0;y<=y1;y+=step)for(let x=x0;x<=x1;x+=step)pts.push(y*lv.w+x);return pts}

export function estimateSimilarity(refData,curData,w=320,h=270,range=64){
 const R=planes(refData,w,h),C=planes(curData,w,h);
 // 第一步：最小縮圖上找大概位置（只平移）。
 let lv=2,f=1/4,pts=samplePoints(R[lv],1);
 if(pts.length<30)return {tx:0,ty:0,rot:0,scale:1};
 let best={tx:0,ty:0,rot:0,scale:1},bestCost=cost(R[lv],C[lv],pts,best,f);
 const r=Math.round(range*f);
 for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const p={tx:dx/f,ty:dy/f,rot:0,scale:1},e=cost(R[lv],C[lv],pts,p,f);if(e<bestCost){bestCost=e;best=p}}
 // 第二步：由粗到細，逐一微調位移、角度、大小。
 const limits={rot:6*Math.PI/180,scale:[.85,1.15]};
 for(const [L,F,step,t0] of [[2,1/4,1,4],[1,1/2,1,2],[0,1,2,1]]){
  pts=samplePoints(R[L],step);let e=cost(R[L],C[L],pts,best,F);
  let st={tx:t0,ty:t0,rot:1.5*Math.PI/180,scale:.03};
  for(let iter=0;iter<40;iter++){let improved=false;
   for(const k of ['tx','ty','rot','scale'])for(const sg of [1,-1]){const p={...best};p[k]+=sg*st[k];
    if(Math.abs(p.rot)>limits.rot||p.scale<limits.scale[0]||p.scale>limits.scale[1]||Math.abs(p.tx)>range||Math.abs(p.ty)>range)continue;
    const ee=cost(R[L],C[L],pts,p,F);if(ee<e){e=ee;best=p;improved=true}}
   if(!improved){st={tx:st.tx/2,ty:st.ty/2,rot:st.rot/2,scale:st.scale/2};if(st.tx<.25&&st.scale<.002)break}}
 }
 return best;
}

// 依照估算結果把這一格「搬回」第一格的位置，輸出新的 ImageData。
export function warpFrame(curData,p,w=320,h=270){
 const out=new ImageData(w,h),o=out.data,cx=w/2,cy=h/2,c=Math.cos(p.rot)*p.scale,s=Math.sin(p.rot)*p.scale;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=x-cx,dy=y-cy,X=cx+c*dx-s*dy+p.tx,Y=cy+s*dx+c*dy+p.ty;
  if(X<0||Y<0||X>w-1||Y>h-1)continue;
  const x0=X|0,y0=Y|0,x1=Math.min(x0+1,w-1),y1=Math.min(y0+1,h-1),fx=X-x0,fy=Y-y0,i=(y*w+x)*4;
  const w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
  const i00=(y0*w+x0)*4,i10=(y0*w+x1)*4,i01=(y1*w+x0)*4,i11=(y1*w+x1)*4;
  // 以不透明度加權混色，避免透明邊緣出現黑邊。
  const a00=curData[i00+3]*w00,a10=curData[i10+3]*w10,a01=curData[i01+3]*w01,a11=curData[i11+3]*w11,A=a00+a10+a01+a11;
  if(A<=0)continue;
  for(let ch=0;ch<3;ch++)o[i+ch]=(curData[i00+ch]*a00+curData[i10+ch]*a10+curData[i01+ch]*a01+curData[i11+ch]*a11)/A;
  o[i+3]=A}
 return out;
}
