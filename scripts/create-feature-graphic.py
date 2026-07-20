from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'lets-q-feature-graphic.png'
LOGO = ROOT / "Let's Q app logo.jpeg"
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'

canvas = Image.new('RGB', (1024, 500), '#edf2ea')
draw = ImageDraw.Draw(canvas)

# Soft two-tone background and abstract queue paths.
draw.rectangle((0, 0, 1024, 500), fill='#f8f0df')
draw.ellipse((690, -230, 1240, 320), fill='#dfeee8')
draw.ellipse((-210, 365, 250, 780), fill='#f4dfaa')
draw.arc((670, -110, 1180, 390), 120, 315, fill='#9dc9d5', width=10)
draw.arc((705, -72, 1138, 356), 118, 313, fill='#c5dfe5', width=6)

# Main information card.
draw.rounded_rectangle((58, 76, 642, 421), radius=34, fill='#fffaf0', outline='#e7dcc7', width=2)
draw.rounded_rectangle((58, 76, 72, 421), radius=7, fill='#176fd0')

def font(path, size):
    return ImageFont.truetype(path, size)

navy = '#153a5c'
muted = '#506c78'
draw.text((108, 127), "LET'S Q", font=font(BOLD, 31), fill=navy)
draw.text((108, 193), 'Private queues,', font=font(BOLD, 47), fill=navy)
draw.text((108, 250), 'made simple.', font=font(BOLD, 47), fill=navy)
draw.text((108, 326), 'Scan a QR code. Take your place.', font=font(FONT, 23), fill=muted)
draw.text((108, 362), 'No name. No phone. No email.', font=font(FONT, 23), fill=muted)

# Brand medallion using the real Let’s Q app logo.
draw.ellipse((689, 82, 979, 372), fill='#ffffff', outline='#d7e2e4', width=3)
logo = Image.open(LOGO).convert('RGBA').resize((250, 250), Image.Resampling.LANCZOS)
# The supplied logo is a square on white. Make that plain outer background
# transparent so it sits cleanly inside the circular brand medallion.
logo.putdata([
    (r, g, b, 0) if r > 248 and g > 248 and b > 248 else (r, g, b, a)
    for r, g, b, a in logo.getdata()
])
canvas.paste(logo, (709, 102), logo)

# Small decorative, explicitly non-scannable QR-inspired blocks.
for x, y, size in [(673, 390, 18), (701, 390, 9), (718, 410, 13), (744, 392, 10), (764, 415, 8)]:
    draw.rounded_rectangle((x, y, x + size, y + size), radius=2, fill='#176fd0')

canvas.save(OUT, 'PNG', optimize=True)
print(OUT)
