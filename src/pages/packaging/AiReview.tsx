import { useMemo, useState, useEffect } from "react";
import {
  Card,
  Select,
  Button,
  Space,
  Tag,
  Checkbox,
  Alert,
  Empty,
  Divider,
  Input,
  message,
} from "antd";
import { RobotOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useWorkbench } from "../../state/WorkbenchContext";
import { PermissionGate } from "../../components/PermissionGate";
import { AiReviewPanel } from "../../components/AiReviewPanel";
import { getAIService, regLibToRegulation, generateAnnotations } from "../../services/aiService";
import { runRuleCheck } from "../../lib/reviewRules";
import { MARKET_LABEL, type AiReviewResult, type AiIssue, type AiDeepResult } from "../../types";
import { MARKET_COLOR } from "../../lib/ui";
import { getFilePreviewURL, getFileBlob } from "../../utils/storageService";

/** AI 审核工作台：选订单 + 法规库 + 品牌资料 + 多图对比，支持两步审核 */
export function AiReview() {
  const wb = useWorkbench();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [regLibId, setRegLibId] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);
  const [printedText, setPrintedText] = useState("");
  const [imgLoading, setImgLoading] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [result, setResult] = useState<AiReviewResult | null>(null);
  const [deep, setDeep] = useState<AiDeepResult | null>(null);
  const [, setRuleRan] = useState(false);

  // 统一以订单的 aiResult.issues 为数据源，按 source 分块展示
  const [issues, setIssues] = useState<AiIssue[]>([]);

  const order = wb.orders.find((o) => o.id === orderId) ?? null;
  const customer = order ? wb.customers.find((c) => c.id === order.customerId) : null;
  const imageFiles = useMemo(
    () => (order ? order.files.filter((f) => f.type.startsWith("image/")) : []),
    [order]
  );
  // 从 IndexedDB 解析图片预览 URL（文件本体不再内联 dataUrl）
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    Promise.all(imageFiles.map(async (f) => ({ id: f.id, url: await getFilePreviewURL(f.id) })))
      .then((entries) => {
        if (!alive) return;
        const map: Record<string, string> = {};
        entries.forEach((e) => {
          if (e.url) map[e.id] = e.url;
        });
        setImgUrls(map);
      });
    return () => {
      alive = false;
      Object.values(imgUrls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [imageFiles]);
  const autoRegLib = order ? wb.regLibs.find((l) => l.region === order.targetMarket) ?? null : null;
  const regLib = regLibId ? wb.regLibs.find((l) => l.id === regLibId) ?? null : autoRegLib;
  const reg = regLib ? regLibToRegulation(regLib) : null;
  const autoAsset = order ? wb.brandAssets.find((a) => a.customerId === order.customerId) ?? null : null;
  const asset = assetId ? wb.brandAssets.find((a) => a.id === assetId) ?? null : autoAsset;

  function pickOrder(id: string) {
    const o = wb.orders.find((x) => x.id === id);
    setOrderId(id);
    setRegLibId(null);
    setAssetId(null);
    setImageIds([]);
    setResult(null);
    setDeep(null);
    setRuleRan((o?.aiResult?.issues ?? []).some((i) => i.source === "rule"));
    setIssues(o?.aiResult?.issues ?? []);
  }

  /** 按 source 合并/替换问题，并持久化到订单 */
  function upsert(newOnes: AiIssue[]) {
    const sources = new Set(newOnes.map((n) => n.source));
    const merged = [...issues.filter((p) => !p.source || !sources.has(p.source)), ...newOnes];
    setIssues(merged);
    if (order) {
      wb.updateOrder(order.id, {
        aiResult: { ...(order.aiResult ?? { used: {} }), issues: merged },
      });
    }
  }

  /** 更新某区块（rule/deep/image）内的第 index 个问题 */
  function updateSectionIssue(section: AiIssue["source"], localIndex: number, patch: Partial<AiIssue>) {
    const list = issues.filter((i) => i.source === section);
    const target = list[localIndex];
    if (!target) return;
    const merged = issues.map((it) => (it === target ? { ...it, ...patch } : it));
    setIssues(merged);
    if (order) {
      wb.updateOrder(order.id, {
        aiResult: { ...(order.aiResult ?? { used: {} }), issues: merged },
      });
    }
  }

  /** 第一步：JS 规则快检（免费、即时，同时自动生成 AI 批注附件） */
  async function runRule() {
    if (!order) {
      message.warning("请先选择订单");
      return;
    }
    setRuleRan(true);
    const base = runRuleCheck({ order, regulation: reg, printedText, spec: order.spec ?? null }).map(
      (it) => ({ ...it, source: "rule" as const })
    );
    upsert(await generateAnnotations(order.files, base));
  }

  /** 一键审核：先规则快检（秒出），再串行调用深度 AI（转圈），结果汇总于同一报告 */
  async function runFullReview() {
    if (!order) {
      message.warning("请先选择订单");
      return;
    }
    setRuleRan(true);
    const ruleIssues = await generateAnnotations(
      order.files,
      runRuleCheck({ order, regulation: reg, printedText, spec: order.spec ?? null }).map((it) => ({
        ...it,
        source: "rule" as const,
      }))
    );
    if (!printedText.trim()) {
      message.info("未粘贴印刷件文字，已跳过深度 AI 检查（规则快检结果已生成）");
      upsert(ruleIssues);
      return;
    }
    setDeepLoading(true);
    try {
      const ai = getAIService(
        wb.settings.aiProvider,
        wb.settings.apiKey,
        wb.settings.apiBase,
        wb.settings.aiModel || undefined
      );
      const res = await ai.deepReviewPrint({
        order,
        regulation: reg,
        printedText,
        spec: order.spec ?? null,
      });
      setDeep(res);
      upsert([...ruleIssues, ...res.issues.map((it) => ({ ...it, source: "deep" as const }))]);
    } catch (e) {
      message.error("深度 AI 检查失败：" + (e as Error).message);
    } finally {
      setDeepLoading(false);
    }
  }

  /** 图像 AI 审核 */
  async function runImage() {
    if (!order) {
      message.warning("请先选择订单");
      return;
    }
    setImgLoading(true);
    try {
      const ai = getAIService(
        wb.settings.aiProvider,
        wb.settings.apiKey,
        wb.settings.apiBase,
        wb.settings.aiModel || undefined
      );
      const selected = imageFiles.filter((f) => imageIds.includes(f.id));
      const targets = selected.length ? selected : imageFiles;
      const images = (
        await Promise.all(
          targets.map(async (f) => {
            const blob = await getFileBlob(f.id);
            return blob ? URL.createObjectURL(blob) : f.dataUrl ?? "";
          })
        )
      ).filter(Boolean) as string[];
      const res = await ai.reviewPrintFile({
        order,
        regulation: reg,
        brandAsset: asset,
        images,
        compareImages: compare && images.length >= 2,
      });
      setResult(res);
      upsert(res.issues.map((it) => ({ ...it, source: "image" as const })));
    } catch (e) {
      message.error("审核失败：" + (e as Error).message);
    } finally {
      setImgLoading(false);
    }
  }

  const ruleIssues = issues.filter((i) => i.source === "rule");
  const deepIssues = issues.filter((i) => i.source === "deep");
  const imgIssues = issues.filter((i) => i.source === "image");

  const exportMeta = order
    ? {
        orderCode: order.productModel,
        productModel: order.productModel,
        market: MARKET_LABEL[order.targetMarket],
        customer: customer?.name,
        brand: asset?.brandName ?? customer?.name,
      }
    : {};

  return (
    <div>
      <Card title="AI 审核工作台" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space wrap>
            <Select
              style={{ width: 260 }}
              placeholder="选择订单"
              value={orderId ?? undefined}
              onChange={pickOrder}
              options={wb.orders.map((o) => {
                const c = wb.customers.find((x) => x.id === o.customerId);
                return { value: o.id, label: `${o.productModel} · ${c?.name ?? "—"}` };
              })}
            />
            {order && (
              <>
                <Tag color={MARKET_COLOR[order.targetMarket]}>
                  {MARKET_LABEL[order.targetMarket]}
                </Tag>
                <Tag>{customer?.name ?? "—"}</Tag>
              </>
            )}
          </Space>

          {order && (
            <>
              <Space wrap>
                <span style={{ color: "#595959" }}>法规库：</span>
                <Select
                  style={{ width: 220 }}
                  placeholder="自动匹配目标市场"
                  allowClear
                  value={regLibId ?? undefined}
                  onChange={(v) => setRegLibId(v ?? null)}
                  options={wb.regLibs.map((l) => ({
                    value: l.id,
                    label: `${MARKET_LABEL[l.region as keyof typeof MARKET_LABEL] ?? l.region}（${l.countries.length} 国）`,
                  }))}
                />
                {regLib ? (
                  <Tag color="blue">
                    已选：{MARKET_LABEL[regLib.region as keyof typeof MARKET_LABEL] ?? regLib.region}
                  </Tag>
                ) : (
                  <Tag color="orange">该市场暂无法规库，将按通用规则审核</Tag>
                )}
              </Space>

              <Space wrap>
                <span style={{ color: "#595959" }}>品牌资料：</span>
                <Select
                  style={{ width: 260 }}
                  placeholder="自动关联客户旗下品牌"
                  allowClear
                  value={assetId ?? undefined}
                  onChange={(v) => setAssetId(v ?? null)}
                  options={wb.brandAssets.map((a) => {
                    const c = wb.customers.find((x) => x.id === a.customerId);
                    return {
                      value: a.id,
                      label: `${c?.name ?? "—"}${a.brandName ? " / " + a.brandName : ""}`,
                    };
                  })}
                />
                {asset ? (
                  <Tag color="purple">
                    已关联：{customer?.name ?? "—"}{asset.brandName ? " / " + asset.brandName : ""}
                  </Tag>
                ) : (
                  <Tag>未关联品牌资料</Tag>
                )}
              </Space>

              <div>
                <div style={{ color: "#595959", marginBottom: 8 }}>
                  参与图像审核的图片（不选则默认全部 {imageFiles.length} 张）：
                </div>
                {imageFiles.length ? (
                  <Space wrap>
                    {imageFiles.map((f) => {
                      const checked = imageIds.includes(f.id);
                      return (
                        <div
                          key={f.id}
                          onClick={() =>
                            setImageIds((ids) =>
                              checked ? ids.filter((x) => x !== f.id) : [...ids, f.id]
                            )
                          }
                          style={{
                            width: 88,
                            cursor: "pointer",
                            border: checked ? "2px solid #1677ff" : "1px solid #f0f0f0",
                            borderRadius: 8,
                            padding: 4,
                            textAlign: "center",
                          }}
                        >
                          <img
                            src={imgUrls[f.id] || f.dataUrl}
                            alt={f.name}
                            style={{ width: "100%", height: 60, objectFit: "cover", borderRadius: 4 }}
                          />
                          <div
                            style={{
                              fontSize: 11,
                              color: "#8c8c8c",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {f.name}
                          </div>
                        </div>
                      );
                    })}
                  </Space>
                ) : (
                  <Alert type="info" showIcon message="该订单暂无图片文件，可在订单详情中上传后再做图像审核" />
                )}
              </div>

              <div>
                <div style={{ marginBottom: 6, fontSize: 13, color: "#595959" }}>
                  粘贴印刷件关键文字（用于规则比对与深度 AI 语义分析）：
                </div>
                <Input.TextArea
                  rows={3}
                  value={printedText}
                  placeholder="例如：COOLING ONLY / INVERTER / 220V / R32 / CE ..."
                  onChange={(e) => setPrintedText(e.target.value)}
                />
              </div>

              <Space wrap>
                <Checkbox
                  checked={compare}
                  disabled={imageFiles.length < 2}
                  onChange={(e) => setCompare(e.target.checked)}
                >
                  多图对比（需至少 2 张图片）
                </Checkbox>
                <PermissionGate require="edit" fallback={<Tag>查看者不可执行审核</Tag>}>
                  <Space wrap>
                    <Button
                      type="primary"
                      icon={<RobotOutlined />}
                      loading={deepLoading}
                      onClick={runFullReview}
                    >
                      一键 AI 审核（规则+深度）
                    </Button>
                    <Button icon={<ThunderboltOutlined />} onClick={runRule}>
                      仅规则快检
                    </Button>
                    <Button
                      icon={<RobotOutlined />}
                      loading={imgLoading}
                      onClick={runImage}
                    >
                      图像 AI 审核（多图）
                    </Button>
                  </Space>
                </PermissionGate>
              </Space>
            </>
          )}
        </Space>
      </Card>

      <Card title="审核结果">
        {!issues.length && !deep && !result && !imgLoading && !deepLoading && (
          <Empty description="选择订单并执行审核后，这里展示问题清单" />
        )}

        {ruleIssues.length > 0 && (
          <>
            <Divider orientation="left" plain>
              第一步 · JS 规则快检（{ruleIssues.length}）
            </Divider>
            <AiReviewPanel
              issues={ruleIssues}
              loading={false}
              showExport
              exportMeta={exportMeta}
              onUpdateIssue={(i, p) => updateSectionIssue("rule", i, p)}
            />
          </>
        )}

        {deep && (
          <>
            <Divider orientation="left" plain>
              第二步 · 深度 AI 检查
            </Divider>
            <Alert
              style={{ marginBottom: 12 }}
              type="success"
              showIcon
              message={
                <span>
                  {deep.summary}　
                  <Tag color="blue">置信度 {Math.round(deep.confidence * 100)}%</Tag>
                </span>
              }
            />
            <AiReviewPanel
              issues={deepIssues}
              loading={deepLoading}
              showExport
              exportMeta={exportMeta}
              onUpdateIssue={(i, p) => updateSectionIssue("deep", i, p)}
            />
          </>
        )}

        {result && (
          <>
            <Divider orientation="left" plain>
              图像 AI 审核
            </Divider>
            <Alert
              style={{ marginBottom: 12 }}
              type="info"
              showIcon
              message={`本次审核依据：法规「${result.used.regulationName ?? "通用规则"}」｜品牌资料「${
                result.used.brandAssetName ?? "未使用"
              }」｜图片 ${result.used.imageCount} 张`}
            />
            <AiReviewPanel
              issues={imgIssues}
              loading={imgLoading}
              showExport
              exportMeta={exportMeta}
              onUpdateIssue={(i, p) => updateSectionIssue("image", i, p)}
            />
            {result.comparison && (
              <>
                <Divider orientation="left" plain>
                  多图对比
                </Divider>
                <Alert
                  type={result.comparison.pairs.some((p) => !p.consistent) ? "warning" : "success"}
                  showIcon
                  message={result.comparison.summary}
                />
                <Space direction="vertical" style={{ width: "100%" }}>
                  {result.comparison.pairs.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid #f0f0f0",
                        borderRadius: 8,
                        padding: 12,
                        background: "#fafafa",
                      }}
                    >
                      <Space wrap>
                        <Tag>{p.a}</Tag>
                        <span>vs</span>
                        <Tag>{p.b}</Tag>
                        {p.consistent ? (
                          <Tag color="green">一致</Tag>
                        ) : (
                          <Tag color="red">存在差异</Tag>
                        )}
                      </Space>
                      <div style={{ color: "#595959", fontSize: 13, marginTop: 4 }}>{p.note}</div>
                    </div>
                  ))}
                </Space>
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
