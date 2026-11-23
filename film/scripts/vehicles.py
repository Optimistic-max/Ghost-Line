# Builds the two illustrative vehicles and their ground halos, exports .glb.
# Blender 5.2:  "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup -P scripts\vehicles.py -- <race-film dir>
# Blender axes: +X forward, +Z up (Cesium reads the glTF the same way after its Y-up fix).
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.getcwd()
MODELS = os.path.join(OUT, 'models')
os.makedirs(MODELS, exist_ok=True)


def srgb(h, a=1.0):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, hexcol, rough=0.45, metal=0.0, emit=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(hexcol)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = srgb(hexcol)
        b.inputs['Emission Strength'].default_value = emit
    return m


def obj_from_bm(name, bm, material, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    return o


def rounded_plan(length, width, r_front, r_rear, seg=10):
    """Plan outline (x forward) with rounded corners, CCW."""
    hl, hw = length / 2, width / 2
    pts = []
    def arc(cx, cy, r, a0, a1):
        for i in range(seg + 1):
            a = a0 + (a1 - a0) * i / seg
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    arc(hl - r_front, -hw + r_front, r_front, -math.pi / 2, 0)
    arc(hl - r_front, hw - r_front, r_front, 0, math.pi / 2)
    arc(-hl + r_rear, hw - r_rear, r_rear, math.pi / 2, math.pi)
    arc(-hl + r_rear, -hw + r_rear, r_rear, math.pi, 1.5 * math.pi)
    return pts


def prism(name, plan, z0, z1, material, bevel_top=0.0, bevel_bot=0.0, segs=5, offset=0.0):
    """Extrude a plan outline from z0 to z1 and round the top/bottom rims."""
    bm = bmesh.new()
    if offset:
        # grow outline outward by offset (approximate via centroid scaling per point normal)
        n = len(plan)
        grown = []
        for i in range(n):
            p0, p1, p2 = Vector((*plan[i - 1], 0)), Vector((*plan[i], 0)), Vector((*plan[(i + 1) % n], 0))
            t = (p2 - p0).normalized()
            nrm = Vector((t.y, -t.x, 0))
            grown.append((p1.x + nrm.x * offset, p1.y + nrm.y * offset))
        plan = grown
    bot = [bm.verts.new((x, y, z0)) for x, y in plan]
    top = [bm.verts.new((x, y, z1)) for x, y in plan]
    n = len(plan)
    for i in range(n):
        bm.faces.new((bot[i], bot[(i + 1) % n], top[(i + 1) % n], top[i]))
    ft = bm.faces.new(top)
    fb = bm.faces.new(list(reversed(bot)))
    bm.normal_update()
    edges = []
    if bevel_top:
        edges += [e for e in ft.edges]
    if bevel_bot:
        bmesh.ops.bevel(bm, geom=list(fb.edges), offset=bevel_bot, segments=max(2, segs // 2), profile=0.5, affect='EDGES')
    if bevel_top:
        ft = [f for f in bm.faces if all(abs(v.co.z - z1) < 1e-5 for v in f.verts) and len(f.verts) > 4][0]
        bmesh.ops.bevel(bm, geom=list(ft.edges), offset=bevel_top, segments=segs, profile=0.5, affect='EDGES')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material)


def rbox(name, size, loc, material, bevel=0.05, segs=3, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(size) / 2.05), segments=segs, profile=0.5, affect='EDGES')
    if rot is not None:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    return obj_from_bm(name, bm, material)


def cyl(name, r, depth, loc, material, axis='Y', segs=24, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=depth)
    if axis == 'Y':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    elif axis == 'X':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    if rot is not None:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    return obj_from_bm(name, bm, material)


def wheel(prefix, x, y, r, w, tyre, hub):
    cyl(prefix + '_tyre', r, w, (x, y, r), tyre, segs=28)
    side = 1 if y > 0 else -1
    cyl(prefix + '_hub', r * 0.55, 0.04, (x, y + side * (w / 2 + 0.005), r), hub, segs=20)


def side_windows(prefix, x_from, x_to, n, z0, z1, half_w, material, gap=0.14, depth=0.03):
    span = (x_to - x_from - gap * (n - 1)) / n
    for i in range(n):
        cx = x_from + span / 2 + i * (span + gap)
        for s in (-1, 1):
            rbox(f'{prefix}_{i}_{s}', (span, depth, z1 - z0), (cx, s * (half_w + depth / 2 - 0.012), (z0 + z1) / 2), material, bevel=0.06, segs=2)


def export(path, select_names=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if select_names is None or o.name.split('_')[0] in select_names:
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_materials='EXPORT', export_image_format='AUTO')
    print('exported', path, os.path.getsize(path), 'bytes')


# ---------------------------------------------------------------- trolley
def build_trolley():
    reset()
    cream = mat('cream', '#FFE7A8', rough=0.42)
    trim = mat('trim', '#3A2A22', rough=0.5)
    glass = mat('glass', '#111018', rough=0.06, metal=0.55)
    roof = mat('roofgrey', '#8C8478', rough=0.7)
    tyre = mat('tyre', '#18161A', rough=0.85)
    hub = mat('hub', '#9A9488', rough=0.35, metal=0.6)
    lamp = mat('lamp', '#FFF3D0', rough=0.2, emit=3.0)
    pole = mat('pole', '#2A2622', rough=0.4, metal=0.5)

    L, W = 10.0, 2.5
    plan = rounded_plan(L, W, r_front=1.05, r_rear=0.75)
    # body: lower panel to roof line, rounded roof
    prism('T_body', plan, 0.42, 3.0, cream, bevel_top=0.42, bevel_bot=0.06, segs=6)
    # dark skirt trim and belt line (thin bands just proud of the body)
    prism('T_skirt', plan, 0.42, 0.62, trim, offset=0.012)
    prism('T_belt', plan, 1.52, 1.64, trim, offset=0.014)
    prism('T_drip', plan, 2.62, 2.68, trim, offset=0.014)
    # window row: 8 side windows, a windshield split in two, rear window
    side_windows('T_win', -4.15, 2.95, 7, 1.74, 2.52, W / 2, glass)
    # windshield: three panels hugging the rounded front (centre + two at +-38 deg on the corner arcs)
    rf = 1.05
    for i, a in enumerate((-38, 0, 38)):
        ar = math.radians(a)
        if a == 0:
            pos, wdt = (L / 2 + 0.012, 0.0), 0.42
        else:
            cy = math.copysign(W / 2 - rf, a)
            pos, wdt = (L / 2 - rf + (rf + 0.012) * math.cos(ar), cy + (rf + 0.012) * math.sin(ar)), 0.78
        rbox(f'T_wind_{i}', (0.03, wdt, 0.8), (pos[0], pos[1], 2.12), glass, bevel=0.06, rot=Matrix.Rotation(ar, 3, 'Z'))
    rbox('T_rearwin', (0.03, 0.9, 0.6), (-L / 2 - 0.008, 0, 2.15), glass, bevel=0.08)
    # entrance door (front, kerb side -Y), on the straight side ahead of the first window
    rbox('T_door', (0.8, 0.03, 2.0), (3.45 + 0.05, -W / 2 - 0.004, 1.48), glass, bevel=0.05)
    # headlights sit on the rounded front surface
    for s in (-1, 1):
        y0 = 0.72
        xf = L / 2 - rf + math.sqrt(rf * rf - (y0 - (W / 2 - rf)) ** 2)
        cyl(f'T_lamp_{s}', 0.13, 0.1, (xf + 0.02, s * y0, 0.98), lamp, axis='X', segs=16, rot=Matrix.Rotation(s * math.asin((y0 - (W / 2 - rf)) / rf), 3, 'Z'))
    prism('T_rub', plan, 0.46, 0.56, trim, offset=0.05)
    # wheels: rubber tyres, front single axle, rear axle
    for s in (-1, 1):
        wheel(f'T_wf{s}', 3.25, s * (W / 2 - 0.16), 0.5, 0.32, tyre, hub)
        wheel(f'T_wr{s}', -2.75, s * (W / 2 - 0.16), 0.5, 0.42, tyre, hub)
    # roof: trolley base, catwalk, two poles reaching ~5.5 m (the overhead wire height)
    rbox('T_catwalk', (3.2, 1.1, 0.08), (-1.2, 0, 3.05), roof, bevel=0.03)
    rbox('T_base', (0.7, 1.0, 0.28), (-0.3, 0, 3.18), trim, bevel=0.06)
    base = Vector((-0.3, 0, 3.32))
    for s in (-1, 1):
        tip = Vector((-5.4, s * 0.30, 5.5))
        v = tip - (base + Vector((0, s * 0.3, 0)))
        length = v.length
        mid = (tip + base + Vector((0, s * 0.3, 0))) / 2
        rot = Vector((1, 0, 0)).rotation_difference(v.normalized()).to_matrix()
        cyl(f'T_pole_{s}', 0.045, length, (0, 0, 0), pole, axis='X', segs=10, rot=rot)
        o = bpy.data.objects[f'T_pole_{s}']
        o.location = mid
        cyl(f'T_shoe_{s}', 0.07, 0.35, tuple(tip), trim, axis='X', segs=10)
        cyl(f'T_spring_{s}', 0.11, 0.5, (base.x - 0.1, s * 0.3, base.z + 0.05), trim, axis='X', segs=12)
    export(os.path.join(MODELS, 'trolley1938.glb'))


# ---------------------------------------------------------------- bus
def build_bus():
    reset()
    coral = mat('coral', '#F47C5A', rough=0.4)
    dark = mat('band', '#111018', rough=0.06, metal=0.55)
    grey = mat('roof', '#D9D3CC', rough=0.6)
    tyre = mat('tyre', '#18161A', rough=0.85)
    hub = mat('hub', '#B5B0A8', rough=0.35, metal=0.6)
    lamp = mat('lamp', '#FFF6E8', rough=0.2, emit=3.0)
    L, W = 12.2, 2.59
    plan = rounded_plan(L, W, r_front=0.38, r_rear=0.32)
    prism('B_body', plan, 0.32, 3.05, coral, bevel_top=0.28, bevel_bot=0.05, segs=5)
    # big window band (continuous dark glazing) and windshield
    prism('B_band', plan, 1.12, 2.62, dark, offset=0.012)
    # coral pillars back over the band at doors so it reads as a bus not a box
    for x in (4.7, -0.6):
        for s in (-1, 1):
            rbox(f'B_door_{x}_{s}', (1.15, 0.03, 2.45), (x, s * (W / 2 + 0.02), 1.55), dark, bevel=0.04)
    for i, x in enumerate((-5.4, -3.3, -1.7, 1.0, 2.6)):
        for s in (-1, 1):
            rbox(f'B_pillar_{i}_{s}', (0.09, 0.03, 1.45), (x, s * (W / 2 + 0.02), 1.87), coral, bevel=0.0)
    rbox('B_wind', (0.05, 1.8, 1.75), (L / 2 + 0.01, 0, 1.85), dark, bevel=0.1)
    rbox('B_sign', (0.06, 1.5, 0.24), (L / 2 + 0.01, 0, 2.86), dark, bevel=0.04)
    rbox('B_ac', (3.4, 1.8, 0.32), (-2.5, 0, 3.15), grey, bevel=0.12)
    rbox('B_hvac', (1.6, 1.6, 0.22), (2.6, 0, 3.1), grey, bevel=0.08)
    rbox('B_bumper', (0.18, 1.8, 0.28), (L / 2 + 0.05, 0, 0.5), dark, bevel=0.07)
    rbox('B_rbumper', (0.18, 1.9, 0.28), (-L / 2 - 0.05, 0, 0.5), dark, bevel=0.07)
    for s in (-1, 1):
        rbox(f'B_lamp_{s}', (0.06, 0.38, 0.16), (L / 2 + 0.03, s * 0.92, 0.82), lamp, bevel=0.04)
        wheel(f'B_wf{s}', 3.6, s * (W / 2 - 0.15), 0.5, 0.3, tyre, hub)
        wheel(f'B_wr{s}', -3.0, s * (W / 2 - 0.15), 0.5, 0.42, tyre, hub)
    export(os.path.join(MODELS, 'bus-today.glb'))


# ---------------------------------------------------------------- halos
def build_halo(name, hexcol, length, width, shadow=False):
    reset()
    size = 256
    img = bpy.data.images.new(name + '_tex', size, size, alpha=True)
    c = srgb(hexcol)
    px = [0.0] * (size * size * 4)
    for j in range(size):
        for i in range(size):
            u = (i + 0.5) / size * 2 - 1
            v = (j + 0.5) / size * 2 - 1
            r = math.sqrt(u * u + v * v)
            # soft disc: bright ring under the vehicle edge, fading out
            if shadow:  # soft contact shadow: dark centre fading to nothing
                a = min(1.0, max(0.0, 1 - r) ** 0.9 * 1.1) * 0.8
            else:
                a = max(0.0, 1 - r) ** 1.6 * 0.85
                a += 0.35 * math.exp(-((r - 0.62) / 0.07) ** 2)
            a = min(1.0, a) if r < 1 else 0.0
            k = (j * size + i) * 4
            px[k:k + 4] = [c[0], c[1], c[2], a]
    img.pixels = px
    img.pack()
    m = bpy.data.materials.new(name + '_mat')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = img
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(t.outputs['Color'], b.inputs['Emission Color'])
    nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
    b.inputs['Emission Strength'].default_value = 0.0 if shadow else 1.0
    b.inputs['Roughness'].default_value = 1.0
    m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bmesh.ops.scale(bm, vec=Vector((length, width, 1)), verts=bm.verts)
    uv = bm.loops.layers.uv.new()
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / length + 0.5, l.vert.co.y / width + 0.5)
    obj_from_bm(name, bm, m, smooth=False)
    export(os.path.join(MODELS, name + '.glb'))


build_trolley()
build_bus()
build_halo('halo-ghost', '#FFE7A8', 26, 13)
build_halo('halo-today', '#F47C5A', 28, 13)
build_halo('shadow-trolley', '#17121F', 11.6, 3.8, shadow=True)
build_halo('shadow-bus', '#17121F', 13.6, 3.9, shadow=True)
print('VEHICLES DONE')


