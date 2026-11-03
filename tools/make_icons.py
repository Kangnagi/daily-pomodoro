# 앱 아이콘·스플래시 이미지 만들기 (www/icon.svg 와 같은 그림을 Pillow로 그림)
# 사용: python tools/make_icons.py   → android/app/src/main/res 의 mipmap-*/ic_launcher*.png, drawable*/splash.png 덮어씀
# 아이콘 글자나 앱 이름을 바꿀 때 아래 LABEL / APP_NAME 만 고치고 다시 실행
import os
from PIL import Image, ImageDraw, ImageFont

LABEL = "STUDY"          # 달력 아이콘 안 글자
APP_NAME = "Daily Study"  # 스플래시 아래 이름
BLUE, LIGHT, WHITE = "#2f6fed", "#cfe0ff", "#ffffff"
SPLASH_BG, SPLASH_TEXT = (245, 247, 251), (29, 35, 48)
FONT_LABEL = "C:/Windows/Fonts/arialbd.ttf"
FONT_NAME = "C:/Windows/Fonts/malgunbd.ttf"
SS = 4  # 4배로 그린 뒤 줄여서 가장자리를 부드럽게

ROOT = os.path.join(os.path.dirname(__file__), "..", "android", "app", "src", "main", "res")
DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def calendar(size, bg=None):
    """512 좌표계(www/icon.svg)의 달력을 size 크기로. bg: None=배경 없음, 'square'=둥근 사각, 'circle'=원"""
    S = size * SS
    k = S / 512
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg == "square":
        d.rounded_rectangle((0, 0, S - 1, S - 1), radius=110 * k, fill=BLUE)
    elif bg == "circle":
        d.ellipse((0, 0, S - 1, S - 1), fill=BLUE)
    if bg == "circle":  # 원 안에 들어가도록 85%로
        k *= 0.85
        off = (S - 512 * k) / 2
    else:
        off = 0
    R = lambda x, y, w, h: (off + x * k, off + y * k, off + (x + w) * k, off + (y + h) * k)
    d.rounded_rectangle(R(96, 120, 320, 290), radius=36 * k, fill=WHITE)
    d.rounded_rectangle(R(96, 120, 320, 76), radius=36 * k, fill=LIGHT)
    d.rectangle(R(96, 160, 320, 36), fill=LIGHT)
    d.rounded_rectangle(R(160, 88, 28, 70), radius=14 * k, fill=WHITE)
    d.rounded_rectangle(R(324, 88, 28, 70), radius=14 * k, fill=WHITE)
    font = ImageFont.truetype(FONT_LABEL, round(76 * k))  # STUDY가 TOEIC보다 넓어서 84→76
    d.text((off + 256 * k, off + 335 * k), LABEL, font=font, fill=BLUE, anchor="ms")  # svg처럼 글자 바닥선 기준
    return im.resize((size, size), Image.LANCZOS)


def foreground(size):
    """적응형 아이콘 앞쪽(108dp 중 가운데 안전 영역): 달력을 62.5% 크기로 가운데에"""
    inner = round(size * 320 / 432)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cal = calendar(inner)
    im.alpha_composite(cal, ((size - inner) // 2, (size - inner) // 2))
    return im


def splash(w, h):
    m = min(w, h)
    im = Image.new("RGB", (w, h), SPLASH_BG)
    icon = calendar(round(m * 0.28), "square")
    font = ImageFont.truetype(FONT_NAME, round(m * 0.0667))
    l, t, r, b = font.getbbox(APP_NAME)
    gap = round(m * 0.061)
    block = icon.size[1] + gap + (b - t)
    y = (h - block) // 2
    im.paste(icon, ((w - icon.size[0]) // 2, y), icon)
    ImageDraw.Draw(im).text(((w - (r - l)) // 2 - l, y + icon.size[1] + gap - t), APP_NAME, font=font, fill=SPLASH_TEXT)
    return im


for name, f in DENS.items():
    base = round(48 * f)
    folder = os.path.join(ROOT, f"mipmap-{name}")
    calendar(base, "square").save(os.path.join(folder, "ic_launcher.png"))
    calendar(base, "circle").save(os.path.join(folder, "ic_launcher_round.png"))
    foreground(round(108 * f)).save(os.path.join(folder, "ic_launcher_foreground.png"))

for dirpath, _, files in os.walk(ROOT):
    if "splash.png" in files:
        p = os.path.join(dirpath, "splash.png")
        w, h = Image.open(p).size
        splash(w, h).save(p)
print("done")
