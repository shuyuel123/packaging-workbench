/**
 * 双引擎存储服务
 * ------------------------------------------------------------------
 * - IndexedDB：存文件 Blob（PDF / 图片 / SVG 等，容量大，通常 >500MB）
 * - localStorage：存业务元数据（订单、法规、品牌等 JSON 对象，体积小）
 *
 * 设计目标：解决「所有附件以 dataUrl 内联存储」导致的 localStorage 5~10MB
 * 容量瓶颈——一个 15MB 的 PDF 直接撑爆，且 base64 还会再膨胀约 1/3。
 * 现在文件本体只进 IndexedDB，业务数据里仅保留文件 id / 名称 / 类型 / 大小。
 */

// ==================== 一、IndexedDB 文件存储引擎 ====================

const DB_NAME = "WorkbenchDB";
const DB_VERSION = 1;
const STORE_NAME = "fileStore";

/** 文件元数据结构（存于 IndexedDB 的 value 中） */
export interface StoredFile {
  id: string; // 唯一ID，timestamp + random
  name: string; // 原始文件名
  type: string; // MIME类型 (如 'application/pdf')
  size: number; // 文件大小 (bytes)
  blob: Blob; // 文件本体
  uploadedAt: string; // ISO 时间戳
  uploadedBy?: string; // 上传人 / 'AI智能审核'
}

/** 打开/创建数据库（带版本升级建表） */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = (event) =>
      resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
};

/** 生成唯一文件 id */
const genFileId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** 保存 File 对象（自动转为 Blob 存储） */
export const saveFileToDB = async (file: File): Promise<StoredFile> => {
  const storedFile: StoredFile = {
    id: genFileId(),
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    blob: file, // File 是 Blob 的子类，直接存
    uploadedAt: new Date().toISOString(),
  };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(storedFile);
    req.onsuccess = () => resolve(storedFile);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
};

/** 保存任意 Blob（用于 AI 生成的 SVG 批注等，非来自 <input type=file>） */
export const saveBlobToDB = async (
  name: string,
  type: string,
  blob: Blob,
  uploadedBy?: string
): Promise<StoredFile> => {
  const storedFile: StoredFile = {
    id: genFileId(),
    name,
    type,
    size: blob.size,
    blob,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
  };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(storedFile);
    req.onsuccess = () => resolve(storedFile);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
};

/** 根据 id 获取 StoredFile（含 Blob） */
export const getFileFromDB = async (id: string): Promise<StoredFile | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as StoredFile) || null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
};

/** 仅取 Blob（用于生成预览 / dataUrl） */
export const getFileBlob = async (id: string): Promise<Blob | null> => {
  const stored = await getFileFromDB(id);
  return stored ? stored.blob : null;
};

/** 获取文件预览 URL（object URL，用毕需 revokeObjectURL 释放） */
export const getFilePreviewURL = async (id: string): Promise<string | null> => {
  const stored = await getFileFromDB(id);
  if (!stored) return null;
  return URL.createObjectURL(stored.blob);
};

/** 删除单个文件 */
export const deleteFileFromDB = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
};

/** 批量删除（清理订单/品牌/法规时调用） */
export const deleteMultipleFilesFromDB = async (ids: string[]): Promise<void> => {
  if (!ids.length) return;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  await Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((resolve, reject) => {
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
    )
  );
  db.close();
};

/** Blob → dataUrl（AI 批注需把图片内嵌进 SVG，必须用 base64 而非 object URL） */
export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

// ==================== 二、localStorage 业务元数据引擎 ====================

const META_PREFIX = "wb_meta_"; // 防止 key 冲突

/** 保存业务对象（自动序列化 JSON） */
export const saveMeta = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(`${META_PREFIX}${key}`, JSON.stringify(data));
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      console.error("localStorage 容量已满，请清理无用数据", e);
      alert("存储空间不足！请导出备份后清理历史数据。");
    } else {
      throw e;
    }
  }
};

/** 读取业务对象 */
export const getMeta = <T>(key: string): T | null => {
  const raw = localStorage.getItem(`${META_PREFIX}${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/** 删除业务对象 */
export const removeMeta = (key: string): void => {
  localStorage.removeItem(`${META_PREFIX}${key}`);
};

/** 获取所有业务 Key（用于数据导出/备份） */
export const getAllMetaKeys = (): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(META_PREFIX)) keys.push(k.replace(META_PREFIX, ""));
  }
  return keys;
};

// ==================== 三、旧数据迁移（dataUrl → IndexedDB） ====================

const MIGRATE_FLAG = "wb_idb_migrated_v1";

/**
 * 将历史 localStorage 中内联的 dataUrl 文件迁移到 IndexedDB，并剥离 dataUrl。
 * - 仅处理业务主数据里的 files（订单/法规库/品牌资产），跳过 AI 批注附件
 *   （其 id 被 issue.attachments 引用，迁移会改变 id 导致断链）。
 * - 仅在成功写入 IndexedDB 后才剥离 dataUrl，避免文件丢失。
 * - 通过 MIGRATE_FLAG 保证只执行一次。
 * @returns 是否发生了实际变更（变更后需调用方重新 saveData 持久化）
 */
export async function migrateInlineFilesToIDB(data: {
  orders?: { files?: Array<{ id: string; name: string; type: string; dataUrl?: string; uploadedBy?: string }> }[];
  regLibs?: { files?: Array<{ id: string; name: string; type: string; dataUrl?: string; uploadedBy?: string }> }[];
  brandAssets?: { files?: Array<{ id: string; name: string; type: string; dataUrl?: string; uploadedBy?: string }> }[];
}): Promise<boolean> {
  if (localStorage.getItem(MIGRATE_FLAG)) return false;
  let changed = false;
  const groups = [data.orders ?? [], data.regLibs ?? [], data.brandAssets ?? []];
  for (const group of groups) {
    for (const item of group) {
      const files = (item as { files?: any[] }).files;
      if (!Array.isArray(files)) continue;
      for (const f of files) {
        if (f.uploadedBy === "AI智能审核") continue; // 附件不迁移
        if (f.dataUrl && f.dataUrl.startsWith("data:")) {
          try {
            const blob = await (await fetch(f.dataUrl)).blob();
            const stored = await saveBlobToDB(f.name, f.type, blob, f.uploadedBy);
            f.id = stored.id; // 元数据指向 IndexedDB 中的新记录
            f.dataUrl = undefined; // 从 localStorage 剥离
            changed = true;
          } catch {
            // 写入失败则保留原 dataUrl，保证文件不丢
          }
        }
      }
    }
  }
  localStorage.setItem(MIGRATE_FLAG, "1");
  return changed;
}

/** 兼容别名：从 IndexedDB 删除单个文件 */
export const deleteStoredFile = deleteFileFromDB;
