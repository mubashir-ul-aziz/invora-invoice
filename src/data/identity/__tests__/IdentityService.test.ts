import { InMemoryUserIdentityRepository } from '../InMemoryUserIdentityRepository';
import { IdentityService } from '../IdentityService';

function makeService(seed: ConstructorParameters<typeof InMemoryUserIdentityRepository>[0] = null) {
  const repository = new InMemoryUserIdentityRepository(seed);
  let nextId = 0;
  const generateId = () => `generated-${(nextId += 1)}`;
  const service = new IdentityService(repository, generateId, () => 1_000);
  return { repository, service, generateId };
}

describe('IdentityService — guest identity (no sign-in required)', () => {
  it('creates a guest identity on first use, without any account prompt', async () => {
    const { service } = makeService();

    const identity = await service.getOrCreateLocalUserId();

    expect(identity).toEqual({
      localUserId: 'generated-1',
      googleUserId: null,
      email: null,
      displayName: null,
      authProvider: 'local',
      accountType: 'guest',
      createdAt: 1_000,
      updatedAt: 1_000,
    });
  });

  it('persists the guest identity so it survives an app restart', async () => {
    const { repository, service } = makeService();
    const first = await service.getOrCreateLocalUserId();

    // A fresh service instance over the same repository — models a restart.
    const restarted = new IdentityService(repository, () => 'should-not-be-used', () => 2_000);
    const second = await restarted.getOrCreateLocalUserId();

    expect(second).toEqual(first);
  });

  it('never regenerates the id on repeated calls within one run', async () => {
    const { service } = makeService();
    await service.getOrCreateLocalUserId();
    await service.getOrCreateLocalUserId();
    const identity = await service.getOrCreateLocalUserId();

    expect(identity.localUserId).toBe('generated-1');
  });

  it('leaves an already-linked (registered) identity untouched', async () => {
    const existing = {
      localUserId: 'stable-id',
      googleUserId: 'google-123',
      email: 'owner@example.com',
      displayName: 'Business Owner',
      authProvider: 'google' as const,
      accountType: 'registered' as const,
      createdAt: 500,
      updatedAt: 900,
    };
    const { service } = makeService(existing);

    const identity = await service.getOrCreateLocalUserId();

    expect(identity).toEqual(existing);
  });
});
