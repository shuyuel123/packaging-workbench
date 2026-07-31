import { useState } from "react";
import { Card, Select, Tag, Empty, List, Typography } from "antd";
import { useWorkbench } from "../../state/WorkbenchContext";
import { MARKET_COLOR } from "../../lib/ui";
import { type MarketKey } from "../../types";

const { Paragraph, Text } = Typography;

export function Regulations() {
  const wb = useWorkbench();
  const [market, setMarket] = useState<MarketKey>(
    (wb.regulations[0]?.market as MarketKey) ?? "southeast_asia"
  );
  const reg = wb.regulations.find((r) => r.market === market);

  return (
    <Card title="市场法规库">
      <Select
        style={{ width: 240, marginBottom: 16 }}
        value={market}
        onChange={setMarket}
        options={wb.regulations.map((r) => ({ value: r.market as MarketKey, label: r.marketName }))}
      />
      {!reg ? (
        <Empty description="暂无该市场法规" />
      ) : (
        <div>
          <Paragraph>
            <Text strong>必检项：</Text>
          </Paragraph>
          <div style={{ marginBottom: 16 }}>
            {reg.requiredChecks.map((c) => (
              <Tag key={c} color="blue" style={{ marginBottom: 6 }}>
                {c}
              </Tag>
            ))}
          </div>
          <Paragraph>
            <Text strong>认证标志：</Text>
          </Paragraph>
          <div style={{ marginBottom: 16 }}>
            {reg.certMarks.map((c) => (
              <Tag key={c} color={MARKET_COLOR[market]} style={{ marginBottom: 6 }}>
                {c}
              </Tag>
            ))}
          </div>
          <Paragraph>
            <Text strong>警示语规范：</Text>
          </Paragraph>
          <List
            size="small"
            dataSource={reg.warnings}
            renderItem={(w) => (
              <List.Item>
                <Tag color="red">警示</Tag>
                {w}
              </List.Item>
            )}
          />
        </div>
      )}
    </Card>
  );
}
