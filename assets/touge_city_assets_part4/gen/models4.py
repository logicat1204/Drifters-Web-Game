from glb import *
import math, numpy as np
exec(open('prims.py').read())
O='../models/'
def save(m,n): m.save(O+n+'.glb')
TEAMS=[((.95,.35,.7),(.08,.08,.1)),((.15,.35,.85),(.95,.95,.98)),((.85,.1,.15),(.95,.95,.98)),((.98,.8,.1),(.08,.08,.1))]
HAIR2=HAIR+[(.95,.85,.55),(.85,.35,.55),(.45,.2,.12)]
def wmats(m):
    pmats(m)
    for i,(a,b) in enumerate(TEAMS): m.mat(f'ta{i}',a+(1,),rough=.8,double=True); m.mat(f'tb{i}',b+(1,),rough=.8,double=True)
    for i,c in enumerate(HAIR2): m.mat(f'hh{i}',c+(1,),rough=1)
    m.mat('boot',(.08,.08,.1,1),rough=.6); m.mat('shoe',(.95,.95,.95,1),rough=.8); m.mat('poncho',(.98,.82,.1,1),double=True,rough=.5); m.mat('ponchoT',(.6,.75,.95,.6),double=True,rough=.2)
    m.mat('bd1',(1,1,1,1),tex='number_board_01.png',double=True); m.mat('bd2',(1,1,1,1),tex='number_board_02.png',double=True)
    for n in ('banner_race_angels','banner_mf_race','banner_fans_a','banner_fans_b'): m.mat(n,(1,1,1,1),tex=n+'.png',double=True)
    m.mat('phone',(.08,.08,.1,1),emis=(.2,.3,.5))
