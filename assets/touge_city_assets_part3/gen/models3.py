from glb import *
import math, numpy as np
exec(open('../../env2/gen/models2.py').read().split('# ================= carretera')[0].replace("from glb import *",""))
O='../models/'
def save(m,n): m.save(O+n+'.glb')
# ---------- primitivas con transformacion (para personas)
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
def make_person(name,pose,seed=1):
    m=M(); pmats(m); person(m,0,0,0,pose,np.random.default_rng(seed)); save(m,name)
for n,po,sd in (('person_stand_a','stand',1),('person_stand_b','stand',5),('person_cheer','cheer',2),('person_photo','photo',3),('person_flag','flag',4),('person_umbrella','umbrella',6),('person_marshal','marshal',7),('person_sit','sit',8)): make_person(n,po,sd)
def crowd(name,n,layout,poses,seed,rain=False,L=10):
    m=M(); pmats(m); rg=np.random.default_rng(seed)
    for i in range(n):
        if layout=='row': x=-L/2+L*i/max(1,n-1)+rg.uniform(-.15,.15); z=rg.uniform(-.25,.25)
        else: x,z=rg.normal(0,1.1,2)
        pose=rg.choice(poses); person(m,x,z,rg.uniform(-.5,.5)+(math.pi if False else 0),pose,rg,sc=rg.uniform(.92,1.08))
    save(m,name)
crowd('crowd_row_10m_a',16,'row',['stand','stand','cheer','photo'],1); crowd('crowd_row_10m_b',16,'row',['stand','cheer','flag','stand','photo'],2)
crowd('crowd_row_rain',14,'row',['umbrella','umbrella','stand'],3); crowd('crowd_group_small_a',9,'group',['stand','cheer','photo','stand'],4); crowd('crowd_group_small_b',9,'group',['stand','flag','cheer'],5)
crowd('crowd_group_photographers',6,'group',['photo'],6)
# gradas con publico sentado
m=M(); pmats(m); m.mat('c',(.72,.72,.7,1),tex='curb_concrete.png'); m.mat('rail',(.6,.62,.65,1),metal=.5); rg=np.random.default_rng(9)
for t in range(4): m.box('c',(0,t*.45+.22,-t*.9),(12,.45,.9+(3-t)*0.0+.0001),uvs=(4,1))
m.box('c',(0,.2,-.2),(12.2,.4,5),uvs=(4,2)) if False else None
for t in range(4):
    for i in range(10):
        if rg.random()<.85: person(m,-5.2+i*1.15+rg.uniform(-.1,.1),-t*.9+.05,math.pi*0+rg.uniform(-.3,.3),rg.choice(['sit','sit','sit']),rg,y0=t*.45+.45)
for s in (-1,1): m.box('rail',(s*6.05,.8,-1.4),(.06,1.6,4.4))
save(m,'stands_small_with_crowd')
m=M(); m.mat('c',(.72,.72,.7,1),tex='curb_concrete.png'); m.mat('seat',(.2,.3,.7,1))
for t in range(5): m.box('c',(0,t*.45+.22,-t*.9),(12,.45,.9),uvs=(4,1)); m.box('seat',(0,t*.45+.5,-t*.9+.2),(11.6,.08,.4))
save(m,'stands_small_empty')
# tienda de eventos
m=M(); m.mat('t',(.95,.95,.95,1),double=True); m.mat('t2',(.8,.1,.15,1),double=True); m.mat('p',(.7,.7,.72,1),metal=.5)
for sx in(-1.5,1.5):
    for sz in(-1.5,1.5): m.cyl('p',(sx,1.2,sz),.04,2.4,6)
for (a,b,c_,d) in (((-1.7,2.4,-1.7),(1.7,2.4,-1.7),(0,3.2,0),(0,3.2,0)),):
    pass
