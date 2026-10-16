# The judge: checks every model the way AR Quick Look and the game need it.
#
#   .venv/bin/python models/check.py
#
# - Apple's ARKit rules for USDZ (`usdchecker --arkit`, macOS)
# - wear models are anchored to a face, place models are not
# - place models have the size the catalog asks for, standing on the floor
# - files stay small enough to open fast on a phone
# - every model has a thumbnail and a credit with an allowed licence
# - no file in site/public/models is missing from the catalog
import json, os, subprocess, sys
from pxr import Usd, UsdGeom

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, "..", "site", "public")
CATALOG = json.load(open(os.path.join(HERE, "catalog.json")))
LICENCES = {"CC0-1.0", "CC-BY-4.0", "own"}
MAX_BYTES = 6_000_000

problems = []

def check(model):
    fail = lambda text: problems.append(f"{model['id']}: {text}")
    path = os.path.join(SITE, "models", f"{model['id']}.usdz")
    if not os.path.exists(path):
        return fail("no .usdz, run models/build.py")
    if os.path.getsize(path) > MAX_BYTES:
        fail(f"{os.path.getsize(path) / 1e6:.1f} MB, over {MAX_BYTES / 1e6:.0f} MB")

    # Apple's own checker, shipped with macOS.
    result = subprocess.run(["usdchecker", "--arkit", path], capture_output=True, text=True)
    if result.returncode != 0:
        for line in (result.stdout + result.stderr).splitlines():
            if line.strip() and "Failed!" not in line:
                fail(f"usdchecker: {line.strip()}")

    stage = Usd.Stage.Open(path)
    anchors = {str(p.GetAttribute("preliminary:anchoring:type").Get()) for p in stage.Traverse() if p.HasAttribute("preliminary:anchoring:type")}
    if model["camera"] == "wear" and anchors != {"face"}:
        fail(f"wear model must be anchored to a face, found {anchors or 'no anchor'}")
    if model["camera"] == "place" and "face" in anchors:
        fail("place model is anchored to a face")

    if model["camera"] == "place":
        box = UsdGeom.BBoxCache(stage.GetStartTimeCode(), ["default", "render"]).ComputeWorldBound(stage.GetPseudoRoot()).ComputeAlignedRange()
        mpu = UsdGeom.GetStageMetersPerUnit(stage)
        longest = max(box.GetSize()) * mpu
        want = model["made"].get("size")
        if want and abs(longest - want) > want * 0.02:
            fail(f"longest side {longest:.2f} m, catalog says {want} m")
        if abs(box.GetMin()[1] * mpu) > 0.01:
            fail(f"not standing on the floor (bottom at {box.GetMin()[1] * mpu:.2f} m)")

    if not os.path.exists(os.path.join(SITE, "thumbs", f"{model['id']}.png")):
        fail("no thumbnail")
    credit = model.get("credit", {})
    if not credit.get("author") or credit.get("licence") not in LICENCES:
        fail(f"credit needs an author and one of {sorted(LICENCES)}")
    if credit.get("licence") == "CC-BY-4.0" and not credit.get("url"):
        fail("CC BY needs a link to the original")

ids = [m["id"] for m in CATALOG]
if len(ids) != len(set(ids)):
    problems.append("catalog: duplicate ids")
for model in CATALOG:
    check(model)
for name in sorted(os.listdir(os.path.join(SITE, "models"))):
    if name.endswith(".usdz") and name[:-5] not in ids:
        problems.append(f"{name}: not in the catalog")

for line in problems:
    print("✗", line)
print(f"{len(CATALOG)} models, {len(problems)} problems")
sys.exit(1 if problems else 0)
