# The "Wear" models: things you try on with the front camera, built in code.
#
# Coordinates are ARKit's face-anchor space, in metres: x to the right as
# you look at the screen, y up, z out of the face towards the camera. The
# origin sits behind the nose. Measured on an iPhone 14 Pro: glasses at
# z 0.075 sit on the eyes, so the face is near z 0.06.
#
# AR Quick Look hides virtual things only behind the face mesh, not behind
# hair or the back of the head. Anything that wraps around the head carries
# an invisible head (an occluder) that hides what's behind it.
import math
from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, Vt

HEAD_C = (0.0, 0.017, -0.035)
HEAD_R = (0.078, 0.118, 0.098)

MATERIALS = {
    # name: (base colour, roughness, metallic, emission, opacity)
    "gold": ((1.0, 0.76, 0.33), 0.22, 1.0, None, 1),
    "steel": ((0.62, 0.64, 0.67), 0.32, 1.0, None, 1),
    "chrome": ((0.9, 0.9, 0.92), 0.12, 1.0, None, 1),
    "leather": ((0.30, 0.15, 0.07), 0.75, 0.0, None, 1),
    "ivory": ((0.92, 0.86, 0.72), 0.45, 0.0, None, 1),
    "felt": ((0.06, 0.05, 0.05), 0.9, 0.0, None, 1),
    "bone": ((0.95, 0.93, 0.88), 0.6, 0.0, None, 1),
    "ruby": ((0.75, 0.02, 0.1), 0.08, 0.0, (0.25, 0.0, 0.03), 1),
    "sapphire": ((0.05, 0.2, 0.85), 0.08, 0.0, (0.0, 0.04, 0.25), 1),
    "emerald": ((0.02, 0.6, 0.25), 0.08, 0.0, (0.0, 0.18, 0.06), 1),
    "lens": ((0.18, 0.1, 0.04), 0.05, 0.0, None, 0.78),
    "visor": ((0.02, 0.02, 0.05), 0.05, 0.3, None, 0.62),
    "neon_pink": ((1.0, 0.1, 0.6), 0.3, 0.0, (1.0, 0.05, 0.55), 1),
    "neon_cyan": ((0.1, 0.95, 1.0), 0.3, 0.0, (0.05, 0.9, 1.0), 1),
    "suit": ((0.93, 0.93, 0.9), 0.55, 0.0, None, 1),
    "gold_visor": ((1.0, 0.75, 0.3), 0.08, 1.0, None, 0.5),
    "mask": ((0.94, 0.93, 0.9), 0.35, 0.0, None, 1),
    "red": ((0.8, 0.05, 0.06), 0.4, 0.0, None, 1),
}

# ---- Geometry: (points, faces); faces are lists of point indices.

def grid(rows, closed=True):
    """Quads between rings of points; every ring has the same length."""
    n = len(rows[0])
    faces = []
    for i in range(len(rows) - 1):
        for j in range(n if closed else n - 1):
            a, b = i * n + j, i * n + (j + 1) % n
            faces.append((a, b, b + n, a + n))
    return [p for row in rows for p in row], faces

def merge(*parts):
    pts, faces = [], []
    for p, f in parts:
        base = len(pts)
        pts += p
        faces += [tuple(i + base for i in face) for face in f]
    return pts, faces

# Off for thumbnails: renderers that draw both sides would show the copies fighting.
DOUBLE_SIDED = True

def two_sided(part):
    """Quick Look draws one side of a face only: add a reversed copy."""
    if not DOUBLE_SIDED:
        return part
    pts, faces = part
    return merge(part, (list(pts), [tuple(reversed(f)) for f in faces]))

