import { test, expect, type Page } from '@playwright/test';

/**
 * SkillHub 前端 E2E 冒烟（只读，不写库）。
 *
 * 覆盖核心风险清单：
 * - 集市首屏渲染 + 进入技能详情（/skill/:slug 路径路由）
 * - 详情深链刷新不白屏（selectedSkill 初始为 null 时的兜底占位）
 * - 返回技能集市（前进/后退导航语义）
 * - 管理员登录 → 审核管理 RBAC 分支导航
 *
 * 注意：用例不修改任何数据（不审核、不删除），保证对现有库幂等可重复跑。
 * 登录账号使用超级管理员默认凭据（admin / skill@2026），
 * 若生产已改密，请先通过环境变量或直接编辑本文件更新。
 */

// 集市技能卡的稳定选择器：SkillCard 根节点 id=`skill-card-<id>`
const skillCard = (page: Page) => page.locator('[id^="skill-card-"]');

test.describe('SkillHub 冒烟', () => {
  test('未登录可浏览集市、进入详情深链并返回', async ({ page }) => {
    await page.goto('/');

    // 集市首屏：分类 tab + 至少一张技能卡
    await expect(page.getByText('技能与 MCP 插件全量集市')).toBeVisible();
    await expect(skillCard(page).first()).toBeVisible();

    // 点第一张卡进入详情（路径路由 /skill/:slug）
    await skillCard(page).first().click();
    await expect(page).toHaveURL(/\/skill\/.+/);
    await expect(page.locator('#btn-back-to-market')).toBeVisible();

    // 深链刷新：不能白屏（详情兜底占位 → 拉取后完整渲染）
    await page.reload();
    await expect(page.locator('#btn-back-to-market')).toBeVisible();
    await expect(page.getByText('多端安装指令')).toBeVisible();

    // 返回技能集市
    await page.locator('#btn-back-to-market').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('技能与 MCP 插件全量集市')).toBeVisible();
  });

  test('管理员登录后出现审核管理导航（RBAC）', async ({ page }) => {
    await page.goto('/');

    // 未登录：header 显示登录按钮
    await expect(page.locator('#btn-nav-login')).toBeVisible();

    // 打开登录弹窗并提交
    await page.locator('#btn-nav-login').click();
    await page.getByTestId('login-account').fill('admin');
    await page.getByTestId('login-password').fill('skill@2026');
    await page.getByTestId('login-submit').click();

    // 登录成功：header 出现用户菜单（替代登录按钮）
    await expect(page.locator('#btn-user-profile-menu')).toBeVisible();

    // 超级管理员可见审核管理，进入后渲染审核管理中心
    await page.getByRole('button', { name: /审核管理/ }).click();
    await expect(page).toHaveURL(/\/audit/);
    await expect(page.getByRole('heading', { name: '审核管理中心' })).toBeVisible();
  });
});
