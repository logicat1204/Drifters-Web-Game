"""Original car surfaces, not conversions of downloaded models.
Blender 5.1: --factory-startup -b --python scripts/build-car-catalog.py -- ROOT [ids...]
All design coordinates: metres, X right, Y up, Z forward.
"""
import bpy, math, json, sys, os, time
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];ROOT=os.path.abspath(args[0]);OUT=os.path.join(ROOT,'assets','cars','original')
cars=json.load(open(os.path.join(OUT,'catalog-specs.json'),encoding='utf8'))['cars']
if len(args)>1:cars=[c for c in cars if c['id'] in args[1:]]
def xyz(v):return (v[0],-v[2],v[1])
def mix(a,b,t):return a+(b-a)*t
def smooth(t):return t*t*(3-2*t)
def linear(x):return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
def replace_file(source,target):
 # Windows indexers or a live static-file reader may hold a short sharing lock.
 # Keep the complete previous asset available until the new export can replace it.
 for attempt in range(30):
  try:os.replace(source,target);return
  except (PermissionError,OSError):
   if attempt==29:raise
   time.sleep(.1)
COLORS={'paint':'#e7e6df','hood':'#e7e6df','trim':'#20262e','rubber':'#13161b','rim':'#57606b','metal':'#a5afb6','disc':'#434b54','glass':'#536e7e','front_lamp':'#ecf2e2','tail_lamp':'#a92027','amber':'#db7a1c','seat':'#343b44','decal':'#1c252c','vinyl_blue':'#397dbb','vinyl_white':'#edf2f4','lower_tone':'#54616a','red_trim':'#a92a32'}
class Part:
 def __init__(self,name):self.name=name;self.v=[];self.faces=[];self.mats=[];self.smooth=[];self.shared={}
 def add(self,verts,faces,mat,smooth=False,normal=None):
  indices=[]
  for vertex in verts:
   key=(mat,)+tuple(round(x,7)for x in vertex)
   if smooth and key in self.shared:indices.append(self.shared[key])
   else:
    index=len(self.v);self.v.append(vertex);indices.append(index)
    if smooth:self.shared[key]=index
  for face in faces:
   a,b,c=[Vector(verts[i]) for i in face[:3]];n=(b-a).cross(c-a);p=sum((Vector(verts[i])for i in face),Vector())/len(face)
   radial=p-Vector((0,0 if self.name=='wheel' else .55,0));radial.z*=1 if self.name=='wheel' else .12
   if n.dot(Vector(normal) if normal else radial)<0:face=tuple(reversed(face))
   self.faces.append(tuple(indices[i]for i in face));self.mats.append(mat);self.smooth.append(smooth)
 def quad(self,a,b,c,d,mat='paint',up=False,smooth=False):self.add([a,b,c,d],[(0,1,2,3)],mat,smooth,(0,1,0)if up else None)
 def grid(self,rows,cols,fn,mat='paint',smooth=True,skip=None):
  verts=[fn(i/rows,j/cols)for i in range(rows+1)for j in range(cols+1)];faces=[]
  for i in range(rows):
   for j in range(cols):
    if skip and skip((i+.5)/rows,(j+.5)/cols):continue
    a=i*(cols+1)+j;faces.append((a,a+1,a+cols+2,a+cols+1))
  self.add(verts,faces,mat,smooth)
 def box(self,p,size,mat='trim',bevel=0):
  x,y,z=p;w,h,d=[s/2 for s in size];b=min(bevel,w*.4,h*.4,d*.4)
  if b<=0:
   self.add([(x+i*w,y+j*h,z+k*d)for i,j,k in [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],mat);return
  vertices=[]
  for yy,inset in [(-h,b),(-h+b,0),(h-b,0),(h,b)]:
   ww,dd=w-inset,d-inset;bb=min(b,ww*.4,dd*.4)
   vertices.extend((x+a,y+yy,z+c)for a,c in [(-ww+bb,-dd),(ww-bb,-dd),(ww,-dd+bb),(ww,dd-bb),(ww-bb,dd),(-ww+bb,dd),(-ww,dd-bb),(-ww,-dd+bb)])
  faces=[tuple(range(7,-1,-1)),tuple(range(24,32))]
  for ring in range(3):
   for i in range(8):faces.append((ring*8+i,ring*8+(i+1)%8,(ring+1)*8+(i+1)%8,(ring+1)*8+i))
  self.add(vertices,faces,mat)
 def line(self,a,b,r,mat='trim',n=8):
  a,b=Vector(a),Vector(b);direction=(b-a).normalized();u=direction.cross(Vector((0,1,0)))
  if u.length<.01:u=direction.cross(Vector((1,0,0)))
  u.normalize();v=direction.cross(u)
  verts=[tuple(p+r*(math.cos(i/n*math.tau)*u+math.sin(i/n*math.tau)*v))for p in [a,b]for i in range(n)]
  self.add(verts,[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]+[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))],mat,True)
 def tube(self,points,r,mat='paint',n=7):
  vertices=[]
  for i,p in enumerate(points):
   tangent=(Vector(points[min(len(points)-1,i+1)])-Vector(points[max(0,i-1)])).normalized();u=tangent.cross(Vector((0,1,0))).normalized();v=tangent.cross(u)
   vertices.extend(tuple(Vector(p)+r*(math.cos(j/n*math.tau)*u+math.sin(j/n*math.tau)*v))for j in range(n))
  self.add(vertices,[(i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j)for i in range(len(points)-1)for j in range(n)],mat,True)
 def ellipse(self,p,rx,ry,mat='trim',n=28,tilt=0):
  x,y,z=p;self.add([p]+[(x+math.cos(i/n*math.tau)*rx,y+math.sin(i/n*math.tau)*ry*math.cos(tilt),z+math.sin(i/n*math.tau)*ry*math.sin(tilt))for i in range(n)],[(0,i+1,(i+1)%n+1)for i in range(n)],mat)

