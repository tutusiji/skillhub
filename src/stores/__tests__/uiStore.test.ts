import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../uiStore';
import { makeSkill } from '../../test/factories';

/**
 * UI 层全局弹窗 store 单测：open/close、登录引导文案、
 * 多版本发布上下文、元数据编辑上下文、命令面板切换、详情加载态。
 */

const RESET = {
  showUploadModal: false,
  showCreateDemandModal: false,
  showFeedbackModal: false,
  newVersionContext: null,
  editingSkill: null,
  showCommandPalette: false,
  showLoginModal: false,
  loginActionHint: undefined,
  detailLoading: false,
};

beforeEach(() => {
  useUiStore.setState(RESET);
});

describe('uiStore 上传/征集/反馈弹窗', () => {
  it('openUploadModal / closeUploadModal', () => {
    useUiStore.getState().openUploadModal();
    expect(useUiStore.getState().showUploadModal).toBe(true);
    useUiStore.getState().closeUploadModal();
    expect(useUiStore.getState().showUploadModal).toBe(false);
  });

  it('openCreateDemandModal / closeCreateDemandModal', () => {
    useUiStore.getState().openCreateDemandModal();
    expect(useUiStore.getState().showCreateDemandModal).toBe(true);
    useUiStore.getState().closeCreateDemandModal();
    expect(useUiStore.getState().showCreateDemandModal).toBe(false);
  });

  it('openFeedbackModal / closeFeedbackModal', () => {
    useUiStore.getState().openFeedbackModal();
    expect(useUiStore.getState().showFeedbackModal).toBe(true);
    useUiStore.getState().closeFeedbackModal();
    expect(useUiStore.getState().showFeedbackModal).toBe(false);
  });
});

describe('uiStore 登录弹窗与引导文案', () => {
  it('openLoginModal 写入引导文案并打开', () => {
    useUiStore.getState().openLoginModal('发布技能征集');
    expect(useUiStore.getState().showLoginModal).toBe(true);
    expect(useUiStore.getState().loginActionHint).toBe('发布技能征集');
  });

  it('closeLoginModal 关闭但保留引导文案（等待下次打开覆盖）', () => {
    useUiStore.getState().openLoginModal('发布技能征集');
    useUiStore.getState().closeLoginModal();
    expect(useUiStore.getState().showLoginModal).toBe(false);
    expect(useUiStore.getState().loginActionHint).toBe('发布技能征集');
  });

  it('不传 hint 打开时清除引导文案（Header 主动打开场景）', () => {
    useUiStore.getState().openLoginModal('发布技能征集');
    useUiStore.getState().openLoginModal(undefined);
    expect(useUiStore.getState().showLoginModal).toBe(true);
    expect(useUiStore.getState().loginActionHint).toBeUndefined();
  });
});

describe('uiStore 上下文与命令面板', () => {
  it('setNewVersionContext 记录/清空多版本发布上下文', () => {
    useUiStore.getState().setNewVersionContext({ parentSkillId: 's1', parentSkillName: '旧版' });
    expect(useUiStore.getState().newVersionContext).toEqual({
      parentSkillId: 's1',
      parentSkillName: '旧版',
    });
    useUiStore.getState().setNewVersionContext(null);
    expect(useUiStore.getState().newVersionContext).toBeNull();
  });

  it('setEditingSkill 记录/清空正在编辑的技能', () => {
    const skill = makeSkill({ id: 's1' });
    useUiStore.getState().setEditingSkill(skill);
    expect(useUiStore.getState().editingSkill?.id).toBe('s1');
    useUiStore.getState().setEditingSkill(null);
    expect(useUiStore.getState().editingSkill).toBeNull();
  });

  it('toggleCommandPalette 取反 / open / close', () => {
    useUiStore.getState().toggleCommandPalette();
    expect(useUiStore.getState().showCommandPalette).toBe(true);
    useUiStore.getState().toggleCommandPalette();
    expect(useUiStore.getState().showCommandPalette).toBe(false);
    useUiStore.getState().openCommandPalette();
    expect(useUiStore.getState().showCommandPalette).toBe(true);
    useUiStore.getState().closeCommandPalette();
    expect(useUiStore.getState().showCommandPalette).toBe(false);
  });

  it('setDetailLoading 切换详情直达加载态', () => {
    useUiStore.getState().setDetailLoading(true);
    expect(useUiStore.getState().detailLoading).toBe(true);
    useUiStore.getState().setDetailLoading(false);
    expect(useUiStore.getState().detailLoading).toBe(false);
  });
});
