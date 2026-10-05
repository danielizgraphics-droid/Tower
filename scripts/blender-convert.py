# Blender batch converter: .blend / .fbx -> GLB keeping materials and animations.
#   blender -b -P scripts/blender-convert.py -- OUT_DIR file1.blend file2.fbx ...
import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:]
out_dir, files = argv[0], argv[1:]
for f in files:
    name = os.path.splitext(os.path.basename(f))[0]
    if f.endswith('.blend'):
        bpy.ops.wm.open_mainfile(filepath=f)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=f, automatic_bone_orientation=True)
    # glTF only understands Principled BSDF: rebuild Diffuse materials and relink textures.
    tex_dir = os.path.join(os.path.dirname(os.path.dirname(f)), 'Textures')
    for img in bpy.data.images:
        cand = os.path.join(tex_dir, os.path.basename(img.filepath.replace('//', '')))
        if not img.has_data and os.path.exists(cand):
            img.filepath = cand
            img.reload()
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        nt = m.node_tree
        diff = next((n for n in nt.nodes if n.type == 'BSDF_DIFFUSE'), None)
        if not diff:
            continue
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        pr = nt.nodes.new('ShaderNodeBsdfPrincipled')
        pr.inputs['Base Color'].default_value = diff.inputs['Color'].default_value
        pr.inputs['Roughness'].default_value = 0.85
        for link in list(nt.links):
            if link.to_node == diff and link.to_socket.name == 'Color':
                nt.links.new(link.from_socket, pr.inputs['Base Color'])
        nt.links.new(pr.outputs['BSDF'], out.inputs['Surface'])
        nt.nodes.remove(diff)
    # Make every action available to the exporter.
    arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    acts = [a.name for a in bpy.data.actions]
    for o in bpy.data.objects:
        o.hide_set(False)
        o.hide_viewport = False
    out = os.path.join(out_dir, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS', export_yup=True, use_visible=False, export_apply=False)
    mats = [m.name for m in bpy.data.materials]
    print('CONVERTED', name, 'actions:', len(acts), 'materials:', len(mats), 'armature:', arm.name if arm else None)
