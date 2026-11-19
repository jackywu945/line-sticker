import {apng,concat,u32,chunk} from './codec.mjs';

const signature=new Uint8Array([137,80,78,71,13,10,26,10]);
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c}

async function framePNG(frame,rect){
 const {data,width}=frame,{x,y,w,h}=rect,stride=w*4,raw=new Uint8Array((stride+1)*h);
 let previous=new Uint8Array(stride);
 for(let row=0;row<h;row++){
  const start=((y+row)*width+x)*4,current=data.subarray(start,start+stride);
  let best=null,bestScore=Infinity,bestType=0;
  for(let type=0;type<5;type++){
   const filtered=new Uint8Array(stride);let score=0;
   for(let i=0;i<stride;i++){
    const a=i>=4?current[i-4]:0,b=previous[i],c=i>=4?previous[i-4]:0;
    const predictor=type===0?0:type===1?a:type===2?b:type===3?Math.floor((a+b)/2):paeth(a,b,c);
    const value=(current[i]-predictor)&255;filtered[i]=value;score+=Math.min(value,256-value);
   }
   if(score<bestScore){bestScore=score;best=filtered;bestType=type}
  }
  const offset=row*(stride+1);raw[offset]=bestType;raw.set(best,offset+1);previous=current;
 }
 const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
 const compressed=new Uint8Array(await new Response(stream).arrayBuffer());
 return concat(signature,chunk('IHDR',concat(u32(w),u32(h),new Uint8Array([8,6,0,0,0]))),chunk('IDAT',compressed),chunk('IEND',new Uint8Array()));
}

// SOURCE blending replaces changed pixels, including pixels that become transparent.
// NONE disposal keeps the unchanged area from the preceding frame intact.
export async function optimizedAPNG(frames,ms,loops){
 if(!frames.length)throw Error('沒有畫格。');
 const {width,height}=frames[0],rects=[],pngs=[];
 for(let n=0;n<frames.length;n++){
  const frame=frames[n];
  if(frame.width!==width||frame.height!==height||frame.data.length!==width*height*4)throw Error('畫格尺寸不一致。');
  let rect={x:0,y:0,w:width,h:height};
  if(n){
   const prev=frames[n-1].data;let minX=width,minY=height,maxX=-1,maxY=-1;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    if(frame.data[i]!==prev[i]||frame.data[i+1]!==prev[i+1]||frame.data[i+2]!==prev[i+2]||frame.data[i+3]!==prev[i+3]){
     minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    }
   }
   rect=maxX<0?{x:0,y:0,w:1,h:1}:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
  }
  rects.push(rect);pngs.push(await framePNG(frame,rect));
 }
 return apng(pngs,ms,loops,rects);
}
