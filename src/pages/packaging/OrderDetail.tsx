import { useRef, useState } from "react";
import { Card, Button, Tag, Space, Input, Empty, message, Alert, Select } from "antd";
import {
  ArrowLeftOutlined,
  RobotOutlined,
  UploadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkbench } from "../../state/WorkbenchContext";
import { PermissionGate } from "../../components/PermissionGate";
import { FlowSteps } from "../../components/FlowSteps";
import { AiReviewPanel } from "../../components/AiReviewPanel";
import { FileChip } from "../../components/FileChip";
import { MARKET_COLOR, ORDER_STATUS_COLOR } from "../../lib/ui";
import {
  MARKET_LABEL,
  ORDER_STATUS_LABEL,
  PRODUCT_CATEGORY_LABEL,
  type AiIssue,
  type ProductSpec,
  type ProductCategory,
  type AiDeepResult,
} from "../../types";
import { getAIService, generateAnnotations } from "../../services/aiService";
import { runRuleCheck } from "../../lib/reviewRules";
import { formatDate } from "../../lib/storage";
import { loadFiles, ACCEPTED_DOC_ACCEPT, MAX_FILE_SIZE } from "../../lib/fileUpload";
import { deleteFileFromDB } from "../../utils/storageService";

/** 订单印刷件支持 PDF / Word / Excel / 图片 */
const ORDER_ACCEPT = ACCEPTED_DOC_ACCEPT;

