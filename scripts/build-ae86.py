"""Original AE86 prototype. Blender 5.1+, no imported geometry or textures.
Run: blender -b --python scripts/build-ae86.py -- [project root]
Design coordinates are x=right, y=up, z=forward, in metres.
"""
import bpy, math, json, sys, os
from mathutils import Vector
ROOT=os.path.abspath(sys.argv[sys.argv.index('--')+1])
OUT=os.path.join(ROOT,'assets','cars','original');os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def xyz(p):return (p[0],-p[2],p[1])
def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
materials={}
for name,color,metal,rough,alpha in [
 ('paint','#e7e6df',.25,.27,1),('hood','#e7e6df',.25,.27,1),('trim','#1d2229',0,.6,1),
 ('rubber','#15171b',0,.85,1),('rim','#414750',.7,.3,1),('metal','#9fa8ac',.8,.3,1),('disc','#454a51',.65,.45,1),
 ('glass','#59717b',.25,.12,.48),('front_lamp','#edf0d9',.2,.2,1),('tail_lamp','#b51e20',.2,.22,1),
 ('amber','#e5831b',.1,.2,1),('seat','#484049',0,.9,1),('decal','#101216',0,.7,1),('vinyl_blue','#397dbb',.2,.3,1),('vinyl_white','#edf2f4',.2,.3,1)]:
 m=bpy.data.materials.new(name);m.use_nodes=True;rgba=tuple(linear(int(color[i:i+2],16)/255) for i in (1,3,5))+(alpha,)
 m.diffuse_color=rgba;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=rgba;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Alpha'].default_value=alpha
 if name=='glass':m.surface_render_method='DITHERED'
 materials[name]=m
groups={};current=None
def mesh(name,verts,faces,mat,smooth=False):
 # Hand-authored panels have outward normals even when mirrored. Open wheel
 # arches must not rely on a closed-volume normal repair to infer their outside.
 corrected=[];center=Vector((0,.298 if current and current[1]=='wheel' else .55,0))
 for face in faces:
  a,b,c=[Vector(verts[i]) for i in face[:3]];n=(b-a).cross(c-a);p=sum((Vector(verts[i]) for i in face),Vector())/len(face);radial=p-center
  if current and current[1]!='wheel':radial.z*=.12
  corrected.append(tuple(reversed(face)) if n.dot(radial)<0 else face)
 faces=corrected
 data=bpy.data.meshes.new(name);data.from_pydata([xyz(v) for v in verts],[],faces);data.update()
 o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(materials[mat]);groups.setdefault(current,[]).append(o)
 for f in data.polygons:f.use_smooth=smooth
 return o
def quad(name,a,b,c,d,mat):return mesh(name,[a,b,c,d],[(0,1,2,3)],mat)
def box(name,p,size,mat,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));o=bpy.context.object;o.name=name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(materials[mat]);groups.setdefault(current,[]).append(o)
 if bevel:
  m=o.modifiers.new('Small manufactured edge','BEVEL');m.width=bevel;m.segments=2;bpy.ops.object.modifier_apply(modifier=m.name)
  m=o.modifiers.new('Face weighted normals','WEIGHTED_NORMAL');m.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=m.name)
 return o
def line(name,a,b,r,mat,sides=6):
 va,vb=Vector(xyz(a)),Vector(xyz(b));bpy.ops.mesh.primitive_cylinder_add(vertices=sides,radius=r,depth=(vb-va).length,location=(va+vb)/2);o=bpy.context.object;o.name=name;o.rotation_euler=(vb-va).to_track_quat('Z','Y').to_euler();o.data.materials.append(materials[mat]);groups.setdefault(current,[]).append(o);return o
def strip(name,points,width,mat):
 for a,b in zip(points,points[1:]):line(name,a,b,width,mat)
def label(name,text,p,size,rotation,mat='decal'):
 curve=bpy.data.curves.new(name,'FONT');curve.body=text;curve.size=size;curve.align_x='CENTER';curve.align_y='CENTER';curve.resolution_u=2
 if any(ord(c)>127 for c in text):curve.font=jpfont
 o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.location=xyz(p);o.rotation_euler=rotation;o.data.materials.append(materials[mat]);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);groups.setdefault(current,[]).append(o)
