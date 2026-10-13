"""结构估计逐步精讲 · Python 配套代码（numpy / scipy / statsmodels）
农户是否购买农机作业服务：静态二元 logit 结构模型
数据：data/mechanization_sim.csv —— 模拟教学数据（SIMULATED），由 00_make_data.py 生成，
      与原站 structural-estimation-mechanization.py 的数据生成过程和 seed 完全一致。
运行：python 01_structural_logit.py      输出：屏幕 + output/*.csv
"""
from pathlib import Path
import numpy as np, pandas as pd
from scipy import optimize, stats
import statsmodels.api as sm

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"; OUT.mkdir(exist_ok=True)
NAMES = ["cons", "net_price", "ln_land", "distance", "quality"]
TRUE = np.array([-0.80, -1.40, 0.75, -0.18, 0.90])     # 只有模拟数据才知道“真值”
rng = np.random.default_rng(20261013)

def Lam(v):                       # logistic CDF Λ(v) = 1/(1+e^{-v})
    return 1.0 / (1.0 + np.exp(-v))

def design(df, price=None):
    p = df["net_price"].to_numpy() if price is None else price
    return np.column_stack([np.ones(len(df)), p, df["ln_land"], df["distance"], df["quality"]])

def loglik(theta, X, y):          # ℓ(θ) = Σ [y·v − log(1+e^v)]，数值稳定写法
    v = X @ theta
    return np.sum(y * v - np.logaddexp(0.0, v))

def score(theta, X, y):           # ∂ℓ/∂θ = Σ (y − Λ(v)) x
    return X.T @ (y - Lam(X @ theta))

def hessian(theta, X):            # ∂²ℓ/∂θ∂θ' = −Σ Λ(1−Λ) x x'
    p = Lam(X @ theta)
    return -(X * (p * (1 - p))[:, None]).T @ X

def fit_mle(X, y):
    res = optimize.minimize(lambda t: -loglik(t, X, y), np.zeros(X.shape[1]),
                            jac=lambda t: -score(t, X, y), hess=lambda t: -hessian(t, X),
                            method="trust-exact", options={"gtol": 1e-6})
    V = np.linalg.inv(-hessian(res.x, X))
    return res, V

df = pd.read_csv(HERE / "data" / "mechanization_sim.csv")
y, X = df["adopt"].to_numpy(), design(df)
print("=" * 72)
print("STEP 0  数据（模拟教学数据，非真实农户）")
print(df[["adopt", "listed_price", "voucher", "net_price", "land", "distance", "quality"]]
      .describe().loc[["mean", "std", "min", "max"]].round(3).to_string())

# ---------------------------------------------------------------- STEP 1
print("=" * 72)
print("STEP 1  手算：三个农户在两组候选参数下的选择概率与对数似然贡献")
show = df.iloc[[0, 1, 2]]
Xs, ys = design(show), show["adopt"].to_numpy()
for label, th in [("θ_A = 全 0（人人 50%）", np.zeros(5)), ("θ_B = 程序设定的真值", TRUE)]:
    v = Xs @ th; p = Lam(v); contrib = ys * np.log(p) + (1 - ys) * np.log(1 - p)
    print(f"  {label}")
    for k in range(3):
        print(f"    农户{k+1}: y={ys[k]}  v={v[k]: .3f}  P(买)={p[k]:.3f}  贡献={contrib[k]: .3f}")
    print(f"    三户合计 ℓ = {contrib.sum():.3f}")
print(f"  全样本：ℓ(θ_A) = {loglik(np.zeros(5), X, y):.3f}   ℓ(θ_B) = {loglik(TRUE, X, y):.3f}")

# ---------------------------------------------------------------- STEP 2
print("=" * 72)
print("STEP 2  Newton–Raphson：每一步 θ ← θ + [−H]⁻¹ s")
th = np.zeros(5)
for it in range(1, 20):
    step = np.linalg.solve(-hessian(th, X), score(th, X, y)); th = th + step
    print(f"  iter {it}: ℓ = {loglik(th, X, y):.4f}   max|Δθ| = {np.abs(step).max():.2e}")
    if np.abs(step).max() < 1e-10: break

