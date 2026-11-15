from glb import *
import math, numpy as np
exec(open('prims.py').read().split('SHIRT=')[0])
O='../models/'
I_=TF()
def save(m,n): m.save(O+n+'.glb')
UV=((0,0),(1,0),(1,1),(0,1))
def floorq(m,mat,x0,x1,z0,z1,y=0,uv=(1,1)):
    m.quad(mat,(x0,y,z1),(x1,y,z1),(x1,y,z0),(x0,y,z0),((0,0),(uv[0],0),(uv[0],uv[1]),(0,uv[1])))
def wallq(m,mat,x0,x1,y0,y1,z,uv=(1,1),flip=False):
    a=[(x0,y0,z),(x1,y0,z),(x1,y1,z),(x0,y1,z)]
    if flip: a=[a[1],a[0],a[3],a[2]]
    m.quad(mat,*a,((0,0),(uv[0],0),(uv[0],uv[1]),(0,uv[1])))
def disc(m,mat,r,y,seg=40,up=True):
    for i in range(seg):
        a0=i/seg*2*math.pi;a1=(i+1)/seg*2*math.pi; p=lambda a:(math.cos(a)*r,y,math.sin(a)*r); uvp=lambda a:(.5+math.cos(a)/2,.5+math.sin(a)/2)
        P=[(0,y,0),p(a1),p(a0)] if up else [(0,y,0),p(a0),p(a1)]; U=[(.5,.5),uvp(a1),uvp(a0)] if up else [(.5,.5),uvp(a0),uvp(a1)]
        tri(m,mat,*P,out=(0,y-5 if up else y+5,0),uv=U)
def ring(m,mat,r0,r1,y,seg=40):
    for i in range(seg):
        a0=i/seg*2*math.pi;a1=(i+1)/seg*2*math.pi; p=lambda r,a:(math.cos(a)*r,y,math.sin(a)*r)
        tri(m,mat,p(r0,a0),p(r1,a0),p(r1,a1),out=(0,y-5,0),uv=[(0,0),(1,0),(1,1)]); tri(m,mat,p(r0,a0),p(r1,a1),p(r0,a1),out=(0,y-5,0),uv=[(0,0),(1,1),(0,1)])
def base(m):
    m.mat('conc',(1,1,1,1),tex='concrete_garage_floor.png',mr='concrete_garage_floor_mr.png'); m.mat('wall',(1,1,1,1),tex='garage_wall_painted.png',double=True); m.mat('wallp',(1,1,1,1),tex='concrete_wall_plain.png',double=True)
    m.mat('door',(1,1,1,1),tex='garage_door_rollup.png',metal=.4,rough=.5,double=True); m.mat('ceil',(1,1,1,1),tex='garage_ceiling_panel.png',double=True)
    m.mat('plate',(1,1,1,1),tex='metal_diamond_plate.png',metal=.6,rough=.4); m.mat('wood',(1,1,1,1),tex='workbench_wood.png'); m.mat('peg',(1,1,1,1),tex='tool_pegboard.png')
    m.mat('steel',(.6,.62,.66,1),metal=.8,rough=.35); m.mat('dark',(.08,.08,.1,1),metal=.3,rough=.6); m.mat('red',(.75,.1,.08,1),metal=.3,rough=.45); m.mat('blue',(.1,.25,.65,1),metal=.3,rough=.45); m.mat('yel',(.95,.75,.1,1),rough=.6)
    m.mat('tire',(1,1,1,1),tex='tire_tread.png',rough=.95); m.mat('side',(1,1,1,1),tex='tire_sidewall.png',rough=.95,double=True); m.mat('rim',(1,1,1,1),tex='rim_face.png',metal=.8,rough=.3,double=True); m.mat('rubber',(.04,.04,.05,1),rough=.95)
    m.mat('tube',(1,1,1,1),emis=(1,.97,.9)); m.mat('tubew',(1,1,1,1),emis=(.9,.95,1)); m.mat('oil',(1,1,1,1),tex='oil_can_label.png'); m.mat('crate',(1,1,1,1),tex='crate_label.png'); m.mat('tt',(1,1,1,1),tex='turntable_top.png',metal=.4,rough=.35)
    m.mat('ttg',(0,0,0,1),emis=(.2,.85,1)); m.mat('back',(1,1,1,1),tex='showroom_backdrop.png',double=True); m.mat('sign',(1,1,1,1),tex='sign_garage.png',etex='sign_garage.png',double=True)
    for p in 'abc': m.mat('post'+p,(1,1,1,1),tex=f'poster_{p}.png',double=True)
    m.mat('fire',(.8,.05,.05,1),metal=.3,rough=.4); m.mat('glass',(.7,.85,.95,.35),double=True)
