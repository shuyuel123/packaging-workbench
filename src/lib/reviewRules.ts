import type { AiIssue, Order, ProductSpec, Regulation } from "../types";

/** 制冷类型关键词对：参数卡中文标注 ↔ 印刷件外文表述 */
const COOLING = {
  single: ["单冷", "COOLING ONLY", "COOL ONLY", "制冷"],
  heat: ["冷暖", "HEAT PUMP", "制热", "冷暖型"],
};
/** 频率类型关键词对 */
const FREQ = {
  fixed: ["定频", "FIXED", "FIXED SPEED"],
  inverter: ["变频", "INVERTER", "VARIABLE SPEED", "VARIABLE"],
};
/** 常见冷媒型号 */
const REFRIGERANTS = ["R32", "R410A", "R410", "R290", "R600A", "R134A", "R134", "R22", "R407C", "R404A"];

function has(text: string, kws: string[]): boolean {
  const t = text.toUpperCase();
  return kws.some((k) => t.includes(k.toUpperCase()));
}

export interface RuleCheckInput {
  order: Order;
  regulation?: Regulation | null;
  /** 用户粘贴的印刷件关键文字 */
  printedText: string;
  spec?: ProductSpec | null;
}

/**
 * AI 审核第一步：纯前端 JS 规则快检（免费、即时）。
 * 将印刷件文字与「产品基准参数卡」「目标市场法规」做关键词 / 数值比对，
 * 返回可直接高亮展示的问题清单（severity: error 标红，warn 提示）。
 */
export function runRuleCheck(input: RuleCheckInput): AiIssue[] {
  const { regulation, printedText, spec } = input;
  const text = (printedText || "").trim();
  const issues: AiIssue[] = [];

  if (!text) {
    issues.push({
      type: "content",
      location: "印刷件文字",
      suggestion: "未粘贴印刷件关键文字，仅执行参数卡内部校验。建议粘贴印刷稿文字以比对认证标志与警示语。",
      severity: "warn",
    });
  }

  // 1) 制冷类型比对
  if (spec?.coolingType && text) {
    const ct = spec.coolingType;
    const isHeat = has(text, COOLING.heat);
    const isSingle = has(text, COOLING.single);
    if (ct.includes("冷暖") && isSingle && !isHeat) {
      issues.push({
        type: "param",
        location: "制冷类型",
        suggestion: `参数卡标注「${ct}」，但印刷文字仅出现单冷表述，请核对制冷类型标注。`,
        severity: "error",
      });
    } else if (ct.includes("单冷") && isHeat && !isSingle) {
      issues.push({
        type: "param",
        location: "制冷类型",
        suggestion: `参数卡标注「${ct}」，但印刷文字出现冷暖 / HEAT PUMP 表述，请核对。`,
        severity: "error",
      });
    }
  }

  // 2) 频率类型比对
  if (spec?.frequency && text) {
    const fq = spec.frequency;
    const isInv = has(text, FREQ.inverter);
    const isFixed = has(text, FREQ.fixed);
    if (fq.includes("变频") && isFixed && !isInv) {
      issues.push({
        type: "param",
        location: "频率类型",
        suggestion: `参数卡标注「${fq}」，但印刷文字仅出现定频表述，请核对。`,
        severity: "error",
      });
    } else if (fq.includes("定频") && isInv && !isFixed) {
      issues.push({
        type: "param",
        location: "频率类型",
        suggestion: `参数卡标注「${fq}」，但印刷文字出现变频 / INVERTER 表述，请核对。`,
        severity: "error",
      });
    }
  }

  // 3) 电压数值比对
  const baseV = spec?.voltage ? parseFloat(String(spec.voltage).replace(/[^\d.]/g, "")) : NaN;
  if (spec?.voltage) {
    if (Number.isNaN(baseV)) {
      issues.push({
        type: "param",
        location: "电压",
        suggestion: `参数卡电压值「${spec.voltage}」无法解析为数字，请填写如 220V / 120V。`,
        severity: "error",
      });
    } else if (text) {
      const nums = text.match(/\d+(?:\.\d+)?\s*(?:V|伏|VAC|KV)/gi);
      if (nums) {
        const found = nums.map((n) => parseFloat(n.replace(/[^\d.]/g, "")));
        const ok = found.some((v) => Math.abs(v - baseV) <= Math.max(5, baseV * 0.05));
        if (!ok) {
          issues.push({
            type: "param",
            location: "电压",
            suggestion: `参数卡电压 ${spec.voltage}，但印刷文字中未检出匹配电压值（检出 ${found.join("/")} V），请核对电压标注。`,
            severity: "error",
          });
        }
      } else {
        issues.push({
          type: "param",
          location: "电压",
          suggestion: `参数卡电压 ${spec.voltage}，但印刷文字中未检出电压数值，请确认是否标注。`,
          severity: "warn",
        });
      }
    }
  }

  // 4) 冷媒型号检测
  if (spec?.refrigerant) {
    if (text && !has(text, [spec.refrigerant, ...REFRIGERANTS])) {
      issues.push({
        type: "param",
        location: "冷媒",
        suggestion: `参数卡标注冷媒「${spec.refrigerant}」，但印刷文字中未检出该冷媒型号，请核对冷媒标注。`,
        severity: "warn",
      });
    }
  } else if (text) {
    const found = REFRIGERANTS.filter((r) => has(text, [r]));
    if (found.length) {
      issues.push({
        type: "content",
        location: "冷媒",
        suggestion: `印刷文字检出冷媒型号：${found.join("、")}。如基准参数卡未登记，请补全以便后续比对。`,
        severity: "warn",
      });
    }
  }

  // 5) 强制认证标志
  if (regulation?.certMarks?.length && text) {
    for (const mark of regulation.certMarks) {
      if (!text.toUpperCase().includes(mark.toUpperCase())) {
        issues.push({
          type: "regulation",
          location: "认证标志",
          suggestion: `目标市场要求认证标志「${mark}」未在印刷文字中检出，请确认已正确印刷。`,
          severity: "error",
        });
      }
    }
  }

  // 6) 安全警示语
  if (regulation?.warnings?.length && text) {
    const generic = ["警告", "WARNING", "警示", "注意", "NOTICE"];
    for (const w of regulation.warnings) {
      const kw = w.replace(/[（(].*$/, "").slice(0, 6);
      if (kw && !text.includes(kw) && !has(text, generic)) {
        issues.push({
          type: "regulation",
          location: "安全警示语",
          suggestion: `目标市场要求警示语「${w}」，建议在印刷稿显著位置补充。`,
          severity: "warn",
        });
      }
    }
  }

  if (!issues.length) {
    issues.push({
      type: "content",
      location: "规则校验",
      suggestion: "JS 规则快检通过：制冷 / 频率 / 电压 / 冷媒 / 认证标志 / 警示语均未见明显冲突。",
      severity: "warn",
    });
  }
  return issues;
}
