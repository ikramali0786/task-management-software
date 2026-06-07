import { describe, it, expect } from 'vitest';
import { evaluateConditions } from '../automation.service';

const task = {
  title: 'Fix login bug',
  status: 'todo',
  priority: 'high',
  assignees: [] as any[],
};

describe('evaluateConditions', () => {
  it('matches when all conditions hold (AND)', () => {
    expect(evaluateConditions(task, [
      { field: 'priority', value: 'high' },
      { field: 'status', value: 'todo' },
    ])).toBe(true);
  });

  it('fails when any condition is false', () => {
    expect(evaluateConditions(task, [
      { field: 'priority', value: 'high' },
      { field: 'status', value: 'done' },
    ])).toBe(false);
  });

  it('titleContains is case-insensitive substring', () => {
    expect(evaluateConditions(task, [{ field: 'titleContains', value: 'BUG' }])).toBe(true);
    expect(evaluateConditions(task, [{ field: 'titleContains', value: 'deploy' }])).toBe(false);
  });

  it('unassigned reflects the assignee count', () => {
    expect(evaluateConditions(task, [{ field: 'unassigned', value: true }])).toBe(true);
    expect(evaluateConditions({ ...task, assignees: ['u1'] }, [{ field: 'unassigned', value: true }])).toBe(false);
  });

  it('empty conditions always match', () => {
    expect(evaluateConditions(task, [])).toBe(true);
  });
});
