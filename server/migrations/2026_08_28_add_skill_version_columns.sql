-- 技能多版本发布：增加 parent_skill_id / superseded_by_id / archived_at 字段
-- 日期：2026-08-28
-- 用途：让"发布新版本"流程能建立版本链（parent→child），替代旧版时把旧版置为
--       archived（DB 软删，git 仓不删），新版从旧版继承 counter（likes/stars/downloads）
--
-- 字段语义：
--   parent_skill_id   新版本指向其前驱版本；第一版为 NULL
--   superseded_by_id  archived 状态指向替代它的 approved 版本；其他状态为 NULL
--   archived_at       被新版替代的时间戳（archived 状态时填入）
--
-- 索引：
--   idx_skills_parent          加速版本链查询（GET /:id/versions）
--   idx_skills_submitter_status 个人中心"我的提交"按 status 过滤

-- 1. 加字段（IF NOT EXISTS 让脚本可重复跑）
ALTER TABLE skills
    ADD COLUMN IF NOT EXISTS parent_skill_id   TEXT,
    ADD COLUMN IF NOT EXISTS superseded_by_id  TEXT,
    ADD COLUMN IF NOT EXISTS archived_at       TEXT,
    ADD COLUMN IF NOT EXISTS supersede_mode    VARCHAR(20);

-- 2. 加索引
CREATE INDEX IF NOT EXISTS idx_skills_parent
    ON skills (parent_skill_id);

CREATE INDEX IF NOT EXISTS idx_skills_submitter_status
    ON skills (submitter_id, status);

-- 3. 不需要回填——历史技能一律视为"第一版"，parent/superseded 都为 NULL

-- 4. 校验：列出当前是否有任何行 archived_at 不为空但 status 不是 'archived'
--    （历史数据理论上不会有；如果发现先修数据再加 CHECK 约束）
-- SELECT id, status, archived_at FROM skills WHERE archived_at IS NOT NULL AND status != 'archived';
