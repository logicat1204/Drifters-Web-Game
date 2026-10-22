export class CornerEffects {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.time=0;this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)');}
  draw(r,visible,dt,motion=true){
    const canvas=this.canvas;canvas.classList.toggle('hidden',!visible);if(!visible||!r)return;
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(window.devicePixelRatio||1,1.5);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const c=this.ctx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);this.time+=dt;
    const focused=r.focus?.remaining>0,power=Math.max(r.skill.intensity,focused?.9:0);if(power<.025||this.reduced.matches||!motion)return;
    // Keep the vanishing point and braking references unobstructed; no flashes.
    const glow=c.createRadialGradient(w*.5,h*.43,w*.27,w*.5,h*.43,w*.72);
    glow.addColorStop(0,'#3855c000');glow.addColorStop(.55,focused?`rgba(70,203,190,${power*.17})`:`rgba(82,95,225,${power*.16})`);glow.addColorStop(1,focused?`rgba(157,232,191,${power*.38})`:`rgba(95,161,245,${power*.36})`);c.fillStyle=glow;c.fillRect(0,0,w,h);
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<36;i++){
      const a=i*2.39996,phase=(this.time*(.65+power)+i*.173)%1,rad=.32+phase*.30;
      const x=w*.5+Math.cos(a)*w*rad,y=h*.43+Math.sin(a)*h*rad;
      if(x>w*.20&&x<w*.80&&y>h*.12&&y<h*.80)continue;
      c.strokeStyle=i%3?`rgba(126,224,255,${power*(1-phase)*.65})`:`rgba(183,149,255,${power*(1-phase)*.60})`;c.lineWidth=(1+power)*Math.min(1.5,w/1000);c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*w*(.02+power*.045),y+Math.sin(a)*h*(.02+power*.045));c.stroke();
    }
    c.restore();
  }
}
