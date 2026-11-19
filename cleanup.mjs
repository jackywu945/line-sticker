// Remove small disconnected pieces that intersect a grid cell's cut boundary.
// Interior details (including detached bubbles) and large components stay intact.
export function clearEdgeFragments(image,bounds){
 const {width:w,height:h,data}=image,seen=new Uint8Array(w*h),components=[];
 for(let seed=0;seed<w*h;seed++){
  if(seen[seed]||data[seed*4+3]<8)continue;
  const pixels=[seed];seen[seed]=1;let edge=false;
  for(let head=0;head<pixels.length;head++){
   const p=pixels[head],x=p%w,y=Math.floor(p/w);
   if(x<=bounds.x+2||x>=bounds.x+bounds.w-3||y<=bounds.y+2||y>=bounds.y+bounds.h-3)edge=true;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;
    const q=ny*w+nx;if(!seen[q]&&data[q*4+3]>=8){seen[q]=1;pixels.push(q)}
   }
  }
  components.push({pixels,edge});
 }
 const largest=components.reduce((n,c)=>Math.max(n,c.pixels.length),0);let removed=0;
 for(const c of components)if(c.edge&&c.pixels.length<largest*.1){
  for(const p of c.pixels){
   const x=p%w,y=Math.floor(p/w);data.fill(0,p*4,p*4+4);
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;
    const q=(ny*w+nx)*4;if(data[q+3]<8)data.fill(0,q,q+4);
   }
  }removed++;
 }
 return removed;
}
