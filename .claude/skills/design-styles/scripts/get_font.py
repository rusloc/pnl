#!/usr/bin/env python3
"""
get_font.py — fetch an open-source font (Fontsource packages on npm) as a local file that
svgkit.text_to_path / text_on_circle can outline.

  python get_font.py "Inter" --weight 700            # prints the cached .woff path
  python get_font.py "Fraunces" --weight 600 --italic
  python get_font.py "Instrument Serif" --list       # weights/styles available + license

Files are cached in ~/.cache/design-styles-fonts (override with DESIGN_STYLES_FONT_CACHE).
Fontsource splits fonts into subsets: 'latin' lacks e.g. Turkish ş ğ ı İ and many symbols. In Python use
get_fonts(family, weight, subsets=("latin", "latin-ext")) -> fallback list for svgkit.text_to_path.
WOFF files are used (fontTools reads them without extra dependencies).
"""
import argparse
import io
import json
import os
import re
import sys
import tarfile
import urllib.request
from pathlib import Path

REGISTRY = "https://registry.npmjs.org/"
CACHE = Path(os.environ.get("DESIGN_STYLES_FONT_CACHE", Path.home() / ".cache" / "design-styles-fonts"))


def slug(family):
    return re.sub(r"[^a-z0-9]+", "-", family.lower()).strip("-")


def _get(url, timeout=60):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "design-styles"}), timeout=timeout) as r:
        return r.read()


def package(family):
    """Download + extract @fontsource/<slug> once; return the extracted folder."""
    s = slug(family)
    dest = CACHE / s
    if (dest / "package.json").exists():
        return dest
    meta = json.loads(_get(REGISTRY + "@fontsource%2F" + s))
    ver = meta["dist-tags"]["latest"]
    tgz = _get(meta["versions"][ver]["dist"]["tarball"], timeout=180)
    dest.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(tgz), mode="r:gz") as t:
        for m in t.getmembers():
            name = m.name.split("/", 1)[1] if "/" in m.name else m.name
            if name == "package.json" or name.startswith("LICENSE") or (
                    name.startswith("files/") and name.endswith(".woff")):            # all subsets (woff)
                m.name = name
                t.extract(m, dest, filter="data") if sys.version_info >= (3, 12) else t.extract(m, dest)
    return dest


def available(family):
    d = package(family)
    out = sorted({(int(m.group(1)), m.group(2)) for f in (d / "files").glob("*.woff")
                  if (m := re.search(r"-latin-(\d+)-(normal|italic)\.woff$", f.name))})
    lic = json.loads((d / "package.json").read_text()).get("license", "?")
    return out, lic


SUBSETS = ("latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek", "greek-ext", "vietnamese")


def get_font(family, weight=400, italic=False, subset="latin"):
    """Local path of one subset file at the closest available weight (same style if possible)."""
    d = package(family)
    style = "italic" if italic else "normal"
    opts, _ = available(family)
    if not opts:
        raise FileNotFoundError(f"no latin woff files in @fontsource/{slug(family)}")
    same = [w for w, s in opts if s == style] or [w for w, _ in opts]
    w = min(same, key=lambda v: abs(v - weight))
    st = style if (w, style) in opts else next(s for ww, s in opts if ww == w)
    hit = next((d / "files").glob(f"*-{subset}-{w}-{st}.woff"), None)
    if hit is None:
        raise FileNotFoundError(f"{family}: no '{subset}' subset")
    return str(hit)


def get_fonts(family, weight=400, italic=False, subsets=("latin", "latin-ext")):
    """Fallback list for svgkit.text_to_path: latin first, then extra subsets that exist.
    Use for any non-English text (Turkish ş ğ ı İ, Polish, Czech... need latin-ext)."""
    out = []
    for sub in subsets:
        try:
            out.append(get_font(family, weight, italic, sub))
        except FileNotFoundError:
            pass
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("family")
    ap.add_argument("--weight", type=int, default=400)
    ap.add_argument("--italic", action="store_true")
    ap.add_argument("--subset", default="latin", choices=SUBSETS)
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    try:
        if a.list:
            opts, lic = available(a.family)
            print(f"{a.family} (@fontsource/{slug(a.family)}, license {lic}): " +
                  ", ".join(f"{w}{'i' if s == 'italic' else ''}" for w, s in opts))
        else:
            print(get_font(a.family, a.weight, a.italic, a.subset))
    except Exception as e:
        sys.exit(f"{a.family}: not available from Fontsource ({e}). Pick an alternative from references/typography.md")


if __name__ == "__main__":
    main()
