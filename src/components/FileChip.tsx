import { Button, Tag, Tooltip } from "antd";
import {
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FileUnknownOutlined,
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  RobotOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import type { OrderFile } from "../types";
import { downloadFile, previewFile, formatSize } from "../lib/fileUpload";

function iconOf(f: OrderFile) {
  const t = f.type;
  if (t === "application/pdf") return <FilePdfOutlined style={{ color: "#cf1322" }} />;
  if (t.includes("word") || /\.(doc|docx)$/i.test(f.name)) return <FileWordOutlined style={{ color: "#1677ff" }} />;
  if (t.includes("excel") || /\.(xls|xlsx)$/i.test(f.name)) return <FileExcelOutlined style={{ color: "#389e0d" }} />;
  if (t.startsWith("image/")) return <FileImageOutlined style={{ color: "#722ed1" }} />;
  return <FileUnknownOutlined style={{ color: "#8c8c8c" }} />;
}

export interface FileChipProps {
  file: OrderFile;
  /** 显示删除按钮 */
  onDelete?: (file: OrderFile) => void;
  /** 显示替换按钮（如法规文件替换） */
  onReplace?: (file: OrderFile) => void;
  /** 紧凑模式（列表行） */
  compact?: boolean;
}

export function FileChip({ file, onDelete, onReplace, compact }: FileChipProps) {
  const isAI = file.uploadedBy === "AI智能审核";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: compact ? "4px 8px" : "8px 10px",
        borderRadius: 8,
        border: "1px solid #f0f0f0",
        background: "#fafafa",
      }}
    >
      {iconOf(file)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: 500,
          }}
          title={file.name}
        >
          {file.name}
        </div>
        <div style={{ fontSize: 12, color: "#999" }}>{formatSize(file.size)}</div>
      </div>
      {isAI && (
        <Tag icon={<RobotOutlined />} color="blue">
          AI智能审核
        </Tag>
      )}
      <Tooltip title="预览">
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => previewFile(file)}
        />
      </Tooltip>
      <Tooltip title="下载">
        <Button
          type="text"
          size="small"
          icon={<DownloadOutlined />}
          onClick={() => downloadFile(file)}
        />
      </Tooltip>
      {onReplace && (
        <Tooltip title="替换">
          <Button type="text" size="small" icon={<SwapOutlined />} onClick={() => onReplace(file)} />
        </Tooltip>
      )}
      {onDelete && (
        <Tooltip title="删除">
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(file)} />
        </Tooltip>
      )}
    </div>
  );
}
