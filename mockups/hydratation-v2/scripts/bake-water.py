#!/usr/bin/env python3
"""Bake translucent water into cutout PNGs (mockups only)."""
from pathlib import Path
import numpy as np
from PIL import Image

CUT = Path(__file__).resolve().parents[1] / 'assets' / 'cutouts'

FILLABLE = {
    'plastic_15': (0.155, 0.035),
    'small_50': (0.14, 0.04),
    'glass_25': (0.06, 0.12),
    'gourd': (0.12, 0.03),
}


def surface_from_bottom(kind: str, fill_ratio: float) -> float:
    top, bot = FILLABLE[kind]
    return bot + max(0.0, min(1.0, fill_ratio)) * (1 - top - bot)


def add_water(src: Path, dst: Path, kind: str, fill_ratio: float, opaque_body: bool = False) -> None:
    im = Image.open(src).convert('RGBA')
    arr = np.array(im).astype(np.float32)
    h, w = arr.shape[:2]
    alpha = arr[..., 3] / 255.0
    rgb = arr[..., :3]

    surface = surface_from_bottom(kind, fill_ratio)
    y_surface = (1.0 - surface) * (h - 1)
    yy = np.arange(h, dtype=np.float32)[:, None]
    xx = np.arange(w, dtype=np.float32)[None, :]

    inside = alpha > 0.15
    water_mask = inside & (yy >= y_surface)

    _top_i, bot_i = FILLABLE[kind]
    water_bot = h - 1 - bot_i * h
    depth = np.clip((yy - y_surface) / max(1.0, water_bot - y_surface), 0, 1)
    depth = np.broadcast_to(depth, (h, w))

    if opaque_body:
        c_top = np.array([140, 220, 255], dtype=np.float32)
        c_bot = np.array([30, 110, 190], dtype=np.float32)
        strength = 0.38 + 0.32 * depth
    else:
        c_top = np.array([160, 230, 255], dtype=np.float32)
        c_bot = np.array([15, 95, 175], dtype=np.float32)
        strength = 0.42 + 0.38 * depth

    water_col = c_top * (1 - depth[..., None]) + c_bot * depth[..., None]
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    spec = np.clip((lum - (160 if opaque_body else 175)) / 70.0, 0, 1)[..., None]

    if opaque_body:
        base = rgb / 255.0
        ov = water_col / 255.0
        soft = np.where(base < 0.5, 2 * base * ov, 1 - 2 * (1 - base) * (1 - ov)) * 255
        tint = rgb * (1 - strength[..., None] * 0.7) + water_col * (strength[..., None] * 0.7)
        blended = soft * 0.4 + tint * 0.6
    else:
        mult = (rgb / 255.0) * (water_col / 255.0) * 255.0
        tint = rgb * (1 - strength[..., None] * 0.65) + water_col * (strength[..., None] * 0.65)
        blended = mult * 0.45 + tint * 0.55

    out_rgb = blended * (1 - spec * (0.9 if opaque_body else 0.85)) + rgb * (spec * (0.9 if opaque_body else 0.85))
    cx = w / 2.0
    rad = np.abs(xx - cx) / (w / 2.0)
    side = np.clip((rad - 0.35) / 0.65, 0, 1)[..., None]
    out_rgb = out_rgb * (1 - side * water_mask[..., None] * 0.12)

    result = arr.copy()
    result[..., :3] = np.where(water_mask[..., None], np.clip(out_rgb, 0, 255), rgb)

    curve = y_surface + 0.006 * h * ((xx - cx) / (w / 2.0)) ** 2
    meniscus = inside & (yy >= curve) & (yy <= curve + max(2.0, h * 0.01))
    men_col = np.array([230, 245, 255], dtype=np.float32)
    rr = result[..., :3]
    rr = np.where(meniscus[..., None], rr * 0.55 + men_col * 0.45, rr)
    line = inside & (np.abs(yy - curve) <= 0.9)
    rr = np.where(line[..., None], np.minimum(rr + 45, 255), rr)
    if opaque_body:
        band = inside & (yy >= curve) & (yy <= curve + h * 0.025)
        rr = np.where(band[..., None], rr * 0.85 + np.array([180, 230, 255]) * 0.15, rr)
    result[..., :3] = np.clip(rr, 0, 255)
    Image.fromarray(result.astype(np.uint8), 'RGBA').save(dst, optimize=True)
    print(f'{dst.name}: fill={fill_ratio:.3f} surface={surface:.3f}')


def main() -> None:
    add_water(CUT / 'shell_bottle_15.png', CUT / 'wet_bottle_15.png', 'plastic_15', 620 / 1500, False)
    add_water(CUT / 'shell_bottle_50.png', CUT / 'wet_bottle_50.png', 'small_50', 0.35, False)
    add_water(CUT / 'shell_glass.png', CUT / 'wet_glass_25.png', 'glass_25', 0.55, False)
    add_water(CUT / 'shell_gourde.png', CUT / 'wet_gourde.png', 'gourd', 480 / 750, True)


if __name__ == '__main__':
    main()
