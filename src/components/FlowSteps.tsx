import { Steps, Button, Tag } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  type Order,
} from "../types";
import { getOrderTimeout } from "../lib/date";
import { PermissionGate } from "./PermissionGate";

export function FlowSteps({
  order,
  onAdvance,
}: {
  order: Order;
  onAdvance: () => void;
}) {
  const idx = ORDER_STATUS_FLOW.indexOf(order.status);
  const timeout = getOrderTimeout(order);
  const isLast = idx >= ORDER_STATUS_FLOW.length - 1;

  const items = ORDER_STATUS_FLOW.map((s, i) => ({
    title: ORDER_STATUS_LABEL[s],
    description:
      i === idx && timeout.message ? (
        <span style={{ color: timeout.overdue ? "#ff4d4f" : timeout.warn ? "#fa8c16" : undefined }}>
          {timeout.message}
        </span>
      ) : undefined,
  }));

  return (
    <div>
      <Steps
        current={idx}
        labelPlacement="vertical"
        size="small"
        items={items}
        style={{ marginBottom: 12 }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <PermissionGate
          require="edit"
          fallback={<Tag color="default">查看者不可推进流程</Tag>}
        >
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            disabled={isLast}
            onClick={onAdvance}
          >
            {isLast ? "已结案" : "推进到下一状态"}
          </Button>
        </PermissionGate>
        {timeout.overdue && <Tag color="red">回传超时</Tag>}
        {timeout.warn && <Tag color="orange">审核待处理</Tag>}
      </div>
    </div>
  );
}
