# 结构方程模型（SEM）对照 · R lavaan
# (A) 真实公开数据：Holzinger & Swineford (1939)，lavaan 自带，三因子 CFA（经典教学例）
# (B) 模拟教学数据（SIMULATED）：计划行为理论（TPB）—— 农户采纳意愿，已知真值，
#     导出为 data/tpb_sim.csv，供 semopy 脚本复用
suppressPackageStartupMessages(library(lavaan))
args <- commandArgs(trailingOnly = FALSE)
here <- dirname(normalizePath(sub("--file=", "", args[grep("--file=", args)])))
dir.create(file.path(here, "data"), showWarnings = FALSE)
write.csv(HolzingerSwineford1939, file.path(here, "data", "holzinger1939.csv"), row.names = FALSE)

cat("==== (A) Holzinger-Swineford 1939, 3-factor CFA (N =", nrow(HolzingerSwineford1939), ")\n")
hs <- ' visual =~ x1 + x2 + x3
        textual =~ x4 + x5 + x6
        speed =~ x7 + x8 + x9 '
fitA <- cfa(hs, data = HolzingerSwineford1939)
print(round(fitMeasures(fitA, c("chisq", "df", "pvalue", "cfi", "tli", "rmsea",
                                "rmsea.ci.lower", "rmsea.ci.upper", "srmr")), 3))
pe <- standardizedSolution(fitA); print(pe[pe$op == "=~", c("lhs", "rhs", "est.std", "se", "pvalue")], digits = 3)

## (B) 生成 TPB 模拟数据：ATT、SN、PBC → INT；每个潜变量 3 个指标
set.seed(20261013); n <- 500
Phi <- matrix(c(1, .4, .3, .4, 1, .35, .3, .35, 1), 3)
xi <- MASS::mvrnorm(n, rep(0, 3), Phi); colnames(xi) <- c("ATT", "SN", "PBC")
INT <- 0.45 * xi[, "ATT"] + 0.20 * xi[, "SN"] + 0.30 * xi[, "PBC"] + rnorm(n, 0, sqrt(0.55))
ind <- function(f, lam) sapply(lam, function(l) l * f + rnorm(n, 0, sqrt(1 - l^2)))
dat <- data.frame(ind(xi[, "ATT"], c(.8, .75, .7)), ind(xi[, "SN"], c(.7, .75, .65)),
                  ind(xi[, "PBC"], c(.8, .7, .7)), ind(INT, c(.85, .8, .75)))
names(dat) <- c(paste0("att", 1:3), paste0("sn", 1:3), paste0("pbc", 1:3), paste0("int", 1:3))
write.csv(round(dat, 6), file.path(here, "data", "tpb_sim.csv"), row.names = FALSE)

tpb <- ' ATT =~ att1 + att2 + att3
         SN  =~ sn1 + sn2 + sn3
         PBC =~ pbc1 + pbc2 + pbc3
         INT =~ int1 + int2 + int3
         INT ~ g1*ATT + g2*SN + g3*PBC '
fitB <- sem(tpb, data = dat)
cat("\n==== (B) TPB simulated (N = 500): fit indices\n")
print(round(fitMeasures(fitB, c("chisq", "df", "pvalue", "cfi", "tli", "rmsea", "srmr")), 3))
ss <- standardizedSolution(fitB)
vINT <- 0.45^2 + 0.20^2 + 0.30^2 + 2 * (0.45*0.20*0.4 + 0.45*0.30*0.3 + 0.20*0.30*0.35) + 0.55
cat(sprintf("true standardized paths: ATT %.3f, SN %.3f, PBC %.3f ; true R2 = %.3f\n",
            0.45 / sqrt(vINT), 0.20 / sqrt(vINT), 0.30 / sqrt(vINT), 1 - 0.55 / vINT))
cat("estimated standardized structural paths:\n")
print(ss[ss$op == "~", c("lhs", "op", "rhs", "est.std", "se", "pvalue")], digits = 3)
cat("R2 of INT:", round(inspect(fitB, "r2")["INT"], 3), "\n")

## (C) 读输出之后做什么：修正指数（MI）只是线索，必须有理论理由才能改模型
cat("\n==== (C) HS: top modification indices\n")
mi <- modindices(fitA, sort. = TRUE); print(head(mi[, c("lhs", "op", "rhs", "mi", "epc")], 3))
fitA2 <- cfa(' visual =~ x1 + x2 + x3 + x9
               textual =~ x4 + x5 + x6
               speed =~ x7 + x8 + x9 ', data = HolzingerSwineford1939)
print(round(fitMeasures(fitA2, c("chisq", "df", "cfi", "rmsea", "srmr")), 3))
print(anova(fitA, fitA2))

## (D) TPB：非标准化路径、组合信度 CR 与平均方差抽取 AVE
cat("\n==== (D) TPB unstandardized paths, CR and AVE\n")
pe <- parameterEstimates(fitB); print(pe[pe$op == "~", c("lhs", "rhs", "est", "se", "pvalue")], digits = 3)
l <- ss[ss$op == "=~", ]
for (k in unique(l$lhs)) { x <- l$est.std[l$lhs == k]
  cat(sprintf("%-4s CR = %.3f  AVE = %.3f\n", k, sum(x)^2 / (sum(x)^2 + sum(1 - x^2)), mean(x^2))) }
