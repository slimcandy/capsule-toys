# Renders site/public/thumbs/<id>.png for every model: a three-quarter view
# from above, lit like a product shot, on a transparent background.
#
#   .venv/bin/python models/thumbs.py [id ...]
#
# Uses macOS's usdrecord. Wear models are rendered single-sided and without
# their invisible head, so nothing fights or hides in the picture.
import json, math, os, subprocess, sys, tempfile
from pxr import Gf, Sdf, Usd, UsdGeom, UsdLux

import wear

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, "..", "site", "public")
CATALOG = json.load(open(os.path.join(HERE, "catalog.json")))
FOCAL, APERTURE = 50.0, 20.955
# Room scans are seen from high above, like a floor plan; the rest from a little above.
VIEWS = {"room": (35, 55)}
DEFAULT_VIEW = (30, 18)  # yaw, pitch in degrees

def render(model, size=512):
    work = tempfile.mkdtemp()
    if model["camera"] == "wear":
        source = os.path.join(work, "model.usdc")
        wear.write(model["made"]["wear"], source, preview=True)
    else:
        source = os.path.join(SITE, "models", f"{model['id']}.usdz")

    shot = os.path.join(work, "shot.usda")
    stage = Usd.Stage.CreateNew(shot)
    UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
    holder = stage.DefinePrim("/Model", "Xform")
    holder.GetReferences().AddReference(source)
    # Match the model's units, so the camera and lights are in metres.
    mpu = UsdGeom.GetStageMetersPerUnit(Usd.Stage.Open(source))
    UsdGeom.Xformable(holder).AddScaleOp().Set(Gf.Vec3f(mpu))

    box = UsdGeom.BBoxCache(Usd.TimeCode.EarliestTime(), ["default", "render"]).ComputeWorldBound(holder).ComputeAlignedRange()
    centre = box.GetMidpoint()
    radius = box.GetSize().GetLength() / 2
    yaw, pitch = (math.radians(a) for a in VIEWS.get(model["id"], DEFAULT_VIEW))
    fov = 2 * math.atan(APERTURE / 2 / FOCAL)
    distance = radius / math.sin(fov / 2) * 1.02
    eye = centre + Gf.Vec3d(math.sin(yaw) * math.cos(pitch), math.sin(pitch), math.cos(yaw) * math.cos(pitch)) * distance

    cam = UsdGeom.Camera.Define(stage, "/Camera")
    cam.CreateFocalLengthAttr(FOCAL)
    cam.CreateHorizontalApertureAttr(APERTURE)
    cam.CreateVerticalApertureAttr(APERTURE)
    cam.CreateClippingRangeAttr(Gf.Vec2f(distance / 100, distance * 4))
    view = Gf.Matrix4d().SetLookAt(eye, centre, Gf.Vec3d(0, 1, 0))
    cam.AddTransformOp().Set(view.GetInverse())

    # A soft sky all around, a warm key light and a cool rim light.
    UsdLux.DomeLight.Define(stage, "/Lights/Sky").CreateIntensityAttr(0.7)
    key = UsdLux.DistantLight.Define(stage, "/Lights/Key")
    key.CreateIntensityAttr(2.2)
    key.CreateColorAttr(Gf.Vec3f(1.0, 0.95, 0.88))
    key.AddRotateXYZOp().Set(Gf.Vec3f(-40, 35, 0))
    rim = UsdLux.DistantLight.Define(stage, "/Lights/Rim")
    rim.CreateIntensityAttr(1.2)
    rim.CreateColorAttr(Gf.Vec3f(0.8, 0.88, 1.0))
    rim.AddRotateXYZOp().Set(Gf.Vec3f(-20, 200, 0))
    stage.GetRootLayer().Save()

    out = os.path.join(SITE, "thumbs", f"{model['id']}.png")
    subprocess.run(["usdrecord", "--camera", "/Camera", "--imageWidth", str(size), shot, out], check=True, capture_output=True)
    trim(out, size)
    return out

def trim(path, size=512, margin=0.03):
    """Cuts the empty margins off, and stands the model on the bottom edge,
    so it sits on a shelf instead of floating above it."""
    from PIL import Image
    im = Image.open(path).convert("RGBA")
    box = im.getchannel("A").getbbox()
    if not box:
        return
    model = im.crop(box)
    side = int(max(model.width, model.height) * (1 + 2 * margin))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(model, ((side - model.width) // 2, side - model.height - int(side * margin)))
    canvas.resize((size, size), Image.LANCZOS).save(path, optimize=True)

if __name__ == "__main__":
    os.makedirs(os.path.join(SITE, "thumbs"), exist_ok=True)
    wanted = set(sys.argv[1:])
    if wanted == {"--trim"}:
        # Just re-trim what's already rendered.
        for model in CATALOG:
            trim(os.path.join(SITE, "thumbs", f"{model['id']}.png"))
        sys.exit()
    for model in CATALOG:
        if not wanted or model["id"] in wanted:
            print(render(model))
