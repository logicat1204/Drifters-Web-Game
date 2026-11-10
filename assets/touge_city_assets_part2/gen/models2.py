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
# ================= carretera =================
def road_arc(name,tex,R,deg,w=7,wet=False):
    m=newm(); m.mat('r',(1,1,1,1),tex=tex,double=True); N=max(4,int(deg/8)); th=math.radians(deg); L=R*th
    for i in range(N):
        t0=th*i/N;t1=th*(i+1)/N
        p=lambda t,off:(R-(R+off)*math.cos(t),0,-(R+off)*math.sin(t))
        v0,v1=L*i/N/7,L*(i+1)/N/7
        quadup(m,'r',p(t0,-w/2),p(t0,w/2),p(t1,w/2),p(t1,-w/2),((0,v0),(1,v0),(1,v1),(0,v1)))
    save(m,name)
road_arc('road_curve_90','road_touge_orange.png',22,90); road_arc('road_hairpin_180','road_touge_orange.png',12,180); road_arc('road_curve_45_wide','road_touge_orange.png',40,45)
m=newm(); m.mat('g',(1,1,1,1),tex='gutter_concrete.png',double=True); quadup(m,'g',(-1.5,0,10),(1.5,0,10),(1.5,0,-10),(-1.5,0,-10),((0,0),(1,0),(1,4),(0,4))); save(m,'road_shoulder_gutter')
m=newm(); m.mat('r',(1,1,1,1),tex='road_touge_wet.png',double=True); quadup(m,'r',(-3.5,0,10),(3.5,0,10),(3.5,0,-10),(-3.5,0,-10),((0,0),(1,0),(1,3),(0,3))); save(m,'road_touge_wet_segment')
# decal quads (sobre la carretera, y=0.02)
for n in ('decal_30','decal_diamond','decal_arrow','decal_stopline','decal_tyre_marks','decal_leaves','decal_cracks','decal_manhole'):
    m=newm(); s=1.6 if n in('decal_30','decal_diamond','decal_arrow','decal_manhole') else (6.4 if n=='decal_stopline' else 7)
    m.mat('d',(1,1,1,1),tex=n+'.png',double=True); w=s if n!='decal_stopline' else 6.4; d=s if n!='decal_stopline' else .9
    if n=='decal_stopline': m.quad('d',(-w/2,.02,d/2),(w/2,.02,d/2),(w/2,.02,-d/2),(-w/2,.02,-d/2),((0,0),(1,0),(1,.25),(0,.25)))
    else: quadup(m,'d',(-w/2,.02,s/2),(w/2,.02,s/2),(w/2,.02,-s/2),(-w/2,.02,-s/2),((0,1),(1,1),(1,0),(0,0)))
    save(m,n.replace('decal_','road_decal_'))
# ================= bordes de carretera =================
m=newm(); m.mat('c',(1,1,1,1),tex='curb_concrete.png'); m.box('c',(0,.1,0),(4,.2,.4),uvs=(2,1)); save(m,'curb_segment')
m=newm(); m.mat('c',(.72,.72,.7,1),rough=.95); m.cyl('c',(0,.4,0),.01,.01,3)
m=newm(); m.mat('c',(.74,.74,.72,1),rough=.95); m.mat('y',(.95,.7,.1,1))
for z in range(1):
    # perfil jersey: base ancha + cuello
    prof=[(-.3,0),(.3,0),(.3,.15),(.12,.55),(.1,.8),(-.1,.8),(-.12,.55),(-.3,.15)]
    L=3
    for i in range(len(prof)):
        a=prof[i];b=prof[(i+1)%len(prof)]
        quado(m,'c',(a[0],a[1],-L/2),(b[0],b[1],-L/2),(b[0],b[1],L/2),(a[0],a[1],L/2),(0,.4,0))
    tri(m,'c',(-.1,.8,-L/2),(.1,.8,-L/2),(0,.4,-L/2),(0,.4,-5)); 
    m.box('y',(0,.82,0),(.2,.02,L)) 
