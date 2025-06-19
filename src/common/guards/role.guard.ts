import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('forbidden resource');
    }

    const handler = context.getHandler();
    const roles: Role[] = this.reflector.get('roles', handler);

    if (!roles || roles.length === 0) {
      return true;
    }

    if (roles.includes(user.role)) {
      return true;
    }

    throw new ForbiddenException('forbidden resource');
  }
}
