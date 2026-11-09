#!/usr/bin/env python3
"""Genereer de PWA-iconen voor Splitsracer met alleen Python 3-stdlib.

De iconen worden procedureel getekend (groen gras, Y-splitsing in asfalt,
oranje/witte curbs en een blauwe auto) en als PNG weggeschreven met zlib.
Geen Pillow, ImageMagick of PowerShell nodig.

Usage:
    python3 tools/make_icons.py
"""
from __future__ import annotations

import math
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(ROOT, "icons")

SIZE = 1024
GRASS_TOP = (53, 186, 107)
GRASS_BOTTOM = (29, 143, 77)
ASPHALT = (156, 192, 194)
ASPHALT_DARK = (120, 158, 161)
WHITE = (246, 246, 240)
ORANGE = (221, 98, 19)
DARK = (46, 79, 82)
SHADOW = (18, 62, 40)
CAR_BLUE = (20, 95, 141)
CAR_BLUE_LIGHT = (32, 126, 181)
CAR_DARK = (10, 52, 78)
WINDOW = (240, 246, 246)
TYRE = (35, 45, 49)


class Raster:
    """Een simpele RGBA-raster met source-over blending."""

    def __init__(self, width: int, height: int, color=(0, 0, 0, 0)):
        self.w = width
        self.h = height
        self.data = bytearray(bytes(color) * (width * height))

    def copy(self) -> "Raster":
        other = Raster(self.w, self.h)
        other.data[:] = self.data
        return other

    def blend_pixel(self, x: int, y: int, color, coverage: float = 1.0):
        if x < 0 or y < 0 or x >= self.w or y >= self.h or coverage <= 0:
            return
        r, g, b, a = color
        alpha = (a / 255.0) * min(1.0, coverage)
        if alpha <= 0:
            return
        index = (y * self.w + x) * 4
        data = self.data
        inv = 1.0 - alpha
        data[index] = int(r * alpha + data[index] * inv + 0.5)
        data[index + 1] = int(g * alpha + data[index + 1] * inv + 0.5)
        data[index + 2] = int(b * alpha + data[index + 2] * inv + 0.5)
        data[index + 3] = int(255 * alpha + data[index + 3] * inv + 0.5)

    def fill_rect(self, x0, y0, x1, y1, color):
        x0, x1 = sorted((int(round(x0)), int(round(x1))))
        y0, y1 = sorted((int(round(y0)), int(round(y1))))
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                self.blend_pixel(x, y, color)

    def fill_polygon(self, points, color):
        if len(points) < 3:
            return
        min_y = max(0, int(math.floor(min(p[1] for p in points))))
        max_y = min(self.h, int(math.ceil(max(p[1] for p in points))))
        for y in range(min_y, max_y):
            scan_y = y + 0.5
            intersections = []
            for i in range(len(points)):
                x1, y1 = points[i]
                x2, y2 = points[(i + 1) % len(points)]
                if (y1 <= scan_y < y2) or (y2 <= scan_y < y1):
                    t = (scan_y - y1) / (y2 - y1)
                    intersections.append(x1 + t * (x2 - x1))
            intersections.sort()
            for i in range(0, len(intersections) - 1, 2):
                start = max(0, int(math.ceil(intersections[i] - 0.5)))
                end = min(self.w, int(math.ceil(intersections[i + 1] - 0.5)))
                for x in range(start, end):
                    self.blend_pixel(x, y, color)

    def fill_circle(self, cx, cy, radius, color):
        r2 = radius * radius
        for y in range(max(0, int(cy - radius - 1)), min(self.h, int(cy + radius + 2))):
            dy = y + 0.5 - cy
            for x in range(max(0, int(cx - radius - 1)), min(self.w, int(cx + radius + 2))):
                dx = x + 0.5 - cx
                dist2 = dx * dx + dy * dy
                coverage = max(0.0, min(1.0, radius + 0.5 - math.sqrt(dist2)))
                if coverage > 0:
                    self.blend_pixel(x, y, color, coverage)

    def fill_ellipse(self, cx, cy, rx, ry, color):
        for y in range(max(0, int(cy - ry - 1)), min(self.h, int(cy + ry + 2))):
            dy = (y + 0.5 - cy) / ry
            for x in range(max(0, int(cx - rx - 1)), min(self.w, int(cx + rx + 2))):
                dx = (x + 0.5 - cx) / rx
                dist = math.sqrt(dx * dx + dy * dy)
                coverage = max(0.0, min(1.0, (1.0 - dist) * min(rx, ry) + 0.5))
                if coverage > 0:
                    self.blend_pixel(x, y, color, coverage)

    def fill_round_rect(self, x0, y0, x1, y1, radius, color):
        x0, x1 = sorted((x0, x1))
        y0, y1 = sorted((y0, y1))
        radius = min(radius, (x1 - x0) / 2, (y1 - y0) / 2)
        for y in range(max(0, int(y0 - 1)), min(self.h, int(y1 + 2))):
            py = y + 0.5
            for x in range(max(0, int(x0 - 1)), min(self.w, int(x1 + 2))):
                px = x + 0.5
                qx = abs(px - (x0 + x1) / 2) - ((x1 - x0) / 2 - radius)
                qy = abs(py - (y0 + y1) / 2) - ((y1 - y0) / 2 - radius)
                outside = math.hypot(max(qx, 0), max(qy, 0))
                inside = min(max(qx, qy), 0)
                dist = outside + inside - radius
                coverage = max(0.0, min(1.0, 0.5 - dist))
                if coverage > 0:
                    self.blend_pixel(x, y, color, coverage)

    def stroke_path(self, points, width, color, dash=None, gap=None):
        """Teken een polylijn met ronde uiteinden en afgeronde verbindingen."""
        if len(points) < 2:
            return
        half = width / 2
        if dash and gap:
            self._stroke_dashed(points, width, color, dash, gap)
            return
        self._stroke_segments(points, half, color)

    def _stroke_segments(self, points, half, color):
        bbox_pad = half + 1
        min_x = max(0, int(min(p[0] for p in points) - bbox_pad))
        max_x = min(self.w, int(max(p[0] for p in points) + bbox_pad))
        min_y = max(0, int(min(p[1] for p in points) - bbox_pad))
        max_y = min(self.h, int(max(p[1] for p in points) + bbox_pad))
        for y in range(min_y, max_y):
            py = y + 0.5
            for x in range(min_x, max_x):
                px = x + 0.5
                best = 1e9
                for i in range(len(points) - 1):
                    ax, ay = points[i]
                    bx, by = points[i + 1]
                    dx, dy = bx - ax, by - ay
                    length2 = dx * dx + dy * dy
                    if length2 == 0:
                        continue
                    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2))
                    qx = ax + t * dx
                    qy = ay + t * dy
                    best = min(best, math.hypot(px - qx, py - qy))
                coverage = max(0.0, min(1.0, half + 0.5 - best))
                if coverage > 0:
                    self.blend_pixel(x, y, color, coverage)

    def _stroke_dashed(self, points, width, color, dash, gap):
        pattern = dash + gap
        lengths = []
        total = 0.0
        for i in range(len(points) - 1):
            ax, ay = points[i]
            bx, by = points[i + 1]
            length = math.hypot(bx - ax, by - ay)
            lengths.append(length)
            total += length
        distance = 0.0
        while distance < total:
            dash_end = min(total, distance + dash)
            segment = []
            acc = 0.0
            for i in range(len(points) - 1):
                seg_len = lengths[i]
                seg_start = acc
                seg_end = acc + seg_len
                acc = seg_end
                if seg_end < distance or seg_start > dash_end:
                    continue
                ax, ay = points[i]
                bx, by = points[i + 1]
                t0 = max(0.0, (distance - seg_start) / seg_len) if seg_len else 0.0
                t1 = min(1.0, (dash_end - seg_start) / seg_len) if seg_len else 1.0
                if t1 <= t0:
                    continue
                p0 = (ax + (bx - ax) * t0, ay + (by - ay) * t0)
                p1 = (ax + (bx - ax) * t1, ay + (by - ay) * t1)
                if not segment:
                    segment.append(p0)
                segment.append(p1)
            if len(segment) >= 2:
                self._stroke_segments(segment, width / 2, color)
            distance += pattern

    def draw_scaled(self, other: "Raster", scale: float, offset_y: float = 0.0):
        """Teken `other` geschaald rond het midden op deze raster."""
        cx = self.w / 2
        cy = self.h / 2 + offset_y
        src_cx = other.w / 2
        src_cy = other.h / 2
        for y in range(self.h):
            sy = (y - cy) / scale + src_cy
            if sy < 0 or sy >= other.h - 1:
                continue
            for x in range(self.w):
                sx = (x - cx) / scale + src_cx
                if sx < 0 or sx >= other.w - 1:
                    continue
                x0, y0 = int(sx), int(sy)
                fx, fy = sx - x0, sy - y0
                i00 = (y0 * other.w + x0) * 4
                i10 = i00 + 4
                i01 = i00 + other.w * 4
                i11 = i01 + 4
                src = other.data
                for c in range(4):
                    v00 = src[i00 + c]
                    v10 = src[i10 + c]
                    v01 = src[i01 + c]
                    v11 = src[i11 + c]
                    top = v00 + (v10 - v00) * fx
                    bottom = v01 + (v11 - v01) * fx
                    value = int(top + (bottom - top) * fy + 0.5)
                    self.data[(y * self.w + x) * 4 + c] = value

    def downsample(self, width: int, height: int) -> "Raster":
        result = Raster(width, height)
        for y in range(height):
            sy0 = y * self.h / height
            sy1 = (y + 1) * self.h / height
            for x in range(width):
                sx0 = x * self.w / width
                sx1 = (x + 1) * self.w / width
                r = g = b = a = 0.0
                count = 0
                py = sy0
                while py < sy1:
                    px = sx0
                    while px < sx1:
                        ix = min(self.w - 1, int(px))
                        iy = min(self.h - 1, int(py))
                        idx = (iy * self.w + ix) * 4
                        alpha = self.data[idx + 3] / 255.0
                        r += self.data[idx] * alpha
                        g += self.data[idx + 1] * alpha
                        b += self.data[idx + 2] * alpha
                        a += alpha
                        count += 1
                        px += 1.0
                    py += 1.0
                out = (y * width + x) * 4
                if a > 0:
                    result.data[out] = int(r / a + 0.5)
                    result.data[out + 1] = int(g / a + 0.5)
                    result.data[out + 2] = int(b / a + 0.5)
                    result.data[out + 3] = int(255 * a / count + 0.5)
        return result

    def alpha_composite(self, other: "Raster"):
        for i in range(0, len(self.data), 4):
            src_a = other.data[i + 3] / 255.0
            if src_a <= 0:
                continue
            dst_a = self.data[i + 3] / 255.0
            out_a = src_a + dst_a * (1 - src_a)
            if out_a <= 0:
                continue
            for c in range(3):
                self.data[i + c] = int(
                    (other.data[i + c] * src_a + self.data[i + c] * dst_a * (1 - src_a)) / out_a + 0.5
                )
            self.data[i + 3] = int(out_a * 255 + 0.5)