try:jpfont=bpy.data.fonts.load('C:/Windows/Fonts/msgothic.ttc')
except:jpfont=bpy.data.fonts.get('Bfont')
# Measured reference: Toyota 1983 GT APEX, 4.205 x 1.625 x 1.335, wheelbase 2.4.
# Mirrors, tyres and optional GT wing extend outside the nominal body envelope.
def halfwidth(z):
 stations=[(-2.1025,.744),(-1.85,.795),(-1.35,.8125),(-.4,.805),(.65,.805),(1.45,.799),(1.85,.775),(2.1025,.735)]
 for (a,wa),(b,wb) in zip(stations,stations[1:]):
  if z<=b:return wa+(wb-wa)*(z-a)/(b-a)
 return .735
def shoulder(z):return .742+(.045 if z<-.9 else .025 if z<.7 else -.035*(z-.7))
def wheel_cut(z):
 y=.255
 for center in [-1.23,1.17]:
  d=z-center
  if abs(d)<.342:y=max(y,.298+math.sqrt(.342**2-d*d))
 return y
for lod in [0,1]:
 detail=lod==0;N=104 if detail else 48
 # Side skin really stops at each wheel arch: no solid box behind the wheels.
 current=(lod,'body')
 zs=sorted(set([-2.1025+4.205*i/N for i in range(N+1)]+[c+d for c in [-1.23,1.17] for d in [-.342,0,.342]]))
 for side in [-1,1]:
  for a,b in zip(zs,zs[1:]):
   def ring(z):
    w=halfwidth(z);bottom=wheel_cut(z);return [(side*(w-.035),bottom,z),(side*w,max(bottom,.43),z),(side*w,.61,z),(side*(w-.025),shoulder(z),z)]
   ra,rb=ring(a),ring(b)
   for j in range(3):quad('sculpted side',ra[j],rb[j],rb[j+1],ra[j+1],'trim' if j==0 else 'paint')
  for center in [-1.23,1.17]:
   points=[]
   for i in range(33 if detail else 17):
    t=math.pi*i/(32 if detail else 16);z=center+math.cos(t)*.342;y=.298+math.sin(t)*.342;w=halfwidth(z)
    points.append((side*(w+.002),y,z))
   strip('rolled wheel arch',points,.012,'paint')
   for a,b in zip(points,points[1:]):quad('dark wheel well',a,b,(b[0]-side*.15,b[1]-.025,b[2]),(a[0]-side*.15,a[1]-.025,a[2]),'rubber')
  box('rocker panel',(side*.779,.25,0),(.045,.07,1.71),'trim',.01)
  # Door shut lines, handle, mirror mounting and beltline.
  strip('door seam',[(side*.808,.405,-.76),(side*.809,.703,-.76),(side*.801,.728,.73)],.0033,'trim')
  box('door handle',(side*.817,.691,-.59),(.014,.035,.135),'trim',.007)
  box('mirror arm',(side*.835,.807,.58),(.13,.035,.06),'trim',.008)
  box('mirror housing',(side*.914,.842,.55),(.15,.105,.19),'trim',.022)
  box('mirror face',(side*.916,.844,.448),(.126,.071,.008),'metal',.008)
  # Panda side band follows the actual body surface, avoiding the wheel openings.
  for a,b in zip(zs,zs[1:]):
   if max(wheel_cut(a),wheel_cut(b))<.52:quad('panda stripe',(side*(halfwidth(a)+.002),.485,a),(side*(halfwidth(b)+.002),.485,b),(side*(halfwidth(b)+.002),.53,b),(side*(halfwidth(a)+.002),.53,a),'trim')
 box('underbody',(0,.215,0),(1.35,.08,3.96),'rubber',.02)
 for z in [-2.06,2.06]:
  box('bumper',(0,.384,z),(1.56,.22,.085),'trim',.022)
  box('paint bumper insert',(0,.415,z+(.047 if z>0 else -.047)),(1.51,.053,.017),'paint',.007)
 box('front grille',(0,.64,2.078),(1.45,.145,.036),'trim',.01)
 for i in range(4):box('grille slat',(0,.595+i*.027,2.101),(1.34,.008,.013),'metal' if i==0 else 'trim')
 box('lower air intake',(0,.311,2.108),(.79,.073,.018),'rubber',.008)
 for side in [-1,1]:
  box('corner indicator',(side*.645,.57,2.106),(.235,.067,.022),'amber',.005)
  box('tail lamp housing',(side*.527,.68,-2.095),(.48,.165,.038),'trim',.01)
  box('tail red upper',(side*.527,.724,-2.118),(.448,.052,.016),'tail_lamp',.005)
  box('tail red lower',(side*.48,.658,-2.118),(.35,.048,.016),'tail_lamp',.004)
  box('tail indicator',(side*.714,.657,-2.119),(.071,.047,.017),'amber',.003)
  box('tail reverse',(side*.295,.658,-2.119),(.064,.045,.017),'vinyl_white',.003)
  box('rear mudflap',(side*.73,.22,-1.6),(.115,.19,.025),'rubber')
 box('rear center trim',(0,.681,-2.11),(.51,.15,.035),'trim',.004)
 for z in [-2.133,2.129]:box('licence plate',(0,.422,z),(.34,.16,.012),'vinyl_white',.003)
 # Exhaust tip, fuel filler and hood frame.
 line('exhaust',(-.57,.21,-1.86),(-.57,.21,-2.19),.043,'metal',16 if detail else 8)
 line('exhaust hollow',(-.57,.21,-2.193),(-.57,.21,-2.196),.032,'rubber',16 if detail else 8)
 box('fuel lid',(-.812,.65,-1.55),(.006,.104,.148),'paint',.008)
 # Nose deck has actual openings for moving pop-up lamp buckets.
 for x0,x1 in [(-.76,-.735),(-.35,.35),(.735,.76)]:quad('nose deck',(x0,.69,2.04),(x1,.69,2.04),(x1,.757,.83),(x0,.757,.83),'paint')
 quad('cowl',(-.775,.765,.83),(.775,.765,.83),(.735,.793,.67),(-.735,.793,.67),'paint')
 for i in range(12 if detail else 6):box('cowl vent',(-.58+i*(.105 if detail else .21),.795,.723),(.056,.005,.032),'trim')
 # Bonnet is independently coloured for Project D / purchased carbon finish.
 current=(lod,'hood')
 for a,b in [(.84,1.18),(1.18,1.7),(1.7,2.027)]:
  za=.765-(a-.84)*.06;zb=.765-(b-.84)*.06
  quad('bonnet',(-.343,za,a),(.343,za,a),(.343,zb,b),(-.343,zb,b),'hood')
  if a<1.18:
   for side in [-1,1]:quad('bonnet shoulder',(side*.343,za,a),(side*.727,za-.008,a),(side*.727,zb-.008,b),(side*.343,zb,b),'hood')
 for a,b in [(1.18,1.31),(1.71,2.027)]:
  for side in [-1,1]:quad('bonnet around lamp',(side*.343,.765-(a-.84)*.06,a),(side*.727,.757-(a-.84)*.06,a),(side*.727,.757-(b-.84)*.06,b),(side*.343,.765-(b-.84)*.06,b),'hood')
 for variant in ['hatch','coupe']:
  current=(lod,'body_'+variant)
  rr=-.61 if variant=='coupe' else -.83;end=-1.28 if variant=='coupe' else -1.66
  A=[(-.755,.79,.67),(.755,.79,.67),(.637,1.284,.115),(-.637,1.284,.115)]
  R=[(-.637,1.284,rr),(.637,1.284,rr),(.765,.797,end),(-.765,.797,end)]
  # Roof crown: longitudinal strips give a gentle shape rather than a cuboid.
  for i in range(12 if detail else 6):
   t0=-1+2*i/(12 if detail else 6);t1=-1+2*(i+1)/(12 if detail else 6)
   y=lambda t:1.294+.041*(1-t*t)
   quad('roof',(t0*.645,y(t0),rr),(t1*.645,y(t1),rr),(t1*.645,y(t1),.12),(t0*.645,y(t0),.12),'paint')
  for points in [A,R]:strip('glass surround',points+[points[0]],.022,'trim')
  for side in [-1,1]:
   p=[(side*.755,.79,.67),(side*.637,1.284,.115),(side*.637,1.284,rr),(side*.765,.797,end+.38)]
   mesh('painted C pillar',[(side*.637,1.284,rr),(side*.765,.797,end+.38),(side*.765,.797,end)],[(0,1,2)],'paint')
   strip('window frame',p+[p[0]],.024,'paint')
   line('B pillar',(side*.71,.787,-.67),(side*.64,1.28,-.67),.025,'trim')
   line('door top',(side*.757,.785,.67),(side*.77,.785,-.78),.012,'trim')
  quad('rear deck',(-.765,.797,end),(.765,.797,end),(.748,.776,-2.075),(-.748,.776,-2.075),'paint')
  if variant=='hatch':
   box('hatch lip',(0,.797,-1.99),(1.45,.027,.08),'trim',.009)
   line('rear wiper',(.08,.95,-1.57),(.5,.95,-1.57),.009,'trim')
  # Cabin under the glazing, deliberately lightweight.
  box('dashboard',(0,.787,.39),(1.36,.125,.34),'trim',.03)
  for x in [-.36,.36]:
   box('bucket cushion',(x,.445,-.15),(.43,.12,.47),'seat',.04)
   box('bucket back',(x,.735,-.43),(.4,.54,.11),'seat',.055)
   box('head restraint',(x,1.035,-.46),(.235,.16,.10),'seat',.035)
  box('rear bench',(0,.55,-1.05),(1.15,.24,.36),'seat',.04)
  current=(lod,'glass_'+variant)
  quad('windscreen',*A,'glass');quad('rear window',*R,'glass')
  for side in [-1,1]:
   quad('side glass',(side*.755,.79,.67),(side*.637,1.284,.115),(side*.637,1.284,rr),(side*.765,.797,end+.38),'glass')
 # Lamps are authored closed around a real hinge; runtime rotates them open.
 for side,name in [(-1,'popup_l'),(1,'popup_r')]:
  current=(lod,name);x=side*.54
  box('popup lid',(x,.742,1.50),(.37,.025,.38),'paint',.007)
  box('popup bucket',(x,.683,1.50),(.35,.105,.34),'trim',.012)
  lens=box('headlamp lens',(x,.655,1.69),(.30,.13,.014),'front_lamp',.004);lens.rotation_euler.x=.65
  if detail:
   for i in range(7):
    rib=box('lens fluting',(x-.126+i*.042,.655,1.699),(.004,.12,.002),'metal');rib.rotation_euler.x=.65
 # Wheel meshes use the same local origin. Runtime instance transforms spin and steer.
 current=(lod,'wheel');segments=48 if detail else 16
 rings=[(-.103,.218),(-.103,.263),(-.077,.294),(.073,.294),(.103,.263),(.103,.218)]
 verts=[(x,.298+math.cos(i/segments*math.tau)*r,math.sin(i/segments*math.tau)*r) for x,r in rings for i in range(segments)]
 faces=[]
 for j in range(len(rings)-1):
  for i in range(segments):faces.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
 mesh('rounded tyre',verts,faces,'rubber',True)
 for sign in [-1,1]:
  # Machined outer lip, eight recessed spokes and brake disc.
  x=sign*.105
  for i in range(segments):
   a=i/segments*math.tau;b=(i+1)/segments*math.tau
   quad('rim lip',(x,.298+math.cos(a)*.21,math.sin(a)*.21),(x,.298+math.cos(b)*.21,math.sin(b)*.21),(x,.298+math.cos(b)*.19,math.sin(b)*.19),(x,.298+math.cos(a)*.19,math.sin(a)*.19),'metal')
  line('brake disc',(x-sign*.035,.298,0),(x-sign*.023,.298,0),.164,'disc',segments)
  for i in range(8):
   a=i/8*math.tau
   line('rounded eight spoke',(x,.298+math.cos(a)*.057,math.sin(a)*.057),(x,.298+math.cos(a)*.184,math.sin(a)*.184),.017,'rim',8 if detail else 5)
  line('hub',(x,.298,0),(x+sign*.008,.298,0),.057,'rim',16 if detail else 8)
  if detail:
   for i in range(4):
    a=i/4*math.tau;line('lug bolt',(x,.298+math.cos(a)*.035,math.sin(a)*.035),(x+sign*.01,.298+math.cos(a)*.035,math.sin(a)*.035),.008,'metal',6)
 # Detachable cosmetics, not baked into the stock shell.
 current=(lod,'spoiler_gt')
 box('GT aerofoil',(0,1.36,-1.92),(1.67,.055,.31),'trim',.014)
 for side in [-1,1]:box('GT upright',(side*.52,1.05,-1.91),(.045,.58,.09),'metal',.005);box('GT endplate',(side*.83,1.37,-1.92),(.025,.17,.35),'trim',.008)
 current=(lod,'vinyl_twin')
 for x in [-.18,.18]:
  quad('bonnet stripe',(x-.05,.772,.85),(x+.05,.772,.85),(x+.05,.701,2.01),(x-.05,.701,2.01),'vinyl_white')
  for z in [-.58,-.2]:quad('roof stripe',(x-.05,1.334,z),(x+.05,1.334,z),(x+.05,1.334,z+.34),(x-.05,1.334,z+.34),'vinyl_white')
 current=(lod,'vinyl_apex')
 for s in [-1,1]:
  quad('apex white',(s*.816,.54,-.86),(s*.816,.54,.61),(s*.816,.65,.24),(s*.816,.65,-.86),'vinyl_white')
  quad('apex blue',(s*.818,.57,-.86),(s*.818,.57,.22),(s*.818,.67,-.10),(s*.818,.67,-.86),'vinyl_blue')
 # Original text outlines; font is converted to geometry, no font file is shipped.
 current=(lod,'lettering')
 for side in [-1,1]:
  # Text local x is car longitudinal direction, local y is vertical.
  rotation=(math.pi/2,0,math.pi/2 if side>0 else -math.pi/2)
  label('tofu lettering','藤原とうふ店',(side*.817,.627,-.12),.105,rotation)
  label('private use','(自家用)',(side*.817,.567,-.11),.044,rotation)
 label('rear badge','TRUENO',(.40,.785,-2.122),.043,(math.pi/2,0,math.pi))
 label('licence number','13-954',(0,.415,-2.142),.047,(math.pi/2,0,math.pi))
 label('front plate','13-954',(0,.415,2.14),.047,(math.pi/2,0,0))

