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
  author?: string;
}

export interface MarketplaceManifest {
  name: string;
  description: string;
  version: string;
  plugins: PluginManifestItem[];
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
        name: 'skillhub',
        description: 'SkillHub 企业内网私有 AI 技能与插件集市',
        version: '1.0.0',
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
      return {
        name: 'skillhub',
        description: 'SkillHub 企业内网私有 AI 技能与插件集市',
        version: '1.0.0',
        plugins: [],
      };
    }
    const rawData = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(rawData);
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

    const cleanSlug = skill.slug.replace('@', '').replace('/', '-');
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
      // 若无 ZIP，生成标准技能模板结构
      const skillsSubDir = path.join(pluginDir, 'skills');
      if (!fs.existsSync(skillsSubDir)) {
        fs.mkdirSync(skillsSubDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(skillsSubDir, 'SKILL.md'),
        `# ${skill.name}\n\n${skill.description}\n\n## 适用端\nClaude Code / Cursor / MCP\n`,
        'utf-8',
      );
    }

    // 2. 确保单个插件元数据 .claude-plugin/plugin.json 存在
    const pluginMetaDir = path.join(pluginDir, '.claude-plugin');
    if (!fs.existsSync(pluginMetaDir)) {
      fs.mkdirSync(pluginMetaDir, { recursive: true });
    }
    const pluginJson = {
      name: cleanSlug,
      version: version,
      description: skill.description,
      author: skill.author || 'Enterprise AI Team',
      skills: ['skills/SKILL.md'],
    };
    fs.writeFileSync(
      path.join(pluginMetaDir, 'plugin.json'),
      JSON.stringify(pluginJson, null, 2),
      'utf-8',
    );

    // 3. 更新全局 .claude-plugin/marketplace.json
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
      author: skill.author,
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

    // 4. 执行 Git 暂存与 Commit 提交
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
}
