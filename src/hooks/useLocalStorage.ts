import { useState, useEffect } from 'react';

/**
 * 受类型校验保护的 localStorage 同步 Hook
 *
 * - 首次渲染时从 localStorage 读，初值缺失 / JSON 解析失败 / 类型校验失败一律回退到 defaultValue
 * - value 变化时写回 localStorage；写入失败（quota / 隐私模式）静默吞掉，不影响 UI
 * - validate 是可选的「值合法吗」断言；不传则视为任意 JSON 都接受
 *
 * 注意：此 Hook 用于**用户偏好**（视图模式、过滤器选项等），不应用于业务数据。
 *       业务数据始终以数据库/后端为单一真相源。
 *
 * @example
 *   const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
 *     'skillhub_view_mode_market',
 *     'grid',
 *     (v): v is ViewMode => v === 'grid' || v === 'table',
 *   );
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  validate?: (raw: unknown) => raw is T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultValue;
      const parsed: unknown = JSON.parse(raw);
      if (validate && !validate(parsed)) return defaultValue;
      return parsed as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 写入失败（quota / Safari 隐私模式 / SSR）静默吞掉 — 偏好丢失不影响功能
    }
  }, [key, value]);

  return [value, setValue];
}
