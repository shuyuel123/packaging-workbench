import { Card, Button, Tag, Empty, Space } from "antd";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useWorkbench } from "../state/WorkbenchContext";
import { PermissionGate } from "../components/PermissionGate";

export function Weekly() {
  const wb = useWorkbench();
  const navigate = useNavigate();
  const list = [...wb.weeklyReports].sort((a, b) => b.weekStart - a.weekStart);

  function newWeekly() {
    const r = wb.ensureWeeklyForWeek();
    navigate(`/weekly/${r.weekStart}`);
  }

  return (
    <Card
      title="周报中心"
      extra={
        <PermissionGate require="edit" fallback={<Tag>查看者</Tag>}>
          <Button type="primary" icon={<PlusOutlined />} onClick={newWeekly}>
            新建本周周报
          </Button>
        </PermissionGate>
      }
    >
      {list.length === 0 ? (
        <Empty description="还没有周报，点击右上角新建" />
      ) : (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {list.map((r) => (
            <div
              key={r.id}
              style={{ border: "1px solid #f0f0f0", borderRadius: 10, padding: 16 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Space>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{r.weekLabel}</span>
                  <Tag color={r.submitted ? "green" : "orange"}>
                    {r.submitted ? "已提交" : "未提交"}
                  </Tag>
                </Space>
                <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/weekly/${r.weekStart}`)}>
                  编辑
                </Button>
              </div>
              <div style={{ color: "#595959", marginTop: 8, whiteSpace: "pre-wrap" }}>
                {r.content || r.autoSummary}
              </div>
            </div>
          ))}
        </Space>
      )}
    </Card>
  );
}
