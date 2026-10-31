from glb import *
import math
O='../models/'
def metal(m,n,c): m.mat(n,c,metal=.6,rough=.5)
# 1 guardrail 4m
m=M(); m.mat('beam',(.85,.87,.9,1),tex='guardrail_metal.png',metal=.5,rough=.5,double=True); m.mat('post',(.7,.72,.75,1),metal=.5,rough=.6); m.mat('refl',(1,.55,.1,1),emis=(.6,.25,0))
for x in (-2,0,2): m.cyl('post',(x,.4,0),.05,.8,8)
m.box('beam',(0,.62,.06),(4,.32,.05),uvs=(2,1)); m.box('refl',(1,.62,.09),(.12,.1,.02)); m.save(O+'guardrail_segment.glb')
# 2 streetlight
m=M(); m.mat('pole',(.55,.57,.6,1),metal=.6,rough=.5); m.mat('lamp',(1,.92,.7,1),emis=(1,.85,.5))
m.cyl('pole',(0,3.5,0),.08,7,8,.05); m.box('pole',(.9,6.9,0),(1.9,.08,.1)); m.box('lamp',(1.7,6.82,0),(.7,.12,.28)); m.save(O+'streetlight.glb')
# 3 utility pole
m=M(); m.mat('wood',(.38,.28,.2,1)); m.mat('wire',(.1,.1,.1,1)); m.mat('trans',(.5,.52,.5,1))
m.cyl('wood',(0,4.5,0),.13,9,8,.1); m.box('wood',(0,8,0),(2.2,.1,.1)); m.box('wood',(0,7.2,0),(1.8,.1,.1)); m.cyl('trans',(.5,6.2,0),.22,.7,8)
for x in (-1,0,1): m.box('wire',(x,8.1,0),(.02,.02,6),); 
m.save(O+'utility_pole.glb')
# 4 cedar
m=M(); m.mat('trunk',(.28,.2,.14,1)); m.mat('leaf',(.1,.28,.16,1))
m.cyl('trunk',(0,1.2,0),.25,2.4,6)
for k in range(5): m.cyl('leaf',(0,3+k*1.7,0),.05,2.2,8,r2=0)  # placeholder replaced below
m=M(); m.mat('trunk',(.28,.2,.14,1)); m.mat('leaf',(.1,.28,.16,1)); m.cyl('trunk',(0,1.2,0),.25,2.4,6)
for k in range(5): 
    r=2.0-k*.32; m.cyl('leaf',(0,2.6+k*1.6,0),r,2.2,8,r2=0.0001)
m.save(O+'tree_cedar.glb')
# 5 autumn tree
m=M(); m.mat('trunk',(.3,.2,.14,1)); m.mat('o1',(.85,.38,.1,1)); m.mat('o2',(.8,.2,.1,1)); m.mat('o3',(.92,.6,.15,1))
m.cyl('trunk',(0,1.5,0),.3,3,6,.2)
for i,(x,y,z,r,mt) in enumerate([(0,4.4,0,1.9,'o1'),(1.2,3.8,.4,1.3,'o2'),(-1.2,3.9,-.3,1.4,'o3'),(.2,5.6,.2,1.3,'o2'),(-.4,3.6,1.1,1.1,'o1')]): m.sphere(mt,(x,y,z),r,8,5)
m.save(O+'tree_autumn.glb')
# 6 chevron sign
m=M(); m.mat('post',(.5,.52,.55,1),metal=.5); m.mat('board',(1,1,1,1),tex='sign_chevron.png',double=True)
m.cyl('post',(-.8,.9,0),.04,1.8,6); m.cyl('post',(.8,.9,0),.04,1.8,6); m.quad('board',(-1,1.0,0),(1,1.0,0),(1,2.0,0),(-1,2.0,0),((0,0),(1,0),(1,1),(0,1))); m.save(O+'sign_chevron.glb')
# 7 buildings
def building(name,tex,w,h,d,rep):
    m=M(); m.mat('f',(1,1,1,1),tex=tex); m.mat('roof',(.35,.36,.38,1))
    cx=0
    m.quad('f',(-w/2,0,d/2),(w/2,0,d/2),(w/2,h,d/2),(-w/2,h,d/2),((0,0),(rep[0],0),(rep[0],rep[1]),(0,rep[1])))
    m.quad('f',(w/2,0,-d/2),(-w/2,0,-d/2),(-w/2,h,-d/2),(w/2,h,-d/2),((0,0),(rep[0],0),(rep[0],rep[1]),(0,rep[1])))
    m.quad('f',(w/2,0,d/2),(w/2,0,-d/2),(w/2,h,-d/2),(w/2,h,d/2),((0,0),(rep[0],0),(rep[0],rep[1]),(0,rep[1])))
    m.quad('f',(-w/2,0,-d/2),(-w/2,0,d/2),(-w/2,h,d/2),(-w/2,h,-d/2),((0,0),(rep[0],0),(rep[0],rep[1]),(0,rep[1])))
    m.box('roof',(0,h+.15,0),(w,.3,d))
    m.save(O+name+'.glb')
