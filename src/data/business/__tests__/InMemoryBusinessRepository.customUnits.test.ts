import { InMemoryBusinessRepository } from '../InMemoryBusinessRepository';
import { EMPTY_BUSINESS_PROFILE_INPUT } from '@/domain/business/types';

describe('InMemoryBusinessRepository — custom units', () => {
  it('returns empty lists before anything is saved', async () => {
    const repo = new InMemoryBusinessRepository();
    await expect(repo.getCustomUnits()).resolves.toEqual({ generic: [], weight: [], length: [], time: [] });
  });

  it('adds a custom unit to the requested kind only', async () => {
    const repo = new InMemoryBusinessRepository();
    const updated = await repo.addCustomUnit('generic', 'roll');
    expect(updated.generic).toEqual(['roll']);
    expect(updated.weight).toEqual([]);
    await expect(repo.getCustomUnits()).resolves.toEqual(updated);
  });

  it('accumulates units across multiple additions', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.addCustomUnit('generic', 'roll');
    const updated = await repo.addCustomUnit('generic', 'bag');
    expect(updated.generic).toEqual(['roll', 'bag']);
  });

  it('never saves the same unit twice, case-insensitively', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.addCustomUnit('generic', 'roll');
    const updated = await repo.addCustomUnit('generic', 'Roll');
    expect(updated.generic).toEqual(['roll']);
  });

  it('rejects a unit that duplicates a fixed base option', async () => {
    const repo = new InMemoryBusinessRepository();
    const updated = await repo.addCustomUnit('weight', 'KG');
    expect(updated.weight).toEqual([]);
  });

  it('does not clobber the business profile when adding a custom unit', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.saveProfile({ ...EMPTY_BUSINESS_PROFILE_INPUT, businessName: 'Acme Co' });

    await repo.addCustomUnit('length', 'fathom');

    const profile = await repo.getProfile();
    expect(profile?.businessName).toBe('Acme Co');
  });
});
