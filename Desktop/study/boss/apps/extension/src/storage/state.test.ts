import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, loadState } from './state';

describe('extension initial state', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts local-first with dry-run policy and safety blacklist defaults', () => {
    const state = createInitialState('2026-06-08T00:00:00.000Z');

    expect(state.policy.mode).toBe('dry-run');
    expect(state.policy.requireResearchBeforeAuto).toBe(true);
    expect(state.queue.dayKey).toBe('2026-06-08');
    expect(state.research).toEqual([]);
    expect(state.pendingResearchTargets).toEqual([]);
    expect(state.runner.enabled).toBe(false);
    expect(state.blacklist.map((rule) => rule.value)).toEqual(expect.arrayContaining(['外包', '单休', '培训']));
  });

  it('fills missing policy defaults when loading older stored state', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            jobAssistantState: {
              policy: {
                dailyLimit: 5,
                minMinutesBetweenActions: 3,
                maxQueueSize: 20,
                mode: 'auto'
              }
            }
          })
        }
      }
    });

    const state = await loadState();

    expect(state.policy).toMatchObject({
      dailyLimit: 5,
      minMinutesBetweenActions: 3,
      maxQueueSize: 20,
      mode: 'auto',
      requireResearchBeforeAuto: true
    });
    expect(state.pendingResearchTargets).toEqual([]);
  });
});
