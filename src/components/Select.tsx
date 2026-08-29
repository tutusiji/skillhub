import React, { useMemo } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

interface SelectProps
  extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    'size' | 'value' | 'onChange' | 'children' | 'defaultValue'
  > {
  /** 尺寸：md 用于表单字段（占满容器宽度），sm 用于筛选工具栏/紧凑场景 */
  size?: 'md' | 'sm';
  /** 视觉变体：default 带边框；ghost 无边框（用于已带边框的胶囊/工具栏容器内，如详情页版本选择器） */
  variant?: 'default' | 'ghost';
  /** 当前选中值（受控） */
  value?: string;
  /** 值变更回调（保持原生 select 的 event 签名，调用点无需改动） */
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  /** 空值占位文案；若子元素中有 value="" 的 option，则自动以其文案为占位 */
  placeholder?: string;
  /** 原生 <option>/<optgroup> 子元素 */
  children?: React.ReactNode;
}

/** 类型守卫：原生 <option> 元素 */
const isOptionElement = (
  n: React.ReactNode,
): n is React.ReactElement<{ value?: unknown; children?: React.ReactNode }> =>
  React.isValidElement(n) && n.type === 'option';

/** 类型守卫：原生 <optgroup> 元素 */
const isOptgroupElement = (
  n: React.ReactNode,
): n is React.ReactElement<{ label?: string; children?: React.ReactNode }> =>
  React.isValidElement(n) && n.type === 'optgroup';

/**
 * 全站统一 Select（基于 @radix-ui/react-select）
 * 原生 select 弹出的选项列表由浏览器绘制、无法定制圆角/样式，这里改用 Radix 受控面板：
 * - 面板经 Portal 渲染到 body，配合 popper 定位/自动翻转，不被 Modal 的 overflow 裁剪；
 * - 面板圆角/悬停高亮/选中勾/键盘导航/禁用态统一；
 * - 子元素仍写原生 <option>/<optgroup>，由本组件解析为 Radix Select.Item，调用点 API 不变。
 * 表单字段用 size="md"，筛选工具栏/排序用 size="sm"。
 */
export const Select: React.FC<SelectProps> = ({
  size = 'md',
  variant = 'default',
  value,
  onChange,
  placeholder,
  className = '',
  children,
  ...rest
}) => {
  // 提取 value="" 的空占位 option 文案作为 placeholder（如「-- 请选择 --」）
  const emptyPlaceholder = useMemo(() => {
    let label: React.ReactNode = null;
    React.Children.forEach(children, child => {
      if (isOptionElement(child) && String(child.props.value ?? '') === '') {
        label = child.props.children;
      }
    });
    return label;
  }, [children]);

  const renderOption = (option: React.ReactElement<{ value?: unknown; children?: React.ReactNode }>) => (
    <SelectPrimitive.Item
      key={String(option.props.value)}
      value={String(option.props.value)}
      className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-lg py-2 pl-3 pr-8 text-xs text-slate-800 outline-none data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-900"
    >
      <SelectPrimitive.ItemText>{option.props.children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2.5 text-indigo-600">
        <Check className="h-3.5 w-3.5" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );

  // 将原生 <option>/<optgroup> 子元素解析为 Radix Select.Item（value="" 的占位项不渲染 Item）
  const items = useMemo(
    () =>
      React.Children.map(children, child => {
        if (isOptgroupElement(child)) {
          return (
            <SelectPrimitive.Group key={String(child.props.label)}>
              <SelectPrimitive.Label className="px-3 py-1.5 text-[11px] font-bold text-slate-400">
                {child.props.label}
              </SelectPrimitive.Label>
              {React.Children.map(child.props.children, c =>
                isOptionElement(c) && String(c.props.value ?? '') !== '' ? renderOption(c) : null,
              )}
            </SelectPrimitive.Group>
          );
        }
        if (isOptionElement(child) && String(child.props.value ?? '') !== '') {
          return renderOption(child);
        }
        return null;
      }),
    [children],
  );

  // 合成与原生 select 兼容的 change 事件，调用点仍通过 e.target.value 读取
  const handleValueChange = (next: string) => {
    if (onChange) {
      onChange({ target: { value: next } } as React.ChangeEvent<HTMLSelectElement>);
    }
  };

  const triggerCls = [
    'group flex items-center justify-between gap-2 rounded-xl text-xs text-slate-800 outline-none transition-colors cursor-pointer',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variant === 'ghost'
      ? 'bg-transparent border border-transparent px-2 py-1 hover:bg-indigo-100/60 data-[state=open]:bg-indigo-100/60'
      : size === 'sm'
        ? 'border border-slate-300 bg-white px-3 py-1.5 focus:ring-2 focus:ring-indigo-500/40 data-[state=open]:border-indigo-500 data-[state=open]:ring-2 data-[state=open]:ring-indigo-500/40'
        : 'w-full border border-slate-300 bg-white px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500/40 data-[state=open]:border-indigo-500 data-[state=open]:ring-2 data-[state=open]:ring-indigo-500/40',
    className,
  ].join(' ');

  const contentCls = [
    'z-[60] min-w-[var(--radix-select-trigger-width)] rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-200/60',
    className.includes('font-mono') ? 'font-mono' : '',
  ].join(' ');

  return (
    <SelectPrimitive.Root value={value} onValueChange={handleValueChange} disabled={rest.disabled}>
      <SelectPrimitive.Trigger
        className={triggerCls}
        title={rest.title}
        aria-label={rest['aria-label']}
      >
        <SelectPrimitive.Value placeholder={emptyPlaceholder ?? placeholder ?? '请选择'} />
        <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className={contentCls} position="popper" sideOffset={4}>
          <SelectPrimitive.Viewport className="max-h-[min(320px,60vh)] overflow-y-auto p-0.5">
            {items}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
};
