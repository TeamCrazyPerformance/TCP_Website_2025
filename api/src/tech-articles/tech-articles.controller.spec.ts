/* eslint-disable @typescript-eslint/unbound-method */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../members/entities/enums/user-role.enum';
import { AdminTechArticlesController } from './admin-tech-articles.controller';
import { TechArticlesController } from './tech-articles.controller';

describe('tech article access metadata', () => {
  it('keeps catalog routes public and authenticates detail optionally', () => {
    const list = TechArticlesController.prototype.list;
    const tags = TechArticlesController.prototype.tags;
    const sources = TechArticlesController.prototype.sources;
    const detail = TechArticlesController.prototype.detail;

    expect(Reflect.getMetadata(GUARDS_METADATA, list)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, tags)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, sources)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, detail)).toContain(
      OptionalJwtAuthGuard,
    );
  });

  it('varies detail responses by authorization without overwriting other vary fields', async () => {
    const publicDetail = jest.fn().mockResolvedValue({ id: 'article-1' });
    const controller = new TechArticlesController({
      publicDetail,
    } as unknown as ConstructorParameters<typeof TechArticlesController>[0]);
    const response = { vary: jest.fn(), setHeader: jest.fn() };

    await controller.detail(
      { articleId: 'article-1' },
      { user: { userId: 'member-1' } } as never,
      response as never,
    );

    expect(response.vary).toHaveBeenCalledWith('Authorization');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-cache',
    );
    expect(publicDetail).toHaveBeenCalledWith('article-1', true);
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
