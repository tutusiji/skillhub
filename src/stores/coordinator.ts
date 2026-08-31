import { api, mapApiUser, mapAuditRule, mapApiDemand, mapApiSkill } from '../services/api';
import { isOwnSubmission } from '../utils/skillOwnership';
import { useAuthStore } from './authStore';
import { useSkillsStore } from './skillsStore';
import { useDemandsStore } from './demandsStore';
import { useRulesStore } from './rulesStore';
import { useToastStore } from './toastStore';

/**
 * 跨 store 编排（coordinator）：组合拉取与跨表联动集中在此，保持各 store
 * 无环依赖（store 间只经 getState 单向读取，不做相互 import 的动作编排）。
 * 依赖 DAG：→ authStore、skillsStore、demandsStore、rulesStore、toastStore、api。
 */

/**
 * 从后端拉取集市主数据（技能 / 规则 / 征集需求）
 *
 * 技能列表以数据库为唯一权威：审核通过、下架、删除等变更都只有重新拉取才能看到，
 * 因此既用于首屏启动，也用于「进入技能集市」时的重新校准。
 * 本地交互态（收藏/点赞标记）在合并时保留，避免刷新数据把用户的星标视觉重置。
 * @returns 是否成功拉到技能列表
 */
export async function fetchMarketData(): Promise<boolean> {
  const [skillsResult, rulesResult, demandsResult] = await Promise.allSettled([
    api.listSkills(),
    api.listAuditRules(),
    api.listDemands(),
  ]);

  if (skillsResult.status === 'fulfilled') {
    const fresh = skillsResult.value.map(mapApiSkill);
    // store 内合并：保留本地收藏/点赞标记（后端未持久化「谁点过」），并置在线/已加载
    useSkillsStore.getState().setSkillsFromServer(fresh);
  }
  if (rulesResult.status === 'fulfilled') {
    useRulesStore.getState().setRules(rulesResult.value.map(mapAuditRule));
  }
  if (demandsResult.status === 'fulfilled') {
    useDemandsStore.getState().setDemands(demandsResult.value.map(mapApiDemand));
  }

  if (
    skillsResult.status === 'rejected' &&
    rulesResult.status === 'rejected' &&
    demandsResult.status === 'rejected'
  ) {
    useSkillsStore.getState().setBackendOnline(false);
    // 标记为已加载：否则后端不可用时集市会永远停在骨架加载态
    useSkillsStore.getState().setSkillsLoaded(true);
    console.warn('SkillHub backend unavailable.', skillsResult.reason);
  }

  return skillsResult.status === 'fulfilled';
}

/**
 * 个人中心「换一个头像」：随机切换当前用户头像
 *
 * seed 由后端生成并落库（同时刷新业务表快照），前端只负责把返回的新头像
 * 铺到所有引用点：currentUser、组织成员列表，以及 skills / demands 里
 * 冗余存的作者头像 —— 这三张表的头像是快照，不跟着 users 自动变，
 * 漏掉任何一处就会出现「个人中心换了脸、集市里还是旧脸」。
 */
export async function shuffleAvatar(): Promise<void> {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser) return;

  try {
    const updated = await api.shuffleMyAvatar();
    const nextAvatar = mapApiUser(updated).avatar;

    // currentUser / allUsers 已收敛到 authStore：setter 收纯值，先 getState 读现值再写回
    const authState = useAuthStore.getState();
    authState.setCurrentUser(
      authState.currentUser ? { ...authState.currentUser, avatar: nextAvatar } : null,
    );
    authState.setAllUsers(
      authState.allUsers.map((u) => (u.id === updated.id ? { ...u, avatar: nextAvatar } : u)),
    );
    // 本地同步作者头像：优先按 submitterId 精确匹配，历史数据没有该字段时
    // 才回落姓名比对（与 isOwnSubmission 的判定口径保持一致）
    useSkillsStore.setState((state) => ({
      skills: state.skills.map((s) =>
        isOwnSubmission(s, currentUser)
          ? { ...s, author: { ...s.author, avatar: nextAvatar } }
          : s,
      ),
    }));
    useDemandsStore.setState((state) => ({
      demands: state.demands.map((d) =>
        d.author.id === updated.id
          ? { ...d, author: { ...d.author, avatar: nextAvatar } }
          : d,
      ),
    }));
    useToastStore
      .getState()
      .addToast('success', '头像已更新', '已为你随机生成一个新头像');
  } catch (error) {
    useToastStore.getState().addToast('error', '头像更新失败', (error as Error).message);
  }
}
