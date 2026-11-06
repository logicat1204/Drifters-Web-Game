const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Family voicing is an arcade interpretation, not an authentic recording of each model.
const ROTARY=new Set(['rx7','rx7fc','rx7amemiya']),SIX=new Set(['r32','r34','supra','grsupra','gt3rs','cayman','a110']),EIGHT=new Set(['r8','ferrari488']);
export function engineFamily(id){return ROTARY.has(id)?'rotary':EIGHT.has(id)?'exotic':SIX.has(id)?'six':'four';}
const profiles={four:{pitch:1.08,cutoff:3300,body:.27},rotary:{pitch:1.24,cutoff:4200,body:.13},six:{pitch:.83,cutoff:2700,body:.40},exotic:{pitch:.94,cutoff:3800,body:.50}};
export function drivingMix(r,input={},interior=false){
 const speed=clamp(Number(r?.speed)||0,0,110),rpm=clamp(((Number(r?.rpm)||1000)-900)/8500,0,1),slip=clamp(Math.max(Number(r?.drift)||0,(Number(r?.understeer)||0)*.65),0,1),throttle=clamp(Number(input.throttle)||0,0,1),wet=!!r?.wet;
 return {rpm,load:.48+throttle*.52,tires:clamp((speed-9)/15,0,1)*slip*(wet?.70:1),brake:input.brake?clamp((speed-15)/38,0,1)*(1-slip*.55):0,wind:(speed/85)**2*(interior?.45:1),rain:wet?(interior?.46:1):0,interior};
}
export class DrivingAudio {
 constructor(ctx,output){
  this.ctx=ctx;this.output=output;this.status='loading';this.voices=[];this.buffers=[];this.error=null;
  this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(output);
  const noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=noise.getChannelData(0);let brown=0;for(let i=0;i<data.length;i++){brown=(brown+Math.random()*.08-.04)*.985;data[i]=brown*.55+(Math.random()*2-1)*.12;}
  this.noise=noise;this.tires=this.noiseLayer('bandpass',1250,.45);this.brakes=this.noiseLayer('bandpass',820,1.8);this.rain=this.noiseLayer('lowpass',2200,.5);this.wind=this.noiseLayer('lowpass',400,.6);
  this.player=this.voice(false);this.rivals=Array.from({length:3},()=>this.voice(true));
  this.ready=this.load();
 }
 noiseLayer(type,hz,q){const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();source.buffer=this.noise;source.loop=true;filter.type=type;filter.frequency.value=hz;filter.Q.value=q;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start();return {gain,filter};}
 voice(spatial){const ctx=this.ctx,gain=ctx.createGain(),filter=ctx.createBiquadFilter(),panner=ctx.createStereoPanner();gain.gain.value=0;filter.type='lowpass';filter.Q.value=.55;filter.frequency.value=3000;filter.connect(gain);gain.connect(panner);panner.connect(this.master);const body=ctx.createOscillator(),bodyGain=ctx.createGain();body.type='triangle';bodyGain.gain.value=.06;body.connect(bodyGain);bodyGain.connect(filter);body.start();const voice={gain,filter,panner,body,bodyGain,loops:[],spatial};this.voices.push(voice);return voice;}
 async load(){
  try{const response=await fetch('/assets/audio/engines/bank.json');if(!response.ok)throw Error('Banco de audio no disponible');const bank=await response.json();
   this.buffers=await Promise.all(bank.loops.slice(0,4).map(async file=>{if(!/^\/assets\/audio\/engines\/[a-z0-9.-]+$/i.test(file))throw Error('Ruta de audio inválida');const response=await fetch(file);if(!response.ok)throw Error('Muestra no disponible');const b=await this.ctx.decodeAudioData(await response.arrayBuffer());
    // Gentle loop boundary crossfade and fixed headroom; no hard clipping or per-frame work.
    const result=this.ctx.createBuffer(b.numberOfChannels,b.length,b.sampleRate),fade=Math.min(Math.floor(b.sampleRate*.018),b.length>>3);let peak=0,sum=0;
    for(let ch=0;ch<b.numberOfChannels;ch++){const d=result.getChannelData(ch);d.set(b.getChannelData(ch));for(let i=0;i<fade;i++){const t=i/fade;d[d.length-fade+i]=d[d.length-fade+i]*(1-t)+d[i]*t;}for(const v of d){peak=Math.max(peak,Math.abs(v));sum+=v*v;}}
    const rms=Math.sqrt(sum/(b.length*b.numberOfChannels)),scale=Math.min(4,.17/Math.max(.001,rms),.75/Math.max(.001,peak));for(let ch=0;ch<result.numberOfChannels;ch++){const d=result.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]*=scale;}return result;}));
   for(const voice of this.voices)for(const buffer of this.buffers){const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;source.loop=true;source.loopStart=.018;source.loopEnd=buffer.duration;gain.gain.value=0;source.connect(gain);gain.connect(voice.filter);source.start();voice.loops.push({source,gain});}this.status='recordings';
  }catch(error){this.status='fallback';this.error=error.message;}
 }
 tone(voice,id,rpm,volume,pan=0,interior=false,load=.7){const ctx=this.ctx,t=ctx.currentTime,p=profiles[engineFamily(id)],x=clamp(rpm,0,1);
  voice.gain.gain.setTargetAtTime(volume,t,.09);voice.panner.pan.setTargetAtTime(clamp(pan,-.9,.9),t,.12);voice.filter.frequency.setTargetAtTime((interior?.56:1)*(650+p.cutoff*x),t,.12);voice.body.frequency.setTargetAtTime((35+x*105)*p.pitch,t,.07);voice.bodyGain.gain.setTargetAtTime((this.buffers.length?p.body*.10:.18)*load,t,.12);
  const weights=[clamp(1-x*2.5,0,1),Math.max(0,1-Math.abs(x-.48)*2.1),clamp((x-.40)/.60,0,1)],total=Math.max(1,Math.hypot(...weights));
  voice.loops.forEach(({source,gain},i)=>{gain.gain.setTargetAtTime((i===3?p.body:weights[i]/total*.72)*load,t,.11);source.playbackRate.setTargetAtTime(p.pitch*([.85,.85,.8,.65][i]+x*[.7,.48,.45,.7][i]),t,.075);});
 }
 update(r,active,settings,input={}){const t=this.ctx.currentTime;this.master.gain.setTargetAtTime(active?1:0,t,.045);if(!active||!r)return;
  const mix=drivingMix(r,input,Number(settings.camera)===3),engine=clamp((Number(settings.engineVolume)||0)/100,0,1),tires=clamp((Number(settings.tireVolume??35)||0)/100,0,1),weather=clamp((Number(settings.weatherVolume??35)||0)/100,0,1);
  this.tone(this.player,r.car.id,mix.rpm,engine*.55,0,mix.interior,mix.load);
  this.tires.gain.gain.setTargetAtTime(tires*mix.tires*.17,t,.16);this.tires.filter.frequency.setTargetAtTime((mix.interior?.75:1)*(900+mix.rpm*800),t,.15);
  this.brakes.gain.gain.setTargetAtTime(tires*mix.brake*.095,t,.14);this.rain.gain.gain.setTargetAtTime(weather*mix.rain*.22,t,.3);this.wind.gain.gain.setTargetAtTime(engine*mix.wind*.15,t,.15);
  const opponents=(r.online?r.netOpponents||[]:r.mode==='time'?[]:[{s:r.rivalS,lateral:r.rivalLateral,speed:r.rivalSpeed,carId:r.rival?.car}]).filter(o=>Math.abs(o.s-r.s)<100).sort((a,b)=>Math.abs(a.s-r.s)-Math.abs(b.s-r.s));
  this.rivals.forEach((voice,i)=>{const o=opponents[i];if(!o){voice.gain.gain.setTargetAtTime(0,t,.12);return;}const distance=Math.hypot(o.s-r.s,(o.lateral||0)-r.lateral),v=clamp((o.speed||0)/75,0,1),pan=((o.lateral||0)-r.lateral)/5;this.tone(voice,o.carId||'ae86',v,engine*.18/(1+(distance/12)**2),pan,mix.interior,.75);});
  this.mix=mix;
 }
 silence(){this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.04);}
 get diagnostics(){return {status:this.status,error:this.error,voices:this.voices.length,loops:this.voices.reduce((n,v)=>n+v.loops.length,0),buffers:this.buffers.length,level:this.master.gain.value,mix:this.mix||null};}
}
