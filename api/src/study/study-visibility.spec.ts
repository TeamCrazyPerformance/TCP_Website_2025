/* eslint-disable @typescript-eslint/unbound-method */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';

describe('study list visibility', () => {
  it('authenticates the list optionally so anonymous callers still get a response', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, StudyController.prototype.findAll),
    ).toContain(OptionalJwtAuthGuard);
  });

  const buildController = () => {
    const findAll = jest.fn().mockResolvedValue([]);
    const controller = new StudyController({
      findAll,
    } as unknown as StudyService);
    const res = {
      vary: jest.fn(),
      setHeader: jest.fn(),
    };
    return { controller, findAll, res };
  };

  it('hides private studies from anonymous callers', async () => {
    const { controller, findAll, res } = buildController();

    await controller.findAll({ year: 2026 }, {}, res as never);

    expect(findAll).toHaveBeenCalledWith(2026, false);
  });

  it('keeps private studies visible once a member is signed in', async () => {
    const { controller, findAll, res } = buildController();

    await controller.findAll(
      { year: undefined },
      { user: { userId: 'member-1' } },
      res as never,
    );

    expect(findAll).toHaveBeenCalledWith(undefined, true);
  });

  it('marks the response as varying by authorization and not shared-cacheable', async () => {
    const { controller, res } = buildController();

    await controller.findAll({ year: undefined }, {}, res as never);

    expect(res.vary).toHaveBeenCalledWith('Authorization');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store',
    );
  });
});

describe('StudyService.findAll', () => {
  const buildService = () => {
    const find = jest.fn().mockResolvedValue([]);
    const service = new StudyService(
      { find } as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );
    return { service, find };
  };

  it('restricts the query to public studies by default', async () => {
    const { service, find } = buildService();

    await service.findAll();

    expect(find).toHaveBeenCalledWith({ where: { is_public: true } });
  });

  it('keeps the year filter alongside the public restriction', async () => {
    const { service, find } = buildService();

    await service.findAll(2026);

    expect(find).toHaveBeenCalledWith({
      where: { start_year: 2026, is_public: true },
    });
  });

  it('drops the restriction for signed-in callers', async () => {
    const { service, find } = buildService();

    await service.findAll(2026, true);

    expect(find).toHaveBeenCalledWith({ where: { start_year: 2026 } });
  });
});
