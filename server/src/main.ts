import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded, raw } from 'express';

/**
 * 启动 NestJS 服务端核心应用程序
 * 配置全局中间件、CORS 跨域策略、端口监听以及 Git 协议流支持
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. 允许跨域请求，支持前端 React 应用 (默认 3000 端口) 访问
  app.enableCors({
    origin: '*',
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

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 SkillHub Enterprise Server 启动成功: http://localhost:${port}`);
  console.log(`📦 Claude Code Git 市场端点: http://localhost:${port}/skillhub.git`);
}

bootstrap();