R=lambda x,y,z:(x,y,z)
quadup_=lambda *a:None
for pts in (((-1.8,2.3,-1.8),(1.8,2.3,-1.8),(0,3.2,0)),((1.8,2.3,-1.8),(1.8,2.3,1.8),(0,3.2,0)),((1.8,2.3,1.8),(-1.8,2.3,1.8),(0,3.2,0)),((-1.8,2.3,1.8),(-1.8,2.3,-1.8),(0,3.2,0))):
    tri(m,'t2' if pts[0][0]!=1.8 and pts[0][2]!=-1.8 else 't',*pts,out=(0,1,0))
save(m,'event_tent')
# ---------- carrera
m=M(); m.mat('p',(.25,.27,.3,1),metal=.6); m.mat('b',(1,1,1,1),tex='banner_stripes.png',double=True); m.mat('c',(1,1,1,1),tex='banner_checker.png',double=True); m.mat('g',(.1,1,.4,1),emis=(.1,.9,.3))
for s in(-1,1): m.box('p',(s*5.2,3.5,0),(.5,7,.5))
m.box('p',(0,7.1,0),(11,.5,.6)); m.quad('b',(-4.8,5.2,.35),(4.8,5.2,.35),(4.8,6.8,.35),(-4.8,6.8,.35),((0,0),(1,0),(1,1),(0,1))); m.quad('b',(4.8,5.2,-.35),(-4.8,5.2,-.35),(-4.8,6.8,-.35),(4.8,6.8,-.35),((0,0),(1,0),(1,1),(0,1)))
for x in(-1,0,1): m.box('g',(x*1.2,4.6,.35),(.5,.5,.1))
save(m,'race_start_gate')
m=M(); m.mat('p',(.25,.27,.3,1),metal=.6); m.mat('c',(1,1,1,1),tex='banner_checker.png',double=True)
for s in(-1,1): m.box('p',(s*5.2,3.3,0),(.5,6.6,.5))
m.box('p',(0,6.7,0),(11,.5,.6)); m.quad('c',(-4.8,5.3,.35),(4.8,5.3,.35),(4.8,6.5,.35),(-4.8,6.5,.35),((0,0),(4,0),(4,1),(0,1))); m.quad('c',(4.8,5.3,-.35),(-4.8,5.3,-.35),(-4.8,6.5,-.35),(4.8,6.5,-.35),((0,0),(4,0),(4,1),(0,1))); save(m,'race_finish_gate')
m=M(); m.mat('p',(.9,.9,.92,1),metal=.4); m.mat('b',(1,1,1,1),tex='banner_stripes.png',double=True)
for s in(-1,1): m.cyl('p',(s*4,2.2,0),.1,4.4,6)
m.quad('b',(-4,3.2,.05),(4,3.2,.05),(4,4.4,.05),(-4,4.4,.05),((0,0),(1,0),(1,1),(0,1))); m.quad('b',(4,3.2,-.05),(-4,3.2,-.05),(-4,4.4,-.05),(4,4.4,-.05),((0,0),(1,0),(1,1),(0,1))); save(m,'checkpoint_arch')
m=M(); m.mat('t',(.08,.08,.09,1),rough=1); m.mat('w',(.95,.95,.95,1))
for k,(x,z) in enumerate([(-.5,0),(.5,0),(0,.85),(0,-.85)] if False else [(-.5,-.3),(.5,-.3),(0,.55)]):
    for y in range(3): m.cyl('t',(x,.15+y*.3,z),.5,.3,10)
    m.cyl('w',(x,.15+.3*2,z),.2,.31,10)
save(m,'tire_stack')
m=M(); m.mat('o',(1,.4,.05,1),emis=(.2,.08,0)); m.mat('w',(.95,.95,.95,1)); m.mat('b',(.1,.1,.1,1))
m.box('b',(0,.02,0),(.4,.04,.4)); m.cyl('o',(0,.35,0),.18,.65,8,r2=.04); m.cyl('w',(0,.38,0),.115,.1,8)
save(m,'traffic_cone')
m=M(); m.mat('o',(1,.4,.05,1),emis=(.2,.08,0)); m.mat('b',(.1,.1,.1,1))
for i in range(6): 
    m.box('b',(i*1.6-4,.02,0),(.4,.04,.4)); m.cyl('o',(i*1.6-4,.35,0),.18,.65,8,r2=.04)
