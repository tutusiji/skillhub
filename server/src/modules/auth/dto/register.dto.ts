import {
  IsNotEmpty,
  IsEmail,
  MinLength,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

/**
 * 用户注册请求数据传输对象
 *
 * 注意：这里**故意不接受 role 字段**。新账号一律为普通用户，
 * 管理员只能由超级管理员在权限设置页委任，避免匿名注册接口被用来自封管理员。
 */
export class RegisterDto {
  /** 员工工号 (唯一登录标识) */
  @IsNotEmpty({ message: '员工工号不能为空' })
  @Matches(/^\d{6,12}$/, { message: '工号须为 6-12 位数字' })
  employeeId: string;

  /** 员工姓名或昵称 */
  @IsNotEmpty({ message: '姓名不能为空' })
  @IsString()
  name: string;

  /** 登录密码 (最少 6 位) */
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度不能少于 6 位' })
  password: string;

  /** 企业工作邮箱，缺省时按工号派生 */
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  /** 所属研发部门 */
  @IsOptional()
  @IsString()
  department?: string;

  /** 头像 URL */
  @IsOptional()
  @IsString()
  avatar?: string;
}