def woman(m,x,z,yaw,pose,rg,outfit='angel',team=0,sc=1.0):
    tf=TF(x,0,z,yaw,sc*.95); k=f'k{rg.integers(0,3)}'; hr=f'hh{rg.integers(0,6)}'; hs=rg.choice(['long','pony','twin','long'])
    A,B=f'ta{team}',f'tb{team}'
    if outfit=='angel': top,low,foot=A,B,'boot'
    elif outfit=='fan': top=f's{rg.integers(0,8)}'; low=f'p{rg.integers(0,3)}'; foot='shoe'
    else: top,low,foot='poncho','poncho','boot'
    # piernas
    for sx in(-1,1):
        if outfit=='angel':
            tube(m,k,(sx*.07,.84,0),(sx*.06,.46,.01),.075,tf,r2=.058); tube(m,foot,(sx*.06,.48,.01),(sx*.06,0,.0),.065,tf,r2=.06); bx(m,foot,(sx*.06,.03,.05),(.1,.06,.2),tf)
        elif outfit=='fan':
            tube(m,low,(sx*.07,.86,0),(sx*.075,.62,0),.088,tf); tube(m,k,(sx*.075,.62,0),(sx*.06,.08,0),.062,tf,r2=.05); bx(m,foot,(sx*.06,.04,.05),(.1,.07,.22),tf)
        else:
            tube(m,k,(sx*.07,.84,0),(sx*.06,.3,0),.065,tf,r2=.05); tube(m,foot,(sx*.06,.32,0),(sx*.06,0,0),.065,tf); bx(m,foot,(sx*.06,.03,.05),(.1,.06,.2),tf)
    sph(m,low if outfit!='rain' else 'poncho',(0,.86,0),.14,tf,sq=.75)
    if outfit=='angel': tube(m,low,(0,.93,0),(0,.62,0),.13,tf,seg=8,r2=.25)
    tube(m,top,(0,.9,0),(0,1.08,0),.115,tf); tube(m,top,(0,1.08,0),(0,1.42,0),.125,tf,seg=7,r2=.15)
    if outfit!='rain':
        for sx in(-1,1): sph(m,top,(sx*.07,1.29,.085),.072,tf)
    tube(m,k,(0,1.42,0),(0,1.53,0),.042,tf)
    sph(m,k,(0,1.63,0),.105,tf,sq=1.1); sph(m,hr,(0,1.66,-.015),.115,tf,sq=.95)
    if hs=='long': tube(m,hr,(0,1.62,-.1),(0,1.05,-.14),.09,tf,r2=.06)
    elif hs=='pony': tube(m,hr,(0,1.7,-.11),(0,1.28,-.27),.048,tf,r2=.035)
    else:
        for sx in(-1,1): tube(m,hr,(sx*.1,1.7,-.04),(sx*.2,1.2,-.1),.045,tf,r2=.03)
    for sx in(-1,1): sph(m,top,(sx*.17,1.4,0),.052,tf)
    if outfit=='rain':
        tube(m,'ponchoT' if rg.random()<.4 else 'poncho',(0,1.5,0),(0,.55,0),.12,tf,seg=8,r2=.36); sph(m,'poncho',(0,1.66,-.04),.14,tf,sq=.9)
    def arm(sx,u,f,fore_mat=None):
        tube(m,top if outfit!='fan' else k,(sx*.17,1.4,0),u,.046,tf); tube(m,k,u,f,.04,tf); sph(m,k,f,.042,tf)
    S_=lambda sx:((sx*.2,1.15,.03),(sx*.21,.92,.08))
    if pose=='stand':
        for sx in(-1,1): arm(sx,*S_(sx))
    elif pose=='hip':
        arm(-1,*S_(-1)); arm(1,(.31,1.2,0),(.15,1.0,.05))
    elif pose=='cheer':
        for sx in(-1,1): arm(sx,(sx*.3,1.62,0),(sx*.38,1.84,0))
    elif pose=='wave':
        arm(-1,*S_(-1)); arm(1,(.32,1.5,.05),(.42,1.76,.08))
    elif pose in('board','banner'):
        arm(-1,(-.2,1.22,.2),(-.28,1.3,.42) if pose=='board' else (-.45,1.45,.36)); arm(1,(.2,1.22,.2),(.28,1.3,.42) if pose=='board' else (.45,1.45,.36))
        if pose=='board':
            bm=rg.choice(['bd1','bd2']); P=lambda xx,yy,zz:tf((xx,yy,zz)); m.quad(bm,P(-.3,1.0,.46),P(.3,1.0,.46),P(.3,1.72,.46),P(-.3,1.72,.46),((0,0),(1,0),(1,1),(0,1)))
        else:
            bm=rg.choice(['banner_race_angels','banner_mf_race','banner_fans_a','banner_fans_b']); P=lambda xx,yy,zz:tf((xx,yy,zz)); m.quad(bm,P(-.45,1.28,.4),P(.45,1.28,.4),P(.45,1.62,.4),P(-.45,1.62,.4),((0,0),(1,0),(1,1),(0,1)))
    elif pose=='flag':
        arm(-1,*S_(-1)); arm(1,(.3,1.62,0),(.4,1.84,0)); tube(m,'flagp',(.4,1.5,0),(.4,3.0,0),.015,tf,seg=4)
        P=lambda xx,yy,zz:tf((xx,yy,zz)); m.quad('flagt',P(.4,2.5,0),P(1.4,2.5,.1),P(1.4,3.0,.1),P(.4,3.0,0),((0,0),(1,0),(1,1),(0,1)))
    elif pose=='umbrella':
        arm(-1,*S_(-1)); arm(1,(.28,1.25,.05),(.32,1.45,.08)); tube(m,'flagp',(.32,.95,.08),(.32,2.55,.08),.018,tf,seg=4)
        top_=(.32,2.55,.08)
        for i in range(10):
            a0=i/10*2*math.pi;a1=(i+1)/10*2*math.pi; q=lambda a:(.32+math.cos(a)*.95,2.2,.08+math.sin(a)*.95)
            tri(m,A if i%2==0 else B,tf(top_),tf(q(a0)),tf(q(a1)),tf((.32,1.6,.08)))
    elif pose=='photo':
        for sx in(-1,1): arm(sx,(sx*.2,1.3,.2),(sx*.07,1.55,.34))
        bx(m,'phone',(0,1.55,.37),(.16,.1,.03),tf)
