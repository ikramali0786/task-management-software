// Starter templates for new wiki pages.
export interface DocTemplate { id: string; name: string; icon: string; title: string; content: string }

export const DOC_TEMPLATES: DocTemplate[] = [
  { id: 'blank', name: 'Blank page', icon: '📄', title: 'Untitled', content: '' },
  {
    id: 'meeting', name: 'Meeting notes', icon: '📝', title: 'Meeting notes',
    content: `# Meeting notes

**Date:** \n**Attendees:** \n

## Agenda
-

## Discussion
-

## Decisions
-

## Action items
- [ ] Owner — task
`,
  },
  {
    id: 'prd', name: 'Product spec', icon: '🚀', title: 'Product spec',
    content: `# Product spec

## Problem
What are we solving and for whom?

## Goals
-

## Non-goals
-

## Proposed solution


## Open questions
-

## Success metrics
-
`,
  },
  {
    id: 'runbook', name: 'Runbook', icon: '🛠️', title: 'Runbook',
    content: `# Runbook: <service>

## Overview


## Prerequisites
-

## Steps
1.
2.

## Rollback
1.

## Troubleshooting
| Symptom | Cause | Fix |
| --- | --- | --- |
|  |  |  |
`,
  },
  {
    id: 'retro', name: 'Retrospective', icon: '🔁', title: 'Sprint retrospective',
    content: `# Sprint retrospective

## 🟢 What went well
-

## 🔴 What to improve
-

## 🔵 Action items
- [ ]
`,
  },
  {
    id: 'howto', name: 'How-to guide', icon: '💡', title: 'How to …',
    content: `# How to …

> A short guide for the team.

## Before you start
-

## Steps
1.
2.
3.

## Tips
-
`,
  },
];
