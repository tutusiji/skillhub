import { IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

/**
 * 用户登录请求数据传输对象
 *
 * 账号标识按 登录名 → 工号 → 邮箱 顺序解析：
 * 超级管理员用登录名 admin，普通员工用工号，邮箱仅为历史账号兜底通道。
 */
export class LoginDto {
  /** 登录账号：登录名 / 工号 / 邮箱 */
  @ValidateIf((o: LoginDto) => !o.email)
  @IsNotEmpty({ message: '登录账号不能为空' })
  @IsString()
  account?: string;

  /** 历史字段别名，兼容旧客户端按邮箱登录 */
  @IsOptional()
  @IsString()
  email?: string;

  /** 登录密码 */
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString()
  password: string;
}
