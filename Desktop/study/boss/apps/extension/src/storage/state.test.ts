import { describe, expect, it } from 'vitest';
import { createInitialState } from './state';

describe('extension initial state', () => {
  it('starts local-first with dry-run policy and safety blacklist defaults', () => {
    const state = createInitialState('2026-06-08T00:00:00.000Z');

    expect(state.policy.mode).toBe('dry-run');
    expect(state.queue.dayKey).toBe('2026-06-08');
    expect(state.research).toEqual([]);
    expect(state.runner.enabled).toBe(false);
    expect(state.blacklist.map((rule) => rule.value)).toEqual(expect.arrayContaining(['外包', '单休', '培训']));
  });
});
