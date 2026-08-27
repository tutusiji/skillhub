import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { json, urlencoded, raw, static as expressStatic } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { isProduction, resolveCorsOrigin } from './common/runtime-env';

/**
 * 启动 NestJS 服务端核心应用程序
 * 配置全局中间件、CORS 跨域策略、端口监听以及 Git 协议流支持
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 1. 跨域策略：开发环境放开便于 Vite dev server 直连；
  //    生产默认同源（后端托管前端静态资源），需要独立前端域名时用 CORS_ORIGINS 白名单。
  //    此前写死 origin:'*' + credentials:true —— 任意外部站点都能用受害者的令牌
  //    直接调用内网 API（CSRF / 数据外带），生产环境不可接受。
  app.enableCors({
    origin: resolveCorsOrigin(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 2. 配置请求体解析器 (针对 Git Smart HTTP 协议支持 raw binary stream)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  app.use(
    raw({
      type: [
        'application/x-git-upload-pack-request',
        'application/x-git-receive-pack-request',
      ],
      limit: '100mb',
    }),
  );

  // 3. 生产模式下由后端直接托管前端构建产物，实现单进程同源部署
  //    (开发时前端仍走 Vite dev server + proxy，不受影响)
  const distDir = path.resolve(process.cwd(), '..', 'dist');
  const indexHtml = path.join(distDir, 'index.html');
  const serveStatic = fs.existsSync(indexHtml);

  if (serveStatic) {
    // 3.1 静态资源 (js/css/图片) 直出
    app.use(expressStatic(distDir, { index: false }));

    // 3.2 SPA history fallback：非 API / 非 Git 协议的 GET 请求回 index.html。
    //     必须在 listen() 之前用中间件注册；listen() 之后再 app.get() 不会生效
    //     (Express 4 的路由表此时已定型)，同时通过前缀判断把接口请求交还给 Nest。
    app.use((req: any, res: any, next: any) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (
        req.path.startsWith('/api') ||
        req.path.includes('.git') ||
        req.path.startsWith('/.claude-plugin')
      ) {
        return next();
      }
      return res.sendFile(indexHtml);
    });
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 SkillHub Enterprise Server 启动成功: http://localhost:${port}`);
  console.log(`📦 Claude Code Git 市场端点: http://localhost:${port}/skillhub.git`);
  console.log(
    serveStatic
      ? `🖥️  前端静态资源已托管 (单进程模式): ${distDir}`
      : `⚠️  未找到前端构建产物 (${distDir})，请先执行 pnpm run build`,
  );
}

bootstrap();
