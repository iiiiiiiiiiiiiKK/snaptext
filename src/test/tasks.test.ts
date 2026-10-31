import { describe, expect, it } from 'vitest';
import {
  EMPTY_TASK_STATE,
  findTask,
  isRunning,
  makeTask,
  nextActiveId,
  tasksReducer,
  type TaskState,
} from '../state/tasks';
import type { OcrTask } from '../lib/types';

function buildTask(id: string, name = `${id}.png`): OcrTask {
  return makeTask({
    id,
    name,
    size: 1024,
    mimeType: 'image/png',
    previewUrl: `blob:${id}`,
    width: 800,
    height: 600,
    langs: 'chi_sim+eng',
    createdAt: 1_700_000_000_000,
  });
}

function stateWith(...ids: string[]): TaskState {
  return tasksReducer(EMPTY_TASK_STATE, { type: 'add', tasks: ids.map((id) => buildTask(id)) });
}

describe('tasksReducer: adding and selecting', () => {
  it('starts empty', () => {
    expect(EMPTY_TASK_STATE).toEqual({ tasks: [], activeId: null });
  });

  it('adds tasks and activates the first one', () => {
    const state = stateWith('a', 'b');
    expect(state.tasks).toHaveLength(2);
    expect(state.activeId).toBe('a');
  });

  it('does not duplicate task ids', () => {
    const base = stateWith('a');
    const next = tasksReducer(base, { type: 'add', tasks: [buildTask('a'), buildTask('b')] });
    expect(next.tasks.map((task) => task.id)).toEqual(['a', 'b']);
  });

  it('keeps the current selection when more tasks arrive', () => {
    const base = tasksReducer(stateWith('a', 'b'), { type: 'activate', id: 'b' });
    const next = tasksReducer(base, { type: 'add', tasks: [buildTask('c')] });
    expect(next.activeId).toBe('b');
  });

  it('ignores empty add actions', () => {
    const base = stateWith('a');
    expect(tasksReducer(base, { type: 'add', tasks: [] })).toBe(base);
  });
});

describe('tasksReducer: removal', () => {
  it('activates a neighbour when the active task is removed', () => {
    const state = tasksReducer(stateWith('a', 'b', 'c'), { type: 'activate', id: 'b' });
    const next = tasksReducer(state, { type: 'remove', id: 'b' });
    expect(next.tasks.map((task) => task.id)).toEqual(['a', 'c']);
    expect(next.activeId).toBe('c');
  });

  it('clears the selection when the last task goes away', () => {
    const next = tasksReducer(stateWith('a'), { type: 'remove', id: 'a' });
    expect(next.tasks).toEqual([]);
    expect(next.activeId).toBeNull();
  });

  it('keeps the selection when another task is removed', () => {
    const state = tasksReducer(stateWith('a', 'b'), { type: 'activate', id: 'a' });
    const next = tasksReducer(state, { type: 'remove', id: 'b' });
    expect(next.activeId).toBe('a');
  });

  it('nextActiveId handles unknown ids safely', () => {
    expect(nextActiveId([], 'x', 'x')).toBeNull();
    expect(nextActiveId([buildTask('a')], 'x', 'a')).toBe('a');
  });

  it('clears everything on clear', () => {
    expect(tasksReducer(stateWith('a', 'b'), { type: 'clear' })).toEqual(EMPTY_TASK_STATE);
  });
});

