import {focusType} from './focus.mjs';
export class CornerEffects {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.time=0;this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)');}
  draw(r,visible,dt,motion=true){
    const canvas=this.canvas;canvas.classList.toggle('hidden',!visible);if(!visible||!r)return;
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(window.devicePixelRatio||1,1.5);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const c=this.ctx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);this.time+=dt;
    const focused=r.focus?.remaining>0,theme=focusType(r),power=Math.max(r.skill.intensity,focused?.9:0);
    if(r.wet&&!this.reduced.matches&&motion){c.strokeStyle=r.fog?'#dce8f33b':'#dce8f326';c.lineWidth=1;for(let i=0;i<45;i++){const x=(i*137.7+this.time*80)%w,y=(i*77+this.time*640)%h;c.beginPath();c.moveTo(x,y);c.lineTo(x-5,y+19);c.stroke();}}
    if(power<.025||this.reduced.matches||!motion)return;
    // Keep the vanishing point and braking references unobstructed; no flashes.
    const glow=c.createRadialGradient(w*.5,h*.43,w*.27,w*.5,h*.43,w*.72);
    glow.addColorStop(0,'#3855c000');glow.addColorStop(.55,focused?theme.aura+'28':`rgba(82,95,225,${power*.16})`);glow.addColorStop(1,focused?theme.aura+'70':`rgba(95,161,245,${power*.36})`);c.fillStyle=glow;c.fillRect(0,0,w,h);
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<36;i++){
      const a=i*2.39996,phase=(this.time*(.65+power)+i*.173)%1,rad=.32+phase*.30;
      const x=w*.5+Math.cos(a)*w*rad,y=h*.43+Math.sin(a)*h*rad;
      if(x>w*.20&&x<w*.80&&y>h*.12&&y<h*.80)continue;
      c.strokeStyle=focused?(i%3?theme.color:theme.aura):i%3?'#7ee0ff':'#b795ff';c.globalAlpha=power*(1-phase)*.65;c.lineWidth=(1+power)*Math.min(1.5,w/1000);c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*w*(.02+power*.045),y+Math.sin(a)*h*(.02+power*.045));c.stroke();
    }
    if(focused&&theme.id==='drift'){
      c.globalAlpha=.40;c.strokeStyle=theme.color;c.fillStyle=theme.aura+'20';c.lineWidth=1.5;
      for(const side of [-1,1])for(let feather=0;feather<6;feather++){
        const rootX=w*.5+side*w*.06,rootY=h*.76,tipX=w*.5+side*w*(.19+feather*.023),tipY=h*(.57+feather*.025)+Math.sin(this.time*2)*h*.007;
        c.beginPath();c.moveTo(rootX,rootY);c.quadraticCurveTo(w*.5+side*w*.22,h*.73,tipX,tipY);c.quadraticCurveTo(w*.5+side*w*.13,h*.77,rootX,rootY);c.fill();c.stroke();
      }
    }
    c.restore();
  }
}
