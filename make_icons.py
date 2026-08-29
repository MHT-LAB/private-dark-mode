"""Generate simple crescent-moon icons for the extension (no external assets)."""
from PIL import Image, ImageDraw

SIZES = [16, 32, 48, 128]
BG = (28, 28, 30, 255)       # near-black circle
MOON = (245, 245, 247, 255)  # light crescent

for size in SIZES:
    scale = 4  # supersample for smoother edges, then downscale
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    margin = int(s * 0.06)
    d.ellipse([margin, margin, s - margin, s - margin], fill=BG)

    # Crescent: draw a second, offset light circle in "MOON" then punch out
    # the overlap using a mask so only the crescent sliver remains light.
    moon_layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    md = ImageDraw.Draw(moon_layer)
    md.ellipse([margin, margin, s - margin, s - margin], fill=MOON)

    cutout_offset = int(s * 0.27)
    cutout_margin = int(s * 0.01)
    cutout = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cutout)
    cd.ellipse(
        [
            margin + cutout_offset - cutout_margin,
            margin - cutout_margin,
            s - margin + cutout_offset - cutout_margin,
            s - margin - cutout_margin,
        ],
        fill=(255, 255, 255, 255),
    )

    # Subtract cutout from moon_layer alpha
    moon_r, moon_g, moon_b, moon_a = moon_layer.split()
    _, _, _, cut_a = cutout.split()
    import PIL.ImageChops as ImageChops

    new_a = ImageChops.subtract(moon_a, cut_a)
    crescent = Image.merge("RGBA", (moon_r, moon_g, moon_b, new_a))

    img = Image.alpha_composite(img, crescent)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(f"icons/icon{size}.png")

print("done")