save(m,'cone_row')
m=M(); m.mat('p',(.7,.7,.72,1),metal=.5); m.mat('f',(1,1,1,1),tex='flag_checker.png',double=True)
m.cyl('p',(0,2,0),.04,4,6); quado(m,'f',(0,3.9,0),(0,3.1,0),(1.6,3.1,.1),(1.6,3.9,.1),(.8,3.5,2)); quado(m,'f',(0,3.9,0),(1.6,3.9,.1),(1.6,3.1,.1),(0,3.1,0),(.8,3.5,-2)); save(m,'flag_pole_checkered')
m=M(); m.mat('p',(.2,.22,.25,1),metal=.6); m.mat('s',(.04,.05,.07,1),emis=(.1,.6,.9)); m.mat('f',(.9,.9,.9,1))
m.box('p',(0,3,0),(.6,6,.6)); m.box('p',(0,7,0),(6,3,.5)); m.box('s',(0,7,.28),(5.6,2.6,.04)); m.box('s',(0,7,-.28),(5.6,2.6,.04)); save(m,'scoreboard_tower')
m=M(); m.mat('b',(1,1,1,1),tex='banner_stripes.png',double=True); m.mat('p',(.5,.52,.55,1),metal=.6)
m.quad('b',(-1.5,.2,.05),(1.5,.2,.05),(1.5,1.0,.05),(-1.5,1.0,.05),((0,0),(1,0),(1,1),(0,1))); m.quad('b',(1.5,.2,-.05),(-1.5,.2,-.05),(-1.5,1.0,-.05),(1.5,1.0,-.05),((0,0),(1,0),(1,1),(0,1)))
for s in(-1,0,1): m.cyl('p',(s*1.5,.55,0),.03,1.1,6)
m.box('p',(0,1.1,0),(3,.05,.06)); m.box('p',(0,.3,0),(3,.05,.06)); save(m,'barrier_fence_banner')
# ---------- ciudad modular
CW=14
def plane(m,mat,x0,x1,z0,z1,uv=(1,1),rot=False):
    q=((1,0),(1,1),(0,1),(0,0)) if rot else ((0,0),(uv[0],0),(uv[0],uv[1]),(0,uv[1]))
    quadup(m,mat,(x0,0,z1),(x1,0,z1),(x1,0,z0),(x0,0,z0),q)
m=M(); m.mat('a',(1,1,1,1),tex='asphalt.png',double=True); m.mat('r',(1,1,1,1),tex='road_city.png',double=True); m.mat('cw',(1,1,1,1),tex='crosswalk.png',double=True); m.mat('s',(.62,.62,.6,1),tex='curb_concrete.png')
plane(m,'a',-7,7,-7,7)
for (x0,x1,z0,z1) in ((-7,7,7,10),(-7,7,-10,-7)): pass
for sx in (-1,1):
    for sz in (-1,1): m.box('s',(sx*11,.1,sz*11),(8,.2,8),uvs=(3,3))
save(m,'city_intersection_4way')
m=M(); m.mat('a',(1,1,1,1),tex='asphalt.png',double=True); m.mat('r',(1,1,1,1),tex='road_city.png',double=True); m.mat('s',(.62,.62,.6,1),tex='curb_concrete.png')
plane(m,'a',-7,7,-7,7); plane(m,'r',7,21,-7,7,rot=True); 
for sz in (-1,): m.box('s',(0,.1,-11),(14,.2,8),uvs=(3,3))
save(m,'city_t_junction')
m=M(); m.mat('r',(1,1,1,1),tex='road_city.png',double=True); m.mat('cw',(1,1,1,1),tex='crosswalk.png',double=True)
plane(m,'cw',-7,7,-1.8,1.8,(1,.25)); save(m,'city_crosswalk')
road_arc=None
m=M(); m.mat('r',(1,1,1,1),tex='road_city.png',double=True); R=14; th=math.pi/2; N=10
for i in range(N):
    t0=th*i/N;t1=th*(i+1)/N; p=lambda t,o:(R-(R+o)*math.cos(t),0,-(R+o)*math.sin(t)); v0,v1=R*t0/14,R*t1/14
    quadup(m,'r',p(t0,-7),p(t0,7),p(t1,7),p(t1,-7),((0,v0),(1,v0),(1,v1),(0,v1)))
