import numpy as np, math
from PIL import Image
OUT='../textures/sky'
W,H=2048,1024
def pnoise(w,h,scale,seed):
    a=np.random.default_rng(seed).standard_normal((h,w)); ky=np.fft.fftfreq(h)[:,None]; kx=np.fft.fftfreq(w)[None,:]
    b=np.real(np.fft.ifft2(np.fft.fft2(a)*np.exp(-((kx**2+ky**2)*scale**2)))); return (b-b.min())/(b.max()-b.min())
def fbm(w,h,base,oct,seed):
    t=0;amp=1;s=0
    for i in range(oct): t=t+amp*pnoise(w,h,base/(2**i),seed+i); s+=amp; amp*=.5
    return t/s
# direccion por pixel equirect (convencion three.js: u=atan2(z,x)/2pi+.5, v=asin(y)/pi+.5)
u=(np.arange(W)+.5)/W; v=1-(np.arange(H)+.5)/H
phi=(u[None,:]-.5)*2*math.pi; th=(v[:,None]-.5)*math.pi
DX=np.cos(th)*np.cos(phi); DY=np.sin(th)*np.ones((1,W)); DZ=np.cos(th)*np.sin(phi)
def mix(a,b,t): return a+(b-a)*t[...,None]
def ridge(seed,amp,freq):
    r=np.random.default_rng(seed); x=np.arange(W)/W*2*math.pi; y=np.zeros(W)
    for k in range(1,9): y+=r.random()/k**1.2*np.sin(k*freq*x+r.random()*6.28)
    y=(y-y.min())/(y.max()-y.min()); return y*amp   # elevacion (radianes)
