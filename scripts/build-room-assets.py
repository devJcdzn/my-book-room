"""Rebuild original Bookroom furniture: Blender --background --python this_file."""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'room-collection'
ROOT.mkdir(parents=True, exist_ok=True)
# A separate scene leaves any open project untouched when run through the MCP.
scene = bpy.data.scenes.new('Bookroom Collection')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.render.resolution_x = 256
scene.render.resolution_y = 256
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = True
scene.world = bpy.data.worlds.new('Bookroom Studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.65, .65, .65, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .7

PALETTES = [('natural', (.63,.40,.22,1), (.83,.72,.53,1), (.27,.39,.24,1)),
            ('classic', (.22,.09,.045,1), (.47,.20,.13,1), (.23,.33,.20,1)),
            ('botanic', (.48,.29,.13,1), (.44,.56,.35,1), (.18,.36,.19,1))]
materials = {}
for theme, wood, fabric, green in PALETTES:
    materials[theme] = {}
    for role, color, metallic in [('wood', wood, 0), ('fabric', fabric, 0), ('leaf', green, 0),
                                  ('ceramic', (.76,.58,.38,1), 0), ('metal', (.55,.36,.12,1), .65),
                                  ('paper', (.91,.84,.65,1), 0), ('soil', (.10,.065,.04,1), 0)]:
        mat = bpy.data.materials.new(theme + '_' + role)
        mat.diffuse_color = color
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = color
        shader.inputs['Roughness'].default_value = .65 if metallic else .86
        shader.inputs['Metallic'].default_value = metallic
        materials[theme][role] = mat

active_collection = None
active_materials = None

def finish(obj, name, role):
    obj.name = name
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    active_collection.objects.link(obj)
    obj.data.materials.append(active_materials[role])
    return obj

def box(name, location, size, role='wood', bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = finish(bpy.context.object, name, role)
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('Soft edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        modifier = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj

def cylinder(name, location, bottom, top, height, role='wood', vertices=24):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=bottom, radius2=top, depth=height, location=location)
    obj = finish(bpy.context.object, name, role)
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return obj

def sphere(name, location, size, role='leaf'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1, location=location)
    obj = finish(bpy.context.object, name, role)
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj

def tube(name, points, radius=.025, role='wood'):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1)
    obj = bpy.data.objects.new(name, curve)
    active_collection.objects.link(obj)
    curve.materials.append(active_materials[role])
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return obj

def build(category, style):
    if category == 'desk':
        box('Top', (0,0,1.105), (2.4,1.45,.09), bevel=.09)
        for x in [-1.02,1.02]:
            for y in [-.56,.56]:
                if style == 2:
                    cylinder('Turned leg', (x,y,.51), .065,.075,1.02)
                    for z in [.14,.73,.9]: sphere('Leg collar',(x,y,z),(.085,.085,.055),'wood')
                else: box('Leg',(x,y,.51),(.09,.09,1.02),bevel=.015)
        box('Apron',(0,.55,.96),(2.1,.07,.19))
        if style == 1:
            for x in [-.57,.57]:
                box('Drawer',(x,-.60,.93),(1.05,.18,.25))
                cylinder('Brass knob',(x,-.71,.93),.035,.035,.055,'metal').rotation_euler[0] = math.pi/2
        if style == 2: box('Stretcher',(0,.43,.24),(2.12,.07,.09))
    elif category == 'seat':
        for x in [-.36,.36]:
            for y in [-.34,.34]: box('Chair leg',(x,y,.36),(.08,.08,.72))
        box('Seat',(0,0,.73),(.91,.84,.12),bevel=.06)
        box('Cushion',(0,-.025,.83),(.82,.74,.13),'fabric',.06)
        for x in [-.36,.36]: box('Back post',(x,.32,1.16),(.075,.08,.83))
        if style == 2:
            tube('Curved back',[(.39*math.cos(a),.32,1.20+.32*math.sin(a)) for a in [i*math.pi/24 for i in range(25)]],.07)
            for x in [-.2,0,.2]: box('Back spindle',(x,.32,1.24),(.035,.035,.42))
        else:
            box('Backrest',(0,.33,1.30),(.85,.12,.47),'fabric' if style == 1 else 'wood',.07)
            if style == 1:
                for x in [-.47,.47]:
                    box('Armrest',(x,0,1.07),(.09,.72,.09))
                    box('Arm support',(x,-.23,.92),(.07,.07,.27))
    elif category == 'bookcase':
        # All variants share shelf anchors, allowing the user's books to fit exactly.
        for x in [-1.04,1.04]: box('Side',(x,.40,1.4),(.10,.65,2.8),bevel=.05 if style == 2 else .025)
        box('Back',(0,.10,1.4),(2.0,.06,2.76))
        for z in [.175,.995,1.815,2.635]: box('Shelf',(0,.40,z),(2.08,.64,.08))
        box('Plinth',(0,.40,.075),(2.18,.69,.15))
        if style == 1:
            for z,w,d in [(2.73,2.20,.69),(2.80,2.29,.74)]: box('Cornice',(0,.40,z),(w,d,.07))
            for x in [-.97,.97]: box('Column trim',(x,.745,1.4),(.045,.035,2.6))
        elif style == 2:
            tube('Arched crown',[(1.04*math.cos(a),.4,2.67+.20*math.sin(a)) for a in [i*math.pi/32 for i in range(33)]],.055)
    elif category == 'lamp':
        cylinder('Base',(0,0,.06),.32,.29,.12,'metal' if style == 1 else 'ceramic')
        cylinder('Stem',(0,0,1.04),.04,.035,1.95,'metal' if style == 1 else 'wood')
        if style == 0: sphere('Ceramic neck',(0,0,1.87),(.15,.15,.21),'ceramic')
        cylinder('Shade',(0,0,2.25),.46,.26,.56,'paper',48)
        tube('Shade lower seam',[(.46*math.cos(a),.46*math.sin(a),1.97) for a in [i*math.tau/48 for i in range(49)]],.018,'fabric')
        if style == 2:
            for i in range(24):
                a = i*math.tau/24
                tube('Pleat',[(.462*math.cos(a),.462*math.sin(a),1.98),(.262*math.cos(a),.262*math.sin(a),2.52)],.008,'fabric')
    elif category in ['window','frame']:
        w,h = (1.5,1.7) if category == 'window' else (1.0,1.0)
        for x in [-w/2,w/2]: box('Side moulding',(x,-.045,0),(.085,.09,h+.085),bevel=.035 if style == 2 else .015)
        for z in [-h/2,h/2]: box('Cross moulding',(0,-.045,z),(w+.085,.09,.085),bevel=.035 if style == 2 else .015)
        if category == 'frame':
            box('Mat',(0,-.024,0),(w-.08,.025,h-.08),'paper',.01)
            if style == 1:
                for x in [-w/2-.045,w/2+.045]: box('Gold fillet',(x,-.065,0),(.018,.025,h+.16),'metal',.005)
                for z in [-h/2-.045,h/2+.045]: box('Gold fillet',(0,-.065,z),(w+.16,.025,.018),'metal',.005)
            elif style == 2:
                for x in [-w/2,w/2]:
                    tube('Organic edge',[(x+.02*math.sin(i*.9),-.08,-h/2+i*h/24) for i in range(25)],.035)
        else:
            box('Sill',(0,-.12,-h/2-.07),(w+.27,.31,.11))
            if style == 1:
                box('Mullion',(0,-.03,0),(.045,.07,h))
                box('Transom',(0,-.03,.05),(w,.07,.045))
            if style == 2:
                # Arch rises above the rectangular clear aperture, preserving dynamic sky support.
                tube('Arch',[(w/2*math.cos(a),-.045,h/2+.30*math.sin(a)) for a in [i*math.pi/32 for i in range(33)]],.06)
            tube('Curtain rod',[(-1,-.15,h/2+.13),(1,-.15,h/2+.13)],.025,'metal')
            for side in [-1,1]:
                for i in range(6):
                    x = side*(.80+i*.038)
                    cylinder('Curtain fold',(x,-.11-.035*math.cos(i),-.02),.035,.035,h+.14,'fabric',12)
    elif category == 'rug':
        if style == 1:
            box('Rug',(0,0,.025),(3.35,2.5,.05),'fabric',.06)
            for x in [-1.55,1.55]: box('Border',(x,0,.054),(.065,2.3,.008),'paper',.008)
            for y in [-1.12,1.12]: box('Border',(0,y,.054),(3.12,.065,.008),'paper',.008)
            for i in range(11):
                for y in [-1.17,1.17]: box('Woven motif',(-1.4+i*.28,y,.06),(.07,.06,.01),'paper',.005).rotation_euler[2]=math.pi/4
        else:
            obj = cylinder('Rug',(0,0,.025),1.7,1.7,.05,'fabric',64)
            obj.scale.y = .72 if style == 0 else 1
            for radius in [1.58,1.62]:
                tube('Woven border',[(radius*math.cos(a),radius*math.sin(a)*(.72 if style == 0 else 1),.055) for a in [i*math.tau/64 for i in range(65)]],.008,'paper')
        for i in range(26):
            x = -1.25+i*.1
            length = 1.4*math.sqrt(max(0,1-(x/1.6)**2))
            tube('Weave',[(x,-length*.7,.053),(x,length*.7,.053)],.003,'fabric')
    elif category == 'plant':
        cylinder('Pot',(0,0,.20),.18,.25,.40,'ceramic')
        cylinder('Rim',(0,0,.39),.27,.27,.065,'ceramic')
        cylinder('Soil',(0,0,.411),.23,.23,.012,'soil')
        for i in range(7 if style == 0 else 9):
            a = i*2.399
            height = .62+(i%3)*.14
            end=(.29*math.cos(a),.29*math.sin(a),height)
            tube('Stem',[(0,0,.41),(.10*math.cos(a),.10*math.sin(a),height*.75),end],.009,'leaf')
            if style == 1:
                for j in range(4):
                    for side in [-1,1]:
                        leaf = sphere('Fern leaflet',(end[0]*(.3+j*.18)+side*.06,end[1]*(.3+j*.18),.46+j*.08),(.12,.035,.028))
                        leaf.rotation_euler[2]=a+side*.5
            elif style == 2:
                for j in range(3):
                    leaf = sphere('Vine leaf',(end[0]*(1+j*.25),end[1]*(1+j*.25),height-j*.18),(.09,.045,.04))
                    leaf.rotation_euler[2]=a
            else:
                leaf = sphere('Broad leaf',end,(.13,.045,.23))
                leaf.rotation_euler=(.45*math.sin(a),.45*math.cos(a),a)

camera_data = bpy.data.cameras.new('Catalog Camera')
camera = bpy.data.objects.new('Catalog Camera',camera_data)
scene.collection.objects.link(camera)
scene.camera=camera
camera_data.type='ORTHO'
for loc,power,size in [((4,-5,7),450,5),((-4,-1,4),250,4)]:
    data=bpy.data.lights.new('Softbox','AREA')
    data.energy=power
    data.shape='DISK'
    data.size=size
    light=bpy.data.objects.new('Softbox',data)
    scene.collection.objects.link(light)
    light.location=loc
    light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()

report=[]
for style,(theme,*_) in enumerate(PALETTES):
    theme_collection=bpy.data.collections.new(theme)
    scene.collection.children.link(theme_collection)
    for category in ['desk','seat','bookcase','lamp','window','frame','rug','plant']:
        asset_id=f'{theme}-{category}'
        active_collection=bpy.data.collections.new(asset_id)
        theme_collection.children.link(active_collection)
        active_materials=materials[theme]
        build(category,style)
        if category == 'bookcase':
            for obj in active_collection.objects:
                obj.location.y *= -1
        bpy.ops.object.select_all(action='DESELECT')
        objects=list(active_collection.objects)
        for obj in objects: obj.select_set(True)
        # Merge per material at export, keeping editable separate meshes in the master.
        export_collection=bpy.data.collections.new('Export '+asset_id)
        scene.collection.children.link(export_collection)
        bpy.ops.object.select_all(action='DESELECT')
        copies=[]
        for original in objects:
            copy=original.copy()
            copy.data=original.data.copy()
            export_collection.objects.link(copy)
            copy.select_set(True)
            copies.append(copy)
        bpy.context.view_layer.objects.active=copies[0]
        bpy.ops.object.join()
        bpy.ops.export_scene.gltf(filepath=str(ROOT/f'{asset_id}.glb'),export_format='GLB',use_selection=False,collection=export_collection.name,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
        for obj in list(export_collection.objects):
            mesh=obj.data
            bpy.data.objects.remove(obj,do_unlink=True)
            if mesh.users==0: bpy.data.meshes.remove(mesh)
        bpy.data.collections.remove(export_collection)

        corners=[obj.matrix_world @ Vector(co) for obj in objects for co in obj.bound_box]
        minimum=Vector(tuple(min(p[i] for p in corners) for i in range(3)))
        maximum=Vector(tuple(max(p[i] for p in corners) for i in range(3)))
        center=(minimum+maximum)/2
        extent=max(maximum-minimum)
        camera.location=center+Vector((3,-4,3))*extent
        camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
        camera_data.ortho_scale=extent*1.55
        scene.render.filepath=str(ROOT/f'{asset_id}.png')
        bpy.ops.render.render(write_still=True)
        tris=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in objects if obj.type=='MESH')
        report.append({'id':asset_id,'triangles':tris,'bytes':(ROOT/f'{asset_id}.glb').stat().st_size,'dimensions':list(maximum-minimum)})
        active_collection.hide_render=True
        active_collection.hide_viewport=True
    if style == 0:
        # Save the first complete collection separately for reviewing before remaining production.
        bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'bookroom-collection.blend'))

