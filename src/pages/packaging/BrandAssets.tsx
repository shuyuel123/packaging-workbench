import { useMemo, useState } from "react";
import {
  Card,
  Select,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Tag,
  Empty,
  Popconfirm,
  Table,
  message,
  Typography,
  Upload,
} from "antd";
import { PlusOutlined, UploadOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkbench } from "../../state/WorkbenchContext";
import { uid, formatDate } from "../../lib/storage";
import type { BrandColor, BrandAsset, OrderFile } from "../../types";
import { FileChip } from "../../components/FileChip";
import { loadFiles, ACCEPTED_DOC_ACCEPT, MAX_FILE_SIZE } from "../../lib/fileUpload";
import { deleteStoredFile } from "../../utils/storageService";

/** 品牌资料库：按客户维护多个品牌（Logo / 标准色 / 字体 / 规范 / 资料文件） */
export function BrandAssets() {
  const wb = useWorkbench();
  const canManage = wb.settings.role === "admin"; // 管理模式
  const navigate = useNavigate();
  const { customerId } = useParams<{ customerId: string }>();

  const selectedId = customerId ?? wb.customers[0]?.id ?? null;
  const customer = wb.customers.find((c) => c.id === selectedId) ?? null;
  const brands = useMemo(
    () => wb.brandAssets.filter((a) => a.customerId === selectedId),
    [wb.brandAssets, selectedId]
  );

  // 品牌弹窗
  const [brandModal, setBrandModal] = useState<{ open: boolean; target: BrandAsset | null; customerId: string }>({
    open: false,
    target: null,
    customerId: selectedId ?? "",
  });
  const [brandForm] = Form.useForm();
  const [modalLogo, setModalLogo] = useState<string | undefined>(undefined);
  const [modalFiles, setModalFiles] = useState<OrderFile[]>([]);

  // 色值弹窗（按品牌）
  const [colorModal, setColorModal] = useState<{ open: boolean; color: BrandColor | null; assetId: string | null }>({
    open: false,
    color: null,
    assetId: null,
  });
  const [colorForm] = Form.useForm<Omit<BrandColor, "id">>();

  const openAddBrand = (cid: string) => {
    setBrandModal({ open: true, target: null, customerId: cid });
    brandForm.resetFields();
    setModalLogo(undefined);
    setModalFiles([]);
  };
  const openEditBrand = (b: BrandAsset) => {
    setBrandModal({ open: true, target: b, customerId: b.customerId });
    brandForm.setFieldsValue({
      brandName: b.brandName ?? "",
      fonts: (b.fonts ?? []).join("\n"),
      usageSpec: b.usageSpec ?? "",
    });
    setModalLogo(b.logoDataUrl);
    setModalFiles([...(b.files ?? [])]);
  };

  const uploadLogo = async (file: File): Promise<boolean> => {
    if (!file.type.startsWith("image/")) {
      message.warning("Logo 仅支持图片格式");
      return false;
    }
    const loaded = await loadFiles([file], { maxSize: MAX_FILE_SIZE });
    if (loaded[0]?.dataUrl) setModalLogo(loaded[0].dataUrl);
    return false;
  };

  const submitBrand = () => {
    brandForm
      .validateFields()
      .then((v) => {
        const brandName = String(v.brandName ?? "").trim();
        const fonts = String(v.fonts ?? "")
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);
        const usageSpec = String(v.usageSpec ?? "");
        if (brandModal.target) {
          wb.updateBrandAsset(brandModal.target.id, { brandName, fonts, usageSpec, logoDataUrl: modalLogo, files: modalFiles });
          message.success("已更新品牌资料");
        } else {
          wb.addBrandAsset({
            customerId: brandModal.customerId,
            brandName,
            logoDataUrl: modalLogo,
            colors: [],
            fonts,
            usageSpec,
            files: modalFiles,
          });
          message.success("已新增品牌");
        }
        setBrandModal({ open: false, target: null, customerId: "" });
      })
      .catch(() => {});
  };

  const saveColor = () => {
    if (!colorModal.assetId) return;
    colorForm
      .validateFields()
      .then((v) => {
        const asset = wb.brandAssets.find((a) => a.id === colorModal.assetId);
        if (!asset) return;
        const colors = colorModal.color
          ? asset.colors.map((c) => (c.id === colorModal.color!.id ? { ...c, ...v } : c))
          : [...asset.colors, { id: uid("color"), ...v }];
        wb.updateBrandAsset(asset.id, { colors });
        setColorModal({ open: false, color: null, assetId: null });
        colorForm.resetFields();
      })
      .catch(() => {});
  };

  // 品牌卡片内的文件上传（上传到该品牌）
  async function uploadBrandFile(b: BrandAsset, file: File): Promise<boolean> {
    const loaded = await loadFiles([file], {
      maxSize: MAX_FILE_SIZE,
      onReject: (names) => message.warning(`已跳过：${names.join("、")}`),
    });
    if (loaded.length) wb.updateBrandAsset(b.id, { files: [...(b.files ?? []), ...loaded] });
    return false;
  }

  return (
    <div>
      <Card
        title="品牌资料库"
        extra={
          <Space>
            {canManage && <Tag color="gold">管理模式</Tag>}
            <Select
              style={{ width: 200 }}
              placeholder="选择客户"
              value={selectedId ?? undefined}
              options={wb.customers.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(v) => navigate(`/packaging/brand/${v}`)}
            />
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        {!customer && <Empty description="暂无客户，请先在「客户与质量」中添加客户" />}
        {customer && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography.Text type="secondary">
                「{customer.name}」旗下共 {brands.length} 个品牌
              </Typography.Text>
              {canManage && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openAddBrand(customer.id)}>
                  添加品牌
                </Button>
              )}
            </div>
            {brands.length === 0 && <Empty description="该客户尚未建立任何品牌资料" />}
            {brands.map((b) => (
              <Card
                key={b.id}
                type="inner"
                title={b.brandName ? `品牌：${b.brandName}` : "默认品牌"}
                extra={
                  canManage && (
                    <Space>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditBrand(b)}>
                        编辑
                      </Button>
                      <Popconfirm
                        title="删除该品牌资料"
                        description="将同时移除该品牌下所有资料文件，不可撤销"
                        okType="danger"
                        onConfirm={() => wb.removeBrandAsset(b.id)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  )
                }
              >
                <Space direction="vertical" size={14} style={{ width: "100%" }}>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>品牌 Logo</div>
                      <div
                        style={{
                          width: 160,
                          height: 120,
                          border: "1px dashed #d9d9d9",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#fafafa",
                          overflow: "hidden",
                        }}
                      >
                        {b.logoDataUrl ? (
                          <img
                            src={b.logoDataUrl}
                            alt="logo"
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          <span style={{ color: "#bfbfbf" }}>未上传</span>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>标准字体</div>
                      <Select
                        mode="tags"
                        style={{ width: "100%", marginBottom: 16 }}
                        placeholder="输入后回车添加字体"
                        value={b.fonts}
                        disabled={!canManage}
                        onChange={(fonts) => wb.updateBrandAsset(b.id, { fonts })}
                      />
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>使用规范</div>
                      <Input.TextArea
                        rows={4}
                        placeholder="例如：Logo 最小尺寸、安全边距、禁用背景色等"
                        value={b.usageSpec}
                        disabled={!canManage}
                        onChange={(e) => wb.updateBrandAsset(b.id, { usageSpec: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* 品牌资料文件 */}
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
                      品牌资料文件
                      {canManage && (
                        <Upload showUploadList={false} beforeUpload={(f) => uploadBrandFile(b, f)} accept={ACCEPTED_DOC_ACCEPT}>
                          <Button size="small" icon={<UploadOutlined />}>
                            上传
                          </Button>
                        </Upload>
                      )}
                    </div>
                    <Space direction="vertical" style={{ width: "100%" }} size={8}>
                      {(b.files ?? []).map((f) => (
                        <FileChip
                          key={f.id}
                          file={f}
                          onDelete={canManage ? () => { deleteStoredFile(f.id); wb.updateBrandAsset(b.id, { files: (b.files ?? []).filter((x) => x.id !== f.id) }); } : undefined}
                        />
                      ))}
                      {(b.files ?? []).length === 0 && (
                        <span style={{ color: "#bfbfbf", fontSize: 12 }}>暂无资料文件（支持 PDF/Word/Excel/图片）</span>
                      )}
                    </Space>
                  </div>

                  {/* 标准色值 */}
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
                      标准色值
                      {canManage && (
                        <Button
                          size="small"
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            colorForm.resetFields();
                            setColorModal({ open: true, color: null, assetId: b.id });
                          }}
                        >
                          添加色值
                        </Button>
                      )}
                    </div>
                    <Table<BrandColor>
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={b.colors}
                      locale={{ emptyText: <Empty description="暂无标准色值" /> }}
                      columns={[
                        {
                          title: "色样",
                          dataIndex: "hex",
                          width: 70,
                          render: (hex: string) => (
                            <div style={{ width: 28, height: 28, borderRadius: 6, background: hex, border: "1px solid #e8e8e8" }} />
                          ),
                        },
                        { title: "名称", dataIndex: "name" },
                        { title: "HEX", dataIndex: "hex", render: (v: string) => <Tag>{v}</Tag> },
                        { title: "CMYK", dataIndex: "cmyk", render: (v: string) => v || "—" },
                        { title: "Pantone", dataIndex: "pantone", render: (v: string) => v || "—" },
                        ...(canManage
                          ? [
                              {
                                title: "操作",
                                width: 110,
                                render: (_: unknown, c: BrandColor) => (
                                  <Space>
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<EditOutlined />}
                                      onClick={() => {
                                        colorForm.setFieldsValue(c);
                                        setColorModal({ open: true, color: c, assetId: b.id });
                                      }}
                                    />
                                    <Popconfirm
                                      title="删除该色值？"
                                      onConfirm={() =>
                                        wb.updateBrandAsset(b.id, { colors: b.colors.filter((x) => x.id !== c.id) })
                                      }
                                    >
                                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                  </Space>
                                ),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                  <div style={{ color: "#8c8c8c", fontSize: 12 }}>最近更新：{formatDate(b.updatedAt)}</div>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Card>

      {/* 品牌弹窗 */}
      <Modal
        title={brandModal.target ? "编辑品牌资料" : "添加品牌"}
        open={brandModal.open}
        onOk={submitBrand}
        onCancel={() => setBrandModal({ open: false, target: null, customerId: "" })}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={brandForm} layout="vertical">
          <Form.Item name="brandName" label="品牌名称" rules={[{ required: true, message: "请输入品牌名称" }]}>
            <Input placeholder="如：主品牌 / 子品牌 A" />
          </Form.Item>
          <Form.Item label="品牌 Logo">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 96,
                  height: 72,
                  border: "1px dashed #d9d9d9",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#fafafa",
                  overflow: "hidden",
                }}
              >
                {modalLogo ? (
                  <img src={modalLogo} alt="logo" style={{ maxWidth: "100%", maxHeight: "100%" }} />
                ) : (
                  <span style={{ color: "#bfbfbf", fontSize: 12 }}>未上传</span>
                )}
              </div>
              <Upload showUploadList={false} beforeUpload={uploadLogo} accept="image/*">
                <Button icon={<UploadOutlined />}>上传 Logo</Button>
              </Upload>
            </div>
          </Form.Item>
          <Form.Item name="fonts" label="标准字体（每行一个）">
            <Input.TextArea rows={2} placeholder="Microsoft YaHei&#10;PingFang SC" />
          </Form.Item>
          <Form.Item name="usageSpec" label="使用规范">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="资料文件（PDF/Word/Excel/图片）">
            <Space direction="vertical" style={{ width: "100%" }} size={8}>
              {(modalFiles ?? []).map((f) => (
                <FileChip
                  key={f.id}
                  file={f}
                  onDelete={(file) => { deleteStoredFile(file.id); setModalFiles(modalFiles.filter((x) => x.id !== file.id)); }}
                />
              ))}
              <Upload
                showUploadList={false}
                accept={ACCEPTED_DOC_ACCEPT}
                beforeUpload={async (file) => {
                  const loaded = await loadFiles([file], {
                    maxSize: MAX_FILE_SIZE,
                    onReject: (names) => message.warning(`已跳过：${names.join("、")}`),
                  });
                  if (loaded.length) setModalFiles([...modalFiles, ...loaded]);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />}>添加资料文件</Button>
              </Upload>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 色值弹窗 */}
      <Modal
        title={colorModal.color ? "编辑色值" : "添加色值"}
        open={colorModal.open}
        onOk={saveColor}
        onCancel={() => setColorModal({ open: false, color: null, assetId: null })}
        destroyOnClose
      >
        <Form form={colorForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input placeholder="如：品牌主红" />
          </Form.Item>
          <Form.Item
            name="hex"
            label="HEX 色值"
            rules={[
              { required: true, message: "请输入 HEX 色值" },
              { pattern: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, message: "格式如 #E60012" },
            ]}
          >
            <Input placeholder="#E60012" />
          </Form.Item>
          <Form.Item name="cmyk" label="CMYK" initialValue="">
            <Input placeholder="0,99,95,0" />
          </Form.Item>
          <Form.Item name="pantone" label="Pantone" initialValue="">
            <Input placeholder="Pantone 185C" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
