import { QueryRunner } from 'typeorm';
import { CascadeStudyDeletion1789300000000 } from '../migrations/1789300000000-CascadeStudyDeletion';

describe('CascadeStudyDeletion1789300000000', () => {
  const migration = new CascadeStudyDeletion1789300000000();
  const query = jest.fn().mockResolvedValue(undefined);
  const queryRunner = { query } as unknown as QueryRunner;

  beforeEach(() => {
    query.mockClear();
  });

  it('enables cascade deletion for every study-owned table', async () => {
    await migration.up(queryRunner);

    const statements = query.mock.calls.map(([statement]) => statement);
    expect(statements).toHaveLength(6);
    expect(statements).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/ALTER TABLE "Progress" ADD .*ON DELETE CASCADE/),
        expect.stringMatching(/ALTER TABLE "Resource" ADD .*ON DELETE CASCADE/),
        expect.stringMatching(
          /ALTER TABLE "StudyMember" ADD .*ON DELETE CASCADE/,
        ),
      ]),
    );
  });

  it('restores the previous no-action constraints on rollback', async () => {
    await migration.down(queryRunner);

    const statements = query.mock.calls.map(([statement]) => statement);
    expect(statements).toHaveLength(6);
    expect(statements).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /ALTER TABLE "Progress" ADD .*ON DELETE NO ACTION/,
        ),
        expect.stringMatching(
          /ALTER TABLE "Resource" ADD .*ON DELETE NO ACTION/,
        ),
        expect.stringMatching(
          /ALTER TABLE "StudyMember" ADD .*ON DELETE NO ACTION/,
        ),
      ]),
    );
  });
});