save(m,'road_city_corner_90')
m=M(); m.mat('s',(.64,.64,.62,1),tex='curb_concrete.png'); m.mat('t',(.55,.55,.5,1)); m.box('s',(0,.1,0),(20,.2,3),uvs=(8,1)); m.box('t',(1.6,.01,0),(.1,.02,20)) if False else None; save(m,'sidewalk_segment')
# edificios
def bld(name,tex,w,h,d,rep,roof=(.35,.36,.38)):
    m=M(); m.mat('f',(1,1,1,1),tex=tex); m.mat('roof',roof+(1,))
    for (a,b,c,dd) in (((-w/2,0,d/2),(w/2,0,d/2),(w/2,h,d/2),(-w/2,h,d/2)),((w/2,0,-d/2),(-w/2,0,-d/2),(-w/2,h,-d/2),(w/2,h,-d/2)),((w/2,0,d/2),(w/2,0,-d/2),(w/2,h,-d/2),(w/2,h,d/2)),((-w/2,0,-d/2),(-w/2,0,d/2),(-w/2,h,d/2),(-w/2,h,-d/2))):
        m.quad('f',a,b,c,dd,((0,0),(rep[0],0),(rep[0],rep[1]),(0,rep[1])))
    m.box('roof',(0,h+.15,0),(w,.3,d)); save(m,name); return m
bld('building_tower','facade_office.png',12,70,12,(1.5,5)); bld('building_tower_night','facade_office_night.png',12,70,12,(1.5,5))
bld('building_apartment_narrow','facade_apartment.png',7,20,9,(1,2)); bld('building_apartment_narrow_night','facade_apartment_night.png',7,20,9,(1,2))
# konbini
m=M(); m.mat('b',(.95,.95,.95,1),tex='plaster_wall.png'); m.mat('sign',(1,1,1,1),tex='konbini_sign.png',double=True,emis=(.4,.4,.4)); m.mat('g',(.5,.8,.9,1),emis=(.5,.7,.8)); m.mat('r',(.3,.3,.32,1))
m.box('b',(0,2.2,0),(12,4.4,9)); m.box('r',(0,4.5,0),(12.2,.3,9.2)); m.box('g',(0,1.7,4.52),(9,2.2,.05)); m.quad('sign',(-4,3.4,4.56),(4,3.4,4.56),(4,4.3,4.56),(-4,4.3,4.56),((0,0),(1,0),(1,1),(0,1)))
m.box('r',(0,.1,6.6),(12,.2,4)); save(m,'konbini')
m=M(); m.mat('w',(.45,.32,.24,1),tex='wood_planks.png'); m.mat('r',(1,1,1,1),tex='roof_tile.png'); m.mat('n',(1,1,1,1),tex='noren_red.png',double=True); m.mat('g',(1,.85,.5,1),emis=(.9,.7,.3)); m.mat('l',(.9,.15,.1,1),emis=(.6,.05,.05))
m.box('w',(0,1.8,0),(7,3.6,6),uvs=(2,1)); hip(m,'r',0,3.6,0,7,6,1.5,.7,1.5); m.quad('n',(-1.5,2.0,3.05),(1.5,2.0,3.05),(1.5,3.1,3.05),(-1.5,3.1,3.05),((0,0),(1,0),(1,1),(0,1))); m.box('g',(-2.4,1.5,3.02),(1.2,1.2,.05)); m.cyl('l',(2.6,2.3,3.4),.3,.6,8); save(m,'ramen_shop')
# pasarela peatonal
m=M(); m.mat('c',(.72,.72,.7,1),tex='curb_concrete.png'); m.mat('r',(.6,.62,.65,1),metal=.5); m.mat('s',(.3,.3,.32,1))
m.box('c',(0,5.5,0),(3,.5,26),uvs=(2,8)); 
for sx in(-1,1): m.box('r',(sx*1.4,6.4,0),(.08,1.3,26)); m.box('r',(sx*11.0*0,0,0),(.01,.01,.01)) if False else None
for z in(-11,11): m.box('c',(0,2.75,z),(2,5.5,1.2))
m.box('s',(0,5.4,0),(3.1,.1,26)); save(m,'footbridge')
m=M(); m.mat('p',(.4,.42,.44,1),metal=.5); m.mat('s',(1,1,1,1),tex='sign_blue_direction.png',double=True); m.cyl('p',(0,2.2,0),.06,4.4,6); m.cyl('p',(0,2.2,0),.06,4.4,6); m.quad('s',(-1.2,3.3,.06),(1.2,3.3,.06),(1.2,4.4,.06),(-1.2,4.4,.06),((0,0),(1,0),(1,1),(0,1))); m.quad('s',(1.2,3.3,-.06),(-1.2,3.3,-.06),(-1.2,4.4,-.06),(1.2,4.4,-.06),((0,0),(1,0),(1,1),(0,1))); save(m,'street_sign_blue')
# cables entre postes
m=M(); m.mat('w',(.06,.06,.07,1))
for off in (-1,0,1):
    pts=[(off*.9,8.1-.9*math.sin(math.pi*i/10),-10+2*i) for i in range(11)]
    for a,b in zip(pts[:-1],pts[1:]): tube(m,'w',a,b,.015,TF(),seg=3)
