import { beforeEach, describe, expect, it, vi } from 'vitest';

const tesseractMock = vi.hoisted(() => ({
  createWorker: vi.fn(),
  recognize: vi.fn(),
  terminate: vi.fn(),
}));

vi.mock('tesseract.js', () => ({
  createWorker: tesseractMock.createWorker,
  OEM: { LSTM_ONLY: 1 },
}));

import { OcrEngine, OcrError } from '../lib/ocrEngine';
import type { OcrProgress } from '../lib/ocrEngine';

const image = {} as HTMLCanvasElement;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function stubWorker(
  recognize: (input: unknown) => Promise<unknown>,
  captureLogger?: (logger: (message: { status: string; progress: number }) => void) => void,
) {
  tesseractMock.createWorker.mockImplementation(async (_langs: unknown, _oem: unknown, options: { logger?: (m: never) => void }) => {
    if (captureLogger && options?.logger) captureLogger(options.logger as never);
    return { recognize, terminate: tesseractMock.terminate };
  });
}

beforeEach(() => {
  tesseractMock.createWorker.mockReset();
  tesseractMock.recognize.mockReset();
  tesseractMock.terminate.mockReset();
  tesseractMock.terminate.mockResolvedValue(undefined);
});

describe('OcrEngine: happy path', () => {
  it('returns recognised text and confidence', async () => {
    stubWorker(async () => ({ data: { text: 'Hello SnapText', confidence: 93.2 } }));
    const engine = new OcrEngine({ workerPath: '/worker.js' });
    const outcome = await engine.recognize({ jobId: 'j1', langs: 'eng', image });

    expect(outcome.text).toBe('Hello SnapText');
    expect(outcome.confidence).toBe(93.2);
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
    expect(tesseractMock.createWorker).toHaveBeenCalledTimes(1);
  });

  it('reuses one worker for repeated jobs in the same language', async () => {
    stubWorker(async () => ({ data: { text: 'ok', confidence: 80 } }));
    const engine = new OcrEngine();
    await engine.recognize({ jobId: 'a', langs: 'eng', image });
    await engine.recognize({ jobId: 'b', langs: 'eng', image });
    expect(tesseractMock.createWorker).toHaveBeenCalledTimes(1);
  });

  it('creates a new worker when the language changes', async () => {
    stubWorker(async () => ({ data: { text: 'ok', confidence: 80 } }));
    const engine = new OcrEngine();
    await engine.recognize({ jobId: 'a', langs: 'eng', image });
    await engine.recognize({ jobId: 'b', langs: 'chi_sim', image });
    expect(tesseractMock.createWorker).toHaveBeenCalledTimes(2);
    expect(tesseractMock.terminate).toHaveBeenCalled();
  });

  it('reports real progress phases from the worker logger', async () => {
    const progress: OcrProgress[] = [];
    stubWorker(
      async () => {
        return { data: { text: 'x', confidence: 1 } };
      },
      (logger) => {
        logger({ status: 'loading language traineddata', progress: 0.5 });
        logger({ status: 'recognizing text', progress: 0.5 });
      },
    );
    const engine = new OcrEngine();
    await engine.recognize({ jobId: 'p', langs: 'eng', image, onProgress: (event) => progress.push(event) });
    expect(progress.some((event) => event.phase === 'model')).toBe(true);
    expect(progress.some((event) => event.phase === 'recognize' && event.ratio === 0.5)).toBe(true);
  });
});

describe('OcrEngine: failures', () => {
  it('maps a worker creation failure onto model-load-failed', async () => {
    tesseractMock.createWorker.mockRejectedValue(new Error('network down'));
    const engine = new OcrEngine();
    await expect(engine.recognize({ jobId: 'j', langs: 'eng', image })).rejects.toMatchObject({
      code: 'model-load-failed',
    });
  });

  it('maps a recognition failure onto recognize-failed', async () => {
    stubWorker(async () => {
      throw new Error('tesseract crashed');
    });
    const engine = new OcrEngine();
    const error = await engine.recognize({ jobId: 'j', langs: 'eng', image }).catch((caught) => caught);
    expect(error).toBeInstanceOf(OcrError);
    expect(error.code).toBe('recognize-failed');
  });

  it('keeps serving the queue after a failure', async () => {
    let calls = 0;
    stubWorker(async () => {
      calls += 1;
      if (calls === 1) throw new Error('first fails');
      return { data: { text: 'second', confidence: 70 } };
    });
    const engine = new OcrEngine();
    await expect(engine.recognize({ jobId: 'a', langs: 'eng', image })).rejects.toBeTruthy();
    await expect(engine.recognize({ jobId: 'b', langs: 'eng', image })).resolves.toMatchObject({ text: 'second' });
  });
});

describe('OcrEngine: concurrency and cancellation', () => {
  it('respects the concurrency limit', async () => {
    const gate = deferred<void>();
    let active = 0;
    let peak = 0;
    stubWorker(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await gate.promise;
      active -= 1;
      return { data: { text: 'x', confidence: 1 } };
    });

    const engine = new OcrEngine();
    engine.setConcurrency(1);
    const first = engine.recognize({ jobId: 'a', langs: 'eng', image });
    const second = engine.recognize({ jobId: 'b', langs: 'eng', image });
    expect(engine.queuedCount).toBe(1);
    gate.resolve();
    await Promise.all([first, second]);
    expect(peak).toBe(1);
  });

  it('cancels a queued job without starting it', async () => {
    const gate = deferred<void>();
    stubWorker(async () => {
      await gate.promise;
      return { data: { text: 'x', confidence: 1 } };
    });

    const engine = new OcrEngine();
    engine.setConcurrency(1);
    const running = engine.recognize({ jobId: 'a', langs: 'eng', image });
    const queued = engine.recognize({ jobId: 'b', langs: 'eng', image });
    expect(engine.cancel('b')).toBe(true);
    await expect(queued).rejects.toMatchObject({ code: 'cancelled' });
    gate.resolve();
    await expect(running).resolves.toMatchObject({ text: 'x' });
  });

  it('cancels a running job by terminating its worker', async () => {
    stubWorker(() => new Promise(() => undefined));
    const engine = new OcrEngine();
    const running = engine.recognize({ jobId: 'a', langs: 'eng', image });

    await new Promise((resolve) => window.setTimeout(resolve, 30));
    expect(engine.cancel('a')).toBe(true);
    await expect(running).rejects.toMatchObject({ code: 'cancelled' });
    expect(tesseractMock.terminate).toHaveBeenCalled();
  });

  it('returns false when cancelling an unknown job', () => {
    const engine = new OcrEngine();
    expect(engine.cancel('nope')).toBe(false);
  });

  it('resets every worker', async () => {
    stubWorker(async () => ({ data: { text: 'x', confidence: 1 } }));
    const engine = new OcrEngine();
    await engine.recognize({ jobId: 'a', langs: 'eng', image });
    await engine.reset();
    expect(tesseractMock.terminate).toHaveBeenCalledTimes(1);
    await engine.recognize({ jobId: 'b', langs: 'eng', image });
    expect(tesseractMock.createWorker).toHaveBeenCalledTimes(2);
  });
});