def M_():
    m=M(); base(m); return m
# ---------- plataforma giratoria ----------
m=M_(); m.cyl('steel',(0,.12,0),3.4,.24,40); disc(m,'tt',3.3,.245); ring(m,'ttg',3.1,3.4,.247)
for i in range(12): a=i/12*2*math.pi; bx(m,'dark',(math.cos(a)*3.55,.1,math.sin(a)*3.55),(.25,.2,.25),TF(0,0,0,-a))
save(m,'turntable_platform')
m=M_(); m.cyl('steel',(0,.05,0),4.6,.1,40); m.cyl('dark',(0,.12,0),3.6,.05,40); disc(m,'tt',3.5,.15); ring(m,'ttg',3.2,3.6,.155); save(m,'turntable_platform_low')
# ---------- piezas modulares de cuarto (8m) ----------
def floor8(): m=M_(); floorq(m,'conc',-4,4,-4,4,0,(2,2)); return m
save(floor8(),'garage_floor_8m')
m=M_(); wallq(m,'wall',-4,4,0,4.5,0,(2,1.1)); bx(m,'dark',(0,.08,0),(8,.16,.2),I_); save(m,'garage_wall_8m')
m=M_(); wallq(m,'wall',-4,-1.6,0,4.5,0,(.6,1.1)); wallq(m,'wall',1.6,4,0,4.5,0,(.6,1.1)); wallq(m,'wall',-1.6,1.6,3.6,4.5,0,(.8,.25)); wallq(m,'door',-1.6,1.6,1.4,3.6,-.05,(1,1)); bx(m,'dark',(0,.08,0),(8,.16,.2),I_); save(m,'garage_wall_door_open')
m=M_(); wallq(m,'wall',-4,4,0,4.5,0,(2,1.1)); wallq(m,'door',-2.4,2.4,0,3.4,.05,(1,1)); bx(m,'dark',(0,3.5,.1),(5,.2,.25),I_); save(m,'garage_wall_door_closed')
m=M_(); wallq(m,'wall',-4,-2,0,4.5,0,(.5,1.1)); wallq(m,'wall',2,4,0,4.5,0,(.5,1.1)); wallq(m,'wall',-2,2,0,1.2,0,(1,.3)); wallq(m,'wall',-2,2,3.3,4.5,0,(1,.3)); wallq(m,'glass',-2,2,1.2,3.3,0,(1,1))
for x in (-2,0,2): bx(m,'dark',(x,2.25,0),(.1,2.1,.1),I_)
bx(m,'dark',(0,1.2,0),(4,.1,.15),I_); bx(m,'dark',(0,3.3,0),(4,.1,.15),I_); save(m,'garage_wall_window')
m=M_(); floorq(m,'ceil',-4,4,-4,4,4.5,(2,2)); m.quad('ceil',(-4,4.5,-4),(4,4.5,-4),(4,4.5,4),(-4,4.5,4),UV)
for x in (-2.5,2.5):
    for z in (-2,2): bx(m,'tube',(x,4.42,z),(.2,.08,3.2) if False else (3.2,.08,.2),I_)