save(m,'jersey_barrier')
m=newm(); m.mat('p',(.9,.9,.9,1),metal=.2); m.mat('o',(1,.5,.05,1),emis=(.5,.2,0))
m.cyl('p',(0,.6,0),.04,1.2,6); m.box('o',(0,1.0,.05),(.1,.14,.02)); save(m,'reflector_post')
m=newm(); m.mat('p',(.78,.8,.82,1),metal=.5); m.mat('mir',(1,1,1,1),tex='curve_mirror.png',double=True)
m.cyl('p',(0,2.2,0),.05,4.4,8); m.quad('mir',(-.55,3.3,.08),(.55,3.3,.08),(.55,4.4,.08),(-.55,4.4,.08),((0,0),(1,0),(1,1),(0,1))); m.quad('mir',(.55,3.3,-.08),(-.55,3.3,-.08),(-.55,4.4,-.08),(.55,4.4,-.08),((0,0),(1,0),(1,1),(0,1))); save(m,'curve_mirror')
m=newm(); m.mat('p',(.5,.52,.55,1),metal=.5); m.mat('s',(1,1,1,1),tex='sign_falling_rocks.png',double=True); m.cyl('p',(0,1.2,0),.04,2.4,6); m.quad('s',(-.45,1.8,.05),(.45,1.8,.05),(.45,2.7,.05),(-.45,2.7,.05),((0,0),(1,0),(1,1),(0,1))); save(m,'sign_falling_rocks')
m=newm(); m.mat('p',(.5,.52,.55,1),metal=.5); m.mat('s',(1,1,1,1),tex='sign_slippery.png',double=True); m.cyl('p',(0,1.2,0),.04,2.4,6); m.quad('s',(-.45,1.8,.05),(.45,1.8,.05),(.45,2.7,.05),(-.45,2.7,.05),((0,0),(1,0),(1,1),(0,1))); save(m,'sign_slippery')
m=newm(); m.mat('s',(1,1,1,1),tex='sign_km_post.png',double=True); m.mat('p',(.8,.8,.8,1)); m.cyl('p',(0,.5,0),.03,1,6); m.quad('s',(-.2,.7,.04),(.2,.7,.04),(.2,1.4,.04),(-.2,1.4,.04),((0,0),(1,0),(1,1),(0,1))); save(m,'km_post')
m=newm(); m.mat('s',(1,1,1,1),tex='slope_lattice.png',double=True); m.mat('t',(.7,.68,.64,1))
m.quad('s',(-4,0,0),(4,0,0),(4,6,-3),(-4,6,-3),((0,0),(2,0),(2,1.5),(0,1.5))); m.box('t',(0,6,-3.1),(8,.3,.4)); save(m,'slope_lattice_panel')
m=newm(); m.mat('n',(1,1,1,1),tex='wall_mossy.png'); m.box('n',(0,1.5,0),(6,3,.6),uvs=(3,1.5)); save(m,'mossy_wall_segment')
m=newm(); m.mat('p',(.3,.32,.34,1),metal=.6); m.mat('net',(.6,.62,.64,.55),double=True)
for x in (-3,0,3): m.cyl('p',(x,1.6,0),.05,3.2,6)
m.quad('net',(-3,.2,0),(3,.2,0),(3,3.2,0),(-3,3.2,0)); save(m,'rockfall_fence')
m=newm(); m.mat('w',(1,1,1,1),tex='wood_planks.png')
for x in (-1.8,0,1.8): m.box('w',(x,.6,0),(.12,1.2,.12))
m.box('w',(0,.95,0),(4,.1,.05)); m.box('w',(0,.5,0),(4,.1,.05)); save(m,'wooden_fence')
# ================= elementos japoneses =================
m=newm(); m.mat('s',(.62,.62,.6,1),rough=1)
m.box('s',(0,.15,0),(.8,.3,.8)); m.box('s',(0,.5,0),(.5,.4,.5)); m.cyl('s',(0,1.0,0),.1,.6,6); m.box('s',(0,1.55,0),(.7,.5,.7)); m.box('s',(0,1.5,0),(.4,.42,.74)); m.box('s',(0,1.95,0),(1.0,.14,1.0)); m.cyl('s',(0,2.2,0),.02,.4,6,r2=.0001); m.sphere('s',(0,2.2,0),.17,6,4); save(m,'stone_lantern')
m=newm(); m.mat('w',(.4,.28,.2,1)); m.mat('r',(.3,.3,.32,1),tex='roof_tile.png'); m.mat('s',(.6,.6,.58,1)); m.mat('red',(.8,.1,.08,1))
m.box('s',(0,.1,0),(1.6,.2,1.4)); m.box('w',(0,.8,0),(1.1,1.0,.9)); hip(m,'r',0,1.3,0,1.2,1.0,.8,.35,.3); m.box('red',(0,.9,.46),(.5,.4,.02)); save(m,'roadside_shrine')
m=newm(); m.mat('p',(.4,.42,.44,1),metal=.5); m.mat('s',(.1,.4,.8,1)); m.mat('r',(.85,.85,.88,1)); m.cyl('p',(0,1.6,0),.04,3.2,6); m.cyl('s',(0,2.9,0),.35,.06,12); m.box('r',(0,2.9,0),(.5,.1,.02)); save(m,'bus_stop_sign')
m=newm(); m.mat('p',(.7,.72,.72,1),metal=.7,rough=.4)  # torre de alta tension
for sx in (-1,1):
    for sz in (-1,1): 
        m.cyl('p',(sx*(.8),6,sz*.8),.08,12,6,.05)
