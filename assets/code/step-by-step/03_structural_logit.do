********************************************************************************
* 结构估计逐步精讲 · Stata 配套代码
* 数据：data/mechanization_sim.csv —— 模拟教学数据（SIMULATED），与 R / Python 同一文件
* 说明：本 .do 用标准 Stata 命令编写（logit / margins / nlcom / predictnl）。
*       制作时所用机器没有 Stata，未在本机运行；预期数值应与 R / Python 输出一致
*       （logit 系数 net_price ≈ -1.795，SE ≈ 0.382，logLik ≈ -298.932）。
********************************************************************************
clear all
set more off
import delimited using "data/mechanization_sim.csv", clear

* STEP 1  MLE：logit 就是在最大化二元选择模型的对数似然
logit adopt net_price ln_land distance quality
estimates store mle
display "McFadden pseudo-R2 = " e(r2_p) "   logLik = " e(ll)

* STEP 2  把系数读成经济量
margins, dydx(net_price)                          // 平均边际效应 AME
nlcom (dist_price_equiv: _b[distance]/_b[net_price])   // 距离的“价格等价”，delta method

* STEP 3  拟合：按净价格四分位比较观测与预测采纳率
predict double phat, pr
xtile price_q = net_price, nq(4)
tabstat adopt phat, by(price_q) statistics(mean) format(%6.3f)

* STEP 4  反事实：取消代金券、对标价普惠补贴 s（供给与标价不变）
foreach s in 0 0.1 0.2 0.3 0.5 {
    quietly generate double pcf = invlogit(_b[_cons] + _b[net_price]*listed_price*(1-`s') ///
        + _b[ln_land]*ln_land + _b[distance]*distance + _b[quality]*quality)
    quietly summarize pcf
    display "subsidy = " %4.2f `s' "   predicted adoption = " %6.3f r(mean)
    drop pcf
}
* 反事实的置信区间（delta method）：以 20% 为例
generate double p_cf20_price = listed_price*(1-0.2)
predictnl double pcf20 = invlogit(_b[_cons] + _b[net_price]*p_cf20_price ///
    + _b[ln_land]*ln_land + _b[distance]*distance + _b[quality]*quality)
summarize pcf20
