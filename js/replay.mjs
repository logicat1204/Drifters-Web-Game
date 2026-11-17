// Compact lossless stream of the controls actually used by each fixed physics tick.
export class RunRecorder {
  constructor(){this.frames=[];this.actions=0;this.ticks=0;}
  action(bit){this.actions|=bit;}
  capture(r,input){const steer=Math.round(input.steer*1000)/1000,flags=Number(!!input.throttle)|(Number(!!input.brake)<<1)|(Number(!!input.handbrake)<<2)|(Number(r.headlights)<<3),actions=this.actions;this.actions=0;
    const last=this.frames.at(-1);if(last&&!actions&&!last[4]&&last[1]===steer&&last[2]===flags&&last[3]===r.gear)last[0]++;else this.frames.push([1,steer,flags,r.gear,actions]);this.ticks++;return {...input,steer};
  }
}

export async function runSubmission(id,frames){
  const body=JSON.stringify({id,frames});
  if(body.length>=65536&&typeof CompressionStream==='function'){
    try{
      const compressed=new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'));
      return {body:await new Response(compressed).blob(),headers:{'Content-Encoding':'gzip'}};
    }catch{
      // Keep the JSON upload available on browsers with incomplete gzip support.
    }
  }
  return {body};
}
