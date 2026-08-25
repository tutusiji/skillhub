/**
 * 数据库主键格式防御工具
 *
 * 背景：SQLite 把 `@PrimaryGeneratedColumn('uuid')` 存成普通 varchar，任意字符串都能安全查询；
 * 切到 PostgreSQL 后该列是真正的 `uuid` 类型，用非法格式的字符串查询会让驱动直接抛
 * `QueryFailedError: invalid input syntax for type uuid`，冒泡成 500。
 * 因此所有「用外部传入的 id 查 uuid 主键」的位置都必须先过一次格式校验，
 * 把「查不到」和「格式非法」统一收敛成业务语义上的 404 / null。
 */

import { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';

/** UUID v1-v5 通用格式（TypeORM uuid 主键生成的值符合该模式） */const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 判断字符串是否为合法 UUID，可安全用于 Postgres uuid 列查询
 * @param value 待校验的主键值
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

/**
 * 按 uuid 主键安全查询单条记录：id 格式非法时直接返回 null，不下发查询
 * 让调用方沿用既有的「查不到」分支处理，而不必各自处理数据库方言异常
 * @param repository 目标实体仓库
 * @param id 外部传入的主键值
 */
export async function findByUuid<T extends ObjectLiteral>(
  repository: Repository<T>,
  id: string | null | undefined,
): Promise<T | null> {
  if (!isUuid(id)) return null;
  return repository.findOne({
    where: { id: id.trim() } as unknown as FindOptionsWhere<T>,
  });
}
