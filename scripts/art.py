"""Cuts the game's textures out of the two reference renders in art/.

    python3 -m venv .venv && .venv/bin/pip install Pillow
    .venv/bin/python scripts/art.py

The scene is one picture (art/arcade.png, a phone mockup: its status bar is
cropped off). The knob, the Play button and the globe are cut from the same
picture, so they sit on it without a seam; the capsules come from the asset
sheet. Positions in site/src/style.css are percentages of the cropped scene.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "public"
TOP = 84  # the mockup's status bar

arcade = Image.open(ROOT / "art" / "arcade.png").convert("RGB")
sheet = Image.open(ROOT / "art" / "sheet.png").convert("RGB")
(OUT / "art").mkdir(exist_ok=True)

# The scene, without the status bar.
scene = arcade.crop((0, TOP, arcade.width, arcade.height))
scene.save(OUT / "art" / "arcade.jpg", quality=86, optimize=True, progressive=True)
print(f"scene {scene.width}x{scene.height}")

# The moving parts, in the original picture's coordinates.
PARTS = {
    "knob.png": (436, 924, 588, 1076),
    "play.png": (244, 1312, 782, 1438),
    "globe.jpg": (270, 500, 754, 984),
}
for name, box in PARTS.items():
    part = arcade.crop(box)
    if name.endswith(".jpg"):
        part.save(OUT / "art" / name, quality=88, optimize=True)
    else:
        part.save(OUT / "art" / name, optimize=True)
    left, top, right, bottom = box
    print(f"{name}: left {left / arcade.width:.2%} top {(top - TOP) / scene.height:.2%} "
          f"width {(right - left) / arcade.width:.2%} height {(bottom - top) / scene.height:.2%}")


def ball(cx: int, cy: int, name: str, r: int = 38) -> None:
    """A capsule from the sheet: a circle with a soft edge, on nothing."""
    im = sheet.crop((cx - 44, cy - 44, cx + 44, cy + 44)).convert("RGBA")
    mask = Image.new("L", (88 * 4, 88 * 4), 0)
    ImageDraw.Draw(mask).ellipse((44 * 4 - r * 4, 44 * 4 - r * 4, 44 * 4 + r * 4, 44 * 4 + r * 4), fill=255)
    im.putalpha(mask.resize((88, 88), Image.LANCZOS))
    im.save(OUT / "art" / f"capsule-{name}.png", optimize=True)


ball(1292, 112, "common")  # blue
ball(1472, 112, "rare")  # purple
ball(1472, 205, "special")  # gold, glowing

# Icons: the lid and the globe, square. iOS rounds the corners itself.
icon = arcade.crop((232, 460, 792, 1020))
for size, name in ((180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")):
    icon.resize((size, size), Image.LANCZOS).save(OUT / "icons" / name, optimize=True)
print("textures and icons written")

# The shelf: the cabinet on black, keyed to nothing. Only true black goes;
# the dark wood in the corners stays.
shelf = Image.open(ROOT / "art" / "shelf.png").convert("RGB")
lum = shelf.convert("L")
alpha = lum.point(lambda v: 0 if v <= 6 else 255 if v >= 22 else int((v - 6) * 255 / 16))
rgba = shelf.convert("RGBA")
rgba.putalpha(alpha)
rgba.save(OUT / "art" / "shelf.webp", quality=84, method=6)
print(f"shelf {rgba.width}x{rgba.height}")


# ---- Pieces rendered on a flat background: the knob's disc and bar (on
# black) and an opened capsule (on green). The background is flood-filled
# from the border, so dark or green bits inside an object stay.

from PIL import ImageDraw as _Draw, ImageFilter


def key(im: Image.Image, is_background, despill=False) -> Image.Image:
    """Alpha from the border inwards: everything the flood reaches goes."""
    px = im.convert("RGB").load()
    w, h = im.size
    marker = Image.new("L", (w, h), 0)
    mp = marker.load()
    for y in range(h):
        for x in range(w):
            if is_background(*px[x, y]):
                mp[x, y] = 255
    # Pillow's floodfill works on the image itself: fill the marker from the corners.
    filled = marker.copy()
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)):
        if filled.getpixel((x, y)) == 255:
            _Draw.floodfill(filled, (x, y), 128)
    alpha = filled.point(lambda v: 0 if v == 128 else 255).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert("RGBA")
    if despill:
        data = out.load()
        for y in range(h):
            for x in range(w):
                R, G, B, A = data[x, y]
                m = max(R, B)
                if G > m:
                    data[x, y] = (R, m, B, A)
    out.putalpha(alpha)
    return out


def piece(name: str, src: str, is_background, size: int, despill=False, box=None):
    im = Image.open(ROOT / "art" / src)
    if box:
        im = im.crop(box)
    keyed = key(im, is_background, despill)
    bbox = keyed.getchannel("A").getbbox()
    keyed = keyed.crop(bbox)
    scale = size / max(keyed.size)
    keyed = keyed.resize((round(keyed.width * scale), round(keyed.height * scale)), Image.LANCZOS)
    keyed.save(OUT / "art" / f"{name}.webp", quality=88, method=6)
    print(f"{name}: {keyed.width}x{keyed.height} (from {bbox})")


black = lambda r, g, b: max(r, g, b) < 16
green = lambda r, g, b: g > 120 and g > r * 1.6 and g > b * 1.6
piece("knob-disc", "knob-disc.png", black, 600)
piece("knob-bar", "knob-bar.png", black, 600)
halves = Image.open(ROOT / "art" / "capsule-halves.png")
piece("capsule-top", "capsule-halves.png", green, 512, despill=True, box=(0, 0, halves.width // 2, halves.height))
piece("capsule-bottom", "capsule-halves.png", green, 512, despill=True, box=(halves.width // 2, 0, halves.width, halves.height))
