import React, { useState } from "react";
import {
  Button,
  Spin,
  Modal,
  List,
  Tag,
  Typography,
  Space,
  Alert,
  Tooltip,
  Empty,
} from "antd";
import {
  ReloadOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import {
  checkRegionUpdates,
  checkAllRegions,
  CheckUpdateResult,
  filterByKeywords,
  type RegionKey,
} from "../../services/regulationService";

const { Text } = Typography;

interface CheckUpdateButtonProps {
  /** 传了则只检查该区域；不传则一键检查所有区域 */
  regionKey?: RegionKey | string;
  /** 自定义区域展示名 */
  regionLabel?: string;
  /** 用于结果高亮的关键词 */
  regionKeywords?: string[];
  buttonText?: string;
  size?: "small" | "middle" | "large";
}

export const CheckUpdateButton: React.FC<CheckUpdateButtonProps> = ({
  regionKey,
  regionLabel,
  regionKeywords = [],
  buttonText = "检查法规更新",
  size = "middle",
}) => {
  const [loading, setLoading] = useState(false);
  const [single, setSingle] = useState<CheckUpdateResult | null>(null);
  const [allResults, setAllResults] = useState<CheckUpdateResult[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const hasRegion = !!regionKey;

  const handleCheck = async () => {
    setLoading(true);
    try {
      if (hasRegion) {
        const r = await checkRegionUpdates(regionKey as string, regionLabel);
        setSingle(r);
        setAllResults([]);
      } else {
        const arr = await checkAllRegions();
        setAllResults(arr);
        setSingle(null);
      }
      setModalVisible(true);
    } catch (error) {
      console.error("检查失败:", error);
      Modal.error({
        title: "检查失败",
        content: "无法获取法规更新信息，请稍后重试。如果持续失败，请手动访问官网确认。",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderItems = (result: CheckUpdateResult, keywords: string[]) => {
    const relevant = keywords.length ? filterByKeywords(result.items, keywords) : [];
    const display = relevant.length ? relevant : result.items;
    const highlight = relevant.length > 0;

    if (display.length === 0) {
      return (
        <Alert
          type="info"
          showIcon
          message="暂未发现该区域的法规变更新闻"
          description="建议定期关注目标市场监管机构官网"
        />
      );
    }

    return (
      <List
        size="small"
        dataSource={display.slice(0, 20)}
        renderItem={(item) => {
          const isRelevant = keywords.some((kw) =>
            (item.title + (item.contentSnippet || ""))
              .toLowerCase()
              .includes(kw.toLowerCase())
          );
          return (
            <List.Item
              actions={[
                <a
                  key="link"
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <LinkOutlined /> 原文
                </a>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {highlight && isRelevant && <Tag color="red">相关</Tag>}
                    <a href={item.link} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  </Space>
                }
                description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.contentSnippet || "无摘要"}
                    {" · "}
                    {new Date(item.pubDate).toLocaleDateString()}
                  </Text>
                }
              />
            </List.Item>
          );
        }}
      />
    );
  };

  const renderBody = () => {
    if (hasRegion) {
      if (!single) return <Empty description="暂无数据" />;
      if (single.error) return <Alert type="error" showIcon message={single.error} />;
      const kws = regionKeywords.length ? regionKeywords : single.keywords;
      return (
        <div>
          <Space style={{ marginBottom: 12 }}>
            <Tag color={single.hasUpdates ? "success" : "default"}>
              {single.hasUpdates ? `发现 ${single.items.length} 条` : "未发现更新"}
            </Tag>
            <Text type="secondary">
              <ClockCircleOutlined /> 检查于{" "}
              {new Date(single.checkedAt).toLocaleString()}
            </Text>
          </Space>
          {renderItems(single, kws)}
        </div>
      );
    }

    if (!allResults.length) return <Empty description="暂无数据" />;
    return (
      <div>
        <Text type="secondary">
          <ClockCircleOutlined /> 检查于{" "}
          {new Date(allResults[0].checkedAt).toLocaleString()}
        </Text>
        {allResults.map((r) => (
          <div key={r.region} style={{ marginTop: 16 }}>
            <Space style={{ marginBottom: 4 }}>
              <Text strong>{r.regionLabel}</Text>
              <Tag color={r.hasUpdates ? "success" : "default"}>
                {r.hasUpdates ? `${r.items.length} 条` : "无更新"}
              </Tag>
            </Space>
            {r.error ? (
              <Alert type="warning" showIcon message={r.error} />
            ) : (
              renderItems(r, r.keywords)
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Tooltip title="从 Google News 经 CORS 代理抓取目标市场法规动态">
        <Button
          type="primary"
          icon={loading ? <Spin size="small" /> : <ReloadOutlined />}
          onClick={handleCheck}
          loading={loading}
          size={size}
          disabled={loading}
        >
          {buttonText}
        </Button>
      </Tooltip>

      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: "#52c41a" }} />
            <span>
              法规更新检查
              {hasRegion
                ? ` · ${regionLabel || single?.regionLabel || ""}`
                : " · 全部区域"}
            </span>
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="refresh"
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => {
              setModalVisible(false);
              setTimeout(handleCheck, 300);
            }}
            loading={loading}
          >
            重新检查
          </Button>,
        ]}
        width={760}
      >
        {renderBody()}
      </Modal>
    </>
  );
};
