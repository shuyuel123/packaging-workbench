import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Button,
  Space,
  Tag,
  Tooltip,
  Popconfirm,
  Drawer,
  Descriptions,
  Typography,
  message,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Badge,
  Empty,
  Spin,
  Row,
  Col,
  Divider,
  Table,
  Card,
  Tree,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  UploadOutlined,
  DownloadOutlined,
  EyeOutlined,
  PaperClipOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileOutlined,
} from '@ant-design/icons';
import { ProTable, ProColumns, type ActionType } from '@ant-design/pro-table';
import { CheckUpdateButton } from '@/components/RegulationLibrary/CheckUpdateButton';
import { REGION_CONFIG, RegionKey } from '@/services/regulationService';
import {
  saveMeta,
  getMeta,
  saveFileToDB,
  deleteFileFromDB,
  getFilePreviewURL,
  getFileFromDB,
  StoredFile,
} from '@/utils/storageService';

const { Text, Paragraph, Title } = Typography;

// ==================== 1. 数据类型定义 ====================

export interface RegulationItem {
  id: string;
  region: RegionKey | string; // 区域代码
  regionLabel: string; // 区域显示名
  country: string; // 具体国家
  certifications: string[]; // 认证标志
  mandatoryItems: string[]; // 强制标注项
  warnings: string[]; // 安全警示语
  languages: string[]; // 目标语言
  standardRef: string; // 标准号
  standardName: string; // 标准全称
  productScope: 'all' | 'mobile_ac' | 'dehumidifier' | 'both'; // 适用产品
  attachments: string[]; // 文件ID列表
  fullDescription: string; // 详细描述
  updatedAt: string;
  updatedBy: string;
  createdAt: string;
}

// ==================== 2. 区域配置（用于下拉选项） ====================

const REGION_OPTIONS = Object.entries(REGION_CONFIG).map(([key, value]) => ({
  value: key,
  label: value.label,
}));

const PRODUCT_SCOPE_OPTIONS = [
  { value: 'all', label: '全部产品' },
  { value: 'mobile_ac', label: '移动空调' },
  { value: 'dehumidifier', label: '除湿机' },
  { value: 'both', label: '移动空调 + 除湿机' },
];

// ==================== 2.1 种子数据（REG-001~REG-006，复用现有 6 区域内容） ====================

const nowISO = () => new Date().toISOString();