def write_png(path: str, raster: Raster):
    raw = bytearray()
    stride = raster.w * 4
    for y in range(raster.h):
        raw.append(0)
        raw.extend(raster.data[y * stride:(y + 1) * stride])

    def chunk(kind: bytes, payload: bytes) -> bytes:
        return (
            struct.pack(">I", len(payload))
            + kind
            + payload
            + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", raster.w, raster.h, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as handle:
        handle.write(png)


def offset_path(points, distance):
    """Offset een polylijn naar links (positief) of rechts (negatief)."""
    result = []
    for i, (x, y) in enumerate(points):
        if i == 0:
            nx, ny = points[1][0] - x, points[1][1] - y
        elif i == len(points) - 1:
            nx, ny = x - points[i - 1][0], y - points[i - 1][1]
        else:
            ax, ay = points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]
            bx, by = points[i + 1][0] - x, points[i + 1][1] - y
            la = math.hypot(ax, ay) or 1.0
            lb = math.hypot(bx, by) or 1.0
            nx = ax / la + bx / lb
            ny = ay / la + by / lb
        length = math.hypot(nx, ny) or 1.0
        nx, ny = nx / length, ny / length
        result.append((x - ny * distance, y + nx * distance))
    return result


def road_polygon(points, width):
    left = offset_path(points, width / 2)
    right = offset_path(points, -width / 2)
    return left + list(reversed(right))