for collection in scene.collection.children:
    for child in collection.children:
        child.hide_render=True
        child.hide_viewport=True
(ROOT/'manifest.json').write_text(json.dumps(report,indent=2))
# Preview scenes use the app's orthographic camera and room dimensions.
for theme, *_ in PALETTES:
    preview=bpy.data.scenes.new(theme+' Room')
    bpy.context.window.scene=preview
    preview.render.engine='CYCLES'
    preview.cycles.samples=24
    preview.render.resolution_x=768
    preview.render.resolution_y=1024
    preview.render.resolution_percentage=100
    preview.render.image_settings.file_format='PNG'
    preview.world=scene.world.copy()
    preview.world.node_tree.nodes['Background'].inputs[0].default_value=(.82,.77,.68,1)
    preview.world.node_tree.nodes['Background'].inputs[1].default_value=.65
    preview_camera=camera.copy()
    preview_camera.data=camera.data.copy()
    preview.collection.objects.link(preview_camera)
    preview.camera=preview_camera
    preview_camera.location=(6.7,-7.4,6.25)
    preview_camera.rotation_euler=(Vector((0,0,1.08))-preview_camera.location).to_track_quat('-Z','Y').to_euler()
    preview_camera.data.ortho_scale=12.4
    shell=bpy.data.collections.new(theme+' Shell')
    preview.collection.children.link(shell)
    active_collection=shell
    active_materials=materials[theme]
    wall=bpy.data.materials.new(theme+' plaster')
    wall.diffuse_color=(.73,.64,.51,1)
    wall.use_nodes=True
    wall.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=wall.diffuse_color
    active_materials['plaster']=wall
    box('Floor',(0,0,-.04),(7.2,7.4,.1),'wood',.02)
    box('Back wall',(0,3.62,1.755),(7.04,.16,3.5),'plaster',.01)
    box('Left wall',(-3.52,0,1.755),(.16,7.4,3.5),'plaster',.01)
    transforms={'desk':((.4,-.6,0),0),'seat':((.4,-2,0),math.pi),'bookcase':((1.5,3,0),0),'lamp':((-2.3,1.1,0),0),'window':((-3.43,-.6,2),math.pi/2),'frame':((-1,3.53,2.1),0),'rug':((.4,-1.1,.015),0),'plant':((-.5,-.2,1.15),0)}
    for category,(position,rotation) in transforms.items():
        original=bpy.data.collections[theme+'-'+category]
        # Copies retain editable masters and avoid collection visibility affecting rendering.
        group=bpy.data.objects.new(theme+' '+category,None)
        preview.collection.objects.link(group)
        group.location=position
        group.rotation_euler.z=rotation
        for original_obj in original.objects:
            obj=original_obj.copy()
            preview.collection.objects.link(obj)
            obj.parent=group
    for loc,power,size in [((4,-5,7),650,5),((-4,-1,4),350,4)]:
        data=bpy.data.lights.new('Room softbox','AREA')
        data.energy=power
        data.size=size
        light=bpy.data.objects.new('Room softbox',data)
        preview.collection.objects.link(light)
        light.location=loc
        light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
    preview.render.filepath=str(ROOT/(theme+'-room-day.png'))
    bpy.ops.render.render(write_still=True)
    preview.world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.14,.18,1)
    preview.world.node_tree.nodes['Background'].inputs[1].default_value=.18
    for obj in preview.objects:
        if obj.type=='LIGHT': obj.data.energy*=.18
    data=bpy.data.lights.new('Warm reading light','POINT')
    data.energy=90
    data.color=(1,.60,.25)
    data.shadow_soft_size=.3
    light=bpy.data.objects.new('Warm reading light',data)
    preview.collection.objects.link(light)
    light.location=(-2.3,1.1,2.12)
    preview.render.filepath=str(ROOT/(theme+'-room-night.png'))
    bpy.ops.render.render(write_still=True)
bpy.context.window.scene=bpy.data.scenes['natural Room']
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'bookroom-collection.blend'))
result={'models':len(report),'max_triangles':max(x['triangles'] for x in report),'max_bytes':max(x['bytes'] for x in report)}