export function OrderDetail() {
  const { id } = useParams();
  const wb = useWorkbench();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const order = wb.orders.find((o) => o.id === id);
  const [issues, setIssues] = useState<AiIssue[]>(order?.aiResult?.issues ?? []);
  const [ruleRan, setRuleRan] = useState(
    !!order?.aiResult?.issues?.some((i) => i.source === "rule")
  );
  const [reviewing, setReviewing] = useState(false);
  const [deep, setDeep] = useState<AiDeepResult | null>(null);
  const [drag, setDrag] = useState(false);
  const [printedText, setPrintedText] = useState("");

  if (!order) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/packaging/orders")}>
          返回
        </Button>
        <Empty description="订单不存在" style={{ marginTop: 24 }} />
      </div>
    );
  }

  const customer = wb.customers.find((c) => c.id === order.customerId);
  const reg = wb.regulations.find((r) => r.market === order.targetMarket);
  const spec = order.spec ?? {};

  async function onFiles(fileList: FileList) {
    const loaded = await loadFiles(fileList, {
      maxSize: MAX_FILE_SIZE,
      onReject: (names) =>
        message.warning(`已跳过不支持的文件：${names.join("、")}`),
    });
    if (!loaded.length) return;
    wb.updateOrder(order!.id, { files: [...order!.files, ...loaded] });
    message.success(`已上传 ${loaded.length} 个文件`);
  }

  /** 人工补充标注附件：更新问题并持久化到订单 AI 审核结果 */
  function updateIssue(index: number, patch: Partial<AiIssue>) {
    const list = issues.map((it, i) => (i === index ? { ...it, ...patch } : it));
    setIssues(list);
    wb.updateOrder(order!.id, {
      aiResult: { ...(order!.aiResult ?? { used: {} }), issues: list },
    });
  }

  const brand = wb.brandAssets.find((b) => b.customerId === order!.customerId);
  const exportMeta = {
    orderCode: order!.productModel,
    productModel: order!.productModel,
    market: MARKET_LABEL[order!.targetMarket],
    customer: customer?.name,
    brand: brand?.brandName ?? customer?.name,
  };

  function removeFile(fid: string) {
    void deleteFileFromDB(fid);
    wb.updateOrder(order!.id, { files: order!.files.filter((f) => f.id !== fid) });
  }

  function setSpec(patch: Partial<ProductSpec>) {
    wb.updateOrder(order!.id, { spec: { ...spec, ...patch } });
  }

  /** 第一步：JS 规则快检（免费、即时，同时自动生成 AI 批注附件） */
  async function runRule(): Promise<AiIssue[]> {
    const base = runRuleCheck({
      order: order!,
      regulation: reg,
      printedText,
      spec,
    });
    const next = await generateAnnotations(order!.files, base);
    setRuleRan(true);
    setDeep(null);
    setIssues(next);
    wb.updateOrder(order!.id, {
      aiResult: { issues: next, used: { regulationName: reg?.marketName } },
    });
    return next;
  }

  /** 第二步：深度 AI 检查（调用大模型 API，可由「一键审核」串行调用） */
  async function runDeep(baseIssues?: AiIssue[]): Promise<void> {
    if (!printedText.trim()) {
      message.warning("请先在上方粘贴印刷件关键文字，再执行深度 AI 检查");
      return;
    }
    setReviewing(true);
    try {
      const ai = getAIService(
        wb.settings.aiProvider,
        wb.settings.apiKey,
        wb.settings.apiBase,
        wb.settings.aiModel || undefined
      );
      const res = await ai.deepReviewPrint({
        order: order!,
        regulation: reg,
        printedText,
        spec,
      });
      const merged = [...(baseIssues ?? issues).filter((i) => i.source !== "deep"), ...res.issues];
      setDeep(res);
      setIssues(merged);
      wb.updateOrder(order!.id, {
        aiResult: { issues: merged, used: { regulationName: reg?.marketName } },
      });
    } catch (e) {
      message.error("深度 AI 检查失败：" + (e as Error).message);
    } finally {
      setReviewing(false);
    }
  }

  /** 一键审核：先规则快检（秒出），再串行深度 AI（转圈），汇总同一报告 */
  async function runFullReview(): Promise<void> {
    const ruleIssues = await runRule();
    if (!printedText.trim()) {
      message.info("未粘贴印刷件文字，已跳过深度 AI 检查（规则快检结果已生成）");
      return;
    }
    await runDeep(ruleIssues);
  }

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/packaging/orders")}>
          返回
        </Button>
        <Tag color={MARKET_COLOR[order.targetMarket]}>{MARKET_LABEL[order.targetMarket]}</Tag>
        <Tag color={ORDER_STATUS_COLOR[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Tag>
      </Space>

      <Card title={`${order.productModel} · ${customer?.name ?? "—"}`} style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <div style={{ color: "#8c8c8c", fontSize: 13 }}>
            创建：{formatDate(order.createdAt)} ｜ 更新：{formatDate(order.updatedAt)}
          </div>
          <FlowSteps order={order} onAdvance={() => wb.advanceOrderStatus(order.id)} />
        </Space>
      </Card>

      {/* 文件区 */}
      <Card title="印刷文件" style={{ marginBottom: 16 }}>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `1px dashed ${drag ? "#10b981" : "#d9d9d9"}`,
            borderRadius: 8,
            padding: 24,
            textAlign: "center",
            cursor: "pointer",
            background: drag ? "#f6ffed" : "#fafafa",
            marginBottom: 12,
          }}
        >
          <UploadOutlined style={{ fontSize: 22, color: "#10b981" }} />
          <div style={{ marginTop: 8, color: "#595959" }}>
            点击或拖拽上传印刷文件（支持 PDF / Word / Excel / 图片，单文件 ≤ 15MB）
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ORDER_ACCEPT}
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.length) onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          {order.files.map((f) => (
            <FileChip key={f.id} file={f} onDelete={(file) => removeFile(file.id)} />
          ))}
          {order.files.length === 0 && <span style={{ color: "#bfbfbf" }}>暂无文件</span>}
        </Space>
      </Card>

      {/* 产品基准参数卡 */}
      <Card title="产品基准参数卡" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="选择产品品类"
            style={{ width: 180 }}
            value={spec.category ?? undefined}
            onChange={(v: ProductCategory) => setSpec({ category: v })}
            options={Object.entries(PRODUCT_CATEGORY_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Input
            addonBefore="制冷类型"
            placeholder="单冷 / 冷暖"
            value={spec.coolingType ?? ""}
            style={{ width: 200 }}
            onChange={(e) => setSpec({ coolingType: e.target.value })}
          />
          <Input
            addonBefore="频率类型"
            placeholder="定频 / 变频"
            value={spec.frequency ?? ""}
            style={{ width: 200 }}
            onChange={(e) => setSpec({ frequency: e.target.value })}
          />
          <Input
            addonBefore="电压"
            placeholder="如 220V / 120V"
            value={spec.voltage ?? ""}
            style={{ width: 180 }}
            onChange={(e) => setSpec({ voltage: e.target.value })}
          />
          <Input
            addonBefore="冷媒"
            placeholder="如 R32 / R410A"
            value={spec.refrigerant ?? ""}
            style={{ width: 180 }}
            onChange={(e) => setSpec({ refrigerant: e.target.value })}
          />
        </Space>
        <div style={{ color: "#8c8c8c", fontSize: 12, marginTop: 8 }}>
          参数卡用于「AI 审核第一步 · JS 规则快检」的数值与关键词比对基准（仅本地保存，不上传）。
        </div>
      </Card>

      {/* AI 合规审核（两步） */}
      <Card
        title="AI 合规审核"
        extra={
          <PermissionGate require="edit" fallback={<Tag>查看者不可运行审核</Tag>}>
            <Space>
              <Button
                type="primary"
                icon={<RobotOutlined />}
                loading={reviewing}
                onClick={runFullReview}
              >
                一键 AI 审核（规则+深度）
              </Button>
              <Button icon={<ThunderboltOutlined />} onClick={runRule}>
                仅规则快检
              </Button>
            </Space>
          </PermissionGate>
        }
        style={{ marginBottom: 16 }}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 6, fontSize: 13, color: "#595959" }}>
            粘贴印刷件关键文字（用于规则比对与深度 AI 语义分析）：
          </div>
          <Input.TextArea
            rows={3}
            value={printedText}
            placeholder="例如：COOLING ONLY / INVERTER / 220V / R32 / CE ... 粘贴后点击「一键 AI 审核」执行规则比对与深度分析"
            onChange={(e) => setPrintedText(e.target.value)}
          />
        </div>

        {!ruleRan && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="点击「一键 AI 审核」：先执行免费规则快检（秒出），再串行调用深度 AI 做语义分析，结果汇总于同一报告；也可单独点「仅规则快检」。"
          />
        )}
        {deep && (
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 12 }}
            message={
              <span>
                {deep.summary}　
                <Tag color="blue">置信度 {Math.round(deep.confidence * 100)}%</Tag>
              </span>
            }
          />
        )}

        <AiReviewPanel
          issues={issues}
          loading={reviewing}
          onUpdateIssue={updateIssue}
          exportMeta={exportMeta}
          showExport
        />
      </Card>

      {/* 备注 */}
      <Card title="备注">
        <PermissionGate
          require="edit"
          fallback={<div style={{ color: "#595959", whiteSpace: "pre-wrap" }}>{order.note || "—"}</div>}
        >
          <Input.TextArea
            rows={3}
            value={order.note}
            placeholder="补充订单说明…"
            onChange={(e) => wb.updateOrder(order.id, { note: e.target.value })}
          />
        </PermissionGate>
      </Card>
    </div>
  );
}