def densify(points, step=12.0):
    """Voeg tussenpunten toe zodat een polylijn per stuk gefilterd kan worden."""
    result = [points[0]]
    for i in range(len(points) - 1):
        ax, ay = points[i]
        bx, by = points[i + 1]
        length = math.hypot(bx - ax, by - ay)
        count = max(1, int(math.ceil(length / step)))
        for j in range(1, count + 1):
            t = j / count
            result.append((ax + (bx - ax) * t, ay + (by - ay) * t))
    return result


def make_background() -> Raster:
    raster = Raster(SIZE, SIZE)
    for y in range(SIZE):
        t = y / (SIZE - 1)
        r = int(GRASS_TOP[0] + (GRASS_BOTTOM[0] - GRASS_TOP[0]) * t)
        g = int(GRASS_TOP[1] + (GRASS_BOTTOM[1] - GRASS_TOP[1]) * t)
        b = int(GRASS_TOP[2] + (GRASS_BOTTOM[2] - GRASS_TOP[2]) * t)
        for x in range(SIZE):
            raster.blend_pixel(x, y, (r, g, b, 255))

    # Subtiele donkere grasvlekken voor textuur.
    raster.fill_circle(120, 210, 150, (24, 132, 70, 55))
    raster.fill_circle(900, 160, 190, (30, 151, 81, 45))
    raster.fill_circle(940, 900, 170, (24, 126, 67, 45))
    raster.fill_circle(90, 860, 130, (30, 151, 81, 40))
    raster.fill_ellipse(820, 520, 210, 120, (26, 137, 73, 28))
    return raster


