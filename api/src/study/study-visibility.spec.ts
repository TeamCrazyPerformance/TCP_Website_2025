import { StudyController } from './study.controller';
import { StudyService } from './study.service';

describe('study list visibility', () => {
  const buildController = () => {
    const findAll = jest.fn().mockResolvedValue([]);
    const controller = new StudyController({
      findAll,
    } as unknown as StudyService);
    return { controller, findAll };
  };

  it('returns every study to anonymous callers', async () => {
    const { controller, findAll } = buildController();

    await controller.findAll({ year: 2026 });

    expect(findAll).toHaveBeenCalledWith(2026);
  });

  it('passes an omitted year through without adding an auth-dependent scope', async () => {
    const { controller, findAll } = buildController();

    await controller.findAll({ year: undefined });

    expect(findAll).toHaveBeenCalledWith(undefined);
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

  it('does not restrict the query by visibility', async () => {
    const { service, find } = buildService();

    await service.findAll();

    expect(find).toHaveBeenCalledWith({
      where: {},
      relations: ['studyMembers', 'studyMembers.user'],
    });
  });

  it('keeps the year filter without adding a visibility restriction', async () => {
    const { service, find } = buildService();

    await service.findAll(2026);

    expect(find).toHaveBeenCalledWith({
      where: { start_year: 2026 },
      relations: ['studyMembers', 'studyMembers.user'],
    });
  });
});
