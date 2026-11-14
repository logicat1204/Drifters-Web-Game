from glb import *
import math, numpy as np
O='../models/'; PAL=lambda i:(i%16+.5)/16
def tri(m,mat,a,b,c,out=None,uv=None):
    a,b,c=[np.array(v,float) for v in (a,b,c)]; n=np.cross(b-a,c-a); l=np.linalg.norm(n)
    if l==0: return
    n/=l
    if out is not None and np.dot(n,(a+b+c)/3-np.array(out))<0: b,c=c,b; n=-n
    m._add(mat,np.array([a,b,c]),np.array([n]*3),np.array(uv or [(0,0),(1,0),(0,1)],float),[[0,1,2]])
def quado(m,mat,a,b,c,d,out):
    tri(m,mat,a,b,c,out); tri(m,mat,a,c,d,out)
def quadup(m,mat,a,b,c,d,uv):
    a,b,c,d=[np.array(v,float) for v in (a,b,c,d)]; n=np.cross(b-a,c-a)
    if n[1]<0: a,b,c,d=a,d,c,b; uv=(uv[0],uv[3],uv[2],uv[1])
    m.quad(mat,a,b,c,d,uv)
def hip(m,mat,cx,y0,cz,w,d,h,o=.5,rl=None):
    W,D=w/2+o,d/2+o; rl=rl if rl is not None else max(w-d,.6); R1=(cx-rl/2,y0+h,cz);R2=(cx+rl/2,y0+h,cz); c=(cx,y0+h*.3,cz)
    A=(cx-W,y0,cz-D);B=(cx+W,y0,cz-D);C=(cx+W,y0,cz+D);Dd=(cx-W,y0,cz+D)
    quado(m,mat,A,B,R2,R1,c); quado(m,mat,C,Dd,R1,R2,c); tri(m,mat,Dd,A,R1,c); tri(m,mat,B,C,R2,c)
    quado(m,mat,A,Dd,C,B,(cx,y0-5,cz))
def boulder(m,mat,c,r,seed,seg=7,rings=4,sq=.75):
    rg=np.random.default_rng(abs(int(seed))); pts={}
    for j in range(rings+1):
        t=j/rings*math.pi
        for i in range(seg):
            a=i/seg*2*math.pi; k=1+rg.uniform(-.22,.22)
            if j in (0,rings) and i>0: pts[(j,i)]=pts[(j,0)]; continue
            pts[(j,i)]=(c[0]+math.sin(t)*math.cos(a)*r*k,c[1]+math.cos(t)*r*sq*k,c[2]+math.sin(t)*math.sin(a)*r*k)
    for j in range(rings):
        for i in range(seg):
            a,b,cc,d=pts[(j,i)],pts[(j,(i+1)%seg)],pts[(j+1,(i+1)%seg)],pts[(j+1,i)]
            quado(m,mat,a,b,cc,d,c)
def newm(): return M()
def save(m,n): m.save(O+n+'.glb')

class TF:
    def __init__(s,ox=0,oy=0,oz=0,yaw=0,sc=1): s.o=np.array([ox,oy,oz],float); s.c=math.cos(yaw); s.s=math.sin(yaw); s.sc=sc
    def __call__(s,p):
        x,y,z=np.array(p,float)*s.sc; return np.array([x*s.c+z*s.s,y,-x*s.s+z*s.c])+s.o
    def n(s,v):
        x,y,z=v; return np.array([x*s.c+z*s.s,y,-x*s.s+z*s.c])
