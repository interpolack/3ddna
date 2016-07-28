import csv
from collections import defaultdict

tree = lambda: defaultdict(tree)
bins = tree()

for hr in ['0', '1', '2', '3', '6']:
    with open(hr + 'hr-Xist_1Mb', 'r') as f:
        reader = csv.reader(f, delimiter='\t')
        for r, row in enumerate(reader):
            bins[r]['xist' + hr] = float(row[4])

with open('Model_1Mb.pdb', 'r') as f:
    reader = csv.reader(f)
    for r, row in enumerate(reader):
        bins[r]['lamina'] = float(row[0][61:62])

rows = "lamina\t" + "\t".join(["xist" + hr for hr in ['0', '1', '2', '3', '6']]) + '\n'
print rows
for b in bins:
    rows += str(bins[b]['lamina'])
    for hr in ['0', '1', '2', '3', '6']:
        rows += '\t'
        rows += "0" if 'xist' + hr not in bins[b] else str(bins[b]['xist' + hr])
    rows += '\n'

with open('data.tsv', 'w') as f:
    f.write(rows)
