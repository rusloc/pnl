"""Splice generated measures into the Desktop-saved _measures.tmdl: repo order and lineageTags kept for every surviving name,
renamed measures (Card LW -> Card Prev) take the old position, new measures go after their generator predecessor, removed
measures drop out, header and trailer bytes stay. Usage: splice.py REPO GEN OUT"""
import re
import sys

KPIS = ["NET_SALES", "TOTAL_MARGIN", "WEEKS_OF_COVER", "MARKDOWN", "AVAILABILITY", "EBITDA", "LFL_GROWTH", "FRONT_GM",
        "SELL_THROUGH", "GMROI", "SUPPLIER_OTIF", "CHANNEL_MIX"]
RENAME = {f"Card LW {k}": f"Card Prev {k}" for k in KPIS}


def parse(path):
    raw = open(path, "rb").read()
    assert not raw.startswith(b"\xef\xbb\xbf")
    lines = raw.decode("utf-8").split("\r\n")
    starts = [k for k, l in enumerate(lines) if l.startswith("\tmeasure ")]
    first = starts[0]
    while lines[first - 1].startswith("\t///"):
        first -= 1
    trail = next(k for k, l in enumerate(lines) if l.startswith("\tcolumn measure_table"))
    blocks, order = {}, []
    for i, k in enumerate(starts):
        name = re.match(r"\tmeasure ('(?:[^']|'')+'|\S+)", lines[k]).group(1)
        name = name[1:-1].replace("''", "'") if name.startswith("'") else name
        s = k
        while lines[s - 1].startswith("\t///"):
            s -= 1
        e = starts[i + 1] if i + 1 < len(starts) else trail
        while lines[e - 1].startswith("\t///"):
            e -= 1
        blocks[name] = lines[s:e]
        order.append(name)
    return lines[:first], blocks, order, lines[trail:]


def tag_of(block):
    return next(l for l in block if l.startswith("\t\tlineageTag: "))


rh, rb, ro, rt = parse(sys.argv[1])
gh, gb, go, _gt = parse(sys.argv[2])
assert rh == gh, "header differs"
out_names, emitted = [], set()
for n in ro:
    if n in gb:
        out_names.append(n)
    elif n in RENAME and RENAME[n] in gb:
        out_names.append(RENAME[n])
emitted = set(out_names)
for i, n in enumerate(go):
    if n in emitted:
        continue
    j = i - 1
    while j >= 0 and go[j] not in emitted:
        j -= 1
    pos = out_names.index(go[j]) + 1 if j >= 0 else 0
    out_names.insert(pos, n)
    emitted.add(n)
assert sorted(out_names) == sorted(go), set(go) ^ set(out_names)
body = []
for n in out_names:
    blk = list(gb[n])
    if n in rb:  # keep the Desktop-saved lineageTag
        t = tag_of(rb[n])
        blk = [t if l.startswith("\t\tlineageTag: ") else l for l in blk]
    body += blk
out = "\r\n".join(rh + body + rt)
open(sys.argv[3], "wb").write(out.encode("utf-8"))
removed = [n for n in ro if n not in gb and n not in RENAME]
renamed = [n for n in ro if n in RENAME]
added = [n for n in go if n not in rb and n not in RENAME.values()]
changed = [n for n in go if n in rb and [l for l in rb[n] if "lineageTag" not in l] != [l for l in gb[n] if "lineageTag" not in l]]
print(f"measures {len(out_names)} (repo {len(ro)}): removed {len(removed)} {removed}")
print(f"renamed {len(renamed)}; added {len(added)} {added}")
print(f"changed {len(changed)}; unchanged {len(go) - len(changed) - len(added) - len(renamed)}")