for y in (3,6,9): m.box('p',(0,y,0),(1.6,.08,1.6))
m.box('p',(0,11.5,0),(7,.15,.15)); m.box('p',(0,9.5,0),(5,.15,.15)); m.cyl('p',(0,13,0),.05,2,6); save(m,'power_pylon')
def house(name,roofc,tall):
    m=newm(); m.mat('p',(1,1,1,1),tex='plaster_wall.png'); m.mat('r',(1,1,1,1),tex='roof_tile.png'); m.mat('w',(.25,.17,.12,1)); m.mat('g',(.45,.6,.7,1),emis=(.04,.06,.08))
    m.box('p',(0,1.5,0),(9,3,7),uvs=(3,1.5)); m.box('w',(0,3.05,0),(9.1,.12,7.1))
    hip(m,'r',0,3.1,0,9,7,1.8,.9,3.5)
    if tall:
        m.box('p',(-.6,4.2,0),(6.8,2.4,5.4),uvs=(2.4,1.2)); hip(m,'r',-.6,5.4,0,6.8,5.4,1.6,.8,2)
    for x in (-3,0,3): m.box('g',(x,1.7,3.52),(1.4,1.2,.05)); 
    m.box('w',(0,1.1,3.52),(1.0,2.0,.06)); save(m,name)
house('house_japanese_a','',False); house('house_japanese_b','',True)
m=newm(); m.mat('t',(.55,.57,.6,1)); m.mat('w',(.4,.35,.3,1)); m.box('t',(0,1.6,0),(6,3.2,4)); m.box('w',(0,3.3,0),(6.2,.2,4.2)); m.box('t',(0,3.7,0),(5.6,.7,3.6)); save(m,'storage_shed')
# ================= vegetacion low poly =================
m=newm(); m.mat('tr',(.3,.2,.14,1)); m.mat('l1',(.78,.18,.1,1)); m.mat('l2',(.9,.42,.1,1)); m.mat('l3',(.65,.12,.1,1))
m.cyl('tr',(0,1.4,0),.22,2.8,6,.12)
for (x,y,z,r,mt) in [(0,4.6,0,2.1,'l1'),(1.5,3.9,.4,1.5,'l2'),(-1.4,4.0,-.3,1.5,'l3'),(.2,5.9,.2,1.3,'l2')]: boulder(m,mt,(x,y,z),r,int(x*7+y),sq=.9)
save(m,'tree_maple')
m=newm(); m.mat('tr',(.35,.25,.2,1)); m.mat('l',(.12,.34,.2,1)); m.cyl('tr',(0,1.5,0),.2,3,6,.12)
for k in range(4): m.cyl('l',(0,3.2+k*1.3,0),1.8-k*.38,1.8,7,r2=.0001)
save(m,'tree_pine')
m=newm(); m.mat('b',(.45,.65,.3,1)); m.mat('n',(.3,.45,.2,1)); r=np.random.default_rng(3)
for k in range(10):
    x,z=r.uniform(-1.5,1.5,2); h=r.uniform(5,8); m.cyl('b',(x,h/2,z),.07,h,6)
    for j in range(2,int(h),2): m.cyl('n',(x,j,z),.085,.06,6)
    m.sphere('n',(x,h,z),.5,5,3)
