import type { AiIssue } from "../types";

export interface ReviewExportMeta {
  orderCode?: string;
  productModel?: string;
  market?: string;
  customer?: string;
  brand?: string;
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function esc(s: string): string {
  return (s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function metaRows(meta: ReviewExportMeta): string {
  const rows: [string, string | undefined][] = [
    ["订单号", meta.orderCode],
    ["产品型号", meta.productModel],
    ["目标市场", meta.market],
    ["客户", meta.customer],
    ["品牌", meta.brand],
  ];
  return rows
    .filter((r) => r[1])
    .map((r) => `<tr><th style="text-align:left;width:120px">${esc(r[0])}</th><td>${esc(r[1] as string)}</td></tr>`)
    .join("");
}

function attachRows(issue: AiIssue): string {
  if (!issue.attachments?.length) return "<li>无附件</li>";
  return issue.attachments
    .map((a) => `<li>${esc(a.name)} ${a.uploadedBy ? `（${esc(a.uploadedBy)}）` : ""}</li>`)
    .join("");
}

/** 导出为 Word（.doc，HTML 兼容） */
export function exportReviewToWord(issues: AiIssue[], meta: ReviewExportMeta) {
  const body = issues
    .map(
      (it, i) => `
    <h3>问题 ${i + 1}：${esc(it.location)} <span style="color:#cf1322">[${esc(it.severity)}]</span></h3>
    <p><b>建议：</b>${esc(it.suggestion)}</p>
    <p><b>标注附件：</b></p>
    <ul>${attachRows(it)}</ul>
  `
    )
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8"><title>AI 审核结果</title></head>
  <body style="font-family: 'Microsoft YaHei', SimSun, sans-serif;">
    <h1>包装 AI 审核结果</h1>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">${metaRows(meta)}</table>
    <p>共 ${issues.length} 项问题</p>
    ${body}
  </body></html>`;
  downloadText(`AI审核结果_${meta.orderCode || "订单"}.doc`, html, "application/msword");
}

/** 导出为 Excel（.xls，HTML 表格兼容） */
export function exportReviewToExcel(issues: AiIssue[], meta: ReviewExportMeta) {
  const header = `<tr>
    <th>序号</th><th>问题位置</th><th>严重度</th><th>来源</th>
    <th>建议</th><th>标注附件</th><th>订单号</th><th>产品型号</th><th>目标市场</th></tr>`;
  const rows = issues
    .map(
      (it, i) => `<tr>
      <td>${i + 1}</td>
      <td>${esc(it.location)}</td>
      <td>${esc(it.severity)}</td>
      <td>${esc(it.source ?? "")}</td>
      <td>${esc(it.suggestion)}</td>
      <td>${(it.attachments ?? []).map((a) => esc(a.name)).join("、")}</td>
      <td>${esc(meta.orderCode ?? "")}</td>
      <td>${esc(meta.productModel ?? "")}</td>
      <td>${esc(meta.market ?? "")}</td>
    </tr>`
    )
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8"></head>
  <body><table border="1" cellpadding="4" cellspacing="0">${header}${rows}</table></body></html>`;
  downloadText(`AI审核结果_${meta.orderCode || "订单"}.xls`, html, "application/vnd.ms-excel");
}
