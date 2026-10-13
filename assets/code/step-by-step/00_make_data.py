"""生成教学数据：与原站 structural-estimation-mechanization.py 完全相同的数据生成过程（同一 seed）。
SIMULATED TEACHING DATA — 不是真实农户数据。输出 data/mechanization_sim.csv，供 R / Python / Stata 三个脚本共用。"""
import csv, math, random
SEED, N = 20260804, 700
TRUE = dict(cons=-0.80, net_price=-1.40, ln_land=0.75, distance=-0.18, quality=0.90)
def logistic(v): return 1/(1+math.exp(-v)) if v >= 0 else math.exp(v)/(1+math.exp(v))
rng = random.Random(SEED)
rows = []
for i in range(N):   # 抽样顺序与原脚本逐行一致
    listed = 0.8 + rng.random()
    voucher = 0.30 if rng.random() < 0.50 else 0.0
    net = listed * (1 - voucher)
    land = 0.3 + 2.7 * rng.random()
    ln_land = math.log1p(land)
    dist = 0.5 + 6.0 * rng.random()
    qual = 0.3 + 0.7 * rng.random()
    idx = TRUE["cons"] + TRUE["net_price"]*net + TRUE["ln_land"]*ln_land + TRUE["distance"]*dist + TRUE["quality"]*qual
    adopt = int(rng.random() < logistic(idx))
    rows.append(dict(id=i+1, adopt=adopt, listed_price=listed, voucher=voucher, net_price=net,
                     land=land, ln_land=ln_land, distance=dist, quality=qual))
with open("data/mechanization_sim.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader()
    for r in rows: w.writerow({k: (f"{v:.10g}" if isinstance(v, float) else v) for k, v in r.items()})
print(f"wrote data/mechanization_sim.csv  N={N}  adoption rate={sum(r['adopt'] for r in rows)/N:.3f}")
