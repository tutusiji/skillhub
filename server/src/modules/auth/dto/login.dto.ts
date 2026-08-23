import { IsNotEmpty, IsEmail, IsString } from 'class-validator';

/**
 * 用户登录请求数据传输对象
 */
export class LoginDto {
  /** 登录企业工作邮箱 */
  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  /** 登录密码 */
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString()
  password: string;
}
