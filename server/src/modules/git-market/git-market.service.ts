import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as git from 'isomorphic-git';
import JSZip from 'jszip';

export interface PluginManifestItem {
  name: string;
  description: string;
  version: string;
  source: string;
  category?: string;
  /** Claude Code 要求 author 为对象结构，不能是纯字符串 */
  author?: { name: string; email?: string };
}

/** 市场归属方信息，Claude Code schema 中为必填对象 */
export interface MarketplaceOwner {
  name: string;
  email?: string;
}

export interface MarketplaceManifest {
  name: string;
  /** Claude Code 校验 marketplace.json 时 owner 为必填项，缺失会直接拒绝添加市场 */
  owner: MarketplaceOwner;
  description: string;
  version: string;
  plugins: PluginManifestItem[];
}

/** 市场清单固定元信息，供初始化与重建时复用，避免多处硬编码漂移 */
const MARKETPLACE_META = {
  name: 'skillhub',
  owner: {
    name: 'SkillHub 企业管理员',
    email: 'admin@skillhub.corp',
  },
  description: 'SkillHub 企业内网私有 AI 技能与插件集市',
  version: '1.0.0',
} as const;

/**
 * 将技能 slug 归一化为 Claude Code 插件名
 * 市场本身已命名为 skillhub，故剔除 @skillhub/ scope 前缀，
 * 让安装命令形如 `/plugin install sql-diagnose-agent@skillhub`，与前端展示保持一致
 * @param slug 技能 slug，如 `@skillhub/sql-diagnose-agent`
 */
