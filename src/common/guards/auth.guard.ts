import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token = request.cookies['access_token'];

    if (!token) {
      throw new UnauthorizedException('token invalid');
    }
    try {
      const { user_id, role } = await this.jwtService.verifyAsync(token);

      request.user_id = user_id;
      request.role = role;

      return true;
    } catch (error) {
      throw new UnauthorizedException(error);
    }
  }
}