def mk(name,fn,seed=1):
    m=M(); wmats(m); fn(m,np.random.default_rng(seed)); save(m,name)
single=lambda pose,outfit='angel',team=0:(lambda m,rg:woman(m,0,0,0,pose,rg,outfit,team))
for n,pose,out,tm,sd in (('angel_stand_a','stand','angel',0,1),('angel_stand_b','stand','angel',1,2),('angel_hip','hip','angel',2,3),('angel_cheer','cheer','angel',3,4),('angel_wave','wave','angel',0,5),
                         ('angel_board_01','board','angel',1,6),('angel_board_02','board','angel',2,7),('angel_flag','flag','angel',3,8),('angel_umbrella','umbrella','angel',0,9),('angel_photo','photo','angel',1,10),
                         ('fan_girl_stand','stand','fan',0,11),('fan_girl_banner','banner','fan',0,12),('fan_girl_cheer','cheer','fan',0,13),('fan_girl_rain','umbrella','rain',0,14)):
    mk(n,single(pose,out,tm),sd)
def man(pose,mat=None):
    def f(m,rg): person(m,0,0,0,pose,rg)
    return f
mk('fan_boy_cheer',man('cheer'),21); mk('staff_mechanic',man('marshal'),22)
def crowd(name,n,items,seed,L=10,layout='row',outfit_mix=None):
    m=M(); wmats(m); rg=np.random.default_rng(seed)
    for i in range(n):
        if layout=='row': x=-L/2+L*i/max(1,n-1)+rg.uniform(-.1,.1); z=rg.uniform(-.2,.2)
        else: x,z=rg.normal(0,1.0,2)
        kind,pose,out=items[i%len(items)] if outfit_mix is None else items[rg.integers(0,len(items))]
        yaw=rg.uniform(-.4,.4)
        if kind=='w': woman(m,x,z,yaw,pose,rg,out,team=int(rg.integers(0,4)),sc=rg.uniform(.96,1.04))
        else: person(m,x,z,yaw,pose,rg,sc=rg.uniform(.95,1.05))
    save(m,name)
crowd('crowd_angels_row_6',6,[('w','stand','angel'),('w','hip','angel'),('w','wave','angel'),('w','cheer','angel')],31,L=9)
crowd('crowd_angels_group',5,[('w','cheer','angel'),('w','wave','angel'),('w','hip','angel'),('w','stand','angel'),('w','photo','angel')],32,layout='group')
crowd('crowd_fans_row_a',14,[('w','banner','fan'),('m','cheer',''),('w','cheer','fan'),('m','stand',''),('w','stand','fan'),('m','photo','')],33)
crowd('crowd_fans_row_b',14,[('w','cheer','fan'),('m','flag',''),('w','photo','fan'),('m','cheer',''),('w','banner','fan')],34)
crowd('crowd_fans_group_a',8,[('w','cheer','fan'),('m','cheer',''),('w','stand','fan'),('w','banner','fan')],35,layout='group',outfit_mix=1)
crowd('crowd_fans_group_b',8,[('w','photo','fan'),('m','stand',''),('w','cheer','fan'),('m','photo','')],36,layout='group',outfit_mix=1)
crowd('crowd_rain_row',12,[('w','umbrella','rain'),('m','umbrella',''),('w','umbrella','angel'),('w','stand','rain')],37)
crowd('crowd_night_row',14,[('w','photo','fan'),('m','photo',''),('w','cheer','fan'),('m','stand',''),('w','wave','fan')],38)
crowd('crowd_staff_group',6,[('m','marshal',''),('m','stand',''),('w','stand','angel')],39,layout='group')
# ================= ciudad nocturna mojada =================
def neon_sign(name,tex,w=1.6):
    m=M(); m.mat('b',(.05,.05,.07,1),metal=.3,rough=.5); m.mat('n',(1,1,1,1),tex=tex,etex=tex,double=True); h=w/2
    m.box('b',(0,0,0),(w,h,.12)); m.quad('n',(-w/2,-h/2,.07),(w/2,-h/2,.07),(w/2,h/2,.07),(-w/2,h/2,.07),((0,0),(1,0),(1,1),(0,1))); m.quad('n',(w/2,-h/2,-.07),(-w/2,-h/2,-.07),(-w/2,h/2,-.07),(w/2,h/2,-.07),((0,0),(1,0),(1,1),(0,1))); save(m,name)