save(m,'garage_ceiling_lit_8m')
m=M_(); bx(m,'wallp',(0,2.25,0),(.5,4.5,.5),I_); bx(m,'yel',(0,.5,0),(.52,1,.52),I_); save(m,'garage_pillar')
m=M_(); wallq(m,'back',-7,7,0,5,0,(1,1)); save(m,'showroom_backdrop_panel')
# ---------- garaje completo 12x10 ----------
def room(name,W=12,D=10,H=4.5,door=True,tube='tube',neon=None,table=True):
    m=M_(); floorq(m,'conc',-W/2,W/2,-D/2,D/2,0,(W/4,D/4)); floorq(m,'ceil',-W/2,W/2,D/2,-D/2,H,(W/4,D/4)) if False else m.quad('ceil',(-W/2,H,-D/2),(W/2,H,-D/2),(W/2,H,D/2),(-W/2,H,D/2),((0,0),(W/4,0),(W/4,D/4),(0,D/4)))
    wallq(m,'wall',-W/2,W/2,0,H,-D/2,(W/4,1.1)); wallq(m,'wall',-W/2,W/2,0,H,D/2,(W/4,1.1),flip=True)
    # laterales
    for sx in(-1,1):
        m.quad('wall',(sx*W/2,0,D/2),(sx*W/2,0,-D/2),(sx*W/2,H,-D/2),(sx*W/2,H,D/2),((0,0),(D/4,0),(D/4,1.1),(0,1.1))) 
    if door: bx(m,'door',(0,H/2-.3,D/2-.06),(4.4,H-1.2,.1),I_); bx(m,'dark',(0,H-.55,D/2-.1),(4.8,.2,.3),I_)
    for x in(-W/3,0,W/3):
        for z in(-D/4,D/4): bx(m,tube,(x,H-.08,z),(.25,.08,3.2),I_)
    if neon: bx(m,neon,(0,H-.5,-D/2+.1),(W-1,.1,.1),I_)
    if table: m.cyl('steel',(0,.12,0),3.4,.24,40); disc(m,'tt',3.3,.245); ring(m,'ttg',3.1,3.4,.247)
    save(m,name); return m
room('garage_room_day',tube='tubew'); room('garage_room_night',tube='tube',neon='tube'); room('garage_room_tuning',tube='tubew',neon='ttg')
# material tuning: reemplazar neon por emisivo cian via geometria extra
m=M_(); m.mat('cy',(0,0,0,1),emis=(.1,.9,1)); m.mat('mg',(0,0,0,1),emis=(1,.1,.8))
for i,(mt,x) in enumerate((('cy',-5.8),('mg',5.8))): bx(m,mt,(x,2.5,0),(.12,3.5,.12),I_)
for z in(-4.9,4.9): bx(m,'cy' if z<0 else 'mg',(0,.2,z),(11,.08,.1),I_)
save(m,'garage_neon_tuning_kit')
# ---------- props ----------
def hjack():
    m=M_(); bx(m,'red',(0,.12,0),(.9,.12,.35),I_); bx(m,'steel',(.3,.35,0),(.12,.5,.18),I_); tube(m,'steel',(.3,.5,0),(-.9,.6,0),.04,I_,seg=6); bx(m,'dark',(-.9,.62,0),(.1,.04,.14),I_)
    for sx in(-.35,.35):
        for sz in(-.15,.15): m.cyl('rubber',(sx,.06,sz),.06,.05,8)
    save(m,'hydraulic_jack')
hjack()
def toolbox_red():
    m=M_(); bx(m,'red',(0,.55,0),(.9,1.1,.5),I_)
    for i in range(5): bx(m,'steel',(0,.15+i*.2,.26),(.7,.03,.03),I_)
    bx(m,'dark',(0,1.12,0),(.92,.04,.52),I_)
    for sx in(-.4,.4):
        for sz in(-.2,.2): m.cyl('rubber',(sx,.05,sz),.05,.1,8)
    save(m,'toolbox_rolling_chest')
toolbox_red()
def toolbox_small():
    m=M_(); bx(m,'blue',(0,.12,0),(.55,.24,.25),I_); bx(m,'steel',(0,.26,0),(.3,.02,.04),I_); save(m,'toolbox_small')