def make_foreground() -> Raster:
    raster = Raster(SIZE, SIZE)
    trunk = [(512, 1180), (512, 640)]
    left_branch = [(512, 640), (430, 500), (245, 170)]
    right_branch = [(512, 640), (594, 500), (779, 170)]
    paths = [trunk, left_branch, right_branch]
    widths = [300, 250, 250]

    # Slagschaduw.
    for path, width in zip(paths, widths):
        raster.fill_polygon(road_polygon([(x, y + 14) for x, y in path], width + 34), (*SHADOW, 100))
        for point in (path[0], path[-1]):
            raster.fill_circle(point[0], point[1] + 14, (width + 34) / 2, (*SHADOW, 100))

    # Witte rand.
    for path, width in zip(paths, widths):
        raster.fill_polygon(road_polygon(path, width + 34), (*WHITE, 255))
        for point in (path[0], path[-1]):
            raster.fill_circle(point[0], point[1], (width + 34) / 2, (*WHITE, 255))

    # Asfalt.
    for path, width in zip(paths, widths):
        raster.fill_polygon(road_polygon(path, width), (*ASPHALT, 255))
        for point in (path[0], path[-1]):
            raster.fill_circle(point[0], point[1], width / 2, (*ASPHALT, 255))

    # Subtiele donkere band langs de binnenkant van de witte rand.
    for path, width in zip(paths, widths):
        raster.fill_polygon(road_polygon(path, width - 6), (*ASPHALT_DARK, 40))

    # Oranje/witte curbs: witte rand is al getekend, oranje strepen erop.
    curb_paths = [
        (offset_path(densify(trunk), 150), 790, 1120),
        (offset_path(densify(trunk), -150), 790, 1120),
        (offset_path(densify(left_branch), 125), 200, 350),
        (offset_path(densify(left_branch), -125), 200, 350),
        (offset_path(densify(right_branch), 125), 200, 350),
        (offset_path(densify(right_branch), -125), 200, 350),
    ]
    for curb, y_min, y_max in curb_paths:
        clipped = [point for point in curb if y_min <= point[1] <= y_max]
        if len(clipped) >= 2:
            raster.stroke_path(clipped, 26, (*ORANGE, 255), dash=60, gap=60)

    # Middenstrepen (dashed) op de rechte stukken.
    for center, y_min, y_max in (
        (densify(trunk), 830, 1120),
        (densify(left_branch), 230, 340),
        (densify(right_branch), 230, 340),
    ):
        clipped = [point for point in center if y_min <= point[1] <= y_max]
        if len(clipped) >= 2:
            raster.stroke_path(clipped, 18, (*WHITE, 235), dash=54, gap=48)

    # Auto (van bovenaf, neus omhoog).
    raster.fill_ellipse(512, 892, 94, 140, (10, 50, 30, 90))
    for x0, x1, y0, y1 in ((430, 462, 786, 850), (562, 594, 786, 850), (430, 462, 922, 986), (562, 594, 922, 986)):
        raster.fill_round_rect(x0, y0, x1, y1, 14, (*TYRE, 255))
    raster.fill_round_rect(446, 762, 578, 1004, 36, (*CAR_DARK, 255))
    raster.fill_round_rect(454, 770, 570, 996, 30, (*CAR_BLUE, 255))
    raster.fill_round_rect(468, 786, 556, 858, 18, (*WINDOW, 255))
    raster.fill_round_rect(480, 900, 544, 952, 16, (*WINDOW, 225))
    raster.fill_round_rect(476, 874, 548, 892, 8, (*CAR_BLUE_LIGHT, 255))
    raster.fill_round_rect(466, 776, 558, 790, 7, (255, 255, 255, 110))
    return raster


def compose(foreground: Raster, maskable: bool) -> Raster:
    background = make_background()
    if maskable:
        scaled = Raster(SIZE, SIZE)
        scaled.draw_scaled(foreground, 0.78)
        background.alpha_composite(scaled)
    else:
        background.alpha_composite(foreground)
    return background


def main() -> int:
    os.makedirs(ICONS, exist_ok=True)
    foreground = make_foreground()
    normal = compose(foreground, maskable=False)
    maskable = compose(foreground, maskable=True)

    outputs = [
        ("icon-512.png", normal, 512),
        ("icon-192.png", normal, 192),
        ("icon-maskable-512.png", maskable, 512),
        ("apple-touch-icon.png", normal, 180),
    ]
    for name, source, size in outputs:
        target = source.downsample(size, size) if source.w != size else source
        path = os.path.join(ICONS, name)
        write_png(path, target)
        print(f"· {name} ({size}×{size})")
    print(f"· klaar; iconen staan in {ICONS}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