describe('tasksReducer: status lifecycle', () => {
  it('walks queued -> loading-model -> recognizing -> done', () => {
    let state = stateWith('a');
    state = tasksReducer(state, { type: 'set-status', id: 'a', status: 'loading-model' });
    expect(findTask(state, 'a')?.status).toBe('loading-model');
    state = tasksReducer(state, { type: 'patch', id: 'a', patch: { status: 'recognizing', progress: 0.4 } });
    expect(findTask(state, 'a')?.progress).toBe(0.4);
    state = tasksReducer(state, { type: 'set-result', id: 'a', text: 'hello', confidence: 88.5, durationMs: 1200 });
    const task = findTask(state, 'a');
    expect(task?.status).toBe('done');
    expect(task?.progress).toBe(1);
    expect(task?.text).toBe('hello');
    expect(task?.confidence).toBe(88.5);
    expect(task?.durationMs).toBe(1200);
  });

  it('records and clears error information', () => {
    let state = tasksReducer(stateWith('a'), {
      type: 'set-status',
      id: 'a',
      status: 'error',
      errorCode: 'recognize-failed',
      errorDetail: 'boom',
    });
    expect(findTask(state, 'a')?.errorCode).toBe('recognize-failed');
    state = tasksReducer(state, { type: 'set-result', id: 'a', text: 'ok', confidence: null, durationMs: 10 });
    expect(findTask(state, 'a')?.errorCode).toBeNull();
    expect(findTask(state, 'a')?.errorDetail).toBeNull();
  });

  it('resets progress when a task is queued again', () => {
    let state = tasksReducer(stateWith('a'), { type: 'set-progress', id: 'a', progress: 0.7 });
    state = tasksReducer(state, { type: 'set-status', id: 'a', status: 'queued' });
    expect(findTask(state, 'a')?.progress).toBe(0);
  });

  it('ignores patches for unknown ids', () => {
    const base = stateWith('a');
    const next = tasksReducer(base, { type: 'set-progress', id: 'zzz', progress: 0.5 });
    expect(next.tasks).toBe(base.tasks);
  });
});

describe('tasksReducer: editing, language, adjustments, region', () => {
  it('stores user edits separately from the raw OCR text', () => {
    let state = tasksReducer(stateWith('a'), { type: 'set-result', id: 'a', text: 'raw', confidence: 50, durationMs: 5 });
    state = tasksReducer(state, { type: 'set-edited-text', id: 'a', text: 'edited' });
    expect(findTask(state, 'a')?.editedText).toBe('edited');
    expect(findTask(state, 'a')?.text).toBe('raw');
    state = tasksReducer(state, { type: 'set-edited-text', id: 'a', text: null });
    expect(findTask(state, 'a')?.editedText).toBeNull();
  });

  it('updates language, adjustments and region', () => {
    let state = stateWith('a');
    state = tasksReducer(state, { type: 'set-langs', id: 'a', langs: 'eng' });
    expect(findTask(state, 'a')?.langs).toBe('eng');
    state = tasksReducer(state, {
      type: 'set-adjustments',
      id: 'a',
      adjustments: { rotate: 90, brightness: 120, contrast: 110, grayscale: true },
    });
    expect(findTask(state, 'a')?.adjustments).toEqual({ rotate: 90, brightness: 120, contrast: 110, grayscale: true });
    state = tasksReducer(state, { type: 'set-region', id: 'a', region: { left: 1, top: 2, width: 30, height: 40 } });
    expect(findTask(state, 'a')?.region).toEqual({ left: 1, top: 2, width: 30, height: 40 });
    state = tasksReducer(state, { type: 'set-region', id: 'a', region: null });
    expect(findTask(state, 'a')?.region).toBeNull();
  });
});

describe('isRunning', () => {
  it('recognises in-flight statuses only', () => {
    expect(isRunning('preparing')).toBe(true);
    expect(isRunning('loading-model')).toBe(true);
    expect(isRunning('recognizing')).toBe(true);
    expect(isRunning('queued')).toBe(false);
    expect(isRunning('done')).toBe(false);
    expect(isRunning('error')).toBe(false);
    expect(isRunning('cancelled')).toBe(false);
  });
});

describe('makeTask', () => {
  it('creates a queued task with default adjustments', () => {
    const task = buildTask('a');
    expect(task.status).toBe('queued');
    expect(task.progress).toBe(0);
    expect(task.adjustments).toEqual({ rotate: 0, brightness: 100, contrast: 100, grayscale: false });
    expect(task.editedText).toBeNull();
    expect(task.fromHistory).toBe(false);
  });
});
