import { useRef } from "react";
import {
  Card,
  Select,
  Input,
  Button,
  Tag,
  Space,
  Popconfirm,
  message,
  Divider,
  Modal,
} from "antd";
import { ApiOutlined, ReloadOutlined, DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { useWorkbench } from "../state/WorkbenchContext";
import { type WorkbenchData } from "../types";
import { getAIService, MODEL_OPTIONS, getDefaultModel } from "../services/aiService";
import { formatDate, now } from "../lib/storage";

export function Settings() {
  const wb = useWorkbench();
  const { settings } = wb;
  const importRef = useRef<HTMLInputElement>(null);

  const dump = JSON.stringify(wb.exportAll());
  const sizeKB = (new Blob([dump]).size / 1024).toFixed(1);

  async function testAi() {
    if (settings.aiProvider === "mock") {
      message.info("当前为 Mock 模式，无需连接，可直接跑通流程");
      return;
    }
    try {
      const ai = getAIService(
        settings.aiProvider,
        settings.apiKey,
        settings.apiBase,
        settings.aiModel || getDefaultModel(settings.aiProvider)
      );
      await ai.suggestTags("测试连接 部署 会议");
      message.success("AI 连接成功（真实接口返回）");
    } catch (e) {
      message.warning("AI 连接失败，已自动降级 Mock：" + (e as Error).message);
    }
  }

  function exportAll() {
    const json = JSON.stringify(wb.exportAll(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workbench-backup-${formatDate(now())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    wb.updateSettings({ lastBackupAt: now() });
    message.success("已导出全部数据为 JSON");
  }

  async function onImportFiles(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as WorkbenchData;
      if (!data || !Array.isArray(data.orders) || !Array.isArray(data.regLibs)) {
        message.error("JSON 格式不正确，缺少必要字段（orders / regLibs）");
        return;
      }
      Modal.confirm({
        title: "覆盖当前数据？",
        content: "导入将用该文件内容替换全部本地数据，且不可撤销。建议先导出备份。",
        okText: "确认导入",
        okType: "danger",
        onOk: () => {
          wb.importAll(data);
          message.success("数据已恢复");
        },
      });
    } catch {
      message.error("读取或解析 JSON 失败");
    }
  }

  return (
    <div>
      <Card title="偏好设置" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <div style={{ marginBottom: 6, color: "#595959" }}>界面密度</div>
            <Select
              style={{ width: 240 }}
              value={settings.density}
              onChange={(v) => wb.updateSettings({ density: v })}
              options={[
                { value: "comfortable", label: "舒适" },
                { value: "compact", label: "紧凑" },
              ]}
            />
          </div>
        </Space>
      </Card>

      <Card title="AI 服务配置" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <div style={{ marginBottom: 6, color: "#595959" }}>提供者</div>
            <Select
              style={{ width: 240 }}
              value={settings.aiProvider}
              onChange={(v) =>
                wb.updateSettings({ aiProvider: v, aiModel: getDefaultModel(v) })
              }
              options={[
                { value: "mock", label: "Mock（本地模拟，默认）" },
                { value: "openai", label: "OpenAI 兼容" },
                { value: "deepseek", label: "DeepSeek" },
                { value: "custom", label: "自定义后端" },
              ]}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, color: "#595959" }}>模型版本</div>
            <Select
              style={{ width: 320 }}
              value={settings.aiModel || getDefaultModel(settings.aiProvider)}
              onChange={(v) => wb.updateSettings({ aiModel: v })}
              options={MODEL_OPTIONS[settings.aiProvider] ?? []}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, color: "#595959" }}>API Key</div>
            <Input.Password
              style={{ maxWidth: 420 }}
              value={settings.apiKey}
              placeholder="留空则使用 Mock"
              onChange={(e) => wb.updateSettings({ apiKey: e.target.value })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, color: "#595959" }}>API Base</div>
            <Input
              style={{ maxWidth: 420 }}
              value={settings.apiBase}
              placeholder="https://api.deepseek.com/v1 或你的代理地址"
              onChange={(e) => wb.updateSettings({ apiBase: e.target.value })}
            />
          </div>
          <Button icon={<ApiOutlined />} onClick={testAi}>
            测试 AI 连接
          </Button>
          <div style={{ color: "#bfbfbf", fontSize: 12 }}>
            提示：真实密钥应放在后端代理，前端仅作演示。当前 Mock 模式无需任何密钥即可跑通流程。
            DeepSeek 默认接口 https://api.deepseek.com/v1；可在上方「模型版本」中选择，例如 DeepSeek-V4 Flash（deepseek-v4-flash）。
          </div>
        </Space>
      </Card>

      <Card title="数据备份与恢复">
        <Divider style={{ margin: "8px 0" }} />
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div style={{ color: "#595959", fontSize: 13 }}>
            当前数据大小：<Tag>{sizeKB} KB</Tag>
            最后备份：
            <Tag>{settings.lastBackupAt ? formatDate(settings.lastBackupAt) : "从未备份"}</Tag>
          </div>
          <Space wrap>
            <Button icon={<DownloadOutlined />} type="primary" onClick={exportAll}>
              导出所有数据为 JSON
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => importRef.current?.click()}>
              导入 JSON 恢复数据
            </Button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.length) onImportFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </Space>
          <div style={{ color: "#bfbfbf", fontSize: 12 }}>
            本工作台为单机版纯前端应用：业务数据（订单/法规/品牌等 JSON）保存在浏览器 localStorage，
            文件本体（PDF/图片等）保存在 IndexedDB（容量更大，可存大文件）；两者均在当前浏览器内，清缓存会丢失，重要变更后请定期导出备份。
          </div>
          <Divider style={{ margin: "4px 0" }} />
          <Popconfirm
            title="确定清空并重置为种子数据？"
            description="所有本地数据将被覆盖"
            onConfirm={() => {
              wb.resetAll();
              message.success("已重置为种子数据");
            }}
          >
            <Button danger icon={<ReloadOutlined />}>
              清空 / 重置种子数据
            </Button>
          </Popconfirm>
        </Space>
      </Card>
    </div>
  );
}