const SEED_REGULATION_ITEMS: RegulationItem[] = [
  {
    id: 'REG-001',
    region: 'southeast_asia',
    regionLabel: '东南亚',
    country: '泰国',
    certifications: ['TISI', 'SNI', 'SIRIM', 'MEPS'],
    mandatoryItems: [
      '型号与额定制冷量(BTU/h·kW)标注',
      'SEER/EER 能效等级',
      '安规 IEC 60335-2-40',
      '噪音 dB(A) 标注',
      '冷媒类型与充注量',
      '原产国与进口商',
    ],
    warnings: ['安装须由专业人员', '冷媒可燃警示(R290/R32)', '移动空调排风管不得堵塞', '除湿机满水/溢水警示'],
    languages: ['泰文', '印尼文', '马来文', '越南文', '英文'],
    standardRef: 'TIS 2134-2565',
    standardName: '泰国空调能效标准(MEPS)',
    productScope: 'both',
    attachments: [],
    fullDescription:
      '东南亚各市场空调/移动空调/除湿机须本地认证 + 能效(MEPS)、IEC 60335-2-40 安规；进口商本地注册号必填；标签需本地语言。',
    updatedAt: nowISO(),
    updatedBy: '系统种子',
    createdAt: nowISO(),
  },
  {
    id: 'REG-002',
    region: 'latin_america',
    regionLabel: '中南美非',
    country: '巴西',
    certifications: ['INMETRO', 'NOM', 'PROCEL', 'ENERGY STAR'],
    mandatoryItems: [
      '西/葡双语标签',
      '额定制冷量(BTU/h)标注',
      'SEER/EER 能效(各该国)',
      '安规 IEC 60335-2-40',
      '噪音 dB(A) 标注',
      '进口商与批次号',
      '目的港准入证书(SONCAP/PVOC/COC)',
    ],
    warnings: [
      '能效标识依品类而定',
      '禁止误导性节能宣称',
      '移动空调禁止密闭空间使用',
      '各国准入要求差异大',
      '需提前确认目的港标准',
      '南非须 NRCS VC9004 安规',
    ],
    languages: ['西班牙语', '葡萄牙语', '英语', '阿拉伯语'],
    standardRef: 'Ordinance 371',
    standardName: '巴西空调 INMETRO 法规',
    productScope: 'both',
    attachments: [],
    fullDescription:
      '中南美非涵盖巴西/墨西哥/智利/阿根廷与尼日利亚/肯尼亚/南非/摩洛哥，认证各异(INMETRO/NOM/SONCAP/PVOC/NRCS)，须西/葡/英/阿双语标签，目的港准入证书为清关关键。',
    updatedAt: nowISO(),
    updatedBy: '系统种子',
    createdAt: nowISO(),
  },
  {
    id: 'REG-003',
    region: 'north_america',
    regionLabel: '北美',
    country: '美国',
    certifications: ['UL', 'ETL', 'FCC', 'DOE', 'Energy Star', 'NRCan'],
    mandatoryItems: [
      '英文标签',
      'UL/ETL 安全认证(UL 484)',
      '额定制冷量(BTU/h)',
      'SEER/EER(DOE 10 CFR 430)',
      'Energy Guide 标签',
      '噪音 dB(A) 标注',
      '冷媒类型与充注量',
    ],
    warnings: ['触电危险警示', '冷媒可燃性警示(R32/R290)', '加州 65 提案如适用', '移动空调禁止密闭空间使用'],
    languages: ['英语', '法语'],
    standardRef: 'UL 484',
    standardName: 'Standard for Room Air Conditioners',
    productScope: 'both',
    attachments: [],
    fullDescription:
      '北美安全认证(UL 484/ETL)强制；DOE 10 CFR 430 能效与 Energy Guide 标签；加拿大须英/法双语标签 + CSA/cUL + NRCan 能效。',
    updatedAt: nowISO(),
    updatedBy: '系统种子',
    createdAt: nowISO(),
  },
  {
    id: 'REG-004',
    region: 'europe_oceania',
    regionLabel: '欧澳',
    country: '德国',
    certifications: ['CE', 'GS', 'TÜV', 'ErP'],
    mandatoryItems: [
      'CE 标志(强制)',
      'ErP EU 206/2012 生态设计',
      'EU 能效标签 626/2011',
      '安规 EN 60335-2-40',
      'F-gas 517/2014',
      '噪音 dB(A) 标注',
      'WEEE 回收标识',
    ],
    warnings: ['禁止虚假能效宣称', '含氟气体(F-gas)标识要求', '冷媒可燃警示(R32/R290)'],
    languages: ['德语', '法语', '英语', '意大利语'],
    standardRef: 'EU 206/2012',
    standardName: 'ErP 生态设计条例',
    productScope: 'both',
    attachments: [],
    fullDescription:
      '欧澳须 CE 强制 + ErP 生态设计 + EU 能效标签(626/2011) + EN 60335-2-40 安规 + F-gas 517/2014 标识；各国语言标签(德/法/英/意)；脱欧后英国用 UKCA。',
    updatedAt: nowISO(),
    updatedBy: '系统种子',
    createdAt: nowISO(),
  },
  {
    id: 'REG-005',
    region: 'middle_east_africa',
    regionLabel: '中东非',
    country: '沙特阿拉伯',
    certifications: ['SASO', 'GSO', 'ESMA', 'ECAS'],
    mandatoryItems: [
      '阿拉伯文标签(本地语言)',
      'SASO/ESMA 认证',
      '额定制冷量(kW)标注',
      'SEER/EER 能效(各国)',
      '安规 IEC 60335-2-40',
      '冷媒类型与充注量',
      '原产国与进口商',
    ],
    warnings: ['安装安全警示', '冷媒可燃警示(R32/R290)', '安规与能效证书须随附'],
    languages: ['阿拉伯文', '英语'],
    standardRef: 'SASO 2663:2025',
    standardName: '沙特空调能效标准 2663',
    productScope: 'both',
    attachments: [],
    fullDescription:
      '中东非以海湾国家为主(沙特 SASO 2663/2874、阿联酋 ECAS、科威特 KUCAS、埃及 GOEIC)，须阿拉伯文标签 + IEC 60335-2-40 安规 + 能效证书随附。',
    updatedAt: nowISO(),
    updatedBy: '系统种子',
    createdAt: nowISO(),
  },
  {
    id: 'REG-006',
    region: 'china',
    regionLabel: '中国',
    country: '中国大陆',
    certifications: ['CCC', 'CEL', 'CQC'],
    mandatoryItems: [
      'CCC 强制认证(GB 4706.32 安规)',
      '中国能效标识(CEL)',
      '额定电流/电压(220V~/50Hz)',
      '冷媒类型与充注量',
      '防触电警示(GB 5296.2)',
      '产品型号与制造商/厂址',
    ],
    warnings: ['防触电危险警示', '冷媒可燃性警示(R32/R290)', '安装须由专业人员', '除湿机满水/溢水警示'],
    languages: ['中文'],
    standardRef: 'GB 4706.32',
    standardName: '家用和类似用途电器的安全 空调器特殊要求',
    productScope: 'both',
    attachments: [],
    fullDescription:
      '中国分体/移动空调须 CCC(GB 4706.32 安规) + 中国能效标识(CEL，GB 21455/GB 12021.3)；除湿机 CCC + GB 37480 能效；中文标签；港澳台各有差异(香港 BS MI、台湾 BSMI)。',
    updatedAt: nowISO(),
    updatedBy: '系统种子',
    createdAt: nowISO(),
  },
];

