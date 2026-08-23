import { IsNotEmpty, IsEmail, MinLength, IsOptional, IsString } from 'class-validator';

/**
 * 用户注册请求数据传输对象
 */
export class RegisterDto {
  /** 员工姓名或昵称 */
  @IsNotEmpty({ message: '姓名不能为空' })
  @IsString()
  name: string;

  /** 企业工作邮箱 */
  @IsNotEmpty({ message: '工作邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  /** 登录密码 (最少 6 位) */
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度不能少于 6 位' })
  password: string;

  /** 所属研发部门 */
  @IsOptional()
  @IsString()
  department?: string;

  /** 系统角色 ('admin' | 'developer' | 'security_officer') */
  @IsOptional()
  @IsString()
  role?: string;

  /** 头像 URL */
  @IsOptional()
  @IsString()
  avatar?: string;
}
