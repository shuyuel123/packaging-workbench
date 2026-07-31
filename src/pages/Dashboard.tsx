import { Card, Row, Col, List, Timeline, Tag, Checkbox, Empty, Button, Space } from "antd";
import {
  CheckSquareOutlined,
  WarningOutlined,
  CalendarOutlined,
  ProjectOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useWorkbench } from "../state/WorkbenchContext";
import { StatCard } from "../components/StatCard";
import { ProgressBar } from "../components/ProgressBar";
import { PriorityTag } from "../components/PriorityTag";
import {
  isToday,
  isOverdue,
  startOfWeek,
} from "../lib/date";
import { formatDate, relativeTime } from "../lib/storage";

export function Dashboard() {
  const wb = useWorkbench();
  const navigate = useNavigate();
  const weekStart = startOfWeek(Date.now());

  const todayTodos = wb.items
    .filter((i) => i.status !== "done" && isToday(i.dueDate))
    .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));

  const doneThisWeek = wb.items.filter(
    (i) => i.status === "done" && i.doneAt && i.doneAt >= weekStart
  ).length;
  const doingThisWeek = wb.items.filter((i) => i.status === "doing").length;
  const newThisWeek = wb.items.filter((i) => i.createdAt >= weekStart).length;

  const wk = wb.weeklyReports.find((r) => r.weekStart === weekStart);

  // 最近动态
  const activity = [
    ...wb.items.map((i) => ({
      ts: i.updatedAt,
      text: `待办更新：${i.title}`,
      kind: "item",
    })),
    ...wb.orders.map((o) => ({
      ts: o.updatedAt,
      text: `订单状态更新：${o.productModel}`,
      kind: "order",
    })),
    ...wb.weeklyReports.map((r) => ({
      ts: r.updatedAt,
      text: `周报${r.submitted ? "已提交" : "已保存"}：${r.weekLabel}`,
      kind: "weekly",
    })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} lg={6}>
          <StatCard
            title="进行中项目"
            value={wb.stats.inProgressProjects}
            icon={<ProjectOutlined />}
            color="#10b981"
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard
            title="今日待办"
            value={wb.stats.todayTodos}
            icon={<CheckSquareOutlined />}
            color="#3b82f6"
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard
            title="逾期任务"
            value={wb.stats.overdue}
            icon={<WarningOutlined />}
            color="#ef4444"
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard
            title="本周周报"
            value={wb.stats.weeklyThisWeek}
            icon={<CalendarOutlined />}
            color="#8b5cf6"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* 项目总览 */}
        <Col xs={24} lg={14}>
          <Card title="项目总览" extra={<Button type="link" onClick={() => navigate("/projects")}>全部<RightOutlined /></Button>}>
            <Row gutter={[12, 12]}>
              {wb.projects.map((p) => {
                const related = wb.items.filter((i) => i.projectId === p.id);
                const done = related.filter((i) => i.status === "done").length;
                const percent = related.length ? (done / related.length) * 100 : 0;
                return (
                  <Col xs={24} sm={12} key={p.id}>
                    <div
                      style={{ border: "1px solid #f0f0f0", borderRadius: 10, padding: 14, cursor: "pointer" }}
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600 }}>
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: p.color, marginRight: 8 }} />
                          {p.name}
                        </span>
                        <Tag>{p.stage}</Tag>
                      </div>
                      <div style={{ margin: "10px 0 4px" }}>
                        <ProgressBar percent={percent} color={p.color} />
                      </div>
                      <Space size={4} wrap>
                        <Tag color="blue">待办 {related.filter((i) => i.status !== "done").length}</Tag>
                        <Tag color="red">逾期 {related.filter((i) => i.status !== "done" && isOverdue(i.dueDate)).length}</Tag>
                        <Tag color="green">本周 {related.filter((i) => i.status === "done" && i.doneAt && i.doneAt >= weekStart).length}</Tag>
                      </Space>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>
        </Col>

        {/* 本周周报状态 + 今日待办 */}
        <Col xs={24} lg={10}>
          <Card title="本周周报状态" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Space>
                <Tag color={wk?.submitted ? "green" : "orange"}>
                  {wk?.submitted ? "已提交" : "未提交"}
                </Tag>
                <span style={{ color: "#8c8c8c" }}>本周（{wk?.weekLabel ?? "进行中"}）</span>
              </Space>
              <Space>
                <Tag color="green">完成 {doneThisWeek}</Tag>
                <Tag color="blue">进行 {doingThisWeek}</Tag>
                <Tag color="default">新增 {newThisWeek}</Tag>
              </Space>
              <Button type="primary" ghost onClick={() => navigate("/weekly")}>
                写 / 查看周报
              </Button>
            </Space>
          </Card>

          <Card
            title="今日待办"
            extra={<Button type="link" onClick={() => navigate("/todos")}>全部<RightOutlined /></Button>}
          >
            {todayTodos.length === 0 ? (
              <Empty description="今天没有待办 🎉" />
            ) : (
              <List
                dataSource={todayTodos}
                renderItem={(i) => (
                  <List.Item
                    actions={[<PriorityTag key="p" priority={i.priority} />]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Checkbox
                          checked={i.status === "done"}
                          onChange={() => wb.toggleDone(i.id)}
                        />
                      }
                      title={
                        <span
                          style={{
                            textDecoration: i.status === "done" ? "line-through" : "none",
                          }}
                        >
                          {i.title}
                        </span>
                      }
                      description={formatDate(i.dueDate)}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 最近动态 */}
      <Card title="最近动态" style={{ marginTop: 16 }}>
        {activity.length === 0 ? (
          <Empty description="暂无动态" />
        ) : (
          <Timeline
            items={activity.map((a) => ({
              children: (
                <span>
                  <span style={{ color: "#595959" }}>{a.text}</span>
                  <span style={{ color: "#bfbfbf", marginLeft: 8 }}>{relativeTime(a.ts)}</span>
                </span>
              ),
            }))}
          />
        )}
      </Card>
    </div>
  );
}
