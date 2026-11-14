// Measures peer links in the lobby and keeps the selected race channels open.
const SAMPLE_COUNT=30, SAMPLE_INTERVAL=100, SIGNAL_WAIT=7000, DRAIN_WAIT=1000;
const defaultIce=[{urls:'stun:stun.l.google.com:19302'}];

function createSamples(){return {sent:new Map(),received:[],count:0};}
function summary(samples){
  const sorted=[...samples.received].sort((a,b)=>a-b);
  const percentile=p=>sorted.length?Math.round(sorted[Math.ceil(p*sorted.length)-1]):null;
  return {median:percentile(.5),p95:percentile(.95),received:sorted.length,sent:samples.count};
}

export class OnlineProbe {
  constructor({send,render,iceServers=defaultIce}){
    this.send=send;
    this.render=render;
    this.iceServers=iceServers;
    this.peers=new Map();
    this.timers=new Set();
  }

  start(id,directPeers=null){
    if(this.active&&!this.finished)return;
    this.cancel(true);
    this.id=id;
    this.active=true;
    this.direct=!!directPeers;
    if(this.direct)this.setPeers(directPeers);
    else{
      this.server=createSamples();
      this.send({type:'probe-ready',ready:true});
      this.sendSample(this.server);
    }
    this.render();
    this.timer(()=>this.sample(),SAMPLE_INTERVAL,true);
    this.timer(()=>this.finish(),SIGNAL_WAIT+SAMPLE_COUNT*SAMPLE_INTERVAL+DRAIN_WAIT);
  }

  timer(action,delay,repeat=false){
    const id=repeat?setInterval(action,delay):setTimeout(action,delay);
    this.timers.add(id);
  }

  cancel(notify=false){
    if(this.active&&notify&&!this.direct)this.send({type:'probe-ready',ready:false});
    this.active=false;
    this.finished=false;
    for(const id of this.timers)clearTimeout(id);
    this.timers.clear();
    for(const peer of this.peers.values())peer.pc?.close();
    this.peers.clear();
    this.server=null;
  }

  finish(){
    if(!this.active)return;
    this.finished=true;
    this.render();
    if(this.direct)return;
    // Peers who clicked later can still receive replies while they finish.
    this.timer(()=>this.cancel(true),4000);
  }

  report(){
    return {active:this.active&&!this.finished,server:this.server&&summary(this.server),peers:[...this.peers.values()].map(peer=>({id:peer.id,status:peer.status,...summary(peer.samples)}))};
  }

  receive(message){
    if(!this.active)return;
    if(message.type==='probe-peers')this.setPeers(message.peers);
    if(message.type==='probe-signal')this.handleSignal(message);
    if(message.type==='probe-pong')this.record(this.server,message.id);
  }

  setPeers(ids){
    for(const [id,peer] of this.peers){
      if(ids.includes(id))continue;
      peer.pc?.close();
      peer.status='left';
    }
    for(const id of ids){
      const previous=this.peers.get(id);
      if(id===this.id||(previous&&previous.status!=='left'))continue;
      const peer={id,samples:createSamples(),status:'connecting',candidates:[],signals:Promise.resolve()};
      this.peers.set(id,peer);
      try{
        const pc=peer.pc=new RTCPeerConnection({iceServers:this.iceServers});
        pc.onicecandidate=({candidate})=>{if(candidate)this.signal(peer,'ice',JSON.stringify(candidate.toJSON()));};
        pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')this.fail(peer);};
        pc.ondatachannel=({channel})=>this.bindChannel(peer,channel);
        if(this.id<id){
          this.bindChannel(peer,pc.createDataChannel('touge-probe',{ordered:false,maxRetransmits:0}));
          if(this.direct)this.bindChannel(peer,pc.createDataChannel('touge-actions'));
          this.enqueue(peer,()=>this.describe(peer,'offer',pc.createOffer()));
        }
      }catch{this.fail(peer);}
    }
    this.render();
  }

  current(peer){return this.active&&this.peers.get(peer.id)===peer&&peer.status!=='left'&&peer.status!=='failed';}

