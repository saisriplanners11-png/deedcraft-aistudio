import { expect, it } from 'vitest';
import { directionRegion } from './plan-regions';
it('proposes a nearby circular source mark without changing its strokes',()=>{
 const w=400,h=600,gray=new Uint8Array(w*h).fill(245);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(Math.abs(Math.hypot(x-340,y-270)-16)<1.5)gray[y*w+x]=20;
 const before=gray.slice();
 const region=directionRegion(gray,w,h,[650,400,100,100]);
 expect(region).not.toBeNull();
 expect(region![0]).toBeLessThan(810);expect(region![0]+region![2]).toBeGreaterThan(890);
 expect(region![1]).toBeLessThan(424);expect(region![1]+region![3]).toBeGreaterThan(476);
 expect(gray).toEqual(before);
});
it('returns no direction mark for a blank page or small text-like dots',()=>{
 const gray=new Uint8Array(400*600).fill(245);gray[270*400+340]=0;
 expect(directionRegion(gray,400,600,[650,400,100,100])).toBeNull();
});
