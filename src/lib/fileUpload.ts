import { message } from "antd";
import type { OrderFile } from "../types";
import { saveFileToDB, getFilePreviewURL } from "../utils/storageService";

/** 支持的资料/印刷件格式：PDF / Word / Excel / 图片 */
export const ACCEPTED_DOC_EXT = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"];
export const ACCEPTED_DOC_ACCEPT = ACCEPTED_DOC_EXT.join(",");

/** 单文件大小上限（15MB）。文件本体存 IndexedDB，此限制仅用于拦截异常大文件 */
export const MAX_FILE_SIZE = 15 * 1024 * 1024;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function isDocAllowed(name: string): boolean {
  return ACCEPTED_DOC_EXT.includes(extOf(name));
}

export interface LoadFilesOptions {
  /** 仅允许指定扩展名（默认 ACCEPTED_DOC_EXT） */
  allowed?: string[];
  maxSize?: number;
  uploadedBy?: string;
  onReject?: (names: string[]) => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * 将 FileList / File[] 读取为 OrderFile[]。
 * 文件本体写入 IndexedDB（按 id 存取），业务元数据只保留 id / 名称 / 类型 / 大小，
 * 不再内联 dataUrl，从而摆脱 localStorage 5~10MB 的容量瓶颈。
 */
export async function loadFiles(list: FileList | File[], opts: LoadFilesOptions = {}): Promise<OrderFile[]> {
  const allowed = opts.allowed ?? ACCEPTED_DOC_EXT;
  const maxSize = opts.maxSize ?? MAX_FILE_SIZE;
  const files = Array.from(list);
  const rejected: string[] = [];
  const out: OrderFile[] = [];
  for (const f of files) {
    if (!allowed.includes(extOf(f.name))) {
      rejected.push(f.name);
      continue;
    }
    if (f.size > maxSize) {
      rejected.push(`${f.name}(超出 ${Math.round(maxSize / 1024 / 1024)}MB 限制)`);
      continue;
    }
    try {
      const stored = await saveFileToDB(f);
      out.push({
        id: stored.id,
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
        addedAt: Date.now(),
        uploadedBy: opts.uploadedBy,
      });
    } catch {
      rejected.push(f.name);
    }
  }
  if (rejected.length && opts.onReject) opts.onReject(rejected);
  return out;
}

/** 解析文件可访问的 URL：优先 IndexedDB 中的 Blob，回退到旧数据的 dataUrl */
async function resolveFileUrl(file: OrderFile): Promise<string | null> {
  const url = await getFilePreviewURL(file.id);
  if (url) return url;
  if (file.dataUrl) return file.dataUrl;
  return null;
}

/** 触发浏览器下载 */
export async function downloadFile(file: OrderFile): Promise<void> {
  const url = await resolveFileUrl(file);
  if (!url) {
    message.warning("文件内容缺失，无法下载");
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 下载完成后延迟释放 object URL；dataUrl 无需释放
  if (url.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 预览：图片/PDF 新标签打开，其余回退为下载 */
export async function previewFile(file: OrderFile): Promise<void> {
  const url = await resolveFileUrl(file);
  if (!url) {
    message.warning("该文件暂不支持预览");
    return;
  }
  window.open(url, "_blank");
}

/** 仅读取图片为 dataUrl（用于品牌 Logo 等需长期内联的小图） */
export function readImageDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) return Promise.reject(new Error("仅支持图片文件"));
  return readAsDataUrl(file);
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