# Join by functional part, apply local pivots, generate original UVs and export.
parts=[]
for (lod,part),objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=f'LOD{lod}_{part}'
 if lod==1 and part not in ['wheel','hood','glass_hatch','glass_coupe','lettering','vinyl_twin','vinyl_apex']:
  m=o.modifiers.new('Distant silhouette','DECIMATE');m.ratio=.35;bpy.ops.object.modifier_apply(modifier=m.name)
 pivot=(0,.298,0) if part=='wheel' else ((-.54 if part=='popup_l' else .54),.742,1.31) if part.startswith('popup') else (0,0,0)
 bpy.context.scene.cursor.location=xyz(pivot);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 o['part']=part;o['lod']=lod;o['authored']='original-procedural-2026-10-31'
 # Independent UVs for future detail textures, no imported UV or bitmap data.
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.01);bpy.ops.object.mode_set(mode='OBJECT')
 parts.append(o)
bpy.context.scene['source']='Original geometry; Toyota dimensional reference only. No imported mesh/UV/texture.'
bpy.context.scene['coordinate_system']='glTF: +Y up, +Z forward, metres'
bpy.context.scene['wheelbase']=2.4
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'ae86-source.blend'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'ae86.glb'),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_apply=True)
stats={'reference':{'length':4.205,'width':1.625,'height':1.335,'wheelbase':2.4},'parts':[]}
for o in parts:
 o.data.calc_loop_triangles();stats['parts'].append({'name':o.name,'part':o['part'],'lod':o['lod'],'triangles':len(o.data.loop_triangles),'pivot':list(o.location)})
with open(os.path.join(OUT,'ae86-build.json'),'w',encoding='utf8')as f:json.dump(stats,f,indent=2)
print('AE86_ORIGINAL_BUILT',json.dumps({'parts':len(parts),'triangles':sum(p['triangles'] for p in stats['parts'])}))