save(m,'bamboo_cluster')
m=newm(); m.mat('g',(.2,.5,.18,1)); m.mat('f',(.85,.5,.8,1)); r=np.random.default_rng(4)
for k in range(5): boulder(m,'g',(r.uniform(-.8,.8),.35,r.uniform(-.8,.8)),r.uniform(.4,.7),k,sq=.8)
for k in range(8): m.sphere('f',(r.uniform(-.9,.9),.6,r.uniform(-.9,.9)),.1,4,3)
save(m,'bush_flowers')
for i,(r_,seed) in enumerate(((1.8,1),(1.2,2),(2.6,3))):
    m=newm(); m.mat('r1',(.5,.5,.48,1),rough=1); m.mat('r2',(.4,.4,.38,1),rough=1); boulder(m,'r1',(0,r_*.55,0),r_,seed,sq=.7); boulder(m,'r2',(r_*.9,r_*.3,r_*.3),r_*.5,seed+9,sq=.7); save(m,'boulder_'+'abc'[i])
# ================= puente y tunel =================
m=newm(); m.mat('a',(1,1,1,1),tex='road_touge_orange.png',double=True); m.mat('c',(.78,.78,.76,1)); m.mat('rail',(.9,.9,.92,1),metal=.5)
quadup(m,'a',(-3.5,0,10),(3.5,0,10),(3.5,0,-10),(-3.5,0,-10),((0,0),(1,0),(1,3),(0,3))); m.box('c',(0,-.35,0),(8.6,.7,20))
for s in (-1,1):
    m.box('c',(s*4.1,.5,0),(.3,1,20))
    for z in (-8,-4,0,4,8): m.box('c',(s*4.1,.8,z),(.4,1.6,.4))
    m.box('rail',(s*4.1,1.3,0),(.1,.12,20))
for z in (-6,6): m.box('c',(0,-6.5,z),(5,11,1.8)); m.box('c',(0,-12.2,z),(7,.6,3))
save(m,'bridge_segment')
m=newm(); m.mat('c',(.72,.72,.7,1),tex='curb_concrete.png',double=True); m.mat('d',(.04,.04,.05,1),double=True)
R=5.4; N=16
for i in range(N):
    a0=math.pi*i/N;a1=math.pi*(i+1)/N; ar=lambda a:(math.cos(a)*R,math.sin(a)*R)
    p0=ar(a0);p1=ar(a1)
    quadup(m,'c',(p0[0],p0[1],0),(p1[0],p1[1],0),(p1[0]*0+max(-9,min(9,p1[0]*3)),9,0),(max(-9,min(9,p0[0]*3)),9,0),((0,0),(1,0),(1,1),(0,1))) if False else None
# portal: fachada plana con hueco semicircular
for i in range(N):
    a0=math.pi*i/N;a1=math.pi*(i+1)/N; x0,y0=math.cos(a0)*R,math.sin(a0)*R; x1,y1=math.cos(a1)*R,math.sin(a1)*R
    m.quad('c',(x0,y0,0),(x1,y1,0),(x1*1.0,9,0),(x0,9,0),((0,0),(.1,0),(.1,1),(0,1)))
m.quad('c',(-9,0,0),(-R,0,0),(-R,9,0),(-9,9,0),((0,0),(1,0),(1,1),(0,1))); m.quad('c',(R,0,0),(9,0,0),(9,9,0),(R,9,0),((0,0),(1,0),(1,1),(0,1)))
m.box('c',(0,9.25,0),(18,.5,1.2)); m.quad('d',(-R,0,-.02),(R,0,-.02),(R,.1,-.02),(-R,.1,-.02))
m.box('c',(-10.5,2.5,-.6),(2,5,.6)); m.box('c',(10.5,2.5,-.6),(2,5,.6)); save(m,'tunnel_portal')
import os; print(len(os.listdir(O)),sorted(os.listdir(O)))