export function toPluginName(slug: string): string {
  const stripped = (slug || '')
    .trim()
    .replace(/^@/, '')
    .replace(/^skillhub\//, '')
    .replace(/[/\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return stripped || 'unnamed-plugin';
}

/**
 * Git 插件市场服务
 * 负责维护内部 Git 仓库、响应 Git Smart HTTP 协议包、以及将已审核技能自动同步入库
 */
@Injectable()
export class GitMarketService implements OnModuleInit {
  // 市场 Git 仓库工作区根目录
  public readonly repoDir = path.resolve(process.cwd(), 'storage/git-marketplace');

  /**
   * 模块初始化生命周期：确保 Git 仓库与标准市场清单文件已就绪
   */
  async onModuleInit() {
    await this.ensureRepoInitialized();
  }

  /**
   * 初始化 Git 仓库及默认 .claude-plugin/marketplace.json 清单
   */
  private async ensureRepoInitialized(): Promise<void> {
    if (!fs.existsSync(this.repoDir)) {
      fs.mkdirSync(this.repoDir, { recursive: true });
    }

    const dotGitDir = path.join(this.repoDir, '.git');
    const isGitRepo = fs.existsSync(dotGitDir);

    if (!isGitRepo) {
      // 1. 初始化 Git 仓库
      await git.init({ fs, dir: this.repoDir, defaultBranch: 'main' });

      // 2. 创建 .claude-plugin 目录与初始 marketplace.json
      const claudePluginDir = path.join(this.repoDir, '.claude-plugin');
      if (!fs.existsSync(claudePluginDir)) {
        fs.mkdirSync(claudePluginDir, { recursive: true });
      }

      const initialManifest: MarketplaceManifest = {
        ...MARKETPLACE_META,
        plugins: [],
      };

      fs.writeFileSync(
        path.join(claudePluginDir, 'marketplace.json'),
        JSON.stringify(initialManifest, null, 2),
        'utf-8',
      );

      // 3. 创建初始 README.md
      fs.writeFileSync(
        path.join(this.repoDir, 'README.md'),
        '# SkillHub Enterprise Marketplace\n\nOfficial enterprise repository for Claude Code & Cursor plugins.\n',
        'utf-8',
      );

      // 4. 提交初始化 Commit
      await git.add({ fs, dir: this.repoDir, filepath: '.' });
      await git.commit({
        fs,
        dir: this.repoDir,
        author: { name: 'SkillHub System', email: 'system@skillhub.corp' },
        message: 'chore: initialize enterprise plugin marketplace repository',
      });
      console.log('✅ Git 插件市场本地仓库初始化成功:', this.repoDir);
    }
  }

  /**
   * 获取当前最新的 Git HEAD Commit SHA
   */
  async getHeadCommit(): Promise<string> {
    try {
      return await git.resolveRef({ fs, dir: this.repoDir, ref: 'main' });
    } catch {
      return '0000000000000000000000000000000000000000';
    }
  }

  /**
   * 读取当前市场的所有插件 Manifest 清单
   */
  getMarketplaceManifest(): MarketplaceManifest {
    const manifestPath = path.join(
      this.repoDir,
      '.claude-plugin',
      'marketplace.json',
    );
    if (!fs.existsSync(manifestPath)) {
      return { ...MARKETPLACE_META, plugins: [] };
    }
    const rawData = fs.readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(rawData) as MarketplaceManifest;
    // 兼容历史仓库：早期清单没有 owner 字段，读取时补齐以通过 Claude Code 校验
    if (!parsed.owner?.name) {
      parsed.owner = { ...MARKETPLACE_META.owner };
    }
    return parsed;
  }

  /**
   * 将审核通过的技能源码包 (ZIP) 自动解压并提交同步至 Git 市场
   * @param skill 技能元数据
   * @param zipBuffer ZIP 源码包二进制流
   * @param version 发布的版本号
   */
  async syncApprovedSkillToGit(
    skill: {
      name: string;
      slug: string;
      description: string;
      category?: string;
      author?: string;
    },
    zipBuffer?: Buffer,
    version: string = 'v1.0.0',
  ): Promise<string> {
    await this.ensureRepoInitialized();

    const cleanSlug = toPluginName(skill.slug);
    const pluginDir = path.join(this.repoDir, 'plugins', cleanSlug);

    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }

    // 1. 若提供了 ZIP，则解压写入插件目录
    if (zipBuffer && zipBuffer.length > 0) {
      const zip = await JSZip.loadAsync(zipBuffer);
      for (const [filename, fileObj] of Object.entries(zip.files)) {
        if (fileObj.dir) continue;
        const filePath = path.join(pluginDir, filename);
        const parentDir = path.dirname(filePath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        const content = await fileObj.async('nodebuffer');
        fs.writeFileSync(filePath, content);
      }
    } else {
      // 若无 ZIP，生成标准技能模板结构：SKILL.md 需带 YAML frontmatter，否则 Claude Code 拒绝加载
      const skillsSubDir = path.join(pluginDir, 'skills');
      if (!fs.existsSync(skillsSubDir)) {
        fs.mkdirSync(skillsSubDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(skillsSubDir, 'SKILL.md'),
        this.buildSkillMarkdown(cleanSlug, skill.name, skill.description),
        'utf-8',
      );
    }

    // 2. 确保插件内至少存在一个合法 SKILL.md，并推导 skills 字段指向的目录
    const skillsField = this.resolveSkillsField(pluginDir, cleanSlug, skill);

    // 3. 写入单个插件元数据 .claude-plugin/plugin.json
    const pluginMetaDir = path.join(pluginDir, '.claude-plugin');
    if (!fs.existsSync(pluginMetaDir)) {
      fs.mkdirSync(pluginMetaDir, { recursive: true });
    }
    const pluginJson = {
      // $schema 与官方脚手架保持一致，便于 IDE 校验
      $schema: 'https://anthropic.com/claude-code/plugin.schema.json',
      name: cleanSlug,
      version: version,
      description: skill.description,
      // author 统一为对象结构，与 Claude Code plugin schema 保持一致
      author: {
        name: skill.author || 'Enterprise AI Team',
        email: MARKETPLACE_META.owner.email,
      },
      // skills 必须是「目录」路径数组，指向具体 SKILL.md 文件会被 schema 拒绝
      skills: skillsField,
    };
    fs.writeFileSync(
      path.join(pluginMetaDir, 'plugin.json'),
      JSON.stringify(pluginJson, null, 2),
      'utf-8',
    );

    // 4. 更新全局 .claude-plugin/marketplace.json
    const manifest = this.getMarketplaceManifest();
    const existingIndex = manifest.plugins.findIndex(
      (p) => p.name === cleanSlug,
    );

    const pluginEntry: PluginManifestItem = {
      name: cleanSlug,
      description: skill.description,
      version: version,
      source: `./plugins/${cleanSlug}`,
      category: skill.category,
      author: skill.author ? { name: skill.author } : undefined,
    };

    if (existingIndex >= 0) {
      manifest.plugins[existingIndex] = pluginEntry;
    } else {
      manifest.plugins.push(pluginEntry);
    }

    const manifestPath = path.join(
      this.repoDir,
      '.claude-plugin',
      'marketplace.json',
    );
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );

    // 5. 执行 Git 暂存与 Commit 提交
    await git.add({ fs, dir: this.repoDir, filepath: '.' });
    const commitSha = await git.commit({
      fs,
      dir: this.repoDir,
      author: {
        name: 'SkillHub Release Bot',
        email: 'release-bot@skillhub.corp',
      },
      message: `feat(plugin): publish ${cleanSlug}@${version} [audit-approved]`,
    });

    console.log(
      `📦 插件 [${cleanSlug}@${version}] 成功同步并提交至 Git 市场! Commit: ${commitSha}`,
    );
    return commitSha;
  }

  /**
   * 校验某插件在仓库中的目录结构是否符合 Claude Code 当前 schema
   * 用于启动自愈：早期版本生成的 skills 字段指向 SKILL.md 文件，会导致 plugin install 失败
   * @param slug 技能 slug (未规范化亦可)
   */
  isPluginLayoutValid(slug: string): boolean {
    const cleanSlug = toPluginName(slug);
    const pluginJsonPath = path.join(
      this.repoDir,
      'plugins',
      cleanSlug,
      '.claude-plugin',
      'plugin.json',
    );
    if (!fs.existsSync(pluginJsonPath)) return false;

    try {
      const parsed = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8')) as {
        skills?: unknown;
        author?: unknown;
      };
      if (!Array.isArray(parsed.skills) || parsed.skills.length === 0) {
        return false;
      }
      // skills 必须全部是目录路径，出现 .md 文件即为历史脏数据
      const allDirs = parsed.skills.every(
        (item) => typeof item === 'string' && !item.toLowerCase().endsWith('.md'),
      );
      if (!allDirs) return false;
      // author 必须为对象结构
      return typeof parsed.author === 'object' && parsed.author !== null;
    } catch {
      return false;
    }
  }

  /**
   * 生成带 YAML frontmatter 的标准 SKILL.md 内容
   * Claude Code 要求技能文件头部声明 name 与 description，否则技能不会被加载
   * @param slug 技能唯一标识 (用作 frontmatter name)
   * @param name 技能中文/展示名
   * @param description 技能描述
   */
  private buildSkillMarkdown(
    slug: string,
    name: string,
    description: string,
  ): string {
    const safeDescription = (description || name).replace(/\r?\n/g, ' ').trim();
    return [
      '---',
      `name: ${slug}`,
      `description: ${safeDescription}`,
      '---',
      '',
      `# ${name}`,
      '',
      safeDescription,
      '',
      '## 适用端',
      '',
      'Claude Code / Cursor / MCP',
      '',
    ].join('\n');
  }

  /**
   * 推导 plugin.json 的 skills 字段 (必须为目录路径)
   * 优先使用插件内已存在的 skills/ 目录；若技能文件位于插件根目录则返回 './'；
   * 两者皆无时兜底生成 skills/SKILL.md 模板，保证插件一定可被安装
   * @param pluginDir 插件工作目录绝对路径
   * @param cleanSlug 规范化后的插件标识
   * @param skill 技能元数据
   */
  private resolveSkillsField(
    pluginDir: string,
    cleanSlug: string,
    skill: { name: string; description: string },
  ): string[] {
    const skillsSubDir = path.join(pluginDir, 'skills');
    const hasSkillsDirEntry =
      fs.existsSync(skillsSubDir) &&
      fs.statSync(skillsSubDir).isDirectory() &&
      this.containsSkillFile(skillsSubDir);
    if (hasSkillsDirEntry) {
      return ['./skills'];
    }

    // ZIP 包可能把 SKILL.md 直接放在插件根目录，此时 skills 指向 './'
    if (fs.existsSync(path.join(pluginDir, 'SKILL.md'))) {
      return ['./'];
    }

    // 兜底：补齐标准模板，避免生成无法安装的空插件
    if (!fs.existsSync(skillsSubDir)) {
      fs.mkdirSync(skillsSubDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(skillsSubDir, 'SKILL.md'),
      this.buildSkillMarkdown(cleanSlug, skill.name, skill.description),
      'utf-8',
    );
    return ['./skills'];
  }

  /**
   * 判断目录内 (含一级子目录) 是否存在 SKILL.md 技能定义文件
   * @param dir 待检查目录
   */
  private containsSkillFile(dir: string): boolean {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && e.name === 'SKILL.md')) {
      return true;
    }
    return entries.some(
      (e) =>
        e.isDirectory() &&
        fs.existsSync(path.join(dir, e.name, 'SKILL.md')),
    );
  }

  /**
   * 按当前已上线技能全量重建市场索引 (用于下架/删除后剔除插件条目)
   * 会移除 marketplace.json 中多余条目，并删除对应插件源码目录后提交 Commit
   * @param approvedSkills 当前处于 approved 状态的技能清单
   */
  async rebuildMarketplaceIndex(
    approvedSkills: Array<{
      name: string;
      slug: string;
      description: string;
      category?: string;
      author?: string;
      version?: string;
    }>,
  ): Promise<string> {
    await this.ensureRepoInitialized();

    const manifest = this.getMarketplaceManifest();
    const validSlugs = new Set<string>();

    // 1. 依据在线技能重建 plugins 数组
    manifest.owner = manifest.owner ?? { ...MARKETPLACE_META.owner };
    manifest.plugins = approvedSkills.map((skill) => {
      const cleanSlug = toPluginName(skill.slug);
      validSlugs.add(cleanSlug);
      return {
        name: cleanSlug,
        description: skill.description,
        version: skill.version || 'v1.0.0',
        source: `./plugins/${cleanSlug}`,
        category: skill.category,
        author: skill.author ? { name: skill.author } : undefined,
      };
    });

    // 2. 物理清理已下架/已删除插件的源码目录
    const pluginsRoot = path.join(this.repoDir, 'plugins');
    if (fs.existsSync(pluginsRoot)) {
      for (const entry of fs.readdirSync(pluginsRoot)) {
        if (!validSlugs.has(entry)) {
          fs.rmSync(path.join(pluginsRoot, entry), {
            recursive: true,
            force: true,
          });
        }
      }
    }

    const manifestPath = path.join(
      this.repoDir,
      '.claude-plugin',
      'marketplace.json',
    );
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    // 3. 提交索引变更 (需显式 remove 已删除文件的索引项)
    await git.add({ fs, dir: this.repoDir, filepath: '.' });
    const status = await git.statusMatrix({ fs, dir: this.repoDir });
    for (const [filepath, , worktreeStatus] of status) {
      if (worktreeStatus === 0) {
        await git.remove({ fs, dir: this.repoDir, filepath });
      }
    }

    const commitSha = await git.commit({
      fs,
      dir: this.repoDir,
      author: {
        name: 'SkillHub Release Bot',
        email: 'release-bot@skillhub.corp',
      },
      message: `chore(marketplace): rebuild index (${manifest.plugins.length} plugins online)`,
    });

    console.log(
      `🔄 市场索引已重建，当前在线插件 ${manifest.plugins.length} 个! Commit: ${commitSha}`,
    );
    return commitSha;
  }
}
