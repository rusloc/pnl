import sys, os, re
src, d = sys.argv[1], sys.argv[2]
os.makedirs(d, exist_ok=True)
for f in os.listdir(d):
    os.remove(os.path.join(d, f))
txt = open(src, encoding='utf-8').read()
parts = re.split(r'(?=^// ==== BLOCK )', txt, flags=re.M)[1:]
for i, p in enumerate(parts, 1):
    name = re.match(r'// ==== BLOCK (\S+):', p).group(1)
    open(os.path.join(d, f'b{i:02d}_{name}.dax'), 'w', encoding='utf-8').write(p)
print(len(parts))