def sky(kind):
    el=DY  # sin(elevacion)
    lat=np.arcsin(np.clip(DY,-1,1))
    P={'day':dict(top=(46,104,214),hor=(190,218,244),gnd=(110,130,120),sun=(.5,.45),sunc=(1,.96,.85),cl=(255,255,255),cth=.52,mt=(104,132,160)),
       'sunset':dict(top=(32,40,100),hor=(255,150,84),gnd=(60,50,60),sun=(.62,.04),sunc=(1,.7,.4),cl=(255,170,130),cth=.5,mt=(74,60,92)),
       'night':dict(top=(3,5,20),hor=(34,40,86),gnd=(8,10,18),sun=(.2,.55),sunc=(.8,.85,1),cl=(48,54,90),cth=.62,mt=(10,14,24)),
       'nightrain':dict(top=(16,19,38),hor=(96,76,86),gnd=(10,11,18),sun=None,sunc=(1,1,1),cl=(70,76,104),cth=.3,mt=(12,14,22)),
       'rain':dict(top=(96,104,116),hor=(150,158,168),gnd=(70,76,80),sun=None,sunc=(1,1,1),cl=(110,118,128),cth=.3,mt=(70,86,92))}[kind]
    top,hor,gnd,mt,cl=[np.array(P[k],float)/255 for k in ('top','hor','gnd','mt','cl')]
    t=np.clip(el,0,1)**.55; a=mix(np.broadcast_to(hor,(H,W,3)).copy(),np.broadcast_to(top,(H,W,3)).copy(),t)
    below=el<0; a=np.where(below[...,None],mix(np.broadcast_to(hor*.8+gnd*.2,(H,W,3)).copy(),np.broadcast_to(gnd,(H,W,3)).copy(),np.clip(-el*3,0,1)),a)
    # sol / luna
    if P['sun']:
        su,sv=P['sun']; sp=(su-.5)*2*math.pi; st=(sv-.5)*math.pi; sx,sy,sz=math.cos(st)*math.cos(sp),math.sin(st),math.cos(st)*math.sin(sp)
        d=DX*sx+DY*sy+DZ*sz; ang=np.arccos(np.clip(d,-1,1)); sc=np.array(P['sunc'])
        disk=np.clip((0.045-ang)/.006,0,1) if kind!='night' else np.clip((0.05-ang)/.004,0,1)
        glow=np.exp(-(ang/.25)**2)*(.55 if kind!='night' else .3)+np.exp(-(ang/.08)**2)*.5
        a=a+glow[...,None]*sc*.8; a=mix(a,np.broadcast_to(sc,(H,W,3)).copy(),disk)
    # nubes (periodicas en longitud por FFT)
    c=fbm(W,H,160 if kind not in('rain','nightrain') else 90,5,7); cd=np.clip((c-P['cth'])*(3.2 if kind not in('rain','nightrain') else 5),0,1)*np.clip(el*2.2+.12,0,1)*(1 if kind!='rain' else 1.1)
    shade=np.clip(1-fbm(W,H,60,3,13)*.5,.5,1)
    a=mix(a,np.broadcast_to(cl,(H,W,3)).copy()*shade[...,None],np.clip(cd*(.9 if kind!='night' else .6),0,1))
    if kind=='night':
        r=np.random.default_rng(4); s=np.zeros((H,W)); n=2600
        ys=r.integers(0,H//2,n); xs=r.integers(0,W,n); s[ys,xs]=r.random(n)**3
        s=np.maximum(s,np.roll(s,1,1)*.6); a=a+ (s*(1-cd))[...,None]*np.array([.9,.95,1])*1.3
    # montañas lejanas
    for k,(am,fr,seed,shade_) in enumerate(((.16,3,21,1.0),(.10,5,22,.8))):
        rg=ridge(seed,am,fr)[None,:]; m=(lat<rg)&(lat>-.02)
        mc=mt*shade_; haze=np.clip(1-lat/np.maximum(rg,1e-3),0,1)**.8
        col=mix(np.broadcast_to(mc,(H,W,3)).copy(),np.broadcast_to(hor,(H,W,3)).copy(),(1-haze)*.5+(k==0)*.1)
        a=np.where(m[...,None],col,a)
    if kind in('night','nightrain'):  # resplandor de ciudad en el horizonte
        gl=np.exp(-((lat-.0)/.07)**2)*(.35+.25*np.sin(np.arctan2(DZ,DX)*3)); a=a+gl[...,None]*np.array([.7,.45,.2])*.6
    # niebla de horizonte
    hz=np.exp(-(np.abs(lat)/.05)**2); a=mix(a,np.broadcast_to(hor,(H,W,3)).copy(),hz*(.5 if kind not in('rain','nightrain') else .7))
    return np.clip(a,0,1)
def faces(eq):
    S=1024; g=(np.arange(S)+.5)/S*2-1; U,V=np.meshgrid(g,g)
    D={'px':(np.ones_like(U),-V,-U),'nx':(-np.ones_like(U),-V,U),'py':(U,np.ones_like(U),V),'ny':(U,-np.ones_like(U),-V),'pz':(U,-V,np.ones_like(U)),'nz':(-U,-V,-np.ones_like(U))}
    out={}
    for k,(x,y,z) in D.items():
        n=np.sqrt(x*x+y*y+z*z); x,y,z=x/n,y/n,z/n
        uu=(np.arctan2(z,x)/(2*math.pi)+.5)*W-.5; vv=(1-(np.arcsin(np.clip(y,-1,1))/math.pi+.5))*H-.5
        x0=np.floor(uu).astype(int); y0=np.clip(np.floor(vv).astype(int),0,H-2); fx=(uu-x0)[...,None]; fy=(vv-y0)[...,None]
        x0%=W; x1=(x0+1)%W
        px=lambda yy,xx: eq[yy,xx]
        out[k]=(px(y0,x0)*(1-fx)*(1-fy)+px(y0,x1)*fx*(1-fy)+px(y0+1,x0)*(1-fx)*fy+px(y0+1,x1)*fx*fy)
    return out
for kind in ('nightrain',):
    eq=sky(kind); Image.fromarray((eq*255).astype('uint8')).save(f'{OUT}/sky_{kind}_equirect.jpg',quality=88)
    for k,f in faces(eq).items(): Image.fromarray((np.clip(f,0,1)*255).astype('uint8')).save(f'{OUT}/sky_{kind}_{k}.jpg',quality=88)
    print(kind,'ok')
