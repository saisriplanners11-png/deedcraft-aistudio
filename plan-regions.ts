/** Propose a source crop for a small circular direction mark near an AI hint.
 * This detects source ink only. The proposal still requires AI source verification.
 */
export function directionRegion(gray: ArrayLike<number>, width: number, height: number, hint: number[]): number[] | null {
  if(hint.length !== 4 || !hint.every(Number.isFinite)) return null;
  const integral = new Float64Array((width+1)*(height+1));
  for(let y=0;y<height;y++) { let sum=0; for(let x=0;x<width;x++) {sum+=gray[y*width+x];integral[(y+1)*(width+1)+x+1]=integral[y*(width+1)+x+1]+sum;} }
  const ink=new Uint8Array(width*height);
  const top=Math.max(0,Math.floor((hint[1]-hint[3])*height/1000)),bottom=Math.min(height,Math.ceil((hint[1]+2*hint[3])*height/1000));
  for(let y=top;y<bottom;y++) for(let x=0;x<width;x++) {
    const l=Math.max(0,x-18),r=Math.min(width,x+19),t=Math.max(0,y-18),b=Math.min(height,y+19);
    const mean=(integral[b*(width+1)+r]-integral[t*(width+1)+r]-integral[b*(width+1)+l]+integral[t*(width+1)+l])/((r-l)*(b-t));
    ink[y*width+x]=gray[y*width+x]<mean-22 ? 1 : 0;
  }
  const queue=new Int32Array(width*height); const options:{box:number[];distance:number}[]=[];
  const min=Math.min(width,height)*.035,max=Math.min(width,height)*.16;
  for(let y=top;y<bottom;y++) for(let x=0;x<width;x++) {
    const index=y*width+x; if(!ink[index])continue;
    let head=0,tail=1,left=x,right=x,upper=y,lower=y;queue[0]=index;ink[index]=0;
    while(head<tail) {
      const current=queue[head++],cx=current%width,cy=Math.floor(current/width);
      left=Math.min(left,cx);right=Math.max(right,cx);upper=Math.min(upper,cy);lower=Math.max(lower,cy);
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
        const nx=cx+dx,ny=cy+dy;if(nx<0||nx>=width||ny<top||ny>=bottom)continue;
        const next=ny*width+nx;if(ink[next]) {ink[next]=0;queue[tail++]=next;}
      }
    }
    const w=right-left+1,h=lower-upper+1,ratio=w/h,density=tail/(w*h);
    if(w<min||h<min||w>max||h>max||ratio<.7||ratio>1.4||density<.08||density>.65)continue;
    const padding=Math.max(3,Math.round(Math.max(w,h)*.1));
    const l=Math.max(0,left-padding),t=Math.max(0,upper-padding),r=Math.min(width,right+padding+1),b=Math.min(height,lower+padding+1);
    const box=[l*1000/width,t*1000/height,(r-l)*1000/width,(b-t)*1000/height];
    options.push({box,distance:Math.hypot((left+right)/2/width*1000-(hint[0]+hint[2]/2),(upper+lower)/2/height*1000-(hint[1]+hint[3]/2))});
  }
  return options.sort((a,b)=>a.distance-b.distance)[0]?.box || null;
}
