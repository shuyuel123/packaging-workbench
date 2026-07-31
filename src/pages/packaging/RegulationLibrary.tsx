import { useRef, useState } from "react";
import {
  Card,
  Tag,
  Button,
  Space,
  Input,
  Popconfirm,
  Modal,
  Form,
  Table,
  message,
  Typography,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useWorkbench } from "../../state/WorkbenchContext";
import { MARKET_COLOR } from "../../lib/ui";
import { MARKET_LABEL } from "../../types";
import type { MarketKey, Regulation, RegulationLibrary, RegCountry, OrderFile } from "../../types";
import { FileChip } from "../../components/FileChip";
import { loadFiles, ACCEPTED_DOC_ACCEPT } from "../../lib/fileUpload";
import { deleteStoredFile } from "../../utils/storageService";
import { CheckUpdateButton } from "../../components/RegulationLibrary/CheckUpdateButton";

type RegField = "certMarks" | "requiredChecks" | "warnings";

/** 单个可编辑 Tag 区（认证标志 / 必检项 / 警示语） */
function TagEditor({
  title,
  values,
  color,
  editable,
  onAdd,
  onRemove,
}: {
  title: string;
  values: string[];
  color: string;
  editable: boolean;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const [val, setVal] = useState("");
  const submit = () => {
    const v = val.trim();
    if (!v) return;
    onAdd(v);
    setVal("");
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>{title}</div>
      <Space wrap size={[4, 4]} style={{ marginBottom: 6 }}>
        {values.map((v) => (
          <Tag
            key={v}
            color={color}
            closable={editable}
            onClose={(e) => {
              e.preventDefault();
              onRemove(v);
            }}
          >
            {v}
          </Tag>
        ))}
        {values.length === 0 && <span style={{ color: "#bfbfbf", fontSize: 12 }}>暂无</span>}
      </Space>
      {editable && (
        <Space.Compact style={{ width: "100%" }}>
          <Input
            size="small"
            placeholder={`输入后回车添加${title}`}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onPressEnter={submit}
          />
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={submit}>
            添加
          </Button>
        </Space.Compact>
      )}
    </div>
  );
}

export function RegulationLibrary() {
  const wb = useWorkbench();
  const canManage = wb.settings.role === "admin"; // 区域增删需管理者权限
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());

  // 区域弹窗（新增 / 批量编辑）
  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [regionTarget, setRegionTarget] = useState<RegulationLibrary | null>(null);
  const [regionForm] = Form.useForm();

  // 国家弹窗
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [countryLibId, setCountryLibId] = useState<string | null>(null);
  const [countryTarget, setCountryTarget] = useState<RegCountry | null>(null);
  const [countryForm] = Form.useForm();

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const replaceInfo = useRef<{ libId: string; fileId: string } | null>(null);

  const labelOf = (lib: RegulationLibrary) =>
    lib.customName ?? MARKET_LABEL[lib.region as MarketKey] ?? String(lib.region);
  const regFor = (region: MarketKey | string) =>
    wb.regulations.find((r) => String(r.market) === String(region));

  const inEdit = (id: string) => editingIds.has(id);
  const toggleEdit = (id: string) =>
    setEditingIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  // ---------- 内容（认证标志/必检项/警示语）增删 ----------
  const addTag = (region: MarketKey | string, field: RegField, value: string) => {
    const reg = regFor(region);
    if (!reg) return;
    wb.updateRegulation(reg.id, { [field]: [...reg[field], value] } as Partial<Regulation>);
  };
  const removeTag = (region: MarketKey | string, field: RegField, value: string) => {
    Modal.confirm({
      title: "确认删除",
      content: "此操作不可撤销",
      okType: "danger",
      onOk: () => {
        const reg = regFor(region);
        if (!reg) return;
        wb.updateRegulation(reg.id, {
          [field]: reg[field].filter((v) => v !== value),
        } as Partial<Regulation>);
      },
    });
  };

  // ---------- 区域文件（上传/替换/删除）----------
  const handleUpload = async (lib: RegulationLibrary, list: FileList | null) => {
    if (!list || !list.length) return;
    const loaded = await loadFiles(list, {
      onReject: (names) => message.warning(`已跳过不支持的文件：${names.join("、")}`),
    });
    if (!loaded.length) return;
    const info = replaceInfo.current;
    let files: OrderFile[];
    if (info && info.libId === lib.id) {
      files = lib.files.map((f) => (f.id === info.fileId ? { ...loaded[0], id: f.id } : f));
    } else {
      files = [...lib.files, ...loaded];
    }
    replaceInfo.current = null;
    wb.updateRegLib(lib.id, { files });
    message.success(`已${info ? "替换" : "上传"} ${loaded.length} 个文件`);
  };
  const removeFile = (lib: RegulationLibrary, fid: string) => {
    deleteStoredFile(fid);
    wb.updateRegLib(lib.id, { files: lib.files.filter((f) => f.id !== fid) });
  };
  const beginReplace = (lib: RegulationLibrary, f: OrderFile) => {
    replaceInfo.current = { libId: lib.id, fileId: f.id };
    fileRefs.current[lib.id]?.click();
  };

  // ---------- 区域弹窗 ----------
  const openAddRegion = () => {
    setRegionTarget(null);
    regionForm.resetFields();
    setRegionModalOpen(true);
  };
  const submitRegion = async () => {
    const v = await regionForm.validateFields();
    const name = String(v.name).trim();
    const split = (s: string) => String(s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
    const certMarks = split(v.certMarks);
    const requiredChecks = split(v.requiredChecks);
    const warnings = split(v.warnings);
    if (regionTarget) {
      const reg = regFor(regionTarget.region);
      if (reg)
        wb.updateRegulation(reg.id, { marketName: name, certMarks, requiredChecks, warnings });
      wb.updateRegLib(regionTarget.id, { customName: name });
      message.success("已更新区域内容");
    } else {
      if (wb.regLibs.some((l) => String(l.region) === name)) {
        message.warning("区域已存在");
        return;
      }
      wb.addRegLib({ region: name, customName: name, isBuiltin: false, countries: [], files: [] });
      wb.addRegulation({ market: name, marketName: name, requiredChecks, certMarks, warnings });
      message.success("已新增区域");
    }
    setRegionModalOpen(false);
    regionForm.resetFields();
  };
  const deleteRegion = (lib: RegulationLibrary) => {
    wb.removeRegLib(lib.id);
    const reg = regFor(lib.region);
    if (reg) wb.removeRegulation(reg.id);
    setEditingIds((prev) => {
      const s = new Set(prev);
      s.delete(lib.id);
      return s;
    });
    message.success("已删除区域");
  };

  // ---------- 国家弹窗 ----------
  const openAddCountry = (libId: string) => {
    setCountryLibId(libId);
    setCountryTarget(null);
    countryForm.resetFields();
    setCountryModalOpen(true);
  };
  const openEditCountry = (lib: RegulationLibrary, c: RegCountry) => {
    setCountryLibId(lib.id);
    setCountryTarget(c);
    countryForm.setFieldsValue(c);
    setCountryModalOpen(true);
  };
  const submitCountry = async () => {
    const v = await countryForm.validateFields();
    const arr = wb.regLibs.find((l) => l.id === countryLibId)?.countries ?? [];
    if (countryTarget) {
      wb.updateRegLib(countryLibId!, {
        countries: arr.map((c) => (c.country === countryTarget.country ? { ...c, ...v } : c)),
      });
    } else {
      wb.updateRegLib(countryLibId!, { countries: [...arr, { ...v } as RegCountry] });
    }
    setCountryModalOpen(false);
    message.success("已保存国家配置");
  };
  const removeCountry = (libId: string, country: string) => {
    const arr = wb.regLibs.find((l) => l.id === libId)?.countries ?? [];
    wb.updateRegLib(libId, { countries: arr.filter((c) => c.country !== country) });
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>
            市场法规库
          </Typography.Title>
          {canManage && <Tag color="gold">管理模式</Tag>}
        </Space>
        <Space wrap>
          <CheckUpdateButton buttonText="一键检查所有区域" size="large" />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            点击后从 Google News 抓取最新法规动态
          </Typography.Text>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddRegion}>
              添加区域
            </Button>
          )}
        </Space>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))",
          gap: 16,
        }}
      >
        {wb.regLibs.map((lib) => {
          const reg = regFor(lib.region);
          const edit = inEdit(lib.id);
          const isBuiltin = lib.isBuiltin ?? String(lib.region) in MARKET_LABEL;
          const color = MARKET_COLOR[lib.region as MarketKey] ?? "#8c8c8c";
          return (
            <Card
              key={lib.id}
              title={
                <Space>
                  <Tag color={color}>{labelOf(lib)}</Tag>
                  {isBuiltin ? <Tag>内置</Tag> : <Tag color="purple">自定义</Tag>}
                </Space>
              }
              extra={
                <Space size={4}>
                  <CheckUpdateButton
                    regionKey={lib.region}
                    regionLabel={labelOf(lib)}
                    regionKeywords={[
                      ...(reg?.certMarks ?? []),
                      ...(reg?.requiredChecks ?? []),
                    ]}
                    buttonText="检查更新"
                    size="small"
                  />
                  {!isBuiltin && canManage && (
                    <Popconfirm
                      title="删除区域"
                      description="将同时移除该区域下所有法规文件和配置，不可撤销"
                      okType="danger"
                      onConfirm={() => deleteRegion(lib)}
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                  <Button
                    size="small"
                    type={edit ? "primary" : "text"}
                    icon={<EditOutlined />}
                    style={edit ? undefined : { color: "#cf1322" }}
                    onClick={() => toggleEdit(lib.id)}
                  >
                    {edit ? "完成" : "编辑"}
                  </Button>
                </Space>
              }
            >
              <TagEditor
                title="认证标志"
                color="blue"
                values={reg?.certMarks ?? []}
                editable={edit}
                onAdd={(v) => addTag(lib.region, "certMarks", v)}
                onRemove={(v) => removeTag(lib.region, "certMarks", v)}
              />
              <TagEditor
                title="必检项"
                color="green"
                values={reg?.requiredChecks ?? []}
                editable={edit}
                onAdd={(v) => addTag(lib.region, "requiredChecks", v)}
                onRemove={(v) => removeTag(lib.region, "requiredChecks", v)}
              />
              <TagEditor
                title="警示语"
                color="orange"
                values={reg?.warnings ?? []}
                editable={edit}
                onAdd={(v) => addTag(lib.region, "warnings", v)}
                onRemove={(v) => removeTag(lib.region, "warnings", v)}
              />

              {/* 每区域独立文件管理 */}
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 6,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  法规文件
                  {edit && (
                    <Button
                      size="small"
                      icon={<UploadOutlined />}
                      onClick={() => fileRefs.current[lib.id]?.click()}
                    >
                      上传
                    </Button>
                  )}
                </div>
                <input
                  ref={(el) => (fileRefs.current[lib.id] = el)}
                  type="file"
                  accept={ACCEPTED_DOC_ACCEPT}
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    handleUpload(lib, e.target.files);
                    e.target.value = "";
                  }}
                />
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  {lib.files.map((f) => (
                    <FileChip
                      key={f.id}
                      file={f}
                      onDelete={edit ? () => removeFile(lib, f.id) : undefined}
                      onReplace={edit ? () => beginReplace(lib, f) : undefined}
                    />
                  ))}
                  {lib.files.length === 0 && (
                    <span style={{ color: "#bfbfbf", fontSize: 12 }}>暂无法规文件</span>
                  )}
                </Space>
              </div>

              {/* 国家明细 */}
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 6,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  国家明细（{lib.countries.length}）
                  {edit && (
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => openAddCountry(lib.id)}
                    >
                      添加国家
                    </Button>
                  )}
                </div>
                {lib.countries.length ? (
                  <Table<RegCountry>
                    size="small"
                    pagination={false}
                    dataSource={lib.countries}
                    rowKey="country"
                    columns={[
                      { title: "国家", dataIndex: "country", width: 90 },
                      {
                        title: "认证/标准",
                        dataIndex: "certs",
                        render: (c: string[]) => (
                          <Space wrap size={[2, 2]}>
                            {(c ?? []).map((x) => (
                              <Tag key={x}>{x}</Tag>
                            ))}
                          </Space>
                        ),
                      },
                      {
                        title: "强制标注",
                        dataIndex: "mandatoryLabels",
                        render: (m: string[]) => (
                          <Space wrap size={[2, 2]}>
                            {(m ?? []).map((x) => (
                              <Tag key={x} color="cyan">
                                {x}
                              </Tag>
                            ))}
                          </Space>
                        ),
                      },
                      {
                        title: "说明",
                        dataIndex: "note",
                        ellipsis: true,
                      },
                      ...(edit
                        ? [
                            {
                              title: "操作",
                              width: 110,
                              render: (_: any, c: RegCountry) => (
                                <Space size={4}>
                                  <Button
                                    size="small"
                                    type="link"
                                    onClick={() => openEditCountry(lib, c)}
                                  >
                                    编辑
                                  </Button>
                                  <Popconfirm
                                    title="删除国家配置"
                                    onConfirm={() => removeCountry(lib.id, c.country)}
                                  >
                                    <Button size="small" type="link" danger>
                                      删除
                                    </Button>
                                  </Popconfirm>
                                </Space>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                ) : (
                  <span style={{ color: "#bfbfbf", fontSize: 12 }}>暂无国家配置</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 区域弹窗 */}
      <Modal
        title={regionTarget ? "批量编辑区域内容" : "添加区域"}
        open={regionModalOpen}
        onOk={submitRegion}
        onCancel={() => setRegionModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={regionForm} layout="vertical">
          <Form.Item
            name="name"
            label="区域名称"
            rules={[{ required: true, message: "请输入区域名称" }]}
          >
            <Input placeholder="如：东南亚 / 北欧" />
          </Form.Item>
          <Form.Item name="certMarks" label="认证标志（每行一个）">
            <Input.TextArea rows={3} placeholder="UL&#10;CE&#10;TISI" />
          </Form.Item>
          <Form.Item name="requiredChecks" label="必检项（每行一个）">
            <Input.TextArea rows={3} placeholder="UL 484 安全认证&#10;SEER/EER 能效" />
          </Form.Item>
          <Form.Item name="warnings" label="警示语（每行一个）">
            <Input.TextArea rows={3} placeholder="防触电危险警示&#10;冷媒可燃警示" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 国家弹窗 */}
      <Modal
        title={countryTarget ? "编辑国家配置" : "添加国家"}
        open={countryModalOpen}
        onOk={submitCountry}
        onCancel={() => setCountryModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={countryForm} layout="vertical">
          <Form.Item
            name="country"
            label="国家/地区"
            rules={[{ required: true, message: "请输入国家名称" }]}
          >
            <Input placeholder="如：泰国" disabled={!!countryTarget} />
          </Form.Item>
          <Form.Item name="certs" label="认证/标准（每行一个）">
            <Input.TextArea rows={3} placeholder="TISI&#10;TIS 2134-2565" />
          </Form.Item>
          <Form.Item name="mandatoryLabels" label="强制标注（每行一个）">
            <Input.TextArea rows={3} placeholder="额定制冷量(kW)&#10;SEER/EER" />
          </Form.Item>
          <Form.Item name="note" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
