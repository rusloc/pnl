"""Shared helpers for the Nordmark Exec PBIP generator (bip, 2026-10-28, ADR-0013 PBI flavour)."""
import json
import os
import uuid

from PIL import ImageFont

# Defaults are relative to this file (<repo>/pbi-report/Nordmark Exec/tools/gen); every path can be overridden by an env var.
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get("NORDMARK_REPO", os.path.normpath(os.path.join(HERE, "..", "..", "..", "..")))
ROOT = os.environ.get("NORDMARK_ROOT", os.path.join(REPO, "pbi-report", "Nordmark Exec"))
NAME = "Nordmark Exec"
MODEL = os.path.join(ROOT, f"{NAME}.SemanticModel")
REPORT = os.path.join(ROOT, f"{NAME}.Report")
DATA_FOLDER = os.environ.get("NORDMARK_DATA", os.path.join(REPO, "data", "nordmark_retail_dummy_data", "parquet"))
CHECKS = os.environ.get("NORDMARK_CHECKS", os.path.join(REPO, "data", "nordmark_retail_dummy_data", "checks", "control_totals_eur.csv"))
CAT_CHECKS = os.environ.get("NORDMARK_CAT_CHECKS", os.path.join(REPO, "data", "nordmark_retail_dummy_data", "checks", "control_totals_category_eur.csv"))
FONTS = os.environ.get("NORDMARK_FONTS", os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts"))
NS = uuid.UUID("3b7a1f0e-5d2c-4c8e-9f61-0a4e2b7d1c13")


def tag(*parts):
    """Deterministic lineageTag from a name path."""
    return str(uuid.uuid5(NS, "/".join(parts)))


def write_text(path, text):
    """UTF-8 no BOM, CRLF line endings (Desktop serialization)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    text = text.replace("\r\n", "\n").replace("\n", "\r\n")
    with open(path, "wb") as f:
        f.write(text.encode("utf-8"))


def write_lf(path, text):
    """Docs in docs/ and README files: UTF-8 no BOM, LF."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(text.replace("\r\n", "\n").encode("utf-8"))


def write_json(path, obj):
    """2-space indent, literal non-ASCII, CRLF, no trailing newline."""
    write_text(path, json.dumps(obj, indent=2, ensure_ascii=False))


# ---------- v5 tokens (docs/design/executive dashboard (reseller)/prototype.html :root) ----------
C = {
    "bg": "#FFFFFF", "ink": "#111827", "muted": "#5F6878", "line": "#E5E7EB", "line2": "#F1F3F5", "soft": "#F6F7F9",
    "acc": "#2048C6", "accT": "#EAEFFB", "accSel": "#E6ECFA", "accLine": "#9AA9E0",
    "good": "#136C3A", "goodT": "#E1F0E5", "watch": "#9A5B00", "watchT": "#FBEFD6", "off": "#C0272D", "offT": "#FAE3E3",
    "col": "#D1D5DB", "tgt": "#9CA3AF", "mix1": "#2048C6", "mix2": "#374151", "mix3": "#B6BCC6",
    "dot_green": "#2E9E5B", "dot_orange": "#E3A52A", "dot_red": "#B3261E",
    "chip_line": "#DBDCDF", "na": "#5F6878", "naT": "#F1F3F5",
}

# ---------- text metrics (Segoe UI from the Windows font folder) ----------
_FONTS = {}


def font(size_px, bold=False):
    key = (size_px, bold)
    if key not in _FONTS:
        path = os.path.join(FONTS, "seguisb.ttf" if bold else "segoeui.ttf")
        _FONTS[key] = ImageFont.truetype(path, size=int(round(size_px * 4)))
    return _FONTS[key]


def text_width(text, size_px, bold=False):
    return font(size_px, bold).getlength(text) / 4.0


def wrap(text, width_px, size_px, bold=False, token_px=None):
    """Greedy word wrap by measured width. token_px: {token: assumed px width} for {placeholders}."""
    token_px = token_px or {}
    words = text.split(" ")
    lines, cur = [], ""

    def w(s):
        base = s
        extra = 0.0
        for t, px in token_px.items():
            if t in base:
                n = base.count(t)
                base = base.replace(t, "")
                extra += n * px
        return text_width(base.replace("**", ""), size_px, bold) + extra

    for word in words:
        cand = word if not cur else cur + " " + word
        if w(cand) <= width_px or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines
