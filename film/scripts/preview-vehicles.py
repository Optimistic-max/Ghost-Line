# Renders a quick look at the exported .glb vehicles (EEVEE, OpenGL backend).
# blender -b --factory-startup -P scripts\preview-vehicles.py -- <race-film dir>
import bpy, sys, os, math
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
for name, x in (('trolley1938', 0.0), ('bus-today', 0.0)):
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, 'models', name + '.glb'))
    for o in bpy.context.selected_objects:
        if o.parent is None:
            o.location.y += (-4.0 if name == 'trolley1938' else 4.0)
bpy.ops.mesh.primitive_plane_add(size=60)
g = bpy.context.object
gm = bpy.data.materials.new('ground'); gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.18, 0.18, 0.19, 1)
g.data.materials.append(gm)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.6, 0.7, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), math.radians(15), math.radians(-40)))
bpy.context.object.data.energy = 3.5
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
sc.eevee.taa_render_samples = 32
sc.view_settings.view_transform = 'AgX'
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.render.image_settings.file_format = 'PNG'
def shot(loc, target, lens, path):
    cam.location = Vector(loc)
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
shot((16, -16, 7), (0, 0, 1.6), 40, os.path.join(OUT, 'stills', 'vehicles-closeup.png'))
shot((-60, -30, 75), (0, 0, 1.0), 85, os.path.join(OUT, 'stills', 'vehicles-drone-height.png'))
print('PREVIEW DONE')
