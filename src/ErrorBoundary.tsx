import React from "react";

interface State {
  error: Error | null;
  info: string;
}

/** 顶层错误边界：捕获任何渲染期异常，直接在页面上显示错误与组件栈 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: "" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info: info.componentStack ?? "" });
  }

  render() {
    const { error, info } = this.state;
    if (error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: "monospace",
            color: "#cf1322",
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
          }}
        >
          <h2>运行时错误（来自错误边界）</h2>
          <div id="eb-name" style={{ fontWeight: 700, marginBottom: 8 }}>
            {`[${(error as Error)?.name ?? "UnknownError"}] ${
              (error as Error)?.message || String(error) || "(空消息)"
            }`}
          </div>
          <h3>JS 调用栈</h3>
          <pre id="eb-stack" style={{ background: "#fff1f0", padding: 12, borderRadius: 8 }}>
            {(error as Error)?.stack ?? "(无 stack)"}
          </pre>
          <h3>组件栈</h3>
          <pre id="eb-info" style={{ background: "#fff1f0", padding: 12, borderRadius: 8 }}>{info}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