for n in ('ramen','bar','hotel','arcade','izakaya'): neon_sign('neon_sign_'+n,f'neon_{n}.png')
m=M(); m.mat('c',(.9,.85,.85,1),tex='chochin_lantern.png',etex='chochin_lantern.png'); m.mat('k',(.08,.08,.08,1)); m.cyl('k',(0,.2,0),.12,.04,10); m.cyl('c',(0,0,0),.24,.4,12); m.cyl('k',(0,-.2,0),.12,.04,10); save(m,'chochin_lantern')
m=M(); m.mat('c',(.9,.85,.85,1),tex='chochin_lantern.png',etex='chochin_lantern.png'); m.mat('w',(.05,.05,.05,1))
for i in range(6): m.cyl('c',(-5+i*2,-.6+0.18*math.sin(i*1.0),0),.24,.4,10)
for i in range(11): 
    a=(-5+i,-.2*math.sin(math.pi*i/10)*0-.02*(i-5)**2*0.0,0)
tube(m,'w',(-6,.1,0),(6,.1,0),.012,TF(),seg=3); save(m,'chochin_string_6')
m=M(); m.mat('b',(.85,.88,.92,1)); m.mat('f',(.7,.85,1,1),emis=(.55,.75,1)); m.mat('k',(.1,.1,.12,1)); m.mat('r',(.9,.15,.2,1),emis=(.8,.1,.15)); m.mat('o',(1,.6,.1,1),emis=(.9,.5,.05))
m.box('b',(0,.95,0),(.9,1.9,.75)); m.box('f',(0,1.2,.39),(.7,1.1,.02)); m.box('k',(0,.35,.39),(.5,.18,.02)); m.box('r',(-.2,1.65,.4),(.2,.12,.02)); m.box('o',(.2,1.65,.4),(.2,.12,.02)); save(m,'vending_machine_lit')
m=M(); m.mat('pole',(.2,.21,.24,1),metal=.6,rough=.4); m.mat('lamp',(1,.92,.7,1),emis=(1,.85,.5)); m.mat('cone',(1,1,1,1),tex='light_cone.png',double=True)
m.cyl('pole',(0,3.5,0),.08,7,8,.05); m.box('pole',(.9,6.9,0),(1.9,.08,.1)); m.box('lamp',(1.7,6.82,0),(.7,.12,.28))
for (a,b,c,d) in (((-2.2,0,0),(2.2,0,0),(.3,6.8,0),(.3,6.8,0)),):
    pass
cx=1.7
m.quad('cone',(cx-.3,6.78,0),(cx+.3,6.78,0),(cx+2.6,.02,0),(cx-2.6,.02,0),((.5,0),(.5,0),(1,1),(0,1)) ) if False else None
m.quad('cone',(cx-2.6,.02,0),(cx+2.6,.02,0),(cx+.3,6.78,0),(cx-.3,6.78,0),((0,1),(1,1),(.6,0),(.4,0))); m.quad('cone',(cx,.02,-2.6),(cx,.02,2.6),(cx,6.78,.3),(cx,6.78,-.3),((0,1),(1,1),(.6,0),(.4,0))); save(m,'streetlight_cone')
def puddle(name,seed,r=1.6,sq=.6):
    m=M(); m.mat('p',(.02,.03,.05,1),metal=1.0,rough=.03); rg=np.random.default_rng(seed); n=18; pts=[]
    for i in range(n):
        a=i/n*2*math.pi; k=1+rg.uniform(-.28,.28)+.18*math.sin(3*a+seed); pts.append((math.cos(a)*r*k,.015,math.sin(a)*r*k*sq))
    for i in range(n): quadup(m,'p',(0,.015,0),pts[i],pts[(i+1)%n],pts[(i+1)%n],((0,0),(1,0),(1,1),(1,1))) if False else tri(m,'p',(0,.015,0),pts[(i+1)%n],pts[i],out=(0,5,0))
    save(m,name)