def revolve(profile, seg=72, c=(0, 0, 0), sx=1.0, sz=1.0, start=0.0, sweep=2 * math.pi, rfun=None, yfun=None):
    """Spin a (radius, y) profile around the y axis; rfun/yfun shape it by angle."""
    closed = sweep >= 2 * math.pi - 1e-6
    rows = []
    for r, y in profile:
        ring = []
        for k in range(seg if closed else seg + 1):
            a = start + sweep * k / seg
            rr = r * (rfun(a) if rfun else 1)
            ring.append((c[0] + math.sin(a) * rr * sx, c[1] + y + (yfun(a, r) if yfun else 0), c[2] + math.cos(a) * rr * sz))
        rows.append(ring)
    return grid(rows, closed)

def ellipsoid(c, r, seg=48, rings=24):
    rows = []
    for i in range(rings + 1):
        s, y = math.sin(math.pi * i / rings), -math.cos(math.pi * i / rings)
        rows.append([(c[0] + math.sin(2 * math.pi * k / seg) * s * r[0], c[1] + y * r[1], c[2] + math.cos(2 * math.pi * k / seg) * s * r[2]) for k in range(seg)])
    return grid(rows)

def sphere(c, r, seg=16):
    return ellipsoid(c, (r, r, r), seg, seg // 2)

def tube(path, radius, seg=16, closed_path=False):
    """A tube along a polyline; radius is a number or a function of 0..1."""
    rows = []
    n = len(path)
    for i, p in enumerate(path):
        t = i / (n - 1)
        rad = radius(t) if callable(radius) else radius
        if closed_path:
            a, b = path[(i - 1) % n], path[(i + 1) % n]
        else:
            a, b = path[max(i - 1, 0)], path[min(i + 1, n - 1)]
        d = (Gf.Vec3d(*b) - Gf.Vec3d(*a)).GetNormalized()
        up = Gf.Vec3d(0, 1, 0) if abs(d[1]) < 0.9 else Gf.Vec3d(1, 0, 0)
        u = Gf.Cross(d, up).GetNormalized()
        v = Gf.Cross(d, u)
        rows.append([tuple(Gf.Vec3d(*p) + (u * math.cos(2 * math.pi * k / seg) + v * math.sin(2 * math.pi * k / seg)) * rad) for k in range(seg)])
    if closed_path:
        rows.append(rows[0])
    return grid(rows)

def surface(fn, nu, nv, keep=None):
    """A sheet z = fn(u, v) sampled on a grid; keep(u, v) drops faces in holes."""
    pts = [fn(i / nu, j / nv) for j in range(nv + 1) for i in range(nu + 1)]
    faces = []
    for j in range(nv):
        for i in range(nu):
            if keep and not keep((i + 0.5) / nu, (j + 0.5) / nv):
                continue
            a = j * (nu + 1) + i
            faces.append((a, a + 1, a + nu + 2, a + nu + 1))
    return pts, faces

# ---- Models: each returns {material: geometry}.

def crown():
    rx, rz = 0.086, 0.104
    c = (HEAD_C[0], 0.0, HEAD_C[2])
    band = revolve([(1.0, 0.095), (1.0, 0.13), (0.97, 0.13), (0.97, 0.095), (1.0, 0.095)], 160, c, rx, rz)
    # The eight points: a wall rising from the band, raised into peaks.
    rows = []
    for h in (0.0, 0.25, 0.5, 0.75, 1.0):
        ring = []
        for k in range(160):
            a = 2 * math.pi * k / 160
            peak = 0.04 * ((math.cos(a * 8) + 1) / 2) ** 3
            ring.append((c[0] + math.sin(a) * rx * 0.985, 0.128 + h * (0.004 + peak), c[2] + math.cos(a) * rz * 0.985))
        rows.append(ring)
    points = two_sided(grid(rows))
    tips = [sphere((c[0] + math.sin(a) * rx * 0.985, 0.176, c[2] + math.cos(a) * rz * 0.985), 0.005) for a in (2 * math.pi * i / 8 for i in range(8))]
    gems = {"ruby": [], "sapphire": [], "emerald": []}
    for i, name in enumerate(["ruby", "sapphire", "emerald", "sapphire"] * 2):
        a = 2 * math.pi * i / 8
        gems[name].append(ellipsoid((c[0] + math.sin(a) * rx * 1.02, 0.111, c[2] + math.cos(a) * rz * 1.02), (0.007, 0.009, 0.007), 20, 10))
    return {"gold": merge(band, points, *tips), **{k: merge(*v) for k, v in gems.items()}}

def viking():
    c = (HEAD_C[0], 0.0, HEAD_C[2])
    prof = [(math.cos(t) + 0.0001, 0.075 + math.sin(t) * 0.085) for t in (i / 24 * math.pi / 2 for i in range(25))]
    dome = revolve(prof, 96, c, 0.096, 0.114)
    ridge = tube([(0, 0.075 + 0.087 * math.sin(i / 24 * math.pi) + 0.002, c[2] + 0.114 * math.cos(i / 24 * math.pi)) for i in range(25)], 0.006, 12)
    band = revolve([(1.0, 0.07), (1.06, 0.072), (1.06, 0.094), (1.0, 0.096), (1.0, 0.07)], 96, c, 0.096, 0.114)
    rivets = [sphere((c[0] + math.sin(a) * 0.1025, 0.083, c[2] + math.cos(a) * 0.121), 0.004, 12) for a in (2 * math.pi * i / 16 for i in range(16))]
    horns = []
    for side in (-1, 1):
        path = [(side * (0.09 + 0.08 * t + 0.02 * math.sin(t * math.pi)), 0.1 + 0.11 * t ** 1.5, c[2] + 0.01 + 0.03 * t) for t in (i / 29 for i in range(30))]
        horns.append(tube(path, lambda t: 0.021 * (1 - t) ** 0.8 + 0.0015, 24))
    return {"steel": merge(dome, ridge), "leather": band, "gold": merge(*rivets), "ivory": merge(*horns)}

def tricorn():
    c = (HEAD_C[0], 0.0, HEAD_C[2] + 0.005)
    R = 0.15
    # Three corners, one at the front; the brim is flat around the head,
    # then turns up into three walls.
    lobes = lambda a: 1 + 0.2 * math.cos(3 * a)
    lift = lambda a, r: 0.065 * max(0.0, (r / R - 0.62) / 0.38) ** 1.6
    steps = (0.58, 0.62, 0.7, 0.78, 0.86, 0.93, 1.0)
    brim_top = revolve([(f * R, 0.098) for f in steps], 144, c, rfun=lobes, yfun=lift)
    brim_under = revolve([(f * R * 0.995, 0.094) for f in reversed(steps)], 144, c, rfun=lobes, yfun=lift)
    edge = [(c[0] + math.sin(a) * R * lobes(a), 0.163, c[2] + math.cos(a) * R * lobes(a)) for a in (2 * math.pi * k / 144 for k in range(144))]
    trim = tube(edge, 0.004, 10, closed_path=True)
    drum = revolve([(1.0, 0.094), (1.0, 0.15), (0.97, 0.175), (0.85, 0.19), (0.5, 0.198), (0.001, 0.2)], 96, c, 0.086, 0.104)
    s = (0.0, 0.148, c[2] + R * 1.2 * 0.93 + 0.008)
    skull = merge(ellipsoid(s, (0.013, 0.012, 0.004), 20, 10),
                  ellipsoid((0, s[1] - 0.012, s[2]), (0.008, 0.006, 0.0035), 16, 8),
                  tube([(-0.02, s[1] - 0.03, s[2]), (0.02, s[1] - 0.012, s[2])], 0.0025, 8),
                  tube([(0.02, s[1] - 0.03, s[2]), (-0.02, s[1] - 0.012, s[2])], 0.0025, 8))
    # Eyepatch over the right eye (left on screen), and its strap.
    rows = []
    for i in range(7):
        k = i / 6
        ring = []
        for j in range(24):
            a = 2 * math.pi * j / 24
            x, y = -0.033 + math.cos(a) * 0.021 * k, 0.018 + math.sin(a) * 0.018 * k
            ring.append((x, y, 0.079 - 3.0 * (x + 0.033) ** 2 - 2.0 * (y - 0.018) ** 2 + 0.004 * (1 - k)))
        rows.append(ring)
    patch = two_sided(grid(rows))
    strap = tube([(-0.05 + 0.15 * t, 0.03 + 0.045 * t, 0.072 - 0.126 * t * t) for t in (i / 20 for i in range(21))], 0.0018, 8)
    return {"felt": merge(brim_top, brim_under, drum, patch, strap), "gold": trim, "bone": skull}

def aviators():
    lenses, frames = [], []
    for side in (-1, 1):
        cx, cy = side * 0.034, 0.016
        def outline(t, k=1.0):
            # A teardrop: rounder and deeper towards the outer bottom corner.
            x, y = math.cos(t), math.sin(t)
            w, h = 0.027, (0.019 if y > 0 else 0.026)
            bulge = 0.006 * max(0.0, -y) * max(0.0, x * side)
            return cx + (x * w + side * bulge) * k, cy + y * h * k
        def z_at(x, y):
            return 0.078 - 2.5 * (x - cx) ** 2 - 2.0 * (y - cy) ** 2 - 1.2 * x * x
        rows = []
        for i in range(9):
            k = i / 8
            rows.append([(*outline(2 * math.pi * j / 48, k), 0) for j in range(48)])
        rows = [[(x, y, z_at(x, y)) for x, y, _ in row] for row in rows]
        lenses.append(two_sided(grid(rows)))
        rim = [(x, y, z_at(x, y)) for x, y in (outline(2 * math.pi * j / 64, 1.0) for j in range(64))]
        frames.append(tube(rim, 0.0012, 8, closed_path=True))
        # Temples: from the outer top corner back to the ear.
        ox, oy = outline(0.25 * side if side > 0 else math.pi - 0.25)
        frames.append(tube([(ox + side * 0.004 * t, oy, z_at(ox, oy) - 0.11 * t) for t in (i / 12 for i in range(13))], 0.0013, 8))
    # The double bridge.
    frames.append(tube([(-0.008, 0.03, 0.079), (0, 0.032, 0.08), (0.008, 0.03, 0.079)], 0.0012, 8))
    frames.append(tube([(-0.009, 0.019, 0.08), (0, 0.021, 0.081), (0.009, 0.019, 0.08)], 0.0012, 8))
    return {"lens": merge(*lenses), "gold": merge(*frames)}

def visor():
    # A curved band around the eyes, following the head from ear to ear.
    span = 1.2
    def at(a, y):
        return math.sin(a) * 0.09, y, -0.035 + math.cos(a) * 0.122
    band = two_sided(surface(lambda u, v: at(-span + 2 * span * u, -0.004 + 0.048 * v), 64, 6))
    top = tube([at(-span + 2 * span * i / 64, 0.046) for i in range(65)], 0.0022, 10)
    bottom = tube([at(-span + 2 * span * i / 64, -0.006) for i in range(65)], 0.0022, 10)
    arms = [tube([at(side * span, 0.02), (side * 0.088, 0.02, -0.06)], 0.004, 10) for side in (-1, 1)]
    return {"visor": band, "neon_pink": top, "neon_cyan": bottom, "steel": merge(*arms)}

def astronaut():
    c, r = (0.0, 0.02, -0.02), 0.165
    shell, glass = [], []
    seg, rings = 64, 40
    rows = []
    for i in range(rings + 1):
        polar = math.pi * (0.18 + 0.82 * i / rings)  # open at the bottom for the neck
        rows.append([(c[0] + math.sin(polar) * math.sin(2 * math.pi * k / seg) * r,
                      c[1] + math.cos(polar) * r,
                      c[2] + math.sin(polar) * math.cos(2 * math.pi * k / seg) * r) for k in range(seg)])
    pts, faces = grid(list(reversed(rows)))
    for f in faces:
        x, y, z = (sum(pts[i][a] for i in f) / 4 for a in range(3))
        front = (z - c[2]) / r
        (glass if front > 0.5 and -0.05 < y < 0.11 else shell).append(f)
    ring = revolve([(0.115, -0.115), (0.13, -0.115), (0.13, -0.13), (0.115, -0.13), (0.115, -0.115)], 64, c)
    return {"suit": merge(two_sided((pts, shell)), ring), "gold_visor": two_sided((pts, glass))}

def hockey():
    holes = [(-0.032, 0.02, 0.017), (0.032, 0.02, 0.017), (0, -0.05, 0.012)]
    vents = [(x * 0.012, -0.075 - row * 0.012, 0.0035) for row in range(2) for x in range(-2, 3)]
    def at(u, v):
        x, y = -0.075 + 0.15 * u, -0.11 + 0.21 * v
        return x, y, 0.098 - 4.0 * x * x - 1.5 * y * y
    def keep(u, v):
        x, y, _ = at(u, v)
        if (x / 0.075) ** 2 + ((y + 0.005) / 0.108) ** 2 > 1:
            return False
        return not any(math.hypot(x - hx, y - hy) < hr for hx, hy, hr in holes + vents)
    shell = two_sided(surface(at, 90, 120, keep))
    # Red chevrons above the eyes and on the cheeks.
    stripes = []
    for side in (-1, 1):
        for y0, dy in ((0.05, 0.03), (-0.025, -0.02)):
            path = []
            for i in range(9):
                t = i / 8
                x = side * (0.018 + 0.03 * t)
                y = y0 + dy * (1 - abs(2 * t - 1))
                path.append((x, y, at((x + 0.075) / 0.15, (y + 0.11) / 0.21)[2] + 0.002))
            stripes.append(tube(path, 0.0028, 8))
    return {"mask": shell, "red": merge(*stripes)}

# name: (build, needs the invisible head)
MODELS = {
    "crown": (crown, True),
    "viking": (viking, True),
    "tricorn": (tricorn, True),
    "aviators": (aviators, False),
    "visor": (visor, True),
    "astronaut": (astronaut, True),
    "hockey": (hockey, False),
}

# ---- Writing USD

def vertex_normals(pts, faces):
    acc = [Gf.Vec3d(0, 0, 0) for _ in pts]
    for f in faces:
        p = [Gf.Vec3d(*pts[i]) for i in f]
        n = Gf.Cross(p[1] - p[0], p[2] - p[0]) + Gf.Cross(p[2] - p[0], p[3 % len(f)] - p[0])
        for i in f:
            acc[i] += n
    return [tuple(v.GetNormalized()) if v.GetLength() > 0 else (0, 1, 0) for v in acc]

def add_mesh(stage, path, part, material):
    pts, faces = part
    mesh = UsdGeom.Mesh.Define(stage, path)
    mesh.CreatePointsAttr(Vt.Vec3fArray([Gf.Vec3f(*p) for p in pts]))
    mesh.CreateFaceVertexCountsAttr([len(f) for f in faces])
    mesh.CreateFaceVertexIndicesAttr([i for f in faces for i in f])
    mesh.CreateSubdivisionSchemeAttr("none")
    mesh.CreateNormalsAttr(Vt.Vec3fArray([Gf.Vec3f(*n) for n in vertex_normals(pts, faces)]))
    mesh.SetNormalsInterpolation("vertex")
    UsdShade.MaterialBindingAPI.Apply(mesh.GetPrim()).Bind(material)

def preview_material(stage, path, spec, soften=False):
    """soften: less metal, for renderers with nothing around to reflect."""
    (r, g, b), rough, metal, emission, opacity = spec
    if soften:
        metal, rough = metal * 0.35, max(rough, 0.35)
    mat = UsdShade.Material.Define(stage, path)
    sh = UsdShade.Shader.Define(stage, path + "/Surface")
    sh.CreateIdAttr("UsdPreviewSurface")
    sh.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(r, g, b))
    sh.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(rough)
    sh.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(metal)
    if emission:
        sh.CreateInput("emissiveColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*emission))
    if opacity < 1:
        sh.CreateInput("opacity", Sdf.ValueTypeNames.Float).Set(opacity)
    mat.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(), "surface")
    return mat