# ---------------------------------------------------------------- STEP 3
print("=" * 72)
print("STEP 3  MLE 结果表（trust-region Newton + 解析梯度/海森；标准误来自信息矩阵的逆）")
res, V = fit_mle(X, y)
b, se = res.x, np.sqrt(np.diag(V)); z = b / se
tab = pd.DataFrame({"estimate": b, "SE": se, "z": z, "p": 2 * stats.norm.sf(np.abs(z)),
                    "CI_low": b - 1.96 * se, "CI_high": b + 1.96 * se, "truth": TRUE}, index=NAMES)
print(tab.round(3).to_string())
ll1 = -res.fun; ybar = y.mean(); ll0 = len(y) * (ybar * np.log(ybar) + (1 - ybar) * np.log(1 - ybar))
LR = 2 * (ll1 - ll0)
print(f"  收敛: {res.success}（max|score| = {np.abs(score(b, X, y)).max():.1e}，{res.nit} 次迭代），ℓ(θ̂) = {ll1:.3f}，仅截距 ℓ0 = {ll0:.3f}")
print(f"  LR = {LR:.2f} (df=4, p = {stats.chi2.sf(LR, 4):.2e})   McFadden pseudo-R² = {1 - ll1/ll0:.3f}")
print(f"  真值是否落在 95% CI 内: {dict(zip(NAMES, ((TRUE > tab.CI_low) & (TRUE < tab.CI_high)).tolist()))}")
sm_fit = sm.Logit(y, X).fit(disp=0)
print(f"  与 statsmodels.Logit 对照，系数最大差 = {np.abs(sm_fit.params - b).max():.1e}")
tab.to_csv(OUT / "mle_table_python.csv")

# ---------------------------------------------------------------- STEP 4
print("=" * 72)
print("STEP 4  把系数读成经济量")
p_hat = Lam(X @ b)
ame_price = np.mean(b[1] * p_hat * (1 - p_hat))
elas = np.mean(b[1] * df["net_price"] * (1 - p_hat))            # 个体价格弹性的平均
wtp_dist = b[3] / b[1]                                          # 每公里距离 ≈ 多少价格单位
g = np.array([0, -b[3] / b[1]**2, 0, 1 / b[1], 0])              # delta method 梯度
se_wtp = np.sqrt(g @ V @ g)
print(f"  净价格的平均边际效应 AME = {ame_price:.3f}（价格 +1 单位 → 购买概率约 {ame_price*100:.1f} 个百分点）")
print(f"  平均价格弹性 = {elas:.3f}")
print(f"  距离的“价格等价” γ/α = {wtp_dist:.3f} 价格单位/公里 (delta-method SE = {se_wtp:.3f})")
print(f"  odds ratio：价格 +0.1 单位，购买胜算乘以 exp(0.1·α) = {np.exp(0.1*b[1]):.3f}")

# ---------------------------------------------------------------- STEP 5
print("=" * 72)
print("STEP 5  拟合：用于估计的维度（价格四分位）+ 没有专门瞄准的维度（距离三等分）")
df["p_hat"] = p_hat
df["price_q"] = pd.qcut(df["net_price"], 4, labels=["Q1 最便宜", "Q2", "Q3", "Q4 最贵"])
df["dist_g"] = pd.qcut(df["distance"], 3, labels=["近", "中", "远"])
for col in ["price_q", "dist_g"]:
    t = df.groupby(col, observed=True).agg(n=("adopt", "size"), observed=("adopt", "mean"), predicted=("p_hat", "mean"))
    print(t.round(3).to_string()); print()

