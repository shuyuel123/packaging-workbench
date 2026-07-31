import type { ReactNode } from "react";

/** 权限级别（保留类型以便后续接入后端账号体系） */
export type RequireRole = "view" | "edit" | "admin";

interface Props {
  /** 所需权限级别（单管理员模式下恒放行） */
  require?: RequireRole;
  children: ReactNode;
  /** 无权限时的占位（单管理员模式下始终展示 children） */
  fallback?: ReactNode;
}

/**
 * 权限门控组件。
 * 当前采用单管理员模式：无需登录即可使用全部功能，故恒放行 children。
 * 保留 require / fallback 签名，便于后续接入真实账号体系时平滑迁移。
 */
export function PermissionGate({ require: _require, children, fallback = null }: Props) {
  void _require;
  void fallback;
  return <>{children}</>;
}