toolbox_small()
def bench():
    m=M_(); bx(m,'wood',(0,.92,0),(2.4,.08,.8),I_)
    for sx in(-1.1,1.1):
        for sz in(-.33,.33): bx(m,'steel',(sx,.45,sz),(.08,.9,.08),I_)
    bx(m,'steel',(0,.3,0),(2.2,.04,.7),I_); bx(m,'peg',(0,1.7,-.4),(2.4,1.4,.04),I_)
    bx(m,'red',(-.8,.99,.05),(.4,.1,.25),I_); bx(m,'steel',(.5,1.0,.1),(.5,.06,.12),I_)
    save(m,'workbench_pegboard')
bench()
def tire_obj(m,x,y,z,tf=I_,R=.33,W=.22):
    # neumatico recostado en Y (eje Y): cilindro + caras laterales
    m.cyl('tire',(x,y,z),R,W,20,R*.97); m.cyl('rubber',(x,y,z),R*.55,W+.01,16)
    disc(m,'side',R*.97,y+W/2+.001,20); disc(m,'side',R*.97,y-W/2-.001,20,up=False)
def tire_single():
    m=M_(); tire_obj(m,0,.11,0); save(m,'tire_single_flat')
    m=M_()
    # de pie, ejes en X: construir con rotacion de TF no soportada por cyl -> usar tubos
    save(m,'_tmp')
    import os; os.remove(O+'_tmp.glb')
tire_single()
def tire_stack(n,name):
    m=M_()
    for i in range(n): tire_obj(m,0,.11+i*.22,0)
    save(m,name)
tire_stack(4,'tire_stack_4'); tire_stack(6,'tire_stack_6')
def tire_stand(m,x,y,z,yaw=0):
    # llanta de pie: anillo con 16 segmentos como tubos
    N=14; R=.33; tf=TF(x,y,z,yaw,1)
    for i in range(N):
        a0=i/N*2*math.pi;a1=(i+1)/N*2*math.pi
        tube(m,'tire',(math.cos(a0)*R,math.sin(a0)*R,0),(math.cos(a1)*R,math.sin(a1)*R,0),.11,tf,seg=6)
    for i in range(10):
        a0=i/10*2*math.pi
    # cara lateral con textura
    for sgn in(-1,1):
        P=[tf((math.cos(i/N*2*math.pi)*R,math.sin(i/N*2*math.pi)*R,sgn*.11)) for i in range(N)]; c=tf((0,0,sgn*.11))
        for i in range(N): tri(m,'side',c,P[(i+1)%N] if sgn>0 else P[i],P[i] if sgn>0 else P[(i+1)%N],out=tf((0,0,-sgn*5)),uv=[(.5,.5),(.5+.5*math.cos((i+1)/N*2*math.pi),.5+.5*math.sin((i+1)/N*2*math.pi)),(.5+.5*math.cos(i/N*2*math.pi),.5+.5*math.sin(i/N*2*math.pi))] if sgn>0 else [(.5,.5),(.5+.5*math.cos(i/N*2*math.pi),.5+.5*math.sin(i/N*2*math.pi)),(.5+.5*math.cos((i+1)/N*2*math.pi),.5+.5*math.sin((i+1)/N*2*math.pi))])
def tire_rack():
    m=M_()
    for sx in(-1.3,1.3):
        for sz in(-.3,.3): bx(m,'steel',(sx,1.0,sz),(.06,2.0,.06),I_)
    for y in(.15,.95,1.75): bx(m,'steel',(0,y,-.3),(2.6,.05,.06),I_); bx(m,'steel',(0,y,.3),(2.6,.05,.06),I_)
    for r_,y in enumerate((.15,.95,1.75)):
        for k in range(4): tire_stand(m,-.9+k*.6,y+.38,0,math.pi/2)
    save(m,'tire_rack_3x4')
tire_rack()
def wheel_loose():
    m=M_(); tf=TF(0,.33,0,0,1); N=14; R=.28
    P=[tf((math.cos(i/N*2*math.pi)*R,math.sin(i/N*2*math.pi)*R,0)) for i in range(N)]
    for i in range(N): tri(m,'rim',tf((0,0,0)),P[i],P[(i+1)%N],out=(0,0,-5),uv=[(.5,.5),(.5+.5*math.cos(i/N*2*math.pi),.5+.5*math.sin(i/N*2*math.pi)),(.5+.5*math.cos((i+1)/N*2*math.pi),.5+.5*math.sin((i+1)/N*2*math.pi))]); 
    for i in range(N): tube(m,'steel',(math.cos(i/N*2*math.pi)*R,math.sin(i/N*2*math.pi)*R,0),(math.cos(i/N*2*math.pi)*R,math.sin(i/N*2*math.pi)*R,-.18),.02,tf,seg=4)
    save(m,'wheel_rim_loose')
