(function () {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function canvasContext(id) {
    const canvas = byId(id);
    if (!canvas) return null;
    return { canvas, context: canvas.getContext("2d") };
  }

  function drawFrame(context, width, height, xLabel, yLabel) {
    context.strokeStyle = "#cfd8d1";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(50, 18);
    context.lineTo(50, height - 38);
    context.lineTo(width - 18, height - 38);
    context.stroke();
    context.fillStyle = "#617067";
    context.font = "13px system-ui, sans-serif";
    context.fillText(xLabel, width - 100, height - 12);
    context.fillText(yLabel, 8, 20);
  }

  function initIiaLab() {
    const utilityInput = byId("iia-utility");
    if (!utilityInput) return;
    const duplicateInput = byId("iia-duplicate");
    const output = byId("iia-output");
    const chart = canvasContext("iia-canvas");

    function shares(utility, duplicate) {
      const serviceWeight = Math.exp(utility);
      const denominator = 1 + serviceWeight * (duplicate ? 2 : 1);
      return {
        self: 1 / denominator,
        a: serviceWeight / denominator,
        b: duplicate ? serviceWeight / denominator : 0
      };
    }

    function draw(values, duplicate) {
      if (!chart) return;
      const { canvas, context } = chart;
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      drawFrame(context, width, height, "选择", "份额");
      const items = [
        { label: "自营", value: values.self, color: "#8a948e" },
        { label: "服务 A", value: values.a, color: "#326b91" },
        { label: "服务 B", value: values.b, color: "#b85f32" }
      ];
      const plotHeight = height - 70;
      items.forEach((item, index) => {
        const x = 105 + index * 190;
        const barHeight = item.value * plotHeight;
        context.fillStyle = item.color;
        context.fillRect(x, height - 38 - barHeight, 74, barHeight);
        context.fillStyle = "#202923";
        context.font = "14px system-ui, sans-serif";
        context.fillText(item.label, x, height - 16);
        context.fillText(`${(100 * item.value).toFixed(1)}%`, x + 10, height - 48 - barHeight);
      });
      if (!duplicate) {
        context.fillStyle = "#617067";
        context.fillText("尚无 B", 492, height - 48);
      }
    }

    function update() {
      const utility = Number(utilityInput.value);
      const duplicate = duplicateInput.checked;
      const one = shares(utility, false);
      const two = shares(utility, true);
      const current = duplicate ? two : one;
      byId("iia-utility-value").textContent = utility.toFixed(2);
      output.textContent = duplicate
        ? `复制出一个可见属性完全相同的服务 B 后，简单 logit 预测总购买率从 ${(100 * one.a).toFixed(1)}% 升到 ${(100 * (two.a + two.b)).toFixed(1)}%。\nA 与 B 平分原本的吸引力，但它们还从“自营”抢走了额外份额。这就是 IIA 的机械替代限制。`
        : `只有一个服务商时，预测购买率为 ${(100 * one.a).toFixed(1)}%，自营率为 ${(100 * one.self).toFixed(1)}%。勾选复制选项，观察简单 logit 如何处理一个近乎相同的选择。`;
      draw(current, duplicate);
    }

    utilityInput.addEventListener("input", update);
    duplicateInput.addEventListener("change", update);
    update();
  }

  function initDynamicLab() {
    const betaInput = byId("dynamic-beta");
    if (!betaInput) return;
    const benefitInput = byId("dynamic-benefit");
    const costInput = byId("dynamic-cost");
    const output = byId("dynamic-output");
    const chart = canvasContext("dynamic-canvas");

    function lifetimeValue(beta, benefit, cost) {
      return benefit / (1 - beta) - cost;
    }

    function draw(beta, benefit, cost) {
      if (!chart) return;
      const { canvas, context } = chart;
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      drawFrame(context, width, height, "折现因子 β", "采用净价值");
      const left = 0.05;
      const right = 0.97;
      const values = [];
      for (let index = 0; index <= 100; index += 1) {
        const candidate = left + ((right - left) * index) / 100;
        values.push(lifetimeValue(candidate, benefit, cost));
      }
      const lower = Math.min(-2, ...values);
      const upper = Math.max(2, ...values);
      const span = upper - lower;
      const x = (value) => 50 + ((value - left) / (right - left)) * (width - 68);
      const y = (value) => height - 38 - ((value - lower) / span) * (height - 64);
      context.strokeStyle = "#c8a38e";
      context.setLineDash([6, 5]);
      context.beginPath();
      context.moveTo(50, y(0));
      context.lineTo(width - 18, y(0));
      context.stroke();
      context.setLineDash([]);
      context.strokeStyle = "#326b91";
      context.lineWidth = 2.4;
      context.beginPath();
      values.forEach((value, index) => {
        const candidate = left + ((right - left) * index) / 100;
        if (index === 0) context.moveTo(x(candidate), y(value));
        else context.lineTo(x(candidate), y(value));
      });
      context.stroke();
      const current = lifetimeValue(beta, benefit, cost);
      context.fillStyle = "#b85f32";
      context.beginPath();
      context.arc(x(beta), y(current), 7, 0, Math.PI * 2);
      context.fill();
    }

    function update() {
      const beta = Number(betaInput.value);
      const benefit = Number(benefitInput.value);
      const cost = Number(costInput.value);
      const myopic = benefit - cost;
      const dynamic = lifetimeValue(beta, benefit, cost);
      byId("dynamic-beta-value").textContent = beta.toFixed(2);
      byId("dynamic-benefit-value").textContent = benefit.toFixed(1);
      byId("dynamic-cost-value").textContent = cost.toFixed(1);
      output.textContent = `只看本期：收益−成本 = ${myopic.toFixed(2)}，${myopic >= 0 ? "会采用" : "不会采用"}。\n看见未来：收益现值−一次性成本 = ${dynamic.toFixed(2)}，${dynamic >= 0 ? "会采用" : "不会采用"}。\n这里假定技术一旦采用就永久获得同样收益；真实模型还要写明状态转移、冲击和退出。`;
      draw(beta, benefit, cost);
    }

    [betaInput, benefitInput, costInput].forEach((input) => input.addEventListener("input", update));
    update();
  }

  function initEntryLab() {
    const demandInput = byId("entry-demand");
    if (!demandInput) return;
    const costInput = byId("entry-cost");
    const competitionInput = byId("entry-competition");
    const output = byId("entry-output");
    const cells = {
      oo: byId("entry-oo"),
      eo: byId("entry-eo"),
      oe: byId("entry-oe"),
      ee: byId("entry-ee")
    };

    function update() {
      const demand = Number(demandInput.value);
      const cost = Number(costInput.value);
      const competition = Number(competitionInput.value);
      const monopoly = demand - cost;
      const duopoly = demand - cost - competition;
      byId("entry-demand-value").textContent = demand.toFixed(1);
      byId("entry-cost-value").textContent = cost.toFixed(1);
      byId("entry-competition-value").textContent = competition.toFixed(1);
      cells.oo.querySelector("span").textContent = "(0.0, 0.0)";
      cells.eo.querySelector("span").textContent = `(${monopoly.toFixed(1)}, 0.0)`;
      cells.oe.querySelector("span").textContent = `(0.0, ${monopoly.toFixed(1)})`;
      cells.ee.querySelector("span").textContent = `(${duopoly.toFixed(1)}, ${duopoly.toFixed(1)})`;
      Object.values(cells).forEach((cell) => cell.classList.remove("is-equilibrium"));
      const equilibria = [];
      if (monopoly <= 0) {
        cells.oo.classList.add("is-equilibrium");
        equilibria.push("两家都不进入");
      }
      if (duopoly >= 0) {
        cells.ee.classList.add("is-equilibrium");
        equilibria.push("两家都进入");
      }
      if (monopoly >= 0 && duopoly <= 0) {
        cells.eo.classList.add("is-equilibrium");
        cells.oe.classList.add("is-equilibrium");
        equilibria.push("只有 A 进入", "只有 B 进入");
      }
      output.textContent = `独家进入利润 = ${monopoly.toFixed(1)}；两家都进入时每家利润 = ${duopoly.toFixed(1)}。\n纳什均衡：${equilibria.join("；")}。${equilibria.length > 1 ? " 数据只看到一种结果时，模型还需要均衡选择规则，或改用允许集合识别的方法。" : " 当前参数下，最佳反应给出唯一纯策略结果。"}`;
    }

    [demandInput, costInput, competitionInput].forEach((input) => input.addEventListener("input", update));
    update();
  }

  function initMteLab() {
    const baselineInput = byId("mte-baseline");
    if (!baselineInput) return;
    const policyInput = byId("mte-policy");
    const output = byId("mte-output");
    const chart = canvasContext("mte-canvas");
    const effect = (u) => 4 - 6 * u;

    function draw(baseline, policy) {
      if (!chart) return;
      const { canvas, context } = chart;
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      drawFrame(context, width, height, "未观测阻力 U", "MTE(U)");
      const x = (value) => 50 + value * (width - 68);
      const y = (value) => height - 38 - ((value + 2.5) / 7) * (height - 64);
      const lower = Math.min(baseline, policy);
      const upper = Math.max(baseline, policy);
      context.fillStyle = "rgba(50, 107, 145, 0.14)";
      context.fillRect(x(lower), 18, x(upper) - x(lower), height - 56);
      context.strokeStyle = "#c8a38e";
      context.setLineDash([6, 5]);
      context.beginPath();
      context.moveTo(50, y(0));
      context.lineTo(width - 18, y(0));
      context.stroke();
      context.setLineDash([]);
      context.strokeStyle = "#326b91";
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(x(0), y(effect(0)));
      context.lineTo(x(1), y(effect(1)));
      context.stroke();
      [
        { value: baseline, color: "#617067", label: "基准" },
        { value: policy, color: "#b85f32", label: "新政策" }
      ].forEach((marker) => {
        context.strokeStyle = marker.color;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x(marker.value), 18);
        context.lineTo(x(marker.value), height - 38);
        context.stroke();
        context.fillStyle = marker.color;
        context.font = "12px system-ui, sans-serif";
        context.fillText(marker.label, x(marker.value) + 4, 32);
      });
    }

    function update() {
      const baseline = Number(baselineInput.value);
      const policy = Number(policyInput.value);
      const lower = Math.min(baseline, policy);
      const upper = Math.max(baseline, policy);
      const policyAverage = upper === lower ? effect(lower) : 4 - 3 * (lower + upper);
      const baselineAverage = 4 - 3 * baseline;
      byId("mte-baseline-value").textContent = baseline.toFixed(2);
      byId("mte-policy-value").textContent = policy.toFixed(2);
      const group = policy >= baseline ? "被新政策推入项目的人" : "因政策收缩而退出的人";
      output.textContent = `基准参与阈值 p₀=${baseline.toFixed(2)}；新政策阈值 p₁=${policy.toFixed(2)}。\n${group}位于 U∈[${lower.toFixed(2)}, ${upper.toFixed(2)}]，这一区间的平均边际处理效应为 ${policyAverage.toFixed(2)}。\n原参与者的平均效应为 ${baselineAverage.toFixed(2)}，全体 ATE 为 1.00。三者不同，说明“一个处理效应”不能代表所有政策。`;
      draw(baseline, policy);
    }

    [baselineInput, policyInput].forEach((input) => input.addEventListener("input", update));
    update();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initIiaLab();
    initDynamicLab();
    initEntryLab();
    initMteLab();
  });
})();
