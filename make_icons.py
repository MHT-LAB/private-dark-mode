"""Generate the extension icon: a dark circle with a bold white "D" —
simplified from the earlier crescent-moon design, which was hard to make
out against a dark browser/OS theme (a light shape on a near-black circle
all but disappeared next to a dark toolbar). A solid, high-contrast circle
with a plain glyph reads clearly at every size, matching the dark-circle
family look shared with the other two extensions in this set."""
from PIL import Image, ImageDraw, ImageFont

SIZES = [16, 32, 48, 128]
SCALE = 8
BG = (28, 28, 30, 255)         # near-black circle — keep, it's not the problem
LETTER = (255, 255, 255, 255)  # solid white glyph, high contrast against any theme
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def draw_icon(size):
    s = size * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    margin = int(s * 0.04)
    d.ellipse([margin, margin, s - margin, s - margin], fill=BG)

    font = ImageFont.truetype(FONT_PATH, int(s * 0.56))
    text = "D"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (s - tw) / 2 - bbox[0]
    y = (s - th) / 2 - bbox[1]
    d.text((x, y), text, font=font, fill=LETTER)

    return img.resize((size, size), Image.LANCZOS)


for size in SIZES:
    icon = draw_icon(size)
    icon.save(f"icons/icon{size}.png")
    print(f"wrote icons/icon{size}.png")
