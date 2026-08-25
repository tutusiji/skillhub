---
name: skill-creator
description: 自定义 Skill 创建器 — 将个人开发习惯和重复性工作封装成专属 Skill。创建新技能、模板化工作流或标准化团队规范时使用。
---

# 自定义 Skill 创建器

帮助用户快速创建和注册自定义 Skill，将重复性工作流程封装为可复用的能力。

## Skill 文件结构

```
skills/
  my-skill/
    SKILL.md          # 技能定义（必须）
    references/       # 参考文档（可选）
    scripts/          # 辅助脚本（可选）
    templates/        # 模板文件（可选）
```

## SKILL.md 模板

```markdown
---
name: my-skill
description: 一句话描述技能用途和触发场景。
---

# 技能名称

## 概述
[技能做什么，解决什么问题]

## 使用场景
- 场景一
- 场景二

## 工作流程
1. 步骤一
2. 步骤二
3. 步骤三

## 规范
[具体的规范和标准]

## 示例
[输入输出示例]
```

## 创建流程

1. **确定技能目标** — 明确技能解决什么问题，什么时候触发
2. **编写 SKILL.md** — 按照 frontmatter + 正文结构编写
3. **添加参考资料** — 复杂技能在 references/ 下补充详细文档
4. **注册到插件** — 在对应插件的 skills/ 目录下创建
5. **测试验证** — 触发技能确认行为符合预期

## 编写原则

- **description 要精准** — 这是技能匹配的关键，写清楚"什么时候用"
- **正文要可执行** — 不要写理论，写具体操作步骤
- **用表格不用段落** — 对比信息用表格更易读
- **给示例** — 每个规范配上正例和反例
- **保持简洁** — 单个 SKILL.md 不超过 200 行

## 注册到市场

创建完成后，在插件的 `.claude-plugin/plugin.json` 中确认技能目录，然后运行：
```bash
npm run validate && npm run generate-registry
```
