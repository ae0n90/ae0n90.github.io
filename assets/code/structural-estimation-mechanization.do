********************************************************************************
* Title:    Structural estimation teaching example: mechanization services
* Author:   Xiaoshi Zhou teaching material
* Purpose:  Simulate farmer service adoption, estimate a static logit model,
*           assess fit, and conduct subsidy counterfactuals
* Input:    None (the script generates synthetic teaching data)
* Output:   output/tables/subsidy_counterfactual.csv
*           output/figures/subsidy_counterfactual.png
* Software: Stata 18 or later
* Note:     Synthetic data only; do not interpret estimates as empirical facts
********************************************************************************

clear all
set more off
set varabbrev off
version 18.0
set seed 20260804

capture mkdir "output"
capture mkdir "output/tables"
capture mkdir "output/figures"
capture log close
log using "output/structural_estimation_mechanization.log", replace text

* 1. Generate synthetic farmers and a randomized 30% service voucher.
set obs 700
generate long id = _n
generate double listed_price = 0.8 + runiform()
generate double voucher = 0.30 * (runiform() < 0.50)
generate double net_price = listed_price * (1 - voucher)
generate double land = 0.3 + 2.7 * runiform()
generate double ln_land = ln(1 + land)
generate double distance = 0.5 + 6 * runiform()
generate double quality = 0.3 + 0.7 * runiform()

scalar true_cons = -0.80
scalar true_price = -1.40
scalar true_land = 0.75
scalar true_distance = -0.18
scalar true_quality = 0.90

generate double true_index = true_cons + true_price * net_price ///
    + true_land * ln_land + true_distance * distance ///
    + true_quality * quality
generate double true_probability = invlogit(true_index)
generate byte adopt = runiform() < true_probability

label variable adopt "Purchased mechanization service"
label variable voucher "Randomized voucher rate"
label variable net_price "Out-of-pocket service price"

* 2. Estimate all utility coefficients by maximum likelihood.
logit adopt net_price ln_land distance quality, vce(robust)
estimates store adoption_mle

display as text "True coefficients: cons=-0.80 price=-1.40 land=0.75 " ///
    "distance=-0.18 quality=0.90"
matrix list e(b)

* 3. Basic in-sample fit, including price-quartile fit not used as an estimator.
predict double phat, pr
summarize adopt phat
xtile price_quartile = net_price, nq(4)
table price_quartile, statistic(mean adopt phat) nformat(%6.3f)

* 4. Partial-equilibrium subsidy counterfactual.
*    Supply capacity, listed prices, and service quality are held fixed.
tempname cf_results
tempfile cf_data
postfile `cf_results' double subsidy adoption_rate fiscal_cost ///
    using "`cf_data'", replace

forvalues percentage = 0/50 {
    scalar subsidy_rate = `percentage' / 100
    quietly generate double phat_cf = invlogit( ///
        _b[_cons] ///
        + _b[net_price] * listed_price * (1 - subsidy_rate) ///
        + _b[ln_land] * ln_land ///
        + _b[distance] * distance ///
        + _b[quality] * quality)
    quietly summarize phat_cf
    scalar mean_adoption = r(mean)
    quietly generate double cost_cf = ///
        phat_cf * listed_price * subsidy_rate
    quietly summarize cost_cf
    scalar mean_cost = r(mean)
    post `cf_results' (subsidy_rate) (mean_adoption) (mean_cost)
    drop phat_cf cost_cf
}
postclose `cf_results'

use "`cf_data'", clear
format subsidy adoption_rate fiscal_cost %6.3f
list if inlist(subsidy, 0, 0.20, 0.50), noobs
export delimited using "output/tables/subsidy_counterfactual.csv", replace

twoway line adoption_rate subsidy, ///
    ytitle("Predicted adoption rate") ///
    xtitle("Universal subsidy rate") ///
    title("Mechanization-service subsidy counterfactual") ///
    note("Synthetic teaching data; partial-equilibrium prediction") ///
    graphregion(color(white))
graph export "output/figures/subsidy_counterfactual.png", replace width(1800)

display as result "Teaching workflow completed successfully."
log close
