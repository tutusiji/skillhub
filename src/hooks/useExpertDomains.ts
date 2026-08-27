// 兼容层：本文件保留是为了不破坏 8 个组件已有的 `import { useExpertDomains } from '../hooks/useExpertDomains'`。
// 真正的实现已迁出至 src/contexts/ExpertDomainsContext.tsx：全应用由 <ExpertDomainsProvider>
// 统一发起一次 /api/v1/expert-domains 请求，所有消费者从 Context 读取，避免每个组件实例各自 fetch。
// 之前 8 个调用方 + SkillCard 在列表里被 map 渲染 N 次，曾造成集市刷新一次就产生 20+ 次重复请求。
export {
  useExpertDomains,
  ExpertDomainsProvider,
  mapExpertDomain,
  type ExpertDomainsContextValue,
} from '../contexts/ExpertDomainsContext';
