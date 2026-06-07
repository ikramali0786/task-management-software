import { describe, it, expect } from 'vitest';
import { buildSlackMessage } from '../slack.service';

describe('buildSlackMessage', () => {
  it('formats a task.created message with identifier, title, and fields', () => {
    const msg = buildSlackMessage('task.created', {
      identifier: 42,
      title: 'Ship Slack',
      status: 'in_progress',
      priority: 'high',
      assignees: [{ id: '1', name: 'Ada' }],
    });
    expect(msg.text).toContain('#42');
    expect(msg.text).toContain('Ship Slack');
    expect(msg.text).toContain('New task');
    expect(JSON.stringify(msg.blocks)).toContain('Ada');
    expect(JSON.stringify(msg.blocks)).toContain('Priority');
  });

  it('uses the completed verb/emoji for task.completed', () => {
    const msg = buildSlackMessage('task.completed', { identifier: 7, title: 'Done thing' });
    expect(msg.text).toContain('Task completed');
    expect(msg.text).toContain(':white_check_mark:');
  });

  it('formats a comment.created message and strips HTML from the body', () => {
    const msg = buildSlackMessage('comment.created', {
      task: { identifier: 9, title: 'Review' },
      author: { name: 'Grace' },
      body: '<b>Looks</b> good',
    });
    expect(msg.text).toContain('New comment');
    expect(msg.text).toContain('Grace');
    expect(JSON.stringify(msg.blocks)).toContain('Looks good');
    expect(JSON.stringify(msg.blocks)).not.toContain('<b>');
  });

  it('produces a ping test message', () => {
    const msg = buildSlackMessage('ping', {});
    expect(msg.text.toLowerCase()).toContain('test');
    expect(msg.blocks.length).toBeGreaterThan(0);
  });

  it('omits the "Open in TaskFlow" link for deletions', () => {
    const msg = buildSlackMessage('task.deleted', { identifier: 3, title: 'Gone' });
    expect(JSON.stringify(msg.blocks)).not.toContain('Open in TaskFlow');
  });
});
