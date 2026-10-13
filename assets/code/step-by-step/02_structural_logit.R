# 结构估计逐步精讲 · R 配套代码（base R + MASS）
# 农户是否购买农机作业服务：静态二元 logit 结构模型
# 数据：data/mechanization_sim.csv —— 模拟教学数据（SIMULATED），与 Python 脚本使用同一文件
# 运行：Rscript 02_structural_logit.R
suppressPackageStartupMessages(library(MASS))
set.seed(20261013)
args <- commandArgs(trailingOnly = FALSE)
here <- dirname(normalizePath(sub("--file=", "", args[grep("--file=", args)])))
df <- read.csv(file.path(here, "data", "mechanization_sim.csv"))
truth <- c(cons = -0.80, net_price = -1.40, ln_land = 0.75, distance = -0.18, quality = 0.90)
X <- cbind(cons = 1, net_price = df$net_price, ln_land = df$ln_land,
           distance = df$distance, quality = df$quality)
y <- df$adopt

## STEP 1 自己写对数似然，交给 optim（BFGS + 解析梯度）
loglik <- function(th) { v <- drop(X %*% th); sum(y * v - log1p(exp(v))) }
grad   <- function(th) { p <- plogis(drop(X %*% th)); drop(crossprod(X, y - p)) }
opt <- optim(rep(0, 5), fn = function(t) -loglik(t), gr = function(t) -grad(t),
             method = "BFGS", hessian = TRUE, control = list(reltol = 1e-12, maxit = 500))
V_opt <- solve(opt$hessian)
cat("==== STEP 1  optim 手写似然：convergence =", opt$convergence,
    " logLik =", round(-opt$value, 3), "\n")

## STEP 2 用 glm 的 logit 作对照：两者应在数值误差内一致
m <- glm(adopt ~ net_price + ln_land + distance + quality, family = binomial("logit"), data = df)
cat("==== STEP 2  glm 对照：系数最大差 =", signif(max(abs(coef(m) - opt$par)), 2), "\n")
print(summary(m)$coefficients, digits = 3)
cat(sprintf("logLik = %.3f ; null logLik = %.3f ; McFadden R2 = %.3f\n",
            logLik(m), logLik(update(m, . ~ 1)), 1 - logLik(m) / logLik(update(m, . ~ 1))))
ci <- confint.default(m)
print(round(cbind(estimate = coef(m), ci, truth = truth), 3))

## STEP 3 读成经济量
b <- coef(m); V <- vcov(m); p_hat <- fitted(m)
ame <- mean(b["net_price"] * p_hat * (1 - p_hat))
wtp <- b["distance"] / b["net_price"]
g <- c(0, -b["distance"] / b["net_price"]^2, 0, 1 / b["net_price"], 0)
cat(sprintf("==== STEP 3  AME(price) = %.3f ; distance price-equivalent gamma/alpha = %.3f (SE %.3f)\n",
            ame, wtp, sqrt(drop(t(g) %*% V %*% g))))

## STEP 4 拟合：价格四分位、距离三等分
q <- cut(df$net_price, quantile(df$net_price, 0:4 / 4), include.lowest = TRUE, labels = paste0("Q", 1:4))
d <- cut(df$distance, quantile(df$distance, 0:3 / 3), include.lowest = TRUE, labels = c("near", "mid", "far"))
cat("==== STEP 4  fit by price quartile / distance tercile\n")
print(round(cbind(observed = tapply(y, q, mean), predicted = tapply(p_hat, q, mean)), 3))
print(round(cbind(observed = tapply(y, d, mean), predicted = tapply(p_hat, d, mean)), 3))

## STEP 5 反事实 + Krinsky–Robb 区间
draws <- mvrnorm(2000, b, V)
cf <- t(sapply(c(0, .1, .2, .3, .5), function(s) {
  Xc <- X; Xc[, "net_price"] <- df$listed_price * (1 - s)
  pc <- plogis(drop(Xc %*% b)); sims <- colMeans(plogis(Xc %*% t(draws)))
  c(subsidy = s, adoption = mean(pc), lo95 = unname(quantile(sims, .025)),
    hi95 = unname(quantile(sims, .975)), cost_per_farmer = mean(pc * df$listed_price * s))
}))
cat("==== STEP 5  universal subsidy counterfactual (vouchers removed; supply fixed)\n")
print(round(cf, 3))
dir.create(file.path(here, "output"), showWarnings = FALSE)
write.csv(cf, file.path(here, "output", "counterfactual_R.csv"), row.names = FALSE)
