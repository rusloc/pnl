#!/usr/bin/env python3
"""
style_board.py — turn a style decision into a checkable board: role palette + contrast + type specimen.

  python style_board.py --brand "#5b3df5" --display "Fraunces:600" --text "Inter:400" -o board/
  python style_board.py --brand "#b5523b" --mode dark --scheme analogous -o board/
  python style_board.py --palette "bg=#f0eee9,surface=#ffffff,ink=#1d1b19,muted=#6b665f,accent=#b5523b,accent2=#3f6f6a" -o board/

Writes board/palette.json (roles, hex, contrast checks) and board/board.svg + board.png.
Palette derivation works in OKLCH: neutrals are tinted with the brand hue, never pure grey.
Needs the svg-art-designer skill (svgkit, render.py) next to this skill.
"""
import argparse
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
for p in (os.environ.get("SVG_ART_DESIGNER_SCRIPTS"), HERE.parent.parent / "svg-art-designer" / "scripts",
          Path.home() / ".claude/skills/svg-art-designer/scripts", Path("/mnt/skills/user/svg-art-designer/scripts")):
    if p and (Path(p) / "svgkit.py").exists():
        sys.path.insert(0, str(p))
        break
sys.path.insert(0, str(HERE))
from svgkit import (Canvas, contrast_ratio, el, oklch, path, rect, text_to_path, to_oklch)  # noqa: E402
from get_font import get_fonts  # noqa: E402

SCHEMES = {"complementary": 180, "split": 150, "triadic": 120, "analogous": 35}
TEXT_CHECKS = [("ink", "bg"), ("ink", "surface"), ("muted", "bg"), ("on_accent", "accent"), ("on_accent2", "accent2")]


def _on(color, *cands):
    """Text color for a fill: whichever candidate has the higher contrast."""
    return max(cands, key=lambda c: contrast_ratio(c, color))


def derive(brand, mode="light", scheme="split"):
    L, C, h = to_oklch(brand)
    h2 = (h + SCHEMES[scheme]) % 360
    yellow = 60 <= h2 <= 115          # yellow family turns brown/olive when dark: only use it light
    if mode == "light":
        pal = {"bg": oklch(.975, .008, h), "surface": oklch(.995, .004, h), "ink": oklch(.23, .025, h),
               "muted": oklch(.48, .03, h), "accent": brand,
               "accent2": oklch(.86 if yellow else min(L, .6), max(C * .8, .08), h2)}
    else:
        pal = {"bg": oklch(.17, .018, h), "surface": oklch(.22, .022, h), "ink": oklch(.95, .01, h),
               "muted": oklch(.74, .02, h), "accent": oklch(max(L, .70), C, h),
               "accent2": oklch(max(L, .72), max(C * .8, .08), h2)}
    dark_text = oklch(.18, .02, h)
    pal["on_accent"] = _on(pal["accent"], "#ffffff", dark_text)
    pal["on_accent2"] = _on(pal["accent2"], "#ffffff", dark_text)
    return pal


def check(pal):
    """Text pairs must reach 4.5:1 (FAIL otherwise). Accents vs bg: >= 3:1 means usable for icons,
    thin lines and text-sized graphics; below that the accent is FILL-ONLY (large areas carrying
    on_accent text), which is a usage rule, not an error."""
    out = []
    for fg, bg in TEXT_CHECKS:
        if fg in pal and bg in pal:
            r = contrast_ratio(pal[fg], pal[bg])
            out.append({"pair": f"{fg}/{bg}", "ratio": round(r, 2), "need": 4.5, "status": "PASS" if r >= 4.5 else "FAIL"})
    for acc in ("accent", "accent2"):
        if acc in pal:
            r = contrast_ratio(pal[acc], pal["bg"])
            out.append({"pair": f"{acc}/bg", "ratio": round(r, 2), "need": 3.0,
                        "status": "PASS" if r >= 3 else "FILL-ONLY"})
    return out