def occluder_material(stage, path):
    """RealityKit's occlusion shader, with a fully transparent fallback."""
    mat = UsdShade.Material.Define(stage, path)
    occ = UsdShade.Shader.Define(stage, path + "/Occlusion")
    occ.CreateIdAttr("ND_realitykit_occlusion_surfaceshader")
    mat.CreateSurfaceOutput("mtlx").ConnectToSource(occ.CreateOutput("out", Sdf.ValueTypeNames.Token))
    clear = UsdShade.Shader.Define(stage, path + "/Clear")
    clear.CreateIdAttr("UsdPreviewSurface")
    clear.CreateInput("opacity", Sdf.ValueTypeNames.Float).Set(0.0)
    mat.CreateSurfaceOutput().ConnectToSource(clear.ConnectableAPI(), "surface")
    return mat

def write(name, path, preview=False, head=False):
    """Writes the model as a face-anchored scene, the way Reality Composer
    lays one out. preview: single-sided and without the invisible head, for
    thumbnails; head: add a visible stand-in head, to check the fit."""
    global DOUBLE_SIDED
    build, occluder = MODELS[name]
    DOUBLE_SIDED = not preview
    parts = build()
    DOUBLE_SIDED = True
    stage = Usd.Stage.CreateNew(path)
    UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
    UsdGeom.SetStageMetersPerUnit(stage, 1.0)
    root = UsdGeom.Xform.Define(stage, "/Root")
    stage.SetDefaultPrim(root.GetPrim())
    Usd.ModelAPI(UsdGeom.Scope.Define(stage, "/Root/Scenes").GetPrim()).SetKind("sceneLibrary")
    scene = UsdGeom.Xform.Define(stage, "/Root/Scenes/Scene")
    prim = scene.GetPrim()
    prim.SetCustomDataByKey("sceneName", "Scene")
    prim.SetCustomDataByKey("preliminary_collidesWithEnvironment", False)
    prim.SetMetadata("apiSchemas", Sdf.TokenListOp.CreateExplicit(["Preliminary_AnchoringAPI"]))
    prim.CreateAttribute("preliminary:anchoring:type", Sdf.ValueTypeNames.Token, variability=Sdf.VariabilityUniform).Set("face")
    scene.AddOrientOp().Set(Gf.Quatf(0.70710677, 0.70710677, 0, 0))
    wear = UsdGeom.Xform.Define(stage, "/Root/Scenes/Scene/Wear")
    wear.AddOrientOp().Set(Gf.Quatf(0.70710677, -0.70710677, 0, 0))
    for m, part in parts.items():
        add_mesh(stage, f"/Root/Scenes/Scene/Wear/{m.capitalize()}", part, preview_material(stage, f"/Root/Materials/{m}", MATERIALS[m], preview))
    if head:
        skin = preview_material(stage, "/Root/Materials/skin", ((0.85, 0.66, 0.55), 0.7, 0.0, None, 1))
        add_mesh(stage, "/Root/Scenes/Scene/Wear/Head", ellipsoid(HEAD_C, HEAD_R), skin)
    if occluder and not preview:
        head_mesh = ellipsoid((HEAD_C[0], HEAD_C[1] + 0.008, HEAD_C[2]), (HEAD_R[0] * 1.02, HEAD_R[1] * 1.04, HEAD_R[2] * 1.02), 32, 16)
        add_mesh(stage, "/Root/Scenes/Scene/Wear/Occluder", head_mesh, occluder_material(stage, "/Root/Materials/Occluder"))
    stage.GetRootLayer().Save()