  fail(peer){
    if(!this.current(peer))return;
    peer.status='failed';
    peer.pc?.close();
    this.render();
  }

  enqueue(peer,work){
    peer.signals=peer.signals.then(()=>{if(this.current(peer))return work();}).catch(()=>this.fail(peer));
  }

  signal(peer,kind,value){if(this.current(peer))this.send({type:'probe-signal',to:peer.id,kind,value});}

  async describe(peer,kind,pending){
    const description=await pending;
    if(!this.current(peer))return;
    await peer.pc.setLocalDescription(description);
    this.signal(peer,kind,description.sdp);
  }

  handleSignal({from,kind,value}){
    const peer=this.peers.get(from);
    if(!peer?.pc)return;
    this.enqueue(peer,async()=>{
      const pc=peer.pc;
      if(kind==='ice'){
        const candidate=JSON.parse(value);
        if(pc.remoteDescription)await pc.addIceCandidate(candidate);
        else if(peer.candidates.length<24)peer.candidates.push(candidate);
        return;
      }
      if((kind==='offer')!==(from<this.id))return;
      await pc.setRemoteDescription({type:kind,sdp:value});
      for(const candidate of peer.candidates)await pc.addIceCandidate(candidate);
      peer.candidates=[];
      if(kind==='offer')await this.describe(peer,'answer',pc.createAnswer());
    });
  }

  bindChannel(peer,channel){
    if(this.direct&&channel.label==='touge-actions'&&!peer.actions){
      peer.actions=channel;
      channel.onmessage=({data})=>{
        if(this.current(peer)&&this.finished&&typeof data==='string'&&data.length<=512)this.onRaceMessage?.(peer.id,data);
      };
      return;
    }
    if(channel.label!=='touge-probe'||peer.channel){channel.close();return;}
    peer.channel=channel;
    const open=()=>{if(this.current(peer)){peer.status='connected';this.render();}};
    channel.onopen=open;
    if(channel.readyState==='open')open();
    channel.onclose=()=>this.fail(peer);
    channel.onmessage=({data})=>{
      if(!this.current(peer)||typeof data!=='string')return;
      if(this.direct&&this.finished&&data.startsWith('{')&&data.length<=24000){
        this.onRaceMessage?.(peer.id,data);
        return;
      }
      if(!/^([pq]):\d{1,2}$/.test(data))return;
      if(data[0]==='p'&&channel.readyState==='open'&&channel.bufferedAmount<1024){
        try{channel.send('q'+data.slice(1));}catch{this.fail(peer);}
      }
      if(data[0]==='q')this.record(peer.samples,Number(data.slice(2)));
    };
  }

  sendRace(id,message,reliable=false){
    const peer=this.peers.get(id),channel=reliable?peer?.actions:peer?.channel;
    if(channel?.readyState!=='open'||channel.bufferedAmount>(reliable?4096:0))return false;
    try{channel.send(message);return true;}catch{return false;}
  }

  keepRacePeers(host){
    if(this.id===host)return;
    for(const peer of this.peers.values()){
      if(peer.id===host)continue;
      peer.status='left';
      peer.pc?.close();
    }
  }

  sendSample(samples,channel){
    const id=samples.count++;
    samples.sent.set(id,performance.now());
    if(!channel)this.send({type:'probe-ping',id});
    else if(channel.bufferedAmount<1024&&channel.readyState==='open')channel.send('p:'+id);
  }

  record(samples,id){
    if(!samples.sent.has(id))return;
    samples.received.push(performance.now()-samples.sent.get(id));
    samples.sent.delete(id);
  }

  sample(){
    if(this.finished)return;
    if(this.server&&this.server.count<SAMPLE_COUNT)this.sendSample(this.server);
    for(const peer of this.peers.values()){
      if(peer.status==='connected'&&peer.samples.count<SAMPLE_COUNT){
        try{this.sendSample(peer.samples,peer.channel);}catch{this.fail(peer);}
      }
    }
    this.render();
  }
}