// ==================== 3. 文件预览组件 ====================

interface FileAttachmentProps {
  fileIds: string[];
}

const FileAttachment: React.FC<FileAttachmentProps> = ({ fileIds }) => {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    const loadFiles = async () => {
      if (!fileIds.length) {
        setFiles([]);
        return;
      }
      setLoading(true);
      try {
        const loaded: StoredFile[] = [];
        for (const id of fileIds) {
          const file = await getFileFromDB(id);
          if (file) loaded.push(file);
        }
        setFiles(loaded);
      } catch (error) {
        console.error('加载文件失败:', error);
        message.error('加载文件失败');
      } finally {
        setLoading(false);
      }
    };
    loadFiles();
  }, [fileIds]);

  // 组件卸载时清理预览 URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePreview = async (file: StoredFile) => {
    const url = await getFilePreviewURL(file.id);
    if (url) {
      setPreviewUrl(url);
      setPreviewVisible(true);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
    if (type.includes('image')) return <FileImageOutlined style={{ color: '#52c41a' }} />;
    if (type.includes('word') || type.includes('document'))
      return <FileWordOutlined style={{ color: '#1890ff' }} />;
    if (type.includes('excel') || type.includes('sheet'))
      return <FileExcelOutlined style={{ color: '#52c41a' }} />;
    return <FileOutlined />;
  };

  if (!fileIds.length) {
    return <Text type="secondary">无附件</Text>;
  }

  return (
    <>
      <Space wrap>
        {files.map((file) => (
          <Tooltip key={file.id} title={`${file.name} (${(file.size / 1024).toFixed(0)}KB)`}>
            <Button
              type="link"
              size="small"
              icon={getFileIcon(file.type)}
              onClick={() => handlePreview(file)}
            >
              {file.name.length > 12 ? file.name.slice(0, 12) + '...' : file.name}
            </Button>
          </Tooltip>
        ))}
        {loading && <Text type="secondary">加载中...</Text>}
      </Space>

      <Modal
        title="文件预览"
        open={previewVisible}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
          <Button key="download" type="primary" onClick={() => window.open(previewUrl)}>
            下载
          </Button>,
        ]}
        onCancel={() => {
          setPreviewVisible(false);
          URL.revokeObjectURL(previewUrl);
        }}
        width="80%"
        style={{ maxWidth: 1000 }}
        bodyStyle={{ height: '70vh', overflow: 'auto', padding: 0 }}
      >
        {previewUrl && (
          <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
        )}
      </Modal>
    </>
  );
};

// ==================== 4. 新增/编辑弹窗 ====================

interface RegulationFormModalProps {
  visible: boolean;
  editingRecord?: RegulationItem | null;
  onSave: (data: Omit<RegulationItem, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>) => void;
  onCancel: () => void;
}

