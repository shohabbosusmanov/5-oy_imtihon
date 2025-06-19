import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

import { Reflector } from '@nestjs/core';

import { SetMetadata } from '@nestjs/common';

export const SkipResponseInterceptor = () =>
  SetMetadata('skipResponseInterceptor', true);

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skip = this.reflector.get<boolean>(
      'skipResponseInterceptor',
      context.getHandler(),
    );
    if (skip) {
      return next.handle();
    }

    return next.handle().pipe(
      map((response) => {
        if (response?.message && response?.data) {
          return {
            success: true,
            message: response.message,
            data: response.data,
          };
        } else if (!response.data) {
          return {
            success: true,
            message: response.message,
          };
        }

        return {
          success: true,
          data: response.data,
        };
      }),
    );
  }
}