def board(pal, checks, display, text, name, outdir, headline="A clear idea, beautifully set"):
    W, H = 1200, 760
    c = Canvas(W, H, bg=pal["bg"], title=f"{name} style board", inkscape_layers=False)
    dfam, dw = (display.split(":") + ["700"])[:2]
    tfam, tw = (text.split(":") + ["400"])[:2]
    dfont, tfont = get_fonts(dfam, int(dw)), get_fonts(tfam, int(tw))       # latin + latin-ext chains
    lab = lambda s, x, y, size=14, col=None, f=None: path(text_to_path(s, f or tfont, size, x, y)[0], fill=col or pal["muted"])
    # 60/30/10 proportion bar
    x = 48
    for role, frac in (("bg", .6), ("surface", .15), ("ink", .1), ("accent", .1), ("accent2", .05)):
        w = (W - 96) * frac
        c.add(rect(x, 48, w, 56, fill=pal[role], stroke=pal["muted"], stroke_width=1, stroke_opacity=.25))
        x += w
    c.add(lab("60 / 30 / 10 — bg · surface+ink · accents", 48, 128, 13))
    # swatches with hex + checks
    roles = ["bg", "surface", "ink", "muted", "accent", "accent2", "on_accent"]
    for i, role in enumerate(roles):
        sx = 48 + i * 158
        c.add(rect(sx, 160, 144, 96, rx=12, fill=pal[role], stroke=pal["muted"], stroke_width=1, stroke_opacity=.3),
              lab(role, sx, 280, 14, pal["ink"]), lab(pal[role].upper(), sx, 300, 13))
    y = 344
    for ck in checks:
        col = {"PASS": pal["ink"], "FAIL": "#d62828"}.get(ck["status"], pal["muted"])
        c.add(lab(f'{ck["status"]}  {ck["pair"]}  {ck["ratio"]}:1  (need {ck["need"]})', 48, y, 14, col))
        y += 24
    # type specimen
    c.add(rect(560, 330, 592, 382, rx=16, fill=pal["surface"]))
    c.add(path(text_to_path("Aa", dfont, 120, 592, 452)[0], fill=pal["accent"]),
          lab(f"{dfam} {dw}", 760, 382, 16, pal["ink"]), lab(f"{tfam} {tw}", 760, 406, 16, pal["muted"]))
    head, hw = text_to_path(headline, dfont, 34, 592, 520)
    if hw > 528:                                                          # fit the specimen box
        head, _ = text_to_path(headline, dfont, 34 * 528 / hw, 592, 520)
    c.add(path(head, fill=pal["ink"]))
    for k, line in enumerate(("Body text sets the rhythm: calm, legible, generous", "in spacing. One accent marks what matters most.")):
        c.add(path(text_to_path(line, tfont, 17, 592, 562 + k * 26)[0], fill=pal["muted"]))
    pill, pw = text_to_path("Primary action", tfont, 16, 0, 0)
    c.add(rect(592, 628, pw + 40, 44, rx=22, fill=pal["accent"]),
          path(text_to_path("Primary action", tfont, 16, 612, 656)[0], fill=pal["on_accent"]))
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    svg = c.save(str(out / "board.svg"))
    try:
        import render
        render.render(svg, str(out / "board.png"), size=1200, quiet=True)
    except Exception as e:  # board.svg is still usable
        print(f"(png skipped: {e})")
    return svg


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--brand", help="brand/accent hex to derive the palette from")
    src.add_argument("--palette", help="explicit roles: bg=#..,surface=#..,ink=#..,muted=#..,accent=#..[,accent2=#..]")
    ap.add_argument("--mode", default="light", choices=["light", "dark"])
    ap.add_argument("--scheme", default="split", choices=sorted(SCHEMES))
    ap.add_argument("--display", default="Fraunces:600", help="Family:weight (Fontsource)")
    ap.add_argument("--text", default="Inter:400", help="Family:weight (Fontsource)")
    ap.add_argument("--name", default="style")
    ap.add_argument("--headline", default="A clear idea, beautifully set", help="specimen text (test real copy/language)")
    ap.add_argument("-o", "--out", default="board")
    a = ap.parse_args()
    if a.brand:
        pal = derive(a.brand, a.mode, a.scheme)
    else:
        pal = dict(kv.split("=") for kv in a.palette.split(","))
        cands = ("#ffffff", pal.get("ink", "#000000"), pal.get("bg", "#000000"), "#111111")  # light AND dark options
        pal.setdefault("on_accent", _on(pal["accent"], *cands))
        if "accent2" in pal:
            pal.setdefault("on_accent2", _on(pal["accent2"], *cands))
    checks = check(pal)
    Path(a.out).mkdir(parents=True, exist_ok=True)
    (Path(a.out) / "palette.json").write_text(json.dumps({"mode": a.mode, "roles": pal, "checks": checks,
                                                          "display": a.display, "text": a.text}, indent=2))
    board(pal, checks, a.display, a.text, a.name, a.out, a.headline)
    for ck in checks:
        print(f'{ck["status"]:9s} {ck["pair"]:20s} {ck["ratio"]:5.2f}:1 (need {ck["need"]})')
    print("palette:", " ".join(f"{k}={v}" for k, v in pal.items()))
    if any(ck["status"] == "FAIL" for ck in checks):
        sys.exit(1)


if __name__ == "__main__":
    main()