def tube(m,mat,a,b,r,tf,seg=5,r2=None):
    a=np.array(a,float);b=np.array(b,float);ax=b-a;L=np.linalg.norm(ax);ax/=L
    t=np.array([1,0,0]) if abs(ax[0])<.9 else np.array([0,0,1]); u=np.cross(ax,t);u/=np.linalg.norm(u);w=np.cross(ax,u)
    r2=r if r2 is None else r2
    ring=lambda c,rr:[c+(u*math.cos(i/seg*2*math.pi)+w*math.sin(i/seg*2*math.pi))*rr for i in range(seg)]
    A=ring(a,r);B=ring(b,r2);c=(a+b)/2
    for i in range(seg):
        j=(i+1)%seg; quado(m,mat,tf(A[i]),tf(A[j]),tf(B[j]),tf(B[i]),tf(c))
def sph(m,mat,c,r,tf,seg=6,rings=4,sq=1.0):
    pts={}
    for j in range(rings+1):
        t=j/rings*math.pi
        for i in range(seg):
            if j in(0,rings) and i>0: pts[(j,i)]=pts[(j,0)]; continue
            a=i/seg*2*math.pi; pts[(j,i)]=tf((c[0]+math.sin(t)*math.cos(a)*r,c[1]+math.cos(t)*r*sq,c[2]+math.sin(t)*math.sin(a)*r))
    for j in range(rings):
        for i in range(seg): quado(m,mat,pts[(j,i)],pts[(j,(i+1)%seg)],pts[(j+1,(i+1)%seg)],pts[(j+1,i)],tf(c))
def bx(m,mat,c,s,tf):
    x,y,z=[v/2 for v in s]; cx,cy,cz=c; P=lambda i,j,k:tf((cx+i*x,cy+j*y,cz+k*z)); o=tf(c)
    for f in (((-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)),((1,-1,-1),(-1,-1,-1),(-1,1,-1),(1,1,-1)),((1,-1,1),(1,-1,-1),(1,1,-1),(1,1,1)),((-1,-1,-1),(-1,-1,1),(-1,1,1),(-1,1,-1)),((-1,1,1),(1,1,1),(1,1,-1),(-1,1,-1)),((-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1))):
        quado(m,mat,*[P(*p) for p in f],o)
SHIRT=[(.85,.2,.18),(.2,.4,.8),(.95,.95,.92),(.15,.15,.18),(.25,.6,.35),(.95,.75,.15),(.6,.3,.7),(.9,.5,.2)]
SKIN=[(.96,.8,.68),(.85,.65,.5),(.62,.44,.32)]; PANT=[(.15,.18,.3),(.2,.2,.22),(.45,.4,.32)]; HAIR=[(.08,.07,.07),(.25,.16,.1),(.5,.4,.25)]
def pmats(m):
    for i,c in enumerate(SHIRT): m.mat(f's{i}',c+(1,),rough=1)
    for i,c in enumerate(SKIN): m.mat(f'k{i}',c+(1,),rough=1)
    for i,c in enumerate(PANT): m.mat(f'p{i}',c+(1,),rough=1)
    for i,c in enumerate(HAIR): m.mat(f'h{i}',c+(1,),rough=1)
    m.mat('vest',(1,.45,.05,1),emis=(.3,.12,0)); m.mat('um',(.9,.15,.2,1),double=True); m.mat('um2',(.2,.35,.8,1),double=True); m.mat('um3',(.95,.95,.95,1),double=True)
    m.mat('cam',(.1,.1,.12,1)); m.mat('flagp',(.7,.7,.7,1)); m.mat('flagt',(1,1,1,1),tex='flag_checker.png',double=True); m.mat('flagr',(.85,.1,.12,1),double=True); m.mat('flagb',(.1,.3,.8,1),double=True)
