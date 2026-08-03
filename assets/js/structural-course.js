(function () {
  "use strict";

  const MODULES = ["why", "model", "math", "estimators", "cases", "hands-on", "next"];
  const PROGRESS_KEY = "structural_estimation_course_progress_v2";
  const QUIZ_KEY = "structural_estimation_course_quiz_v2";

  function readStore(key) {
    try {
      return JSON.parse(window.localStorage.getItem(key) || "{}");
    } catch (error) {
      return {};
    }
  }

  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // The course remains usable when storage is blocked.
    }
  }

  function updateProgress() {
    const progress = readStore(PROGRESS_KEY);
    const count = MODULES.filter((id) => progress[id]).length;
    const percent = Math.round((100 * count) / MODULES.length);

    document.querySelectorAll("[data-course-progress]").forEach((element) => {
      element.textContent = `已完成 ${count} / ${MODULES.length} 个模块`;
    });
    document.querySelectorAll("[data-course-progress-bar]").forEach((element) => {
      element.style.width = `${percent}%`;
    });
    document.querySelectorAll("[data-course-nav-module]").forEach((element) => {
      element.classList.toggle("is-complete", Boolean(progress[element.dataset.courseNavModule]));
    });
    document.querySelectorAll("[data-module-card]").forEach((card) => {
      const complete = Boolean(progress[card.dataset.moduleCard]);
      card.classList.toggle("is-complete", complete);
      const status = card.querySelector("[data-module-status]");
      if (status) status.textContent = complete ? "已完成" : "未完成";
    });
    document.querySelectorAll("[data-complete-module]").forEach((button) => {
      const complete = Boolean(progress[button.dataset.completeModule]);
      button.classList.toggle("is-complete", complete);
      button.setAttribute("aria-pressed", String(complete));
      button.textContent = complete ? "✓ 本模块已完成（点击可撤销）" : "标记本模块为已完成";
    });
  }

  function initProgress() {
    document.querySelectorAll("[data-complete-module]").forEach((button) => {
      button.addEventListener("click", () => {
        const progress = readStore(PROGRESS_KEY);
        const id = button.dataset.completeModule;
        if (progress[id]) delete progress[id];
        else progress[id] = true;
        writeStore(PROGRESS_KEY, progress);
        updateProgress();
      });
    });
    updateProgress();
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function normalRandom(random) {
    let spare = null;
    return function () {
      if (spare !== null) {
        const value = spare;
        spare = null;
        return value;
      }
      let u = 0;
      while (u === 0) u = random();
      const v = random();
      const radius = Math.sqrt(-2 * Math.log(u));
      const angle = 2 * Math.PI * v;
      spare = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    };
  }

  function logistic(value) {
    if (value >= 0) return 1 / (1 + Math.exp(-value));
    const expValue = Math.exp(value);
    return expValue / (1 + expValue);
  }

  function canvasContext(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    return { canvas, context: canvas.getContext("2d") };
  }

  function drawAxes(context, width, height, xLabel, yLabel) {
    context.strokeStyle = "#cfd8d1";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(48, 16);
    context.lineTo(48, height - 34);
    context.lineTo(width - 16, height - 34);
    context.stroke();
    context.fillStyle = "#617067";
    context.font = "13px system-ui, sans-serif";
    context.fillText(xLabel, width - 92, height - 10);
    context.fillText(yLabel, 8, 20);
  }

  function initMethodGuide() {
    const box = document.getElementById("method-guide");
    if (!box) return;
    const output = document.getElementById("method-guide-output");
    box.addEventListener("change", () => {
      const checked = Array.from(box.querySelectorAll("input:checked")).map((input) => input.value);
      let message = "先明确政策问题，再选择方法。";
      if (checked.includes("new-policy") || checked.includes("behavior") || checked.includes("equilibrium")) {
        message = "结构模型值得考虑，但仍应尽量用实验、DID、IV 或其他外生变化识别和验证关键参数。";
      }
      if (checked.length === 1 && checked.includes("past-effect")) {
        message = "如果目标只是可信地估计已发生政策的平均效果，设计型方法通常更直接；不必为了“高级”而上结构模型。";
      }
      if (checked.includes("no-data")) {
        message = "暂不适合估计结构模型：先确认数据能观察选择、状态、价格/约束，并能为关键参数提供识别。";
      }
      output.textContent = message;
    });
  }

  function initCoinLab() {
    const output = document.getElementById("coin-output");
    if (!output) return;
    const chart = canvasContext("coin-canvas");
    let flips = [];
    let random = seededRandom(20260804);

    function draw() {
      const heads = flips.reduce((sum, value) => sum + value, 0);
      output.textContent = flips.length
        ? `已抛 ${flips.length} 次；正面 ${heads} 次；样本频率 ${(heads / flips.length).toFixed(3)}。`
        : "点击按钮开始。红线是理论概率 0.5，蓝线是累计样本频率。";
      if (!chart) return;
      const { canvas, context } = chart;
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      drawAxes(context, width, height, "抛掷次数", "正面频率");
      const y = (value) => height - 34 - value * (height - 58);
      context.strokeStyle = "#b85f32";
      context.setLineDash([6, 5]);
      context.beginPath();
      context.moveTo(48, y(0.5));
      context.lineTo(width - 16, y(0.5));
      context.stroke();
      context.setLineDash([]);
      if (flips.length < 2) return;
      let runningHeads = 0;
      context.strokeStyle = "#326b91";
      context.lineWidth = 2;
      context.beginPath();
      flips.forEach((value, index) => {
        runningHeads += value;
        const x = 48 + (index / (flips.length - 1)) * (width - 64);
        const pointY = y(runningHeads / (index + 1));
        if (index === 0) context.moveTo(x, pointY);
        else context.lineTo(x, pointY);
      });
      context.stroke();
    }

    document.querySelectorAll("[data-flip-count]").forEach((button) => {
      button.addEventListener("click", () => {
        const count = Number(button.dataset.flipCount);
        for (let index = 0; index < count; index += 1) flips.push(random() < 0.5 ? 1 : 0);
        draw();
      });
    });
    document.getElementById("coin-reset").addEventListener("click", () => {
      flips = [];
      random = seededRandom(20260804);
      draw();
    });
    draw();
  }

  function simulateAr1(rho, sigma, seed, periods) {
    const random = seededRandom(seed);
    const normal = normalRandom(random);
    const values = [0];
    for (let time = 1; time < periods; time += 1) {
      values.push(rho * values[time - 1] + sigma * normal());
    }
    return values;
  }

  function seriesMoments(values) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    let covariance = 0;
    for (let index = 1; index < values.length; index += 1) {
      covariance += (values[index] - mean) * (values[index - 1] - mean);
    }
    covariance /= values.length - 1;
    return { sd: Math.sqrt(variance), ac: covariance / variance };
  }

  function drawSeries(id, values, color, secondValues) {
    const chart = canvasContext(id);
    if (!chart) return;
    const { canvas, context } = chart;
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    drawAxes(context, width, height, "时间", "数值");
    const combined = secondValues ? values.concat(secondValues) : values;
    const min = Math.min(...combined);
    const max = Math.max(...combined);
    const span = Math.max(max - min, 0.001);
    const x = (index) => 48 + (index / (values.length - 1)) * (width - 64);
    const y = (value) => height - 34 - ((value - min) / span) * (height - 58);
    function line(series, stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 1.8;
      context.beginPath();
      series.forEach((value, index) => {
        if (index === 0) context.moveTo(x(index), y(value));
        else context.lineTo(x(index), y(value));
      });
      context.stroke();
    }
    if (secondValues) line(secondValues, "#8a948e");
    line(values, color);
  }

  function initAr1Lab() {
    const rhoInput = document.getElementById("ar-rho");
    if (!rhoInput) return;
    const sigmaInput = document.getElementById("ar-sigma");
    const output = document.getElementById("ar-output");
    function update() {
      const rho = Number(rhoInput.value);
      const sigma = Number(sigmaInput.value);
      document.getElementById("ar-rho-value").textContent = rho.toFixed(2);
      document.getElementById("ar-sigma-value").textContent = sigma.toFixed(2);
      const values = simulateAr1(rho, sigma, 41, 160);
      const moments = seriesMoments(values);
      const theoreticalSd = sigma / Math.sqrt(1 - rho ** 2);
      output.textContent = `样本标准差 ${moments.sd.toFixed(3)}；样本一阶自相关 ${moments.ac.toFixed(3)}；平稳分布的理论标准差 ${theoreticalSd.toFixed(3)}。\n注意：ρ 不只影响自相关，也会通过 1-ρ² 影响长期波动。`;
      drawSeries("ar-canvas", values, "#326b91");
    }
    rhoInput.addEventListener("input", update);
    sigmaInput.addEventListener("input", update);
    update();
  }

  function initHillLab() {
    const button = document.getElementById("hill-start");
    if (!button) return;
    const output = document.getElementById("hill-output");
    const chart = canvasContext("hill-canvas");
    let path = [];
    const objective = (x) => -((x - 2) ** 2) + 5;

    function draw(current) {
      if (!chart) return;
      const { canvas, context } = chart;
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      drawAxes(context, width, height, "候选参数", "目标函数");
      const xScale = (value) => 48 + ((value + 3) / 10) * (width - 64);
      const yScale = (value) => height - 34 - ((value + 20) / 27) * (height - 58);
      context.strokeStyle = "#326b91";
      context.lineWidth = 2;
      context.beginPath();
      for (let index = 0; index <= 200; index += 1) {
        const x = -3 + (10 * index) / 200;
        const y = objective(x);
        if (index === 0) context.moveTo(xScale(x), yScale(y));
        else context.lineTo(xScale(x), yScale(y));
      }
      context.stroke();
      context.fillStyle = "rgba(184, 95, 50, 0.45)";
      path.forEach((point) => {
        context.beginPath();
        context.arc(xScale(point), yScale(objective(point)), 4, 0, Math.PI * 2);
        context.fill();
      });
      if (current !== null) {
        context.fillStyle = "#b85f32";
        context.beginPath();
        context.arc(xScale(current), yScale(objective(current)), 7, 0, Math.PI * 2);
        context.fill();
      }
    }

    button.addEventListener("click", () => {
      button.disabled = true;
      let x = -2;
      let step = 1;
      path = [x];
      function iterate() {
        if (objective(x + step) > objective(x)) x += step;
        else if (objective(x - step) > objective(x)) x -= step;
        else step /= 2;
        path.push(x);
        output.textContent = `当前位置 x=${x.toFixed(3)}；目标函数=${objective(x).toFixed(3)}；步长=${step.toFixed(3)}。`;
        draw(x);
        if (step > 0.012) window.setTimeout(iterate, 120);
        else {
          output.textContent += "\n收敛到 x≈2。真实结构估计还必须检查多组初值、边界和收敛诊断。";
          button.disabled = false;
        }
      }
      iterate();
    });
    draw(null);
  }

  function initCoinMle() {
    const input = document.getElementById("mle-p");
    if (!input) return;
    const output = document.getElementById("mle-output");
    const chart = canvasContext("mle-canvas");
    const likelihood = (p) => p ** 7 * (1 - p) ** 3;
    const maximum = likelihood(0.7);
    function update() {
      const p = Number(input.value);
      document.getElementById("mle-p-value").textContent = p.toFixed(2);
      output.textContent = `候选 p=${p.toFixed(2)}；似然核=${likelihood(p).toExponential(3)}；相对最大似然=${(100 * likelihood(p) / maximum).toFixed(1)}%。`;
      if (!chart) return;
      const { canvas, context } = chart;
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      drawAxes(context, width, height, "正面概率 p", "相对似然");
      const x = (value) => 48 + value * (width - 64);
      const y = (value) => height - 34 - value * (height - 58);
      context.strokeStyle = "#326b91";
      context.lineWidth = 2;
      context.beginPath();
      for (let index = 1; index < 199; index += 1) {
        const candidate = index / 200;
        const pointY = y(likelihood(candidate) / maximum);
        if (index === 1) context.moveTo(x(candidate), pointY);
        else context.lineTo(x(candidate), pointY);
      }
      context.stroke();
      context.fillStyle = "#b85f32";
      context.beginPath();
      context.arc(x(p), y(likelihood(p) / maximum), 7, 0, Math.PI * 2);
      context.fill();
    }
    input.addEventListener("input", update);
    document.getElementById("mle-auto").addEventListener("click", () => {
      input.value = "0.70";
      update();
    });
    update();
  }

  function initSmmLab() {
    const rhoInput = document.getElementById("smm-rho");
    if (!rhoInput) return;
    const sigmaInput = document.getElementById("smm-sigma");
    const output = document.getElementById("smm-output");
    const observed = simulateAr1(0.78, 0.28, 901, 500).slice(100);
    const observedMoments = seriesMoments(observed);

    function distance(rho, sigma) {
      const simulated = simulateAr1(rho, sigma, 44, 500).slice(100);
      const moments = seriesMoments(simulated);
      const sdGap = (moments.sd - observedMoments.sd) / observedMoments.sd;
      const acGap = (moments.ac - observedMoments.ac) / Math.abs(observedMoments.ac);
      return { value: sdGap ** 2 + acGap ** 2, moments, simulated };
    }

    function update() {
      const rho = Number(rhoInput.value);
      const sigma = Number(sigmaInput.value);
      document.getElementById("smm-rho-value").textContent = rho.toFixed(2);
      document.getElementById("smm-sigma-value").textContent = sigma.toFixed(2);
      const result = distance(rho, sigma);
      output.textContent = `数据矩：SD=${observedMoments.sd.toFixed(3)}, AC(1)=${observedMoments.ac.toFixed(3)}\n模拟矩：SD=${result.moments.sd.toFixed(3)}, AC(1)=${result.moments.ac.toFixed(3)}\n标准化矩距离=${result.value.toFixed(4)}（越小越好）`;
      drawSeries("smm-canvas", result.simulated.slice(-160), "#326b91", observed.slice(-160));
    }

    document.getElementById("smm-search").addEventListener("click", () => {
      let best = { value: Infinity, rho: 0, sigma: 0 };
      for (let rho = 0.4; rho <= 0.96; rho += 0.02) {
        for (let sigma = 0.12; sigma <= 0.5; sigma += 0.02) {
          const candidate = distance(rho, sigma);
          if (candidate.value < best.value) best = { value: candidate.value, rho, sigma };
        }
      }
      rhoInput.value = best.rho.toFixed(2);
      sigmaInput.value = best.sigma.toFixed(2);
      update();
    });
    rhoInput.addEventListener("input", update);
    sigmaInput.addEventListener("input", update);
    update();
  }

  function initMechanizationLab() {
    const alphaInput = document.getElementById("mech-alpha");
    if (!alphaInput) return;
    const betaInput = document.getElementById("mech-beta");
    const subsidyInput = document.getElementById("mech-subsidy");
    const estimateOutput = document.getElementById("mech-estimate-output");
    const policyOutput = document.getElementById("mech-policy-output");
    const chart = canvasContext("mech-canvas");
    const random = seededRandom(20260804);
    const observations = [];
    const trueParameters = { alpha: -1.4, beta: 0.75 };

    for (let index = 0; index < 700; index += 1) {
      const listedPrice = 0.8 + random();
      const voucher = random() < 0.5 ? 0.3 : 0;
      const netPrice = listedPrice * (1 - voucher);
      const land = 0.3 + 2.7 * random();
      const logLand = Math.log(1 + land);
      const distance = 0.5 + 6 * random();
      const quality = 0.3 + 0.7 * random();
      const indexValue = -0.8 + trueParameters.alpha * netPrice + trueParameters.beta * logLand - 0.18 * distance + 0.9 * quality;
      const probability = logistic(indexValue);
      observations.push({ listedPrice, netPrice, voucher, land, logLand, distance, quality, adopt: random() < probability ? 1 : 0 });
    }

    function choiceProbability(observation, alpha, beta, subsidy) {
      const price = subsidy === undefined ? observation.netPrice : observation.listedPrice * (1 - subsidy);
      return logistic(-0.8 + alpha * price + beta * observation.logLand - 0.18 * observation.distance + 0.9 * observation.quality);
    }

    function logLikelihood(alpha, beta) {
      return observations.reduce((sum, observation) => {
        const probability = Math.min(Math.max(choiceProbability(observation, alpha, beta), 1e-10), 1 - 1e-10);
        return sum + (observation.adopt ? Math.log(probability) : Math.log(1 - probability));
      }, 0);
    }

    function policyStats(alpha, beta, subsidy) {
      let baseline = 0;
      let counterfactual = 0;
      let cost = 0;
      observations.forEach((observation) => {
        const baseProbability = choiceProbability(observation, alpha, beta, 0);
        const policyProbability = choiceProbability(observation, alpha, beta, subsidy);
        baseline += baseProbability;
        counterfactual += policyProbability;
        cost += policyProbability * observation.listedPrice * subsidy;
      });
      return {
        baseline: baseline / observations.length,
        counterfactual: counterfactual / observations.length,
        cost: cost / observations.length
      };
    }

    function drawPolicy(alpha, beta, currentSubsidy) {
      if (!chart) return;
      const { canvas, context } = chart;
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      drawAxes(context, width, height, "补贴率", "预测采纳率");
      const x = (value) => 48 + (value / 0.5) * (width - 64);
      const y = (value) => height - 34 - value * (height - 58);
      context.strokeStyle = "#326b91";
      context.lineWidth = 2.5;
      context.beginPath();
      for (let index = 0; index <= 50; index += 1) {
        const subsidy = index / 100;
        const adoption = policyStats(alpha, beta, subsidy).counterfactual;
        if (index === 0) context.moveTo(x(subsidy), y(adoption));
        else context.lineTo(x(subsidy), y(adoption));
      }
      context.stroke();
      const current = policyStats(alpha, beta, currentSubsidy).counterfactual;
      context.fillStyle = "#b85f32";
      context.beginPath();
      context.arc(x(currentSubsidy), y(current), 7, 0, Math.PI * 2);
      context.fill();
    }

    function update() {
      const alpha = Number(alphaInput.value);
      const beta = Number(betaInput.value);
      const subsidy = Number(subsidyInput.value);
      document.getElementById("mech-alpha-value").textContent = alpha.toFixed(2);
      document.getElementById("mech-beta-value").textContent = beta.toFixed(2);
      document.getElementById("mech-subsidy-value").textContent = `${Math.round(100 * subsidy)}%`;
      estimateOutput.textContent = `当前参数：价格系数 α=${alpha.toFixed(2)}，规模系数 β=${beta.toFixed(2)}；对数似然=${logLikelihood(alpha, beta).toFixed(1)}。\n教学数据真值：α*=-1.40，β*=0.75；估计值不会与真值完全相等，因为存在抽样误差。`;
      const stats = policyStats(alpha, beta, subsidy);
      policyOutput.textContent = `无补贴预测采纳率 ${(100 * stats.baseline).toFixed(1)}%\n补贴后预测采纳率 ${(100 * stats.counterfactual).toFixed(1)}%\n变化 ${((stats.counterfactual - stats.baseline) * 100).toFixed(1)} 个百分点；每户预期财政成本 ${stats.cost.toFixed(3)} 个价格单位。`;
      drawPolicy(alpha, beta, subsidy);
    }

    document.getElementById("mech-estimate").addEventListener("click", (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      let alpha = -0.4;
      let beta = 0.1;
      let alphaStep = 0.6;
      let betaStep = 0.45;
      let iteration = 0;
      function iterate() {
        iteration += 1;
        let improved = false;
        [[alphaStep, 0], [-alphaStep, 0], [0, betaStep], [0, -betaStep]].forEach(([alphaMove, betaMove]) => {
          if (logLikelihood(alpha + alphaMove, beta + betaMove) > logLikelihood(alpha, beta)) {
            alpha += alphaMove;
            beta += betaMove;
            improved = true;
          }
        });
        if (!improved) {
          alphaStep /= 2;
          betaStep /= 2;
        }
        alphaInput.value = alpha.toFixed(2);
        betaInput.value = beta.toFixed(2);
        update();
        if (Math.max(alphaStep, betaStep) > 0.008 && iteration < 100) window.setTimeout(iterate, 70);
        else button.disabled = false;
      }
      iterate();
    });

    alphaInput.addEventListener("input", update);
    betaInput.addEventListener("input", update);
    subsidyInput.addEventListener("input", update);
    update();
  }

  const QUIZ = [
    {
      q: "什么时候最值得考虑结构模型？",
      options: ["只想描述样本均值", "需要预测未实施政策并刻画行为反应", "只想提高显著性", "数据越少越适合"],
      answer: 1,
      why: "结构模型的主要收益是把行为约束写清，并在明确假设下做政策外推；它不是显著性工具。"
    },
    {
      q: "“偏好参数在政策变化后保持不变”应被怎样理解？",
      options: ["永远成立的定理", "结构估计自动保证", "需要论证和检验的稳定性假设", "只与样本量有关"],
      answer: 2,
      why: "所谓深层参数的政策稳定性是一项实质假设，不是贴上 structural 标签后自动获得。"
    },
    {
      q: "矩条件 E[z·u]=0 的准确直觉是什么？",
      options: ["z 与 u 的样本均值都为零", "在真参数下，工具变量与结构误差正交", "回归 R² 等于零", "所有变量相互独立"],
      answer: 1,
      why: "正交是乘积的期望为零；它通常来自经济假设或实验设计，并不等同于所有变量独立。"
    },
    {
      q: "AR(1) 中 ε_t~N(0,σ²)，σ 表示什么？",
      options: ["冲击的标准差", "冲击的方差", "自相关系数", "长期均值"],
      answer: 0,
      why: "写作 N(0,σ²) 时，σ 是标准差；ρ 与 σ 都会影响平稳分布的长期波动。"
    },
    {
      q: "SMM 与 GMM 的关系最准确的是？",
      options: ["完全无关", "SMM 用模拟近似模型矩，可看作模拟版矩估计", "SMM 一定比 GMM 准", "GMM 不需要识别"],
      answer: 1,
      why: "SMM 用模拟得到模型矩，再最小化模型矩与数据矩的距离；仍需选择矩、权重矩阵并论证识别。"
    },
    {
      q: "如果价格由服务商根据不可观测需求定价，直接 logit MLE 的价格系数会怎样？",
      options: ["必然正确", "可能因价格内生性而有偏", "自动成为工具变量", "只影响标准误"],
      answer: 1,
      why: "价格与未观测需求/质量相关时需要实验价格变化、工具变量或供需联合模型。"
    },
    {
      q: "结构模型的样本外验证为什么重要？",
      options: ["让表格更长", "检验模型能否预测估计时未使用的事实或政策冲击", "替代识别", "保证反事实一定正确"],
      answer: 1,
      why: "验证不能证明模型为真，但能发现模型无法解释的事实，约束反事实可信度。"
    },
    {
      q: "Todd–Wolpin 的 PROGRESA 案例最值得学习的设计是什么？",
      options: ["只报告拟合优度", "用实验政策效果验证未使用政策后数据估计的动态模型", "完全不使用数据", "只做静态 OLS"],
      answer: 1,
      why: "该研究把随机实验作为模型验证标尺，再比较不同补贴方案，是结构与设计型证据结合的经典例子。"
    },
    {
      q: "反事实补贴模拟最需要同时报告什么？",
      options: ["只有一个点估计", "参数与模型不确定性、适用范围及供给反应限制", "只报告显著星号", "删除不合预期结果"],
      answer: 1,
      why: "反事实依赖参数、函数形式、均衡与外推区间；敏感性和限制是结果的一部分。"
    },
    {
      q: "开始自己的第一个结构项目，最稳妥的顺序是？",
      options: ["先做最大模型", "先写反事实结论", "小模型→模拟回收真值→真实数据→拟合/验证→反事实", "跳过识别直接优化"],
      answer: 2,
      why: "先用小模型和蒙特卡洛确认代码与识别，再进入真实数据和政策模拟，最容易定位错误。"
    }
  ];

  function initQuiz() {
    const container = document.getElementById("course-quiz");
    if (!container) return;
    const saved = readStore(QUIZ_KEY);
    const score = document.getElementById("quiz-score");

    QUIZ.forEach((item, questionIndex) => {
      const article = document.createElement("article");
      article.className = "quiz-item";
      const question = document.createElement("p");
      question.className = "quiz-question";
      question.textContent = `${questionIndex + 1}. ${item.q}`;
      article.appendChild(question);
      const options = document.createElement("div");
      options.className = "quiz-options";
      const feedback = document.createElement("p");
      feedback.className = "quiz-feedback";
      feedback.setAttribute("aria-live", "polite");

      item.options.forEach((option, optionIndex) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "quiz-option";
        button.textContent = `${String.fromCharCode(65 + optionIndex)}. ${option}`;
        button.addEventListener("click", () => {
          if (saved[questionIndex] !== undefined) return;
          saved[questionIndex] = optionIndex;
          writeStore(QUIZ_KEY, saved);
          renderQuestion();
          updateScore();
        });
        options.appendChild(button);
      });

      function renderQuestion() {
        const answer = saved[questionIndex];
        const buttons = options.querySelectorAll("button");
        if (answer === undefined) {
          feedback.textContent = "";
          return;
        }
        buttons.forEach((button, optionIndex) => {
          button.disabled = true;
          if (optionIndex === item.answer) button.classList.add("correct");
          if (optionIndex === answer && answer !== item.answer) button.classList.add("wrong");
        });
        feedback.textContent = `${answer === item.answer ? "答对了。" : "答案需要再想一想。"}${item.why}`;
      }

      article.appendChild(options);
      article.appendChild(feedback);
      container.appendChild(article);
      renderQuestion();
    });

    function updateScore() {
      const answered = Object.keys(saved).length;
      const correct = QUIZ.reduce((sum, item, index) => sum + (saved[index] === item.answer ? 1 : 0), 0);
      score.textContent = `已答 ${answered} / ${QUIZ.length} 题；答对 ${correct} 题。${answered === QUIZ.length ? (correct >= 8 ? " 已达到入门验收线。" : " 建议回看错题对应模块。") : ""}`;
    }

    const reset = document.getElementById("quiz-reset");
    if (reset) {
      reset.addEventListener("click", () => {
        writeStore(QUIZ_KEY, {});
        window.location.reload();
      });
    }
    updateScore();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initProgress();
    initMethodGuide();
    initCoinLab();
    initAr1Lab();
    initHillLab();
    initCoinMle();
    initSmmLab();
    initMechanizationLab();
    initQuiz();
  });
})();
