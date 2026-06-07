import { describe, it, expect } from 'vitest';
import { cosineSim, taskEmbedText } from '../embedding.service';

describe('cosineSim', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSim([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });

  it('returns ~0 for orthogonal vectors', () => {
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSim([1, 2], [-1, -2])).toBeCloseTo(-1, 5);
  });

  it('handles zero vectors without NaN', () => {
    expect(cosineSim([0, 0], [1, 1])).toBe(0);
  });

  it('ranks a closer vector higher', () => {
    const q = [1, 1, 0];
    const near = cosineSim(q, [1, 0.9, 0]);
    const far = cosineSim(q, [0, 0, 1]);
    expect(near).toBeGreaterThan(far);
  });
});

describe('taskEmbedText', () => {
  it('combines title and description and trims', () => {
    expect(taskEmbedText({ title: 'Fix bug', description: 'in login' })).toBe('Fix bug\nin login');
  });
  it('tolerates missing description', () => {
    expect(taskEmbedText({ title: 'Solo' })).toBe('Solo');
  });
});