def person(m,x,z,yaw,pose,rg,sc=1.0,y0=0):
    tf=TF(x,y0,z,yaw,sc); sh=f's{rg.integers(0,8)}'; k=f'k{rg.integers(0,3)}'; p=f'p{rg.integers(0,3)}'; h=f'h{rg.integers(0,3)}'
    if pose=='sit':
        for sx in(-.1,.1): tube(m,p,(sx,.5,0),(sx,.5,.4),.075,tf); tube(m,p,(sx,.5,.4),(sx,.05,.45),.07,tf)
        base=.5
    elif pose=='photo':
        for sx in(-.12,.12): tube(m,p,(sx,.85,0),(sx*1.3,.4,.15),.08,tf); tube(m,p,(sx*1.3,.4,.15),(sx*1.3,0,.0),.07,tf)
        base=.8
    else:
        for sx in(-.1,.1): tube(m,p,(sx,.9,0),(sx,0,0),.08,tf,r2=.065)
        base=.9
    tube(m,sh,(0,base,0),(0,base+.55,0),.19,tf,seg=6,r2=.17)
    sph(m,k,(0,base+.74,0),.13,tf); sph(m,h,(0,base+.78,-.02),.14,tf,sq=.75)
    sy=base+.5
    if pose in('stand','sit'):
        for sx in(-1,1): tube(m,sh,(sx*.2,sy,0),(sx*.24,sy-.3,.04),.06,tf); tube(m,k,(sx*.24,sy-.3,.04),(sx*.25,sy-.55,.08),.05,tf)
    elif pose=='cheer':
        for sx in(-1,1): tube(m,sh,(sx*.2,sy,0),(sx*.36,sy+.25,0),.06,tf); tube(m,k,(sx*.36,sy+.25,0),(sx*.5,sy+.52,0),.05,tf)
    elif pose=='photo':
        for sx in(-1,1): tube(m,sh,(sx*.2,sy,0),(sx*.18,sy-.05,.25),.06,tf); tube(m,k,(sx*.18,sy-.05,.25),(sx*.08,sy+.12,.42),.05,tf)
        bx(m,'cam',(0,sy+.15,.46),(.2,.12,.12),tf)
    elif pose=='flag':
        tube(m,sh,(.2,sy,0),(.34,sy+.28,0),.06,tf); tube(m,k,(.34,sy+.28,0),(.42,sy+.55,0),.05,tf); tube(m,sh,(-.2,sy,0),(-.24,sy-.3,.04),.06,tf); tube(m,k,(-.24,sy-.3,.04),(-.25,sy-.55,.08),.05,tf)
        tube(m,'flagp',(.42,sy+.3,0),(.42,sy+1.5,0),.015,tf,seg=4); fm=rg.choice(['flagt','flagr','flagb'])
        a=tf((.42,sy+1.5,0));b=tf((.42,sy+1.1,0));c=tf((1.1,sy+1.15,.1));d=tf((1.1,sy+1.5,.1)); quado(m,fm,a,b,c,d,tf((.7,sy+.3,0))) ; quado(m,fm,a,d,c,b,tf((.7,sy+.3,0))) if False else None
    elif pose=='umbrella':
        for sx in(-1,1): tube(m,sh,(sx*.2,sy,0),(sx*.24,sy-.3,.04),.06,tf); tube(m,k,(sx*.24,sy-.3,.04),(sx*.25,sy-.55,.08),.05,tf)
        tube(m,'flagp',(.3,sy-.4,.1),(.3,sy+.85,.1),.014,tf,seg=4); um=rg.choice(['um','um2','um3'])
        top=(.3,sy+.98,.1)
        for i in range(8):
            a0=i/8*2*math.pi;a1=(i+1)/8*2*math.pi; q=lambda a:(.3+math.cos(a)*.55,sy+.78,.1+math.sin(a)*.55)
            tri(m,um,tf(top),tf(q(a0)),tf(q(a1)),tf((.3,sy+.3,.1)))
    elif pose=='marshal':
        tube(m,'vest',(0,base+.02,0),(0,base+.5,0),.2,tf,seg=6,r2=.18)
        for sx in(-1,1): tube(m,sh,(sx*.2,sy,0),(sx*.24,sy-.3,.04),.06,tf); tube(m,k,(sx*.24,sy-.3,.04),(sx*.25,sy-.55,.08),.05,tf)
