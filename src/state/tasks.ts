import { DEFAULT_ADJUSTMENTS, type Adjustments, type LangKey, type OcrTask, type Rect, type TaskStatus } from '../lib/types';

export interface TaskState {
  tasks: OcrTask[];
  activeId: string | null;
}

export type TaskAction =
  | { type: 'add'; tasks: OcrTask[] }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'activate'; id: string | null }
  | { type: 'patch'; id: string; patch: Partial<OcrTask> }
  | { type: 'set-status'; id: string; status: TaskStatus; errorCode?: string | null; errorDetail?: string | null }
  | { type: 'set-progress'; id: string; progress: number }
  | { type: 'set-result'; id: string; text: string; confidence: number | null; durationMs: number }
  | { type: 'set-edited-text'; id: string; text: string | null }
  | { type: 'set-langs'; id: string; langs: LangKey }
  | { type: 'set-adjustments'; id: string; adjustments: Adjustments }
  | { type: 'set-region'; id: string; region: Rect | null };

export const EMPTY_TASK_STATE: TaskState = { tasks: [], activeId: null };

export function makeTask(input: {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  previewUrl: string;
  width: number;
  height: number;
  langs: LangKey;
  createdAt?: number;
}): OcrTask {
  return {
    id: input.id,
    name: input.name,
    size: input.size,
    mimeType: input.mimeType,
    previewUrl: input.previewUrl,
    width: input.width,
    height: input.height,
    status: 'queued',
    progress: 0,
    text: '',
    editedText: null,
    confidence: null,
    errorCode: null,
    errorDetail: null,
    langs: input.langs,
    region: null,
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    durationMs: null,
    createdAt: input.createdAt ?? Date.now(),
    fromHistory: false,
  };
}

function patchTask(tasks: OcrTask[], id: string, patch: Partial<OcrTask>): OcrTask[] {
  let changed = false;
  const next = tasks.map((task) => {
    if (task.id !== id) return task;
    changed = true;
    return { ...task, ...patch };
  });
  return changed ? next : tasks;
}

/** Pick the next task to focus after one is removed. */
export function nextActiveId(tasks: OcrTask[], removedId: string, activeId: string | null): string | null {
  if (activeId !== removedId) return activeId;
  const index = tasks.findIndex((task) => task.id === removedId);
  const remaining = tasks.filter((task) => task.id !== removedId);
  if (remaining.length === 0) return null;
  const nextIndex = Math.min(Math.max(index, 0), remaining.length - 1);
  return remaining[nextIndex].id;
}

export function tasksReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'add': {
      if (action.tasks.length === 0) return state;
      const known = new Set(state.tasks.map((task) => task.id));
      const incoming = action.tasks.filter((task) => !known.has(task.id));
      if (incoming.length === 0) return state;
      return {
        tasks: [...state.tasks, ...incoming],
        activeId: state.activeId ?? incoming[0].id,
      };
    }
    case 'remove': {
      const nextActive = nextActiveId(state.tasks, action.id, state.activeId);
      return {
        tasks: state.tasks.filter((task) => task.id !== action.id),
        activeId: nextActive === action.id ? null : nextActive,
      };
    }
    case 'clear':
      return EMPTY_TASK_STATE;
    case 'activate':
      return { ...state, activeId: action.id };
    case 'patch':
      return { ...state, tasks: patchTask(state.tasks, action.id, action.patch) };
    case 'set-status':
      return {
        ...state,
        tasks: patchTask(state.tasks, action.id, {
          status: action.status,
          errorCode: action.errorCode ?? null,
          errorDetail: action.errorDetail ?? null,
          ...(action.status === 'queued' ? { progress: 0 } : {}),
        }),
      };
    case 'set-progress':
      return { ...state, tasks: patchTask(state.tasks, action.id, { progress: action.progress }) };
    case 'set-result':
      return {
        ...state,
        tasks: patchTask(state.tasks, action.id, {
          status: 'done',
          progress: 1,
          text: action.text,
          confidence: action.confidence,
          durationMs: action.durationMs,
          errorCode: null,
          errorDetail: null,
        }),
      };
    case 'set-edited-text':
      return { ...state, tasks: patchTask(state.tasks, action.id, { editedText: action.text }) };
    case 'set-langs':
      return { ...state, tasks: patchTask(state.tasks, action.id, { langs: action.langs }) };
    case 'set-adjustments':
      return { ...state, tasks: patchTask(state.tasks, action.id, { adjustments: action.adjustments }) };
    case 'set-region':
      return { ...state, tasks: patchTask(state.tasks, action.id, { region: action.region }) };
    default:
      return state;
  }
}

export function findTask(state: TaskState, id: string | null): OcrTask | null {
  if (!id) return null;
  return state.tasks.find((task) => task.id === id) ?? null;
}

export function isRunning(status: TaskStatus): boolean {
  return status === 'preparing' || status === 'loading-model' || status === 'recognizing';
}