const RegulationFormModal: React.FC<RegulationFormModalProps> = ({
  visible,
  editingRecord,
  onSave,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);

  // 当编辑记录变化时填充表单
  useEffect(() => {
    if (editingRecord && visible) {
      form.setFieldsValue({
        ...editingRecord,
        // 区域需要转为字符串，因为 Select 的 value 是 string
        region: editingRecord.region as string,
      });
      setUploadedFileIds(editingRecord.attachments || []);
    } else if (visible) {
      form.resetFields();
      setUploadedFileIds([]);
    }
  }, [editingRecord, visible, form]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const stored = await saveFileToDB(file);
      setUploadedFileIds((prev) => [...prev, stored.id]);
      message.success(`已上传: ${file.name}`);
    } catch (error) {
      message.error('文件上传失败');
    } finally {
      setUploading(false);
    }
    return false; // 阻止自动上传
  };

  const handleRemoveFile = async (fileId: string) => {
    await deleteFileFromDB(fileId);
    setUploadedFileIds((prev) => prev.filter((id) => id !== fileId));
    message.success('文件已删除');
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      onSave({
        ...values,
        attachments: uploadedFileIds,
      });
      form.resetFields();
      setUploadedFileIds([]);
    });
  };

  return (
    <Modal
      title={editingRecord ? '编辑法规' : '新增法规'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      width={800}
      okText="保存"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="region"
              label="目标区域"
              rules={[{ required: true, message: '请选择区域' }]}
            >
              <Select placeholder="请选择区域" options={REGION_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="country"
              label="具体国家"
              rules={[{ required: true, message: '请输入国家' }]}
            >
              <Input placeholder="如: 美国、沙特" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="standardRef"
              label="标准号"
              rules={[{ required: true, message: '请输入标准号' }]}
            >
              <Input placeholder="如: UL 484" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="standardName" label="标准全称">
              <Input placeholder="如: Standard for Room Air Conditioners" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="certifications"
          label="认证标志（用逗号分隔）"
          rules={[{ required: true, message: '请至少填写一个认证标志' }]}
        >
          <Select
            mode="tags"
            placeholder="输入认证标志，回车添加，如 UL, CSA, CE"
            tokenSeparators={[',', '，']}
          />
        </Form.Item>

        <Form.Item
          name="mandatoryItems"
          label="强制标注项（用逗号分隔）"
          rules={[{ required: true, message: '请至少填写一个强制标注项' }]}
        >
          <Select
            mode="tags"
            placeholder="输入强制标注项，如 电压/频率, 功率标注, 能效等级"
            tokenSeparators={[',', '，']}
          />
        </Form.Item>

        <Form.Item
          name="warnings"
          label="安全警示语（用逗号分隔）"
          rules={[{ required: true, message: '请至少填写一条警示语' }]}
        >
          <Select
            mode="tags"
            placeholder="输入安全警示语，如 高温表面警告, 电气安全警告"
            tokenSeparators={[',', '，']}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="languages"
              label="目标语言（用逗号分隔）"
              rules={[{ required: true, message: '请至少选择一种语言' }]}
            >
              <Select
                mode="tags"
                placeholder="如 英语, 法语, 阿拉伯语"
                tokenSeparators={[',', '，']}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="productScope"
              label="适用产品范围"
              initialValue="all"
            >
              <Select options={PRODUCT_SCOPE_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="fullDescription" label="详细规范说明">
          <Input.TextArea rows={3} placeholder="补充详细说明..." />
        </Form.Item>

        <Form.Item label="法规参考文件">
          <Upload
            beforeUpload={handleFileUpload}
            showUploadList={false}
            disabled={uploading}
          >
            <Button icon={<UploadOutlined />} loading={uploading}>
              上传文件
            </Button>
          </Upload>
          <div style={{ marginTop: 8 }}>
            <Space wrap>
              {uploadedFileIds.map((id) => (
                <Tag
                  key={id}
                  closable
                  onClose={() => handleRemoveFile(id)}
                  icon={<PaperClipOutlined />}
                >
                  #{id.slice(-8)}
                </Tag>
              ))}
            </Space>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            支持 PDF、图片、Word、Excel，单个文件 ≤ 15MB
          </Text>
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ==================== 4.1 卡片视图 ====================

interface RegulationCardViewProps {
  items: RegulationItem[];
  onView: (record: RegulationItem) => void;
  onEdit: (record: RegulationItem) => void;
  onDuplicate: (record: RegulationItem) => void;
  onDelete: (record: RegulationItem) => void;
}

const RegulationCardView: React.FC<RegulationCardViewProps> = ({
  items,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  return (
    <Row gutter={[16, 16]}>
      {items.map((item) => (
        <Col xs={24} sm={12} md={8} xl={6} key={item.id}>
          <Card
            size="small"
            hoverable
            title={
              <Space>
                <Tag color="blue">{item.regionLabel}</Tag>
                <Text strong>{item.country}</Text>
              </Space>
            }
            extra={
              <Tag>
                {PRODUCT_SCOPE_OPTIONS.find((o) => o.value === item.productScope)?.label || '全部'}
              </Tag>
            }
            actions={[
              <Tooltip title="查看详情" key="view">
                <EyeOutlined onClick={() => onView(item)} />
              </Tooltip>,
              <Tooltip title="编辑" key="edit">
                <EditOutlined onClick={() => onEdit(item)} />
              </Tooltip>,
              <Tooltip title="复制" key="copy">
                <CopyOutlined onClick={() => onDuplicate(item)} />
              </Tooltip>,
              <Popconfirm
                key="del"
                title="确定要删除该法规吗？"
                description="删除后不可恢复，关联文件也将被清除。"
                onConfirm={() => onDelete(item)}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="删除">
                  <DeleteOutlined />
                </Tooltip>
              </Popconfirm>,
            ]}
          >
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <div>
                <Text type="secondary">标准号：</Text>
                <Tag color="purple">{item.standardRef}</Tag>
              </div>
              <div>
                <Text type="secondary">认证：</Text>
                <Space wrap size={[4, 4]}>
                  {item.certifications.map((c) => (
                    <Tag key={c} color="green" style={{ margin: 0 }}>
                      {c}
                    </Tag>
                  ))}
                </Space>
              </div>
              <div>
                <Text type="secondary">语言：</Text>
                <Text>{item.languages.join('、')}</Text>
              </div>
              <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                {item.fullDescription}
              </Paragraph>
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

// ==================== 5. 主组件 ====================

const RegulationLibrary: React.FC = () => {
  const [dataSource, setDataSource] = useState<RegulationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RegulationItem | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState<RegulationItem | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [cardSearch, setCardSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<string | null>(null);

  // 区域选项（数据驱动）
  const regionOptions = useMemo(
    () => Array.from(new Set(dataSource.map((d) => d.regionLabel))).map((r) => ({ value: r, label: r })),
    [dataSource]
  );

  // 统一筛选：区域 + 产品范围 + 关键词（布局逻辑参考包装物料模块的 Select 筛选条）
  const filtered = useMemo(() => {
    const kw = cardSearch.trim().toLowerCase();
    return dataSource.filter((it) => {
      if (regionFilter && it.regionLabel !== regionFilter) return false;
      if (scopeFilter && it.productScope !== scopeFilter) return false;
      if (kw) {
        const hay = [it.regionLabel, it.country, it.standardRef, it.standardName, it.region]
          .concat(it.certifications, it.languages, it.mandatoryItems, it.warnings)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [dataSource, regionFilter, scopeFilter, cardSearch]);

  // 左侧区域树数据：按 region 分组 -> 国家（叶子节点含完整描述）
  const regionTreeData = useMemo(() => {
    const map = new Map<string, RegulationItem[]>();
    dataSource.forEach((it) => {
      const key = it.regionLabel;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    });
    return Array.from(map.entries()).map(([region, items]) => ({
      key: `region:${region}`,
      selectable: true,
      title: (
        <Space>
          <Tag color="blue">{region}</Tag>
          <Badge count={items.length} showZero />
        </Space>
      ),
      children: items.map((it) => ({
        key: `country:${it.id}`,
        isLeaf: true,
        title: (
          <div>
            <Space size={4} wrap>
              <Text strong>{it.country}</Text>
              <Tag color="purple">{it.standardRef}</Tag>
            </Space>
            <div style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {it.fullDescription}
              </Text>
            </div>
          </div>
        ),
      })),
    }));
  }, [dataSource]);

  const actionRef = useRef<ActionType>();

  // ==================== 数据加载 ====================

  const loadData = useCallback(() => {
    setLoading(true);
    try {
      let stored = getMeta<RegulationItem[]>('regulations');
      // 首次运行：注入 REG-001~REG-006 种子（写入 wb_meta_regulations）
      if (stored === null) {
        stored = SEED_REGULATION_ITEMS;
        saveMeta('regulations', stored);
      }
      // 按更新时间降序排序
      const sorted = [...stored].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setDataSource(sorted);
    } catch (error) {
      console.error('加载法规数据失败:', error);
      message.error('加载法规数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==================== 数据持久化 ====================

  const saveData = useCallback((data: RegulationItem[]) => {
    saveMeta('regulations', data);
    setDataSource(data);
    actionRef.current?.reload();
  }, []);

  const generateId = () => `REG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ==================== CRUD 操作 ====================

  const handleAdd = (
    values: Omit<RegulationItem, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>
  ) => {
    const newItem: RegulationItem = {
      ...values,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: '当前用户',
    };
    saveData([...dataSource, newItem]);
    message.success('法规添加成功');
    setModalVisible(false);
  };

  const handleEdit = (
    values: Omit<RegulationItem, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>
  ) => {
    if (!editingRecord) return;
    const updated: RegulationItem = {
      ...editingRecord,
      ...values,
      updatedAt: new Date().toISOString(),
      updatedBy: '当前用户',
    };
    const newData = dataSource.map((item) =>
      item.id === editingRecord.id ? updated : item
    );
    saveData(newData);
    message.success('法规更新成功');
    setModalVisible(false);
    setEditingRecord(null);
  };

  const handleDelete = useCallback((record: RegulationItem) => {
    // 同时删除关联文件
    if (record.attachments?.length) {
      record.attachments.forEach((id) => deleteFileFromDB(id).catch((e) => console.error('删除关联文件失败:', e)));
    }
    const newData = dataSource.filter((item) => item.id !== record.id);
    saveData(newData);
    message.success('已删除');
  }, [dataSource, saveData]);

  const handleDuplicate = useCallback((record: RegulationItem) => {
    const newItem: RegulationItem = {
      ...record,
      id: generateId(),
      regionLabel: `${record.regionLabel} (副本)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: '当前用户',
    };
    saveData([...dataSource, newItem]);
    message.success('已复制');
  }, [dataSource, saveData]);

  // ==================== 列定义 ====================

  const columns = useMemo<ProColumns<RegulationItem>[]>(() => [
    {
      title: '序号',
      dataIndex: 'index',
      valueType: 'index',
      width: 60,
      fixed: 'left',
    },
    {
      title: '区域',
      dataIndex: 'regionLabel',
      key: 'regionLabel',
      width: 100,
      fixed: 'left',
      filters: REGION_OPTIONS.map((opt) => ({
        text: opt.label,
        value: opt.label,
      })),
      onFilter: (value, record) => record.regionLabel === value,
      render: (_, record) => (
        <Tooltip title={record.region}>
          <Tag color="blue">{record.regionLabel}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 90,
      ellipsis: true,
      render: (_, record) => <Text>{record.country}</Text>,
    },
    {
      title: '认证标志',
      dataIndex: 'certifications',
      key: 'certifications',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <Space wrap size={[4, 4]}>
          {record.certifications.slice(0, 3).map((cert) => (
            <Tag key={cert} color="green" style={{ margin: 0 }}>
              {cert}
            </Tag>
          ))}
          {record.certifications.length > 3 && (
            <Tag style={{ margin: 0 }}>+{record.certifications.length - 3}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '强制标注项',
      dataIndex: 'mandatoryItems',
      key: 'mandatoryItems',
      width: 160,
      ellipsis: true,
      render: (_, record) => (
        <Tooltip title={record.mandatoryItems.join('、')}>
          <Text>
            {record.mandatoryItems.slice(0, 3).join('、')}
            {record.mandatoryItems.length > 3 && '...'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '警示语',
      dataIndex: 'warnings',
      key: 'warnings',
      width: 160,
      ellipsis: true,
      render: (_, record) => (
        <Tooltip title={record.warnings.join('\n')}>
          <Text type="secondary">
            {record.warnings.slice(0, 2).join('、')}
            {record.warnings.length > 2 && '...'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '标准号',
      dataIndex: 'standardRef',
      key: 'standardRef',
      width: 120,
      ellipsis: true,
      render: (_, record) => (
        <Tooltip title={record.standardName || record.standardRef}>
          <Tag color="purple">{record.standardRef}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '语言',
      dataIndex: 'languages',
      key: 'languages',
      width: 110,
      ellipsis: true,
      render: (_, record) => (
        <Tooltip title={record.languages.join('、')}>
          <Text>
            {record.languages.slice(0, 2).join('、')}
            {record.languages.length > 2 && '...'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '产品范围',
      dataIndex: 'productScope',
      key: 'productScope',
      width: 100,
      filters: PRODUCT_SCOPE_OPTIONS.map((opt) => ({
        text: opt.label,
        value: opt.value,
      })),
      onFilter: (value, record) => record.productScope === value,
      render: (_, record) => {
        const map = {
          all: '全部',
          mobile_ac: '移动空调',
          dehumidifier: '除湿机',
          both: '空调+除湿机',
        };
        return <Tag>{map[record.productScope] || '全部'}</Tag>;
      },
    },
    {
      title: '附件',
      dataIndex: 'attachments',
      key: 'attachments',
      width: 100,
      render: (_, record) => <FileAttachment fileIds={record.attachments || []} />,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      valueType: 'dateTime',
      sorter: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setDrawerRecord(record);
                setDrawerVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingRecord(record);
                setModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleDuplicate(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除该法规吗？"
            description="删除后不可恢复，关联文件也将被清除。"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleDelete, handleDuplicate]);

  // ==================== 渲染 ====================

  return (
    <Card
      title={
        <Space>
          <span>市场法规库</span>
          <Badge count={dataSource.length} showZero style={{ backgroundColor: '#52c41a' }} />
        </Space>
      }
      extra={
        <Space wrap>
          <CheckUpdateButton key="check" buttonText="检查法规更新" size="middle" />
          <Button
            key="add"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRecord(null);
              setModalVisible(true);
            }}
          >
            新增法规
          </Button>
          <Button key="import" icon={<UploadOutlined />}>
            导入
          </Button>
          <Button key="export" icon={<DownloadOutlined />}>
            导出
          </Button>
          <Button
            key="toggle"
            icon={viewMode === 'table' ? <AppstoreOutlined /> : <UnorderedListOutlined />}
            onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}
          >
            {viewMode === 'table' ? '卡片视图' : '表格视图'}
          </Button>
        </Space>
      }
    >
      {/* 筛选条：参考包装物料模块的 Select 筛选 + 搜索 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder="按区域"
          style={{ width: 160 }}
          value={regionFilter ?? undefined}
          onChange={(v) => setRegionFilter(v ?? null)}
          options={regionOptions}
        />
        <Select
          allowClear
          placeholder="按产品范围"
          style={{ width: 160 }}
          value={scopeFilter ?? undefined}
          onChange={(v) => setScopeFilter(v ?? null)}
          options={PRODUCT_SCOPE_OPTIONS}
        />
        <Input.Search
          placeholder="搜索区域 / 国家 / 标准号 / 认证标志"
          allowClear
          value={cardSearch}
          onChange={(e) => setCardSearch(e.target.value)}
          style={{ width: 280 }}
        />
        {(regionFilter || scopeFilter || cardSearch) && (
          <Button
            onClick={() => {
              setRegionFilter(null);
              setScopeFilter(null);
              setCardSearch('');
            }}
          >
            重置筛选
          </Button>
        )}
      </Space>

      {viewMode === 'table' ? (
        <ProTable<RegulationItem>
          columns={columns}
          dataSource={filtered}
          loading={loading}
          actionRef={actionRef}
          rowKey="id"
          search={false}
          options={{
            density: true, // 密度切换
            fullScreen: true, // 全屏
            reload: loadData, // 刷新
            setting: true, // 列设置
          }}
          pagination={{
            defaultPageSize: 20,
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
          }}
          // 行展开（查看完整描述）
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: 16, background: '#fafafa', borderRadius: 4 }}>
                <Row gutter={16}>
                  <Col span={24}>
                    <Title level={5}>📄 详细规范</Title>
                    <Paragraph>{record.fullDescription || '暂无详细描述'}</Paragraph>
                  </Col>
                </Row>
                <Divider style={{ margin: '8px 0' }} />
                <Row gutter={16}>
                  <Col span={8}>
                    <Text type="secondary">标准名称：</Text>
                    <Text>{record.standardName || '-'}</Text>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">创建时间：</Text>
                    <Text>{new Date(record.createdAt).toLocaleString()}</Text>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">最后更新：</Text>
                    <Text>{new Date(record.updatedAt).toLocaleString()}</Text>
                  </Col>
                </Row>
              </div>
            ),
            rowExpandable: (record) => !!record.fullDescription,
          }}
          // 行选择（批量操作）
          rowSelection={{
            selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT],
            defaultSelectedRowKeys: [],
          }}
          tableAlertRender={({ selectedRowKeys }) => (
            <span>
              已选 <a style={{ fontWeight: 600 }}>{selectedRowKeys.length}</a> 项
            </span>
          )}
          tableAlertOptionRender={({ selectedRowKeys, onCleanSelected }) => (
            <Space>
              <Button size="small" onClick={onCleanSelected}>
                取消选择
              </Button>
              <Button size="small" type="primary">
                批量导出
              </Button>
              <Popconfirm
                title="确定要批量删除选中的法规吗？"
                onConfirm={() => {
                  const ids = new Set(selectedRowKeys);
                  const remaining = dataSource.filter((item) => !ids.has(item.id));
                  // 删除关联文件
                  dataSource
                    .filter((item) => ids.has(item.id))
                    .forEach((item) => {
                      item.attachments?.forEach((id) => deleteFileFromDB(id).catch((e) => { console.error('删除文件失败:', e); }));
                    });
                  saveData(remaining);
                  onCleanSelected();
                  message.success('已批量删除');
                }}
              >
                <Button size="small" danger>
                  批量删除
                </Button>
              </Popconfirm>
            </Space>
          )}
          scroll={{ x: 1600 }}
          sticky
          bordered
        />
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* 左侧：按区域分类的树，点击区域行 ▶ 展开查看每个国家完整描述；点击国家打开详情 */}
          <div
            style={{
              width: 300,
              flexShrink: 0,
              borderRight: '1px solid #f0f0f0',
              paddingRight: 12,
              maxHeight: '75vh',
              overflow: 'auto',
            }}
          >
            <Tree
              treeData={regionTreeData}
              defaultExpandAll
              blockNode
              selectedKeys={regionFilter ? [`region:${regionFilter}`] : []}
              onSelect={(keys) => {
                const key = keys.length ? String(keys[0]) : null;
                if (!key) {
                  setRegionFilter(null);
                  return;
                }
                if (key.startsWith('region:')) {
                  setRegionFilter(key.slice('region:'.length));
                } else if (key.startsWith('country:')) {
                  const id = key.slice('country:'.length);
                  const item = dataSource.find((d) => d.id === id);
                  if (item) {
                    setDrawerRecord(item);
                    setDrawerVisible(true);
                  }
                }
              }}
            />
          </div>

          {/* 右侧：卡片网格（受统一筛选驱动） */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <Spin size="large" tip="加载法规数据中..." />
              </div>
            ) : filtered.length ? (
              <RegulationCardView
                items={filtered}
                onView={(r) => {
                  setDrawerRecord(r);
                  setDrawerVisible(true);
                }}
                onEdit={(r) => {
                  setEditingRecord(r);
                  setModalVisible(true);
                }}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Empty description="没有匹配的法规，试试调整筛选条件" />
              </div>
            )}
          </div>
        </div>
      )}
      <RegulationFormModal
        visible={modalVisible}
        editingRecord={editingRecord}
        onSave={editingRecord ? handleEdit : handleAdd}
        onCancel={() => {
          setModalVisible(false);
          setEditingRecord(null);
        }}
      />

      {/* ===== 详情抽屉 ===== */}
      <Drawer
        title={
          <Space>
            <Tag color="blue">{drawerRecord?.regionLabel}</Tag>
            <Text strong>{drawerRecord?.country}</Text>
          </Space>
        }
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                if (drawerRecord) {
                  setEditingRecord(drawerRecord);
                  setModalVisible(true);
                  setDrawerVisible(false);
                }
              }}
            >
              编辑
            </Button>
          </Space>
        }
      >
        {drawerRecord && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="区域">{drawerRecord.regionLabel}</Descriptions.Item>
            <Descriptions.Item label="国家">{drawerRecord.country}</Descriptions.Item>
            <Descriptions.Item label="认证标志">
              <Space wrap>
                {drawerRecord.certifications.map((c) => (
                  <Tag key={c} color="green">
                    {c}
                  </Tag>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="强制标注项">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {drawerRecord.mandatoryItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Descriptions.Item>
            <Descriptions.Item label="安全警示语">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {drawerRecord.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Descriptions.Item>
            <Descriptions.Item label="目标语言">
              <Space wrap>
                {drawerRecord.languages.map((lang) => (
                  <Tag key={lang}>{lang}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="标准号">{drawerRecord.standardRef}</Descriptions.Item>
            <Descriptions.Item label="标准全称">{drawerRecord.standardName || '-'}</Descriptions.Item>
            <Descriptions.Item label="产品范围">
              {PRODUCT_SCOPE_OPTIONS.find((o) => o.value === drawerRecord.productScope)?.label || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="详细说明">
              <Paragraph>{drawerRecord.fullDescription || '无'}</Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="附件">
              <FileAttachment fileIds={drawerRecord.attachments || []} />
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(drawerRecord.createdAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {new Date(drawerRecord.updatedAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </Card>
  );
};

export default RegulationLibrary;