building('building_office','facade_office.png',14,42,14,(2,3)); building('building_office_night','facade_office_night.png',14,42,14,(2,3))
building('building_apartment','facade_apartment.png',16,24,10,(1.5,2)); building('building_apartment_night','facade_apartment_night.png',16,24,10,(1.5,2))
building('building_shop','facade_shop.png',8,7,8,(1,1)); building('building_shop_night','facade_shop_night.png',8,7,8,(1,1))
# torii
m=M(); m.mat('red',(.78,.12,.08,1),rough=.6); m.mat('blk',(.08,.08,.08,1))
for x in (-2,2): m.cyl('red',(x,2.5,0),.22,5,10,.19); m.box('blk',(x,.1,0),(.6,.2,.6))
m.box('red',(0,4.9,0),(6.4,.28,.34)); m.box('blk',(0,5.2,0),(7,.16,.42)); m.box('red',(0,4.2,0),(4.6,.2,.22)); m.box('red',(0,4.55,0),(.3,.6,.22)); m.save(O+'torii_gate.glb')
# vending machine
m=M(); m.mat('body',(.9,.9,.92,1)); m.mat('front',(.2,.5,.95,1),emis=(.15,.35,.8)); m.mat('slot',(.1,.1,.1,1))
m.box('body',(0,.95,0),(.9,1.9,.75)); m.box('front',(0,1.15,.39),(.7,1.1,.02)); m.box('slot',(0,.35,.39),(.5,.18,.02)); m.save(O+'vending_machine.glb')
# traffic light
m=M(); m.mat('pole',(.2,.22,.24,1),metal=.5); m.mat('box',(.1,.12,.12,1)); m.mat('g',(.1,1,.5,1),emis=(.1,1,.5)); m.mat('y',(.6,.5,0,1)); m.mat('r',(.5,.05,.05,1))
m.cyl('pole',(0,3,0),.1,6,8); m.box('pole',(1.8,5.8,0),(3.6,.12,.12)); m.box('box',(3.4,5.8,0),(1.1,.4,.35)); 
for x,mt in ((3.1,'g'),(3.4,'y'),(3.7,'r')): m.sphere(mt,(x,5.8,.2),.14,6,4)
m.save(O+'traffic_light.glb')
# road segments (8m wide x 20 long)
for n,t,w,rep in (('road_mountain_segment','road_mountain.png',7,(1,5)),('road_city_segment','road_city.png',14,(1,5))):
    m=M(); m.mat('r',(1,1,1,1),tex=t); m.quad('r',(-w/2,0,10),(w/2,0,10),(w/2,0,-10),(-w/2,0,-10),((0,0),(rep[0],0),(rep[0],rep[1]),(0,rep[1]))); m.save(O+n+'.glb')
# retaining wall 10m
m=M(); m.mat('c',(1,1,1,1),tex='concrete_wall.png'); m.mat('top',(.5,.5,.48,1))
m.quad('c',(-5,0,0),(5,0,0),(5,5,-1.5),(-5,5,-1.5),((0,0),(4,0),(4,2),(0,2))); m.box('top',(0,5.05,-1.7),(10,.2,.7)); m.save(O+'retaining_wall.glb')
# rock cliff chunk
m=M(); m.mat('r',(1,1,1,1),tex='rock_cliff.png')
m.quad('r',(-6,0,0),(6,0,0),(5,9,-3),(-5,9,-3),((0,0),(3,0),(3,3),(0,3))); m.save(O+'cliff_face.glb')
# tunnel segment 10m long, radius 5.2
m=M(); m.mat('w',(1,1,1,1),tex='tunnel_wall.png',double=True); m.mat('lamp',(1,.9,.6,1),emis=(1,.8,.4)); m.mat('floor',(.3,.3,.32,1))
R=5.2;N=14;L=10
for i in range(N):
    a0=math.pi*i/N;a1=math.pi*(i+1)/N
    p=lambda a,z:(math.cos(a)*R,math.sin(a)*R,z)
    m.quad('w',p(a0,-L/2),p(a0,L/2),p(a1,L/2),p(a1,-L/2),((i/N*4,0),(i/N*4,2),((i+1)/N*4,2),((i+1)/N*4,0)))
m.box('floor',(0,-.1,0),(2*R,.2,L)); 
for s in (-1,1): m.box('lamp',(s*2.2,R*.93,0),(.35,.08,L*.8))
m.save(O+'tunnel_segment.glb')
import os; print(sorted(os.listdir(O)))