save(m,'wire_span_20m')
# coches aparcados
def car(name,col):
    m=M(); m.mat('b',col+(1,),metal=.6,rough=.35); m.mat('g',(.15,.2,.25,1),metal=.5,rough=.2); m.mat('w',(.05,.05,.06,1)); m.mat('l',(1,.95,.8,1),emis=(.6,.55,.4)); m.mat('t',(.8,.1,.1,1),emis=(.4,0,0))
    tf=TF(); bx(m,'b',(0,.55,0),(1.8,.7,4.3),tf); bx(m,'b',(0,1.05,-.2),(1.6,.5,2.2),tf); bx(m,'g',(0,1.08,-.2),(1.62,.36,2.0),tf)
    for sx in(-.9,.9):
        for sz in(-1.4,1.4): tube(m,'w',(sx-.1,.33,sz),(sx+.1,.33,sz),.33,tf,seg=8)
    bx(m,'l',(-.6,.62,2.16),(.4,.15,.04),tf); bx(m,'l',(.6,.62,2.16),(.4,.15,.04),tf); bx(m,'t',(-.6,.62,-2.16),(.4,.15,.04),tf); bx(m,'t',(.6,.62,-2.16),(.4,.15,.04),tf)
    save(m,name)
car('car_parked_white',(.92,.92,.94)); car('car_parked_red',(.75,.1,.1)); car('car_parked_blue',(.12,.25,.6)); car('car_parked_silver',(.6,.62,.66))
m=M(); m.mat('r',(.8,.1,.1,1),metal=.3); m.cyl('r',(0,.35,0),.14,.7,8); m.cyl('r',(0,.72,0),.1,.08,8); save(m,'fire_hydrant')
m=M(); m.mat('r',(.8,.1,.1,1)); m.mat('p',(.3,.3,.3,1)); m.box('r',(0,.6,0),(.4,.5,.5)); m.cyl('p',(0,.18,0),.05,.36,6); save(m,'mailbox_japan')
m=M(); m.mat('c',(.65,.65,.62,1),tex='curb_concrete.png'); m.mat('g',(.2,.45,.2,1)); m.box('c',(0,.3,0),(1.2,.6,.6)); m.box('g',(0,.65,0),(1.0,.12,.5)); save(m,'planter')
import os,glob; print(len(glob.glob(O+'*.glb')),sorted(os.path.basename(f) for f in glob.glob(O+'*.glb')))