def build(c):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for data in list(bpy.data.meshes):
  if not data.users:bpy.data.meshes.remove(data)
 materials={}
 for name,hex in COLORS.items():
  m=bpy.data.materials.new(name);m.use_nodes=True;rgba=tuple(linear(int(hex[i:i+2],16)/255)for i in (1,3,5))+( .48 if name=='glass' else 1,)
  m.diffuse_color=rgba;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=rgba;p.inputs['Alpha'].default_value=rgba[3];p.inputs['Roughness'].default_value=.23 if name in ['paint','hood','glass','metal','rim'] else .65;p.inputs['Metallic'].default_value=.65 if name in ['metal','rim','disc']else .2 if name in ['paint','hood']else 0
  if name=='glass':m.surface_render_method='DITHERED'
  materials[name]=m
 L,W,H=c['size'];half=L/2;wb=c['wb'];r=c['radius'];hub=r+.006;front=wb/2+.025;rear=front-wb;track=W/2-.098
 cowl,roofF,roofR,glassR=c['roof'];belt=c['belt'];roundbody=c['shape']in ['round','porsche'];popup=c['lights']=='popup'
 hinge=half-.72;lampX=W*.305;lampY=0;allparts=[]
 def width(z):
  t=z/half;ends=.86 if roundbody else .94;v=1-(1-ends)*abs(t)**4
  if roundbody:v+=.035*math.exp(-((z-rear)/.40)**2)+.020*math.exp(-((z-front)/.35)**2)-.025*math.exp(-(z/.6)**2)
  return W/2*min(1.025,v)
 def deck(z):
  if z>cowl:return mix(belt,c['nose'],smooth(min(1,(z-cowl)/(half-cowl))))
  back=c.get('backHeight',belt-.015)
  if z<glassR:return mix(back,back-.08 if roundbody else back-.025,smooth(min(1,(glassR-z)/(half+glassR))))
  return mix(belt,back,max(0,min(1,(cowl-z)/(cowl-glassR)))) if c.get('backHeight')else belt
 def top(z,t):
  fender=(.055 if roundbody else .020)*(math.exp(-((z-front)/.35)**2)+math.exp(-((z-rear)/.38)**2))*abs(t)**3
  noseRise=(.23 if c['lights']in ['911','cayman','4c','exige']else .13)*math.exp(-((z-(half-.19))/.36)**2)*math.exp(-((abs(t)-.74)/.24)**2) if not popup else 0
  base=deck(z)+fender+noseRise-(.045 if roundbody else .014)*abs(t)**4
  edge=smooth(max(0,min(1,(abs(t)-.65)/.35)))
  return mix(base,max(base,cut(z)+.023),edge)
 def cut(z):
  low=.23
  for center in [rear,front]:
   d=z-center;rad=r+.038
   if abs(d)<rad:low=max(low,hub+math.sqrt(rad*rad-d*d))
  return low
 lampY=top(hinge,lampX/width(hinge))+.006
 shoulderScale=.93 if roundbody else .98
 def point(z,t):return (width(z)*shoulderScale*t,top(z,t),z)
 for lod in [0,1]:
  detail=lod==0;N=80 if detail else 24;parts={n:Part(n)for n in ['body','cabin','hood','glass','wheel','spoiler_stock','spoiler_gt','vinyl_twin','vinyl_apex','badges']};body=parts['body'];cabin=parts['cabin'];hood=parts['hood'];glass=parts['glass'];wheel=parts['wheel']
  zs=sorted(set([-half+L*i/N for i in range(N+1)]+[v for center in [front,rear]for v in [center-r-.038,center,center+r+.038]]+[cowl,glassR,hinge,hinge+.34]))
  zs=[z for z in zs if -half<=z<=half]
  # Genuine side openings, fender crown and curved shoulder surfaces.
  for side in [-1,1]:
   rows=[]
   for z in zs:
    w=width(z);lo=cut(z);hi=max(top(z,1),lo+.023)
    rows.append([(side*w*.93,lo,z),(side*w,max(lo,mix(.23,hi,.39)),z),(side*w*.998,max(lo,mix(.23,hi,.77)),z),(side*w*shoulderScale,hi,z)])
   verts=[p for row in rows for p in row];faces=[]
   for i in range(len(zs)-1):
    for j in range(3):faces.append((i*4+j,(i+1)*4+j,(i+1)*4+j+1,i*4+j+1))
   body.add(verts,faces,'paint',roundbody)
   for center in [front,rear]:
    arch=[(side*width(center+math.cos(i/(32 if detail else 12)*math.pi)*(r+.038))*1.001,hub+math.sin(i/(32 if detail else 12)*math.pi)*(r+.038),center+math.cos(i/(32 if detail else 12)*math.pi)*(r+.038))for i in range((32 if detail else 12)+1)]
    for a,b in zip(arch,arch[1:]):
     body.quad((a[0],a[1]-.014,a[2]),(b[0],b[1]-.014,b[2]),(b[0]-side*.12,b[1]-.025,b[2]),(a[0]-side*.12,a[1]-.025,a[2]),'rubber')
     body.quad((a[0]+side*.006,a[1],a[2]),(b[0]+side*.006,b[1],b[2]),(b[0]+side*.007,b[1]+.014,b[2]),(a[0]+side*.007,a[1]+.014,a[2]),'paint')
   # Sill, separate door seams, flush handles and road mirrors.
   body.box((side*(W/2-.035),.238,0),(.065,.07,wb-.64),'lower_tone' if c.get('twoTone')else 'trim',.012)
   doorBack=-.58 if c.get('doors',2)==2 else -.10
   for a,b in [((side*width(doorBack)*1.001,.31,doorBack),(side*width(doorBack)*1.001,belt,doorBack)),((side*width(cowl-.05)*1.001,.34,cowl-.05),(side*width(cowl-.05)*1.001,belt,cowl-.05))]:body.line(a,b,.0025,'trim',5)
   body.box((side*(width(doorBack+.14)+.004),belt-.095,doorBack+.14),(.013,.026,.11),'metal' if c['id']=='r32' else 'trim',.005)
   if c.get('doors')==4:
    z=glassR+.2;body.line((side*width(z),.32,z),(side*width(z),belt,z),.0025,'trim',5);body.box((side*(width(z+.12)+.005),belt-.09,z+.12),(.015,.025,.11),'trim',.004)
   body.box((side*(W/2+.045),belt+.10,cowl-.06),(.17,.105,.20),'paint',.023)
   body.box((side*(W/2+.047),belt+.10,cowl-.165),(.135,.068,.009),'metal',.01)
   if c.get('twoTone'):
    for a,b in zip(zs,zs[1:]):
     if max(cut(a),cut(b))<.40:body.quad((side*width(a)*1.001,.29,a),(side*width(b)*1.001,.29,b),(side*width(b)*1.001,.43,b),(side*width(a)*1.001,.43,a),'lower_tone')
  body.box((0,.19,0),(W*.83,.06,L*.94),'rubber',.015)
  # Top skin, with independent bonnet paint and actual holes for pop-up buckets.
  cuts=16 if detail else 8
  for a,b in zip(zs,zs[1:]):
   fractions=sorted(set([-1+2*j/cuts for j in range(cuts+1)]+([side*(lampX+edge)/(width((a+b)/2)*shoulderScale)for side in [-1,1]for edge in [-.174,.174]]if popup else [])))
   for u,v in zip(fractions,fractions[1:]):
    mid=(u+v)/2;z=(a+b)/2;x=width(z)*shoulderScale*mid
    if glassR<z<cowl and abs(mid)<.80:continue
    if popup and hinge<z<hinge+.34 and abs(abs(x)-lampX)<.174:continue
    target=hood if z>cowl and abs(mid)<.82 else body;target.quad(point(a,u),point(a,v),point(b,v),point(b,u),'hood' if target==hood else 'paint',up=True,smooth=roundbody)
  # End caps and manufactured bumper lips.
  for z in [-half,half]:
   w=width(z)
   for i in range(16 if detail else 8):
    u=-1+2*i/(16 if detail else 8);v=-1+2*(i+1)/(16 if detail else 8)
    body.quad((w*shoulderScale*u,.25,z),(w*shoulderScale*v,.25,z),point(z,v),point(z,u),'paint',smooth=roundbody)
   body.box((0,.245,z),(w*1.88,.055,.07),'trim',.012)
  # Glasshouse: independent windshield, quarter windows and substantial C pillars.
  topW=W*(.329 if roundbody else .345);baseW=W*(.425 if roundbody else .44);openTop=c.get('open',False);curved=roundbody or c['shape']=='modern';rearY=c.get('rearGlassHeight',belt+.03)
  A=[(-baseW,belt+.035,cowl),(baseW,belt+.035,cowl),(topW,H-.045,roofF),(-topW,H-.045,roofF)]
  R=[(-topW,H-.065,roofR),(topW,H-.065,roofR),(baseW,rearY,glassR),(-baseW,rearY,glassR)]
  def panel(points,part,mat,kind='side'):
   def vertex(t,u):
    p=[mix(mix(points[0][k],points[1][k],u),mix(points[3][k],points[2][k],u),t)for k in range(3)]
    if curved:
     if kind=='front':p[1]+=.04*math.sin(u*math.pi)*t;p[2]+=.08*math.sin(u*math.pi)*t
     elif kind=='rear':p[1]+=.04*math.sin(u*math.pi)*(1-t);p[2]-=.08*math.sin(u*math.pi)*(1-t)
     else:p[1]+=.025*math.sin(t*math.pi)*u
    return tuple(p)
   part.grid(8 if detail else 3,14 if detail else 4,vertex,mat,True)
  panel(A,glass,'glass','front')
  for a,b in [(A[0],A[1]),(A[0],A[3]),(A[1],A[2])]:cabin.line(a,b,.018,'trim',8 if detail else 5)
  def topFrame(u):return ((u*2-1)*topW,H-.045+(.04*math.sin(u*math.pi)if curved else 0),roofF+(.08*math.sin(u*math.pi)if curved else 0))
  cabin.tube([topFrame(i/(12 if detail else 4))for i in range((12 if detail else 4)+1)],.016,'paint',7 if detail else 5)
  # A pillars belong to body paint, not to the windshield texture.
  for side in [-1,1]:cabin.line((side*baseW,belt+.035,cowl),(side*topW,H-.045,roofF),.026,'paint',8 if detail else 5)
  if not openTop:
   roofMat='trim' if c.get('targa')else 'paint'
   cabin.grid(14 if detail else 4,20 if detail else 6,lambda t,u:((u*2-1)*topW,mix(H-.045,H-.065,t)+(.04*math.sin(u*math.pi)+.025*math.sin(t*math.pi)if curved else .018*math.sin(u*math.pi)),mix(roofF,roofR,t)+(.08*math.sin(u*math.pi)*(1-2*t)if curved else 0)),roofMat,True)
   panel(R,glass,'glass','rear')
   for a,b in [(R[0],R[3]),(R[1],R[2]),(R[2],R[3])]:cabin.line(a,b,.019,'trim',7 if detail else 5)
   def rearFrame(u):return ((u*2-1)*topW,H-.065+(.04*math.sin(u*math.pi)if curved else 0),roofR-(.08*math.sin(u*math.pi)if curved else 0))
   cabin.tube([rearFrame(i/(12 if detail else 4))for i in range((12 if detail else 4)+1)],.016,'paint',7 if detail else 5)
   for side in [-1,1]:
    end=glassR+.28;P=[(side*baseW,belt+.035,cowl),(side*topW,H-.045,roofF),(side*topW,H-.065,roofR),(side*baseW,deck(end)+.03,end)]
    panel(P,glass,'glass');cabin.add([P[2],P[3],(side*baseW,rearY,glassR)],[(0,1,2)],'paint')
    for a,b in [(P[0],P[1]),(P[2],P[3]),(P[3],P[0])]:cabin.line(a,b,.018,'paint',7 if detail else 5)
    cabin.tube([(side*topW,mix(H-.045,H-.065,i/(12 if detail else 4))+(.025*math.sin(i/(12 if detail else 4)*math.pi)if curved else 0),mix(roofF,roofR,i/(12 if detail else 4)))for i in range((12 if detail else 4)+1)],.017,'paint',7 if detail else 5)
    b=-.40 if c.get('doors',2)==2 else -.10
    if roofR<b<roofF:cabin.line((side*baseW,belt+.03,b),(side*topW,H-.045,b),.016 if detail else .014,'trim',6)
  else:
   cabin.box((0,belt+.04,-.97),(W*.80,.065,.30),'trim',.02)
   for x in [-W*.21,W*.21]:
    for i in range(12 if detail else 6):
     a=i/(12 if detail else 6)*math.pi;b=(i+1)/(12 if detail else 6)*math.pi;cabin.line((x+math.cos(a)*.17,belt+.09+math.sin(a)*.25,-.65),(x+math.cos(b)*.17,belt+.09+math.sin(b)*.25,-.65),.026,'metal',8 if detail else 5)
  cabin.box((0,.30,(cowl+glassR)/2),(W*.79,.045,cowl-glassR),'trim')
  cabin.box((0,belt-.015,cowl-.11),(W*.79,.13,.28),'trim',.025)
  for side in [-1,1]:
   x=side*W*.215;seatZ=(cowl+roofR)/2-.1
   cabin.box((x,.445,seatZ),(.40,.10,.46),'seat',.035)
   cabin.box((x,.715,seatZ-.22),(.355,.48,.105),'seat',.035)
   cabin.box((x,.99,seatZ-.24),(.22,.14,.10),'seat',.025)
   for dx in [-.17,.17]:cabin.line((x+dx,.51,seatZ-.18),(x+dx,.89,seatZ-.22),.035,'seat',7 if detail else 5)
  # Shadowed front intake with per-model proportions.
  frontZ=half+.009;rearZ=-half-.012
  if c['lights']=='4c':
   body.add([(-.16,.52,frontZ),(.16,.52,frontZ),(0,.26,frontZ+.015)],[(0,1,2)],'trim')
   for side in [-1,1]:body.box((side*.52,.34,frontZ),(.40,.16,.025),'trim',.045)
  elif c['lights']=='r8':
   body.add([(-.43,.30,frontZ),(.43,.30,frontZ),(.54,.51,frontZ),(.42,.65,frontZ),(-.42,.65,frontZ),(-.54,.51,frontZ)],[(0,1,2,3,4,5)],'trim')
   for side in [-1,1]:body.box((side*W*.37,.40,frontZ),(.34,.23,.024),'trim',.025)
  elif c['id']in ['rx7','rx7amemiya']:
   body.ellipse((0,.35,frontZ),.48 if c['id']=='rx7'else .57,.095,'trim',36 if detail else 14)
   for side in [-1,1]:body.ellipse((side*W*.35,.35,frontZ+.006),.12,.075,'trim',24 if detail else 10)
  else:
   wide=.98 if c['id']in ['supra','rx7amemiya','gt86','grsupra','civic'] else .74
   body.box((0,.35,frontZ),(wide,.16,.025),'trim',.03)
   for side in [-1,1]:body.box((side*W*.35,.34,frontZ),(.23,.13,.022),'trim',.025)
   if c['lights']=='grsupra':body.add([(-.08,.29,frontZ+.01),(.08,.29,frontZ+.01),(.14,.57,frontZ+.01),(-.14,.57,frontZ+.01)],[(0,1,2,3)],'paint')
  if detail:
   for i in range(4):body.box((0,.295+i*.033,frontZ+.017),(.64,.005,.006),'metal' if c['id']=='silvia' else 'trim')
  # Per-model lighting, not a repeated generic headlight rectangle.
  lampType=c['lights']
  for side in [-1,1]:
   x=side*W*.315;z=half+.04;y=max(c['nose']+.025,.59)
   if popup:
    name='popup_l' if side<0 else 'popup_r';p=parts[name]=Part(name);pivot=(side*lampX,lampY,hinge)
    def lid(xx,zz):return (xx,top(hinge+zz,(side*lampX+xx)/(width(hinge+zz)*shoulderScale))-lampY+.007,zz)
    p.quad(lid(-.18,0),lid(.18,0),lid(.18,.34),lid(-.18,.34),'paint',up=True,smooth=roundbody)
    p.box((0,min(lid(0,.34)[1],lid(0,0)[1])-.058,.15),(.345,.09,.28),'trim',.008)
    angle=.65;cx,cy,cz=0,lid(0,.34)[1]-.078,.319
    def lenspos(xx,yy):return (cx+xx,cy+math.cos(angle)*yy,cz+math.sin(angle)*yy)
    p.quad(lenspos(-.155,-.068),lenspos(.155,-.068),lenspos(.155,.068),lenspos(-.155,.068),'front_lamp')
    if detail:
     for i in range(7):p.line(lenspos(-.13+i*.043,-.061),lenspos(-.13+i*.043,.061),.0016,'metal',4)
    p.pivot=pivot
   elif lampType in ['911','a110','4c','exige','cayman']:
    yy=.67 if lampType in ['911','cayman']else .62
    rx=.14 if lampType=='911' else .12;ry=.15 if lampType in ['911','exige','cayman','4c']else .12;tilt=-.78
    body.ellipse((x,yy,z),rx+.018,ry+.014,'trim',32 if detail else 12,tilt);body.ellipse((x,yy,z+.008),rx,ry,'metal',32 if detail else 12,tilt);body.ellipse((x,yy,z+.016),rx*.42,ry*.40,'front_lamp',24 if detail else 10,tilt)
    if lampType=='a110':body.ellipse((side*.30,.53,z+.012),.082,.078,'trim',24 if detail else 10,-.4);body.ellipse((side*.30,.53,z+.02),.065,.060,'front_lamp',24 if detail else 10,-.4)
    if lampType=='4c':
     body.ellipse((x,.62,z+.015),.09,.13,'trim',24 if detail else 10,tilt)
     for yy in [.56,.62,.68]:body.ellipse((x+side*.045,yy,z+.024-(yy-.62)*.75),.020,.020,'front_lamp',12 if detail else 6,tilt)
   elif lampType=='supra':
    body.ellipse((x,.65,z),.245,.105,'trim',32 if detail else 12)
    for i in range(3):body.ellipse((x+(i-1)*.13,.65,z+.012),.049,.049,'front_lamp',18 if detail else 8)
   elif lampType=='488':
    body.add([(x-side*.105,.56,z),(x+side*.11,.60,z),(x+side*.10,.87,z-.23),(x-side*.02,.78,z-.16)],[(0,1,2,3)],'trim')
    for i in range(5):body.ellipse((x+side*.033,.62+i*.035,z-.025-i*.033),.033,.018,'front_lamp',12 if detail else 6)
   else:
    long= .24 if lampType in ['s13','s14','r32','r34']else .20
    yy=.70 if c['shape']=='edge' else .65
    body.add([(x-long,yy-.065,z),(x+long,yy-.055,z),(x+long*.91,yy+.08,z-.025),(x-long*.84,yy+.072,z-.035)],[(0,1,2,3)],'trim')
    if lampType in ['s13','r32','r34']:
     for i in range(3):body.ellipse((x+(i-1)*.115,yy,z+.009),.046,.043,'front_lamp',16 if detail else 8)
    else:
     body.line((x-long*.8,yy-.025,z+.013),(x+long*.8,yy+.025,z+.013),.018,'front_lamp',8 if detail else 5)
     for i in range(2 if lampType!='grsupra' else 6):body.ellipse((x+(i-(.5 if lampType!='grsupra' else 2.5))*.055,yy+.023,z+.015),.025,.025,'front_lamp',14 if detail else 7)
    if lampType=='evo':body.ellipse((side*.53,.34,frontZ+.025),.075,.075,'front_lamp',24 if detail else 10)
   # Small amber marker below headlights, white plates never emit light.
   body.box((side*W*.39,.48,frontZ+.009),(.10,.035,.014),'amber',.003)
   tail=c['tail'];tx=side*W*.32;ty=c.get('rearTailY',belt-.09)
   if tail in ['skyline','fd','supra','exige']:
    body.box((tx,ty,rearZ),(.47,.20,.025),'trim',.035)
    for i in [-1,1]:
     rr=.09 if tail=='skyline' else .075
     if c['id']=='r34'and i*side<0:rr*=.83
     body.ellipse((tx+i*.13,ty,rearZ-.015),rr+.015,rr+.015,'trim',28 if detail else 10);body.ellipse((tx+i*.13,ty,rearZ-.023),rr,rr,'tail_lamp',28 if detail else 10);body.ellipse((tx+i*.13,ty,rearZ-.025),rr*.48,rr*.48,'tail_lamp',20 if detail else 8)
   elif tail in ['488','4c']:
    body.ellipse((tx,ty,rearZ),.125,.125,'trim',32 if detail else 12);body.ellipse((tx,ty,rearZ-.012),.104,.104,'tail_lamp',32 if detail else 12);body.ellipse((tx,ty,rearZ-.016),.062,.062,'trim',24 if detail else 10)
   elif tail=='civic':
    for a,b in [((tx-side*.12,ty+.11,rearZ),(tx+side*.12,ty+.11,rearZ)),((tx+side*.12,ty+.11,rearZ),(tx+side*.16,ty-.10,rearZ)),((tx+side*.16,ty-.10,rearZ),(tx-side*.06,ty-.10,rearZ))]:body.line(a,b,.025,'tail_lamp',7 if detail else 5)
   else:
    body.box((tx,ty,rearZ),(.46,.115,.027),'trim',.027);body.box((tx,ty+.012,rearZ-.016),(.40,.055,.015),'tail_lamp',.018)
    if tail in ['s2000','mr2','180sx','s13','s14','evo']:body.box((tx+side*.15,ty-.035,rearZ-.018),(.075,.026,.015),'amber',.003)
   # Exhaust placement and diffuser fins.
   ex=.16 if c['id']=='civic'else .40 if c['id']in ['ferrari488','gt3rs']else W*.32
   if side<0 or c['id']in ['supra','r8','ferrari488','grsupra','cayman','gt3rs','s2000','gt86','civic']:
    body.line((side*ex,.24,-half+.10),(side*ex,.24,-half-.08),.047 if c['id']!='r8' else .061,'metal',20 if detail else 8);body.ellipse((side*ex,.24,-half-.085),.036,.036,'rubber',18 if detail else 8)
  if c['id']=='civic':body.line((0,.24,-half+.08),(0,.24,-half-.08),.036,'metal',16 if detail else 8)
  plateY=.65 if c['id']=='civic'else .54 if c['id']in ['r32','r34','evo3']else .46
  body.box((0,.43,half+.027),(.33,.13,.012),'vinyl_white',.004);body.box((0,plateY,-half-.038),(.33,.13,.012),'vinyl_white',.004)
  # Diffuser and rear bumper apertures keep the chase view readable by family.
  body.box((0,.285,rearZ-.004),(W*.76,.12,.025),'trim',.018)
  for side in [-1,1]:
   if c['id']in ['civic','r8','ferrari488','gt3rs','exige','rx7amemiya']:
    body.box((side*W*.35,.47 if c['id']!='civic'else .55,rearZ-.008),(.28,.17 if c['id']!='civic'else .24,.023),'trim',.025)
    body.box((side*W*.36,.37,rearZ-.028),(.13,.025,.014),'tail_lamp',.004)
   if detail:
    for i in range(3):body.box((side*(.13+i*.16),.245,rearZ-.035),(.018,.105,.15),'trim',.003)
  # Distinct intake panels on mid-engine cars and the R8 sideblade.
  vent=c.get('vents')
  for side in [-1,1]:
   if vent in ['mid','exige','488','cayman','r8']:
    x=side*(width(-.72)+.008);yy=belt-.11
    if vent=='r8':body.add([(x,.42,-.48),(x,belt+.01,-.48),(side*W*.405,H-.18,-.62),(x,.72,-1.12),(x,.37,-1.09)],[(0,1,2,3,4)],'trim')
    else:
     body.add([(x,yy-.12,-.98),(x,yy+.12,-.98),(x,yy+.08,-.51),(x,yy-.07,-.66)],[(0,1,2,3)],'trim')
     for i in range(3 if detail else 1):body.line((x+side*.003,yy-.08+i*.07,-.94),(x+side*.003,yy-.05+i*.06,-.60),.006,'paint',5)
   if vent in ['evo','amemiya','r34']:
    for i in range(4 if detail else 2):
     z=cowl+.29+i*.09;y=top(z,side*.35)+.006;hood.box((side*W*.16,y,z),(.22,.012,.045),'trim',.004)
   if vent=='civic'and side==1:
    z=cowl+.31;y=top(z,0)+.014;hood.box((0,y,z),(.38,.023,.19),'trim',.012)
    for i in range(3):hood.box((0,y+.014,z-.055+i*.055),(.35,.012,.012),'paint',.003)
   if vent in ['911','exige','mid','488','r8']:
    for i in range(7 if detail else 3):
     z=glassR-.08-i*.065;body.box((side*.24,deck(z)+.014,z),(.37,.009,.027),'trim',.003)
  if c['id']=='r32':body.box((0,.71,frontZ+.01),(.36,.09,.017),'trim',.01)
  if c['id']=='civic':body.box((0,.56,frontZ+.025),(W*.72,.024,.02),'red_trim',.005)
  # Separate stock wing is suppressed when a purchased GT wing is installed.
  wing=c['wing'];wingZ=-half+.24;stock=parts['spoiler_stock'];wingY=belt+(.40 if wing in ['gt','hoop','tall']else .17 if wing=='pedestal'else .025)
  stock.box((0,wingY,wingZ),(W*.87,.045,.23 if wing!='gt' else .32),'paint' if wing!='gt'else 'trim',.018)
  if wing in ['gt','hoop','tall','pedestal']:
   for side in [-1,1]:stock.box((side*W*.29,(wingY+belt)/2,wingZ),(.055,wingY-belt,.10),'paint' if wing!='gt'else 'metal',.012)
  if wing=='gt':
   for side in [-1,1]:stock.box((side*W*.435,wingY+.025,wingZ),(.023,.14,.35),'trim',.008)
  gt=parts['spoiler_gt'];gtY=max(belt+.44,H+.03);gt.box((0,gtY,wingZ),(W*.99,.05,.34),'trim',.018)
  for side in [-1,1]:gt.box((side*W*.29,(gtY+belt)/2,wingZ),(.045,gtY-belt,.09),'metal',.008);gt.box((side*W*.49,gtY+.025,wingZ),(.022,.16,.37),'trim',.007)
  # Cosmetic geometry follows this car's hood and roof surfaces.
  twin=parts['vinyl_twin']
  for side in [-1,1]:
   for a,b in zip(zs,zs[1:]):
    if a<cowl+.015:continue
    x=side*.18;ta=(x-.045)/width(a);tb=(x+.045)/width(a);tc=(x+.045)/width(b);td=(x-.045)/width(b)
    twin.quad((x-.045,top(a,ta)+.006,a),(x+.045,top(a,tb)+.006,a),(x+.045,top(b,tc)+.006,b),(x-.045,top(b,td)+.006,b),'vinyl_white')
   if not openTop:
    for i in range(8 if detail else 3):
     a=mix(roofF,roofR,i/(8 if detail else 3));b=mix(roofF,roofR,(i+1)/(8 if detail else 3));y=H+.006
     twin.quad((side*.18-.045,y,a),(side*.18+.045,y,a),(side*.18+.045,y,b),(side*.18-.045,y,b),'vinyl_white')
   apex=parts['vinyl_apex'];x=side*(W/2+.008)
   apex.quad((x,.40,-.78),(x,.40,.60),(x,belt-.12,.25),(x,belt-.12,-.78),'vinyl_white');apex.quad((x+side*.002,.44,-.78),(x+side*.002,.44,.27),(x+side*.002,belt-.10,-.10),(x+side*.002,belt-.10,-.78),'vinyl_blue')
  # Tyre and model-specific wheel face, centred at its own axle for instancing.
  n=48 if detail else 16;ww=.108 if W<1.82 else .125;rimR=r*.73
  rings=[(-ww,r*.72),(-ww,r*.89),(-ww*.74,r),(ww*.74,r),(ww,r*.89),(ww,r*.72)]
  wheel.add([(x,math.cos(i/n*math.tau)*rr,math.sin(i/n*math.tau)*rr)for x,rr in rings for i in range(n)],[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i)for j in range(len(rings)-1)for i in range(n)],'rubber',True)
  for side in [-1,1]:
   xx=side*(ww+.002);wheel.line((xx-side*.028,0,0),(xx-side*.018,0,0),rimR*.78,'disc',n)
   for i in range(n):
    a=i/n*math.tau;b=(i+1)/n*math.tau;wheel.quad((xx,math.cos(a)*rimR,math.sin(a)*rimR),(xx,math.cos(b)*rimR,math.sin(b)*rimR),(xx,math.cos(b)*(rimR-.016),math.sin(b)*(rimR-.016)),(xx,math.cos(a)*(rimR-.016),math.sin(a)*(rimR-.016)),'metal')
   count=c['spokes'] if detail else min(c['spokes'],6)
   if c.get('wheelStyle')=='telephone':
    for i in range(5):
     a=i/5*math.tau;cy,cz=math.cos(a)*rimR*.57,math.sin(a)*rimR*.57
     for j in range(12 if detail else 8):
      a=j/(12 if detail else 8)*math.tau;b=(j+1)/(12 if detail else 8)*math.tau
      if detail:wheel.line((xx,cy+math.cos(a)*rimR*.28,cz+math.sin(a)*rimR*.28),(xx,cy+math.cos(b)*rimR*.28,cz+math.sin(b)*rimR*.28),.012,'rim',5)
      else:wheel.quad((xx,cy+math.cos(a)*rimR*.24,cz+math.sin(a)*rimR*.24),(xx,cy+math.cos(b)*rimR*.24,cz+math.sin(b)*rimR*.24),(xx,cy+math.cos(b)*rimR*.32,cz+math.sin(b)*rimR*.32),(xx,cy+math.cos(a)*rimR*.32,cz+math.sin(a)*rimR*.32),'rim')
   else:
    for i in range(count):
     a=i/count*math.tau
     if detail:wheel.line((xx,math.cos(a)*.05,math.sin(a)*.05),(xx,math.cos(a)*rimR*.94,math.sin(a)*rimR*.94),.016 if count<8 else .011,'rim',7)
     else:
      d=.08;wheel.quad((xx,math.cos(a-d)*.045,math.sin(a-d)*.045),(xx,math.cos(a+d)*.045,math.sin(a+d)*.045),(xx,math.cos(a+d)*rimR*.94,math.sin(a+d)*rimR*.94),(xx,math.cos(a-d)*rimR*.94,math.sin(a-d)*rimR*.94),'rim')
   wheel.line((xx,0,0),(xx+side*.009,0,0),.050,'rim',16 if detail else 8)
   if detail:
    for i in range(5):
     a=i/5*math.tau;wheel.line((xx,.033*math.cos(a),.033*math.sin(a)),(xx+side*.012,.033*math.cos(a),.033*math.sin(a)),.006,'metal',5)
  # Upload original surfaces to editable Blender meshes, with independent UVs.
  for name,p in parts.items():
   if not p.faces:continue
   def warped(v):
    if name=='wheel'or name.startswith('popup'):return v
    x,y,z=v;amount=.16 if roundbody else .045 if c['shape']=='modern'else 0;factor=abs(x/(W/2))**4
    z-=amount*factor*smooth(max(0,min(1,(z-half+.55)/.55)))
    z+=amount*.6*factor*smooth(max(0,min(1,(-z-half+.5)/.5)))
    return (x,y,z)
   data=bpy.data.meshes.new(f'{c["id"]}_{name}_{lod}');data.from_pydata([xyz(warped(v))for v in p.v],[],p.faces);data.update();o=bpy.data.objects.new(f'LOD{lod}_{name}',data);bpy.context.collection.objects.link(o)
   for mat in materials.values():data.materials.append(mat)
   matIndex={name:i for i,name in enumerate(materials)}
   for f,mat,sm in zip(data.polygons,p.mats,p.smooth):f.material_index=matIndex[mat];f.use_smooth=sm
   # Planar UVs selected by face normal: stable, original and reproducible.
   uv=data.uv_layers.new(name='Original surface coordinates')
   for f in data.polygons:
    axis=max(range(3),key=lambda i:abs(f.normal[i]));axes=[i for i in range(3)if i!=axis]
    for loop in f.loop_indices:
     v=data.vertices[data.loops[loop].vertex_index].co;uv.data[loop].uv=(v[axes[0]]*.35+.5,v[axes[1]]*.35+.5)
   if hasattr(p,'pivot'):o.location=xyz(p.pivot)
   if lod==1 and name not in ['glass','hood','wheel','vinyl_twin','vinyl_apex']:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;m=o.modifiers.new('Distant silhouette','DECIMATE');m.ratio=.48;bpy.ops.object.modifier_apply(modifier=m.name)
   o['part']=name;o['lod']=lod;o['authored']='original-catalog-2026-10-31';allparts.append(o)
  # Text is a separate small near-only part. Font outline output, no font asset.
  if detail:
   badge=next(o for o in allparts if o.get('part')=='body'and o.get('lod')==0)
   for text,loc,rot,size in [(c['label'],(0,c.get('rearTailY',belt)+.015,-half-.043),(math.pi/2,0,math.pi),.041),('TOUGE',(0,plateY,-half-.05),(math.pi/2,0,math.pi),.040),('TOUGE',(0,.43,half+.04),(math.pi/2,0,0),.040)]:
    curve=bpy.data.curves.new('Original badge text','FONT');curve.body=text;curve.size=size;curve.align_x='CENTER';curve.align_y='CENTER';curve.resolution_u=1;o=bpy.data.objects.new('badge',curve);bpy.context.collection.objects.link(o);o.location=xyz(loc);o.rotation_euler=rot;o.data.materials.append(materials['metal' if text!='TOUGE' else 'decal']);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o['part']='badges';o['lod']=0
    if 'textobjs'not in locals():textobjs=[]
    textobjs.append(o)
 if 'textobjs'in locals():
  bpy.ops.object.select_all(action='DESELECT')
  for o in textobjs:o.select_set(True)
  bpy.context.view_layer.objects.active=textobjs[0];bpy.ops.object.join();o=bpy.context.object;o.name='LOD0_badges';bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);allparts.append(o)
 rig={'track':track,'wheelY':hub,'radius':r,'front':front,'rear':rear,'popupAngle':.65,'id':c['id'],'size':c['size'],'label':c['label']}
 reference=c.get('source','Stylized body proportions from the campaign car specification')
 scene=bpy.context.scene;scene['vehicleRig']=json.dumps(rig);scene['source']='Original authored surfaces';scene['reference']=reference;scene['coordinate_system']='+Y up, +Z forward, metres'
 bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,c['id']+'-source.blend'))
 bpy.ops.object.select_all(action='SELECT');pending=os.path.join(OUT,c['id']+'-pending.glb');bpy.ops.export_scene.gltf(filepath=pending,export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False);replace_file(pending,os.path.join(OUT,c['id']+'.glb'))
 stats={'id':c['id'],'rig':rig,'reference':reference,'parts':[]}
 for o in allparts:o.data.calc_loop_triangles();stats['parts'].append({'part':o['part'],'lod':o['lod'],'triangles':len(o.data.loop_triangles)})
 metadata=os.path.join(OUT,c['id']+'-pending.json')
 with open(metadata,'w',encoding='utf8')as f:json.dump(stats,f,indent=2)
 replace_file(metadata,os.path.join(OUT,c['id']+'-build.json'))
 print('ORIGINAL_CAR_BUILT',c['id'],sum(p['triangles']for p in stats['parts']),flush=True)

for c in cars:build(c)
print('CATALOG_BUILT',len(cars),flush=True)
