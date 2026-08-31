import { Controller, Get, Post, Req, Res, Query } from '@nestjs/common';
import { Request, Response } from 'express';
import { GitMarketService } from './git-market.service';
import { spawn } from 'child_process';

/**
 * Git Smart HTTP 插件市场控制器
 * 遵循 Git Smart HTTP 协议 (RFC 9017)，为 Claude Code 提供原生插件仓库接入
 */
@Controller()
export class GitMarketController {
  constructor(private readonly gitMarketService: GitMarketService) {}

  /**
   * 处理 Git 客户端引用协商请求 (info/refs)
   * 对应 Claude Code 执行 `/plugin marketplace add` 或 `update` 的协商阶段
   * @param service Git 服务类型 (通常为 git-upload-pack)
   * @param req HTTP 请求对象
   * @param res HTTP 响应对象
   */
  @Get(['skillhub.git/info/refs', 'market.git/info/refs'])
  async handleInfoRefs(
    @Query('service') service: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (service !== 'git-upload-pack') {
      // 技能市场仅支持只读拉取服务
      return res.status(400).send('Only git-upload-pack is supported for marketplace');
    }

    // 内网部署策略：Git 市场仓库对全内网公开只读（已上架技能本就对所有登录用户可见，
    // 匿名 git 拉取与之等价）。Claude Code /plugin marketplace add 免 token 直接拉取。
    // 若未来需要限制拉取范围，应在入口层（frp / Nginx / 内网网关）控制，而非给
    // Git Smart HTTP 协议端点加鉴权（那会破坏免配置安装）。

    res.setHeader('Content-Type', `application/x-${service}-advertisement`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // 采用 Git stateless-rpc 协议直接输出广告引用
    const gitProcess = spawn('git', [
      'upload-pack',
      '--stateless-rpc',
      '--advertise-refs',
      this.gitMarketService.repoDir,
    ]);

    const packet = `# service=${service}\n`;
    const hexLen = (packet.length + 4).toString(16).padStart(4, '0');
    res.write(`${hexLen}${packet}0000`);

    gitProcess.stdout.pipe(res);
    gitProcess.stderr.on('data', (data) => {
      console.error('Git upload-pack stderr:', data.toString());
    });
  }

  /**
   * 处理 Git 客户端拉取数据包请求 (git-upload-pack)
   * 对应 Claude Code 真正传输插件源码树与 Commit 数据的阶段
   * @param req HTTP 请求对象 (包含 Git 客户端协商二进制流)
   * @param res HTTP 响应对象
   */
  @Post(['skillhub.git/git-upload-pack', 'market.git/git-upload-pack'])
  async handleUploadPack(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'application/x-git-upload-pack-result');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const gitProcess = spawn('git', [
      'upload-pack',
      '--stateless-rpc',
      this.gitMarketService.repoDir,
    ]);

    // 将请求体 (Buffer 或原始流) 写入 Git upload-pack 进程并将打包数据流式返回客户端
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      gitProcess.stdin.write(req.body);
      gitProcess.stdin.end();
    } else {
      req.pipe(gitProcess.stdin);
    }

    gitProcess.stdout.pipe(res);

    gitProcess.stderr.on('data', (data) => {
      console.error('Git upload-pack transfer stderr:', data.toString());
    });
  }

  /**
   * 提供标准 HTTP REST 协议的 .claude-plugin/marketplace.json 清单
   * 便于 Web 前端或静态客户端直接获取已发布插件索引
   */
  @Get('.claude-plugin/marketplace.json')
  getMarketplaceManifestDirect() {
    return this.gitMarketService.getMarketplaceManifest();
  }

  /**
   * 市场 REST API 清单查询接口
   */
  @Get('api/v1/marketplace/manifest')
  getMarketplaceManifestApi() {
    return this.gitMarketService.getMarketplaceManifest();
  }
}
