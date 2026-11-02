"""Read-only Blender import review. Never saves or exports the source model."""
import bpy,sys,json,math,os
from mathutils import Vector,Matrix
args=sys.argv[sys.argv.index('--')+1:]
source=os.path.abspath(args[0]);root=os.path.abspath(args[1]);os.makedirs(root,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
lo=Vector([min(p[a] for p in points) for a in range(3)]);hi=Vector([max(p[a] for p in points) for a in range(3)]);dims=hi-lo
stats={'source':source,'blender':bpy.app.version_string,'meshObjects':len(objects),'worldBoundsMin':list(lo),'worldBoundsMax':list(hi),'worldDimensions':list(dims),'triangles':0,'parts':[],'images':[],'materials':[]}
for o in objects:
 o.data.calc_loop_triangles();n=len(o.data.loop_triangles);stats['triangles']+=n
 stats['parts'].append({'name':o.name,'triangles':n,'dimensions':list(o.dimensions),'origin':list(o.matrix_world.translation),'uvLayers':len(o.data.uv_layers),'materials':[s.material.name if s.material else None for s in o.material_slots]})
for image in bpy.data.images:
 if image.type=='IMAGE':stats['images'].append({'name':image.name,'size':list(image.size),'packed':bool(image.packed_file)})
for material in bpy.data.materials:stats['materials'].append({'name':material.name,'usesNodes':material.use_nodes})
# Normalize only this temporary studio view to a 4.25 m length. Keep imported
# hierarchy, UVs, materials and pivots; no changes are written to the GLB.
scale=4.25/max(dims.x,dims.y);stats['previewScaleFactor']=scale
center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
anchor=bpy.data.objects.new('REVIEW_ONLY_NORMALIZATION',None);bpy.context.collection.objects.link(anchor)
for o in list(bpy.context.scene.objects):
 if o!=anchor and o.parent is None:o.parent=anchor
anchor.matrix_world=Matrix.Translation(-center*scale)@Matrix.Scale(scale,4)
bpy.context.view_layer.update()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));floor=bpy.context.object
material=bpy.data.materials.new('REVIEW studio ground');material.diffuse_color=(.11,.125,.145,1);material.use_nodes=True;material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.11,.125,.145,1);material.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8;floor.data.materials.append(material)
def aim(o,point):o.rotation_euler=(Vector(point)-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,size in [('key',(2,-3,6),1100,5),('fill',(-4,-1,3),700,4),('rim',(1,5,5),1300,4)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.name=name;light.data.energy=power;light.data.shape='DISK';light.data.size=size;aim(light,(0,0,.7))
scene=bpy.context.scene;scene.world.color=(.18,.18,.18);scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1100;scene.render.resolution_y=750;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=5.8
for name,loc in [('ae86-importado-vista-a',(5,-7,3.6)),('ae86-importado-vista-b',(-5,7,3.2))]:
 camera.location=loc;aim(camera,(0,0,.65));scene.render.filepath=os.path.join(root,name+'.png');bpy.ops.render.render(write_still=True)
with open(os.path.join(root,'blender-audit.json'),'w',encoding='utf8') as out:json.dump(stats,out,indent=2)
print('REVIEW_OK',json.dumps({k:stats[k] for k in ['meshObjects','triangles','worldDimensions','previewScaleFactor']}))