# ---------------------------------------------------------------- STEP 6
print("=" * 72)
print("STEP 6  反事实：取消代金券、改为对标价普惠补贴 s；供给和标价不变（局部均衡）")
draws = rng.multivariate_normal(b, V, size=2000)                # Krinsky–Robb 参数不确定性
rows = []
for s in np.round(np.arange(0, 0.51, 0.05), 2):
    Xc = design(df, price=df["listed_price"].to_numpy() * (1 - s))
    pc = Lam(Xc @ b); adop = pc.mean(); cost = np.mean(pc * df["listed_price"] * s)
    sims = Lam(Xc @ draws.T).mean(axis=0)
    rows.append(dict(subsidy=s, adoption=adop, lo95=np.quantile(sims, .025), hi95=np.quantile(sims, .975),
                     cost_per_farmer=cost, cost_per_extra_adopter=np.nan))
cf = pd.DataFrame(rows)
base = cf.loc[0, "adoption"]
cf["cost_per_extra_adopter"] = np.where(cf.subsidy > 0, cf.cost_per_farmer / (cf.adoption - base), np.nan)
print(f"  现状（一半农户持 30% 代金券）预测采纳率 = {p_hat.mean():.3f}，观测 = {y.mean():.3f}")
print(cf.round(3).to_string(index=False))
cf.to_csv(OUT / "counterfactual_python.csv", index=False)

# ---------------------------------------------------------------- STEP 7
print("=" * 72)
print("STEP 7  蒙特卡洛：用真值反复生成 300 份 N=700 的数据，看估计量能否‘估回真值’")
R = 300; est = np.empty((R, 5)); cover = np.zeros(5)
for r in range(R):
    n = 700; lp = 0.8 + rng.random(n); vo = np.where(rng.random(n) < .5, .3, 0.)
    Xr = np.column_stack([np.ones(n), lp * (1 - vo), np.log1p(0.3 + 2.7 * rng.random(n)),
                          0.5 + 6 * rng.random(n), 0.3 + 0.7 * rng.random(n)])
    yr = (rng.random(n) < Lam(Xr @ TRUE)).astype(float)
    rr, Vr = fit_mle(Xr, yr); est[r] = rr.x; s_r = np.sqrt(np.diag(Vr))
    cover += (np.abs(rr.x - TRUE) < 1.96 * s_r)
mc = pd.DataFrame({"truth": TRUE, "mean_est": est.mean(0), "bias": est.mean(0) - TRUE,
                   "sd_est": est.std(0), "coverage95": cover / R}, index=NAMES)
print(mc.round(3).to_string())

# ---------------------------------------------------------------- STEP 8
print("=" * 72)
print("STEP 8  识别为什么重要：若价格与研究者看不到的服务质量 ξ 相关（另一份模拟数据）")
n = 5000; xi = rng.normal(0, 1, n)                              # 未观测质量
listed = 1.3 + 0.25 * xi + 0.2 * rng.normal(size=n)             # 好服务定价高 → 价格内生
vo = np.where(rng.random(n) < .5, .3, 0.); net = listed * (1 - vo)
yv = (rng.random(n) < Lam(-0.5 - 1.4 * net + 1.0 * xi)).astype(float)
naive = sm.Logit(yv, sm.add_constant(net)).fit(disp=0)
# 只用随机代金券的变化：控制标价（它吸收了 ξ 的一部分），用代金券带来的净价差识别 α
ctrl = sm.Logit(yv, sm.add_constant(np.column_stack([net, listed]))).fit(disp=0)
full = sm.Logit(yv, sm.add_constant(np.column_stack([net, xi]))).fit(disp=0)
print(f"  真 α = -1.40")
print(f"  天真 logit（只放净价格）            α̂ = {naive.params[1]: .3f}")
print(f"  加入标价，只用代金券变化识别        α̂ = {ctrl.params[1]: .3f}   (SE {ctrl.bse[1]:.3f})")
print(f"  （上帝视角）把 ξ 也放进去            α̂ = {full.params[1]: .3f}")
print("  解读：天真估计甚至为正（“越贵越受欢迎”）；控制标价后，剩余的净价格变化只来自随机代金券，")
print("        与 ξ 无关，α̂ 回到真值附近（相差不到一个标准误）。")
