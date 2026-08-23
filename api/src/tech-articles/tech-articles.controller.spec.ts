/* eslint-disable @typescript-eslint/unbound-method */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../members/entities/enums/user-role.enum';
import { AdminTechArticlesController } from './admin-tech-articles.controller';
import { TechArticlesController } from './tech-articles.controller';

describe('tech article access metadata', () => {
  it('keeps list and tags public while protecting detail with JWT', () => {
    const list = TechArticlesController.prototype.list;
    const tags = TechArticlesController.prototype.tags;
    const detail = TechArticlesController.prototype.detail;

    expect(Reflect.getMetadata(GUARDS_METADATA, list)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, tags)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, detail)).toContain(
      JwtAuthGuard,
    );
  });

  it('protects the complete admin controller with JWT and ADMIN role', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminTechArticlesController),
    ).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, AdminTechArticlesController)).toEqual(
      [UserRole.ADMIN],
    );
  });
});
