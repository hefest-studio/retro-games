#!/usr/bin/env python3
"""make-backlink-sheet.py — контактный лист скриншотов плашки «← Каталог».

Собирает сетку миниатюр с подписями slug'ов, чтобы глазами оценить плашку
на всех играх сразу. Использует Pillow из bundled Python.

Запуск:
  python3 tools/qa/make-backlink-sheet.py \
      --dir reports/qa-shots/backlink --out reports/qa-shots/backlink/contact-sheet-1440.png
"""
import argparse
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont


def load_font(size):
    for path in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--cell-width", type=int, default=460)
    ap.add_argument("--pattern", default=r"^(.+)-1440\.png$")
    ap.add_argument("--exclude", default=r"^(prod|file|mobile|landscape)-")
    ap.add_argument("--title", default="Плашка «← Каталог» — все игры, 1440×900")
    args = ap.parse_args()

    pat = re.compile(args.pattern)
    exclude = re.compile(args.exclude)
    items = []
    for name in sorted(os.listdir(args.dir)):
        if exclude.search(name):
            continue
        m = pat.match(name)
        if not m:
            continue
        items.append((m.group(1), os.path.join(args.dir, name)))
    if not items:
        print("Нет подходящих файлов", file=sys.stderr)
        sys.exit(1)

    cell_w = args.cell_width
    cw, ch = 1440, 900
    img_h = round(cell_w * ch / cw)
    label_h = 26
    pad = 12
    cols = args.cols
    rows = (len(items) + cols - 1) // cols
    width = cols * cell_w + (cols + 1) * pad
    header = 44
    height = header + rows * (img_h + label_h) + (rows + 1) * pad
    sheet = Image.new("RGB", (width, height), (10, 11, 16))
    draw = ImageDraw.Draw(sheet)
    draw.text((pad, 12), args.title, fill=(255, 210, 122), font=load_font(20))
    font = load_font(15)
    for idx, (slug, path) in enumerate(items):
        row, col = divmod(idx, cols)
        x = pad + col * (cell_w + pad)
        y = header + pad + row * (img_h + label_h + pad)
        try:
            with Image.open(path) as im:
                im = im.convert("RGB").resize((cell_w, img_h), Image.LANCZOS)
                sheet.paste(im, (x, y))
        except OSError as exc:
            draw.text((x + 8, y + 8), f"ERR {slug}: {exc}", fill=(255, 90, 90), font=font)
            continue
        draw.rectangle([x, y, x + cell_w - 1, y + img_h - 1], outline=(60, 62, 78))
        draw.rectangle([x, y + img_h, x + cell_w, y + img_h + label_h], fill=(18, 20, 30))
        draw.text((x + 8, y + img_h + 5), slug, fill=(236, 240, 250), font=font)
        if "standalone" in slug:
            draw.text((x + cell_w - 110, y + img_h + 5), "standalone", fill=(120, 200, 255), font=font)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    sheet.save(args.out, optimize=True)
    print(f"saved {args.out} ({sheet.width}x{sheet.height}, {len(items)} tiles)")


if __name__ == "__main__":
    main()
