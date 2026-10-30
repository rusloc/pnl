"""Scratch only: dump the measure catalogue as JSON for tom_sync.ps1."""
import json, sys
import measures, measures_svg  # noqa
from measures import M
json.dump({"measures": [dict(name=m["name"], expr=m["expr"].replace("\n", "\r\n"), folder=m["folder"], hidden=bool(m["hidden"]), fmt=m["fmt"] or "", cat=m["cat"] or "") for m in M]},
          open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False)
print(len(M))
