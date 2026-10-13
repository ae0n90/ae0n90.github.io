"""结构方程模型（SEM）对照 · Python semopy
读取 04_sem_lavaan.R 导出的同一份数据，检查 semopy 与 lavaan 是否给出相同估计。
(A) Holzinger & Swineford (1939) 真实公开数据，三因子 CFA
(B) TPB 模拟教学数据（SIMULATED）
"""
from pathlib import Path
import pandas as pd, semopy
HERE = Path(__file__).resolve().parent
pd.set_option("display.width", 120)

hs = pd.read_csv(HERE / "data" / "holzinger1939.csv")
mA = semopy.Model("""visual =~ x1 + x2 + x3
textual =~ x4 + x5 + x6
speed =~ x7 + x8 + x9""")
mA.fit(hs, obj="MLW")
st = semopy.calc_stats(mA).T
print(f"==== (A) Holzinger-Swineford 1939 (N={len(hs)})  semopy {semopy.__version__}")
print(st.loc[["DoF", "chi2", "chi2 p-value", "CFI", "TLI", "RMSEA"]].round(3).to_string())
est = mA.inspect(std_est=True)
print(est[est.op == "~"][["lval", "op", "rval", "Estimate", "Est. Std", "Std. Err"]].round(3).to_string(index=False))

tpb = pd.read_csv(HERE / "data" / "tpb_sim.csv")
mB = semopy.Model("""ATT =~ att1 + att2 + att3
SN =~ sn1 + sn2 + sn3
PBC =~ pbc1 + pbc2 + pbc3
INT =~ int1 + int2 + int3
INT ~ ATT + SN + PBC""")
mB.fit(tpb, obj="MLW")
print(f"\n==== (B) TPB simulated (N={len(tpb)})")
print(semopy.calc_stats(mB).T.loc[["DoF", "chi2", "chi2 p-value", "CFI", "TLI", "RMSEA"]].round(3).to_string())
e = mB.inspect(std_est=True)
print(e[(e.op == "~") & (e.lval == "INT")][["lval", "op", "rval", "Estimate", "Est. Std", "Std. Err", "p-value"]].round(3).to_string(index=False))