wheel_loose()
def barrel():
    m=M_(); m.cyl('blue',(0,.45,0),.3,.9,12); 
    for y in(.15,.75): m.cyl('steel',(0,y,0),.31,.04,12)
    save(m,'oil_barrel')
barrel()
def oilcan():
    m=M_(); m.cyl('oil',(0,.12,0),.07,.24,10); m.cyl('steel',(0,.26,0),.03,.04,6); save(m,'oil_can')
oilcan()
def oilcans():
    m=M_()
    for i in range(6): 
        x=(i%3-1)*.2; y=.12+(i//3)*.26
        m.cyl('oil',(x,y,0),.07,.24,10)
    bx(m,'wood',(0,-.0,0),(.7,.02,.3),I_); save(m,'oil_can_stack')
oilcans()
def jerry():
    m=M_(); bx(m,'red',(0,.24,0),(.34,.48,.16),I_); bx(m,'red',(0,.5,.0),(.16,.06,.12),I_); m.cyl('yel',(.09,.54,0),.03,.06,6); save(m,'jerry_can')
jerry()
def compressor():
    m=M_(); m.cyl('red',(0,.45,0),.28,.8,12,.28); m.mesh=None if False else None
    tube(m,'red',(-.4,.45,0),(.4,.45,0),.26,I_,seg=12); bx(m,'dark',(0,.75,0),(.6,.2,.4),I_); m.cyl('steel',(0,1.0,0),.05,.15,6)
    for sx in(-.35,.35): m.cyl('rubber',(sx,.1,.2),.1,.06,10)
    save(m,'air_compressor')
compressor()
def lift():
    m=M_(); 
    for sx in(-1.4,1.4): bx(m,'yel',(sx,1.6,-.6),(.28,3.2,.28),I_); bx(m,'dark',(sx,.05,-.6),(.9,.1,.7),I_)
    bx(m,'yel',(0,3.1,-.6),(3.1,.25,.3),I_)
    for sx in(-1.4,1.4): bx(m,'steel',(sx*.8,1.0,.1),(.18,.12,1.8),I_)
    save(m,'car_lift_2post')
lift()
def hoist():
    m=M_(); bx(m,'blue',(0,.05,0),(1.0,.1,.1),I_)
    for sx in(-.5,.5): bx(m,'blue',(sx,.05,.6),(.1,.1,1.2),I_)
    bx(m,'blue',(0,1.1,.0),(.12,2.1,.12),I_); tube(m,'blue',(0,2.1,0),(0,2.1,.9),.06,I_,seg=6); tube(m,'steel',(0,2.1,.9),(0,1.2,.9),.015,I_,seg=4); bx(m,'dark',(0,1.15,.9),(.2,.1,.2),I_); save(m,'engine_hoist')
hoist()
def crate():
    m=M_(); bx(m,'wood',(0,.2,0),(.6,.4,.45),I_); bx(m,'crate',(0,.2,.226),(.4,.2,.01),I_); save(m,'crate_parts')
crate()
def shelf():
    m=M_()
    for sx in(-.9,.9):
        for sz in(-.2,.2): bx(m,'steel',(sx,1.0,sz),(.05,2,.05),I_)
    for y in (.1,.7,1.3,1.9):
        bx(m,'wood',(0,y,0),(1.9,.04,.5),I_)
    for x,y,mt in((-.5,.14,'oil'),(0,.3,'red'),(.5,.82,'blue'),(-.4,.95,'crate'),(.4,1.45,'oil'),(-.3,1.52,'red')): bx(m,mt,(x,y+.1 if y<1 else y,0),(.3,.2,.3),I_)
    save(m,'shelf_parts')
shelf()
def stool():
    m=M_(); m.cyl('red',(0,.55,0),.2,.06,10); 
    for a in (0,2.1,4.2): tube(m,'steel',(0,.5,0),(math.cos(a)*.25,0,math.sin(a)*.25),.015,I_,seg=4)
    save(m,'stool_garage')
stool()
def poster_obj(p):
    m=M_(); bx(m,'dark',(0,0,0),(.84,1.2,.02),I_); m.quad('post'+p,(-.4,-.58,.012),(.4,-.58,.012),(.4,.58,.012),(-.4,.58,.012),UV); save(m,f'poster_frame_{p}')
for p in 'abc': poster_obj(p)
m=M_(); bx(m,'dark',(0,0,0),(2,.62,.08),I_); m.quad('sign',(-.95,-.28,.045),(.95,-.28,.045),(.95,.28,.045),(-.95,.28,.045),UV); save(m,'sign_garage_hanging')
m=M_(); m.cyl('fire',(0,.25,0),.07,.5,8); m.cyl('dark',(0,.52,0),.03,.06,6); bx(m,'dark',(.05,.5,0),(.1,.03,.03),I_); save(m,'fire_extinguisher')
m=M_(); bx(m,'steel',(0,.55,0),(.6,1.1,.55),I_); bx(m,'dark',(0,.88,.28),(.4,.1,.02),I_); bx(m,'glass',(0,.6,.285),(.45,.55,.01),I_); save(m,'mini_fridge')
def worklight():
    m=M_(); tube(m,'dark',(0,0,0),(0,1.6,0),.02,I_,seg=5)
    for a in(0,2.1,4.2): tube(m,'dark',(0,.4,0),(math.cos(a)*.4,0,math.sin(a)*.4),.015,I_,seg=4)
    bx(m,'steel',(0,1.7,0),(.4,.3,.12),I_); bx(m,'tubew',(0,1.7,.07),(.34,.24,.02),I_); save(m,'work_light_stand')
worklight()
def tchanger():
    m=M_(); bx(m,'dark',(0,.45,0),(.9,.9,.8),I_); m.cyl('steel',(0,.95,0),.35,.06,16); tube(m,'steel',(.3,.95,.2),(.3,1.6,.2),.03,I_,seg=5); tube(m,'steel',(.3,1.6,.2),(0,1.6,.1),.03,I_,seg=5); save(m,'tire_changer')
tchanger()
def cone():
    m=M_(); bx(m,'dark',(0,.02,0),(.32,.04,.32),I_); m.cyl('yel',(0,.3,0),.14,.52,10,.02); save(m,'garage_cone')
cone()
m=M_(); 
for i in range(3): bx(m,'steel',(0,.15+i*.0,0),(.01,.01,.01),I_)
# ---------- decals de huellas ----------
def decal(name,tex,w,l,uv=(1,1)):
    m=M(); m.mat('d',(1,1,1,1),tex=tex,double=True); m.quad('d',(-w/2,.012,l/2),(w/2,.012,l/2),(w/2,.012,-l/2),(-w/2,.012,-l/2),((0,0),(uv[0],0),(uv[0],uv[1]),(0,uv[1]))); m.save(O+name+'.glb')
for n,t in(('dry_a','decal_skid_dry_a'),('dry_b','decal_skid_dry_b'),('wet','decal_skid_wet'),('dirt','decal_skid_dirt'),('snow','decal_skid_snow')): decal('skid_'+n,t+'.png',2.2,6)
decal('skid_drift_curve','decal_skid_drift_curve.png',7,7); decal('skid_burnout','decal_skid_burnout.png',6,6)
m=M(); m.mat('s',(1,1,1,1),tex='smoke_atlas.png',double=True); m.quad('s',(-1,-1,0),(1,-1,0),(1,1,0),(-1,1,0),UV); m.save(O+'vfx_smoke_quad.glb')
m=M(); m.mat('s',(1,1,1,1),tex='spark_sprite.png',double=True); m.quad('s',(-.5,-.5,0),(.5,-.5,0),(.5,.5,0),(-.5,.5,0),UV); m.save(O+'vfx_spark_quad.glb')
import glob,os; print(len(glob.glob(O+'*.glb')))