puddle('puddle_a',1,1.4,.6); puddle('puddle_b',2,2.4,.5); puddle('puddle_c',3,3.4,.7)
def wet_plane(name,tex,mr_,w,l,uv):
    m=M(); m.mat('r',(1,1,1,1),tex=tex,mr=mr_,double=True); quadup(m,'r',(-w/2,0,l/2),(w/2,0,l/2),(w/2,0,-l/2),(-w/2,0,-l/2),((0,0),(uv[0],0),(uv[0],uv[1]),(0,uv[1]))); save(m,name)
wet_plane('road_city_wet_segment','road_city_wet.png','road_city_wet_mr.png',14,20,(1,5)); wet_plane('city_intersection_wet','asphalt_wet_night.png','asphalt_wet_night_mr.png',14,14,(2,2))
wet_plane('crosswalk_wet_plane','crosswalk_wet.png','crosswalk_wet_mr.png',14,3.6,(1,.26)); wet_plane('asphalt_wet_tile_20m','asphalt_wet_night.png','asphalt_wet_night_mr.png',20,20,(4,4))
def bld(name,tex,em,w,h,d,rep):
    m=M(); m.mat('f',(1,1,1,1),tex=tex,etex=em,rough=.6); m.mat('roof',(.12,.12,.14,1))
    for (a,b,c,dd) in (((-w/2,0,d/2),(w/2,0,d/2),(w/2,h,d/2),(-w/2,h,d/2)),((w/2,0,-d/2),(-w/2,0,-d/2),(-w/2,h,-d/2),(w/2,h,-d/2)),((w/2,0,d/2),(w/2,0,-d/2),(w/2,h,-d/2),(w/2,h,d/2)),((-w/2,0,-d/2),(-w/2,0,d/2),(-w/2,h,d/2),(-w/2,h,-d/2))):
        m.quad('f',a,b,c,dd,((0,0),(rep[0],0),(rep[0],rep[1]),(0,rep[1])))
    m.box('roof',(0,h+.15,0),(w,.3,d)); save(m,name)
bld('building_office_wet_night','facade_office_wet.png','facade_office_emissive.png',14,42,14,(2,3)); bld('building_apartment_wet_night','facade_apartment_wet.png','facade_apartment_emissive.png',16,24,10,(1.5,2)); bld('building_shop_wet_night','facade_shop_wet.png','facade_shop_emissive.png',8,7,8,(1,1))
m=M(); m.mat('p',(.2,.22,.24,1),metal=.5); m.mat('box',(.1,.12,.12,1)); m.mat('r',(1,.1,.1,1),emis=(1,.1,.1)); m.mat('y',(.3,.25,0,1)); m.mat('g',(.05,.3,.15,1))
m.cyl('p',(0,3,0),.1,6,8); m.box('p',(1.8,5.8,0),(3.6,.12,.12)); m.box('box',(3.4,5.8,0),(1.1,.4,.35))
for x,mt in ((3.1,'g'),(3.4,'y'),(3.7,'r')): m.sphere(mt,(x,5.8,.2),.14,6,4)
save(m,'traffic_light_red_lit')
m=M(); m.mat('r',(1,1,1,1),tex='rain_streaks.png',double=True); R=6; H=12; N=20
for i in range(N):
    a0=i/N*2*math.pi;a1=(i+1)/N*2*math.pi; m.quad('r',(math.cos(a0)*R,0,math.sin(a0)*R),(math.cos(a1)*R,0,math.sin(a1)*R),(math.cos(a1)*R,H,math.sin(a1)*R),(math.cos(a0)*R,H,math.sin(a0)*R),((i/N*6,1),((i+1)/N*6,1),((i+1)/N*6,0),(i/N*6,0)))
save(m,'rain_curtain_cylinder')
import os,glob; print(len(glob.glob(O+'*.glb')),sorted(os.path.basename(f) for f in glob.glob(O+'*.glb')))
