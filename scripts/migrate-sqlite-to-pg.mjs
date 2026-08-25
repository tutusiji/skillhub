#!/usr/bin/env node
/**
 * 一次性迁移脚本：把 SQLite (server/storage/skillhub.sqlite) 的全部业务数据
 * 复制到本地 PostgreSQL skillhub 库。
 *
 * 用法：
 *   node scripts/migrate-sqlite-to-pg.mjs
 *
 * 前置条件：
 *   1. 目标 PG 库已由后端首次启动完成建表 (synchronize=true)
 *   2. 后端处于停止状态，避免迁移期间写入冲突
 *
 * 注意：
 *   - 目标表已存在同名主键记录时会跳过该条，保证脚本可重复执行
 *   - JSON 列 (text 存的 JSON) 原样透传
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '../server');
const require = createRequire(path.join(serverDir, 'package.json'));

const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');

const SQLITE_PATH = path.join(serverDir, 'storage', 'skillhub.sqlite');

/** 各表主键列，用于幂等跳过已存在记录 */
const TABLES = [
  { name: 'users', pk: 'id' },
  { name: 'skills', pk: 'id' },
  { name: 'audit_rules', pk: 'id' },
  { name: 'audit_reports', pk: 'id' },
  { name: 'skill_demands', pk: 'id' },
  { name: 'llm_configs', pk: 'id' },
];

/** SQLite 里 datetime 以多种形态存储，统一转为 PG timestamp */
function normalizeValue(value) {
  if (value === null || value === undefined) return null;
  return value;
}

/**
 * 从 SQLite 读取整表记录
 * @param db sqlite3 数据库句柄
 * @param table 表名
 */
function readTable(db, table) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${table}`, (err, rows) => {
      if (err) {
        // 表不存在时返回空数组，兼容不同历史版本的库
        if (String(err.message).includes('no such table')) return resolve(null);
        return reject(err);
      }
      resolve(rows);
    });
  });
}

/** 主流程 */
async function main() {
  const pg = new Client({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'bone',
    password: process.env.PGPASSWORD || 'bone123',
    database: process.env.PGDATABASE || 'skillhub',
  });

  const db = new sqlite3.Database(SQLITE_PATH);
  await pg.connect();
  console.log(`已连接 PG: ${pg.database}@${pg.host}:${pg.port}`);

  for (const { name, pk } of TABLES) {
    const rows = await readTable(db, name);
    if (rows === null) {
      console.log(`- ${name}: SQLite 中不存在，跳过`);
      continue;
    }
    if (rows.length === 0) {
      console.log(`- ${name}: 空表，跳过`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const columnList = columns.map((c) => `"${c}"`).join(', ');
      // 不带冲突列：任意唯一约束冲突（主键或 email/slug 等唯一键）都跳过，幂等可重复执行
      const sql = `INSERT INTO ${name} (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
      const values = columns.map((c) => normalizeValue(row[c]));
      const result = await pg.query(sql, values);
      if (result.rowCount > 0) inserted += 1;
      else skipped += 1;
    }
    console.log(`- ${name}: 共 ${rows.length} 行，迁移 ${inserted} 行，已存在跳过 ${skipped} 行`);
  }

  db.close();
  await pg.end();
  console.log('\n✅ 迁移完成');
}

main().catch((err) => {
  console.error('迁移失败:', err);
  process.exit(1);
});
