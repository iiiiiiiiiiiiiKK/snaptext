import { createWorker, OEM, type Worker } from 'tesseract.js';
import workerScriptUrl from 'tesseract.js/dist/worker.min.js?url';
import { langsFor, type LangKey } from './types';

export type OcrPhase = 'model' | 'recognize';

export interface OcrProgress {
  phase: OcrPhase;
  /** 0..1 within the current phase. */
  ratio: number;
  status: string;
}

export interface RecognizeRequest {
  jobId: string;
  langs: LangKey;
  image: HTMLCanvasElement;
  onProgress?: (progress: OcrProgress) => void;
}

export interface RecognizeOutcome {
  text: string;
  confidence: number | null;
  durationMs: number;
}

export type OcrErrorCode = 'model-load-failed' | 'recognize-failed' | 'cancelled';

export class OcrError extends Error {
  constructor(
    readonly code: OcrErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OcrError';
  }
}

type Stage = 'model' | 'recognize';

interface Job {
  id: string;
  langs: LangKey;
  image: HTMLCanvasElement;
  onProgress?: (progress: OcrProgress) => void;
  resolve: (outcome: RecognizeOutcome) => void;
  reject: (error: unknown) => void;
  cancelled: boolean;
  settled: boolean;
  stage: Stage;
  startedAt: number;
}

interface Slot {
  langs: LangKey | null;
  worker: Worker | null;
  creating: Promise<Worker> | null;
  busy: boolean;
  currentJob: Job | null;
}

/**
 * A tiny worker pool around Tesseract.js.
 *
 * - Every OCR job runs inside Tesseract's own Web Worker, so the main thread
 *   never blocks while text is being recognised.
 * - Workers are keyed by language and reused: language models are downloaded
 *   once (and cached in IndexedDB by Tesseract.js), then kept in memory.
 * - `concurrency` caps how many workers run at once so batch jobs cannot
 *   exhaust device memory.
 * - `cancel()` terminates the worker executing the job; the language model is
 *   re-read from cache the next time it is needed.
 */
export class OcrEngine {
  private slots: Slot[] = [];
  private queue: Job[] = [];
  private running = 0;
  private concurrency = 1;
  private readonly workerPath: string;

  constructor(options: { workerPath?: string } = {}) {
    this.workerPath = options.workerPath ?? workerScriptUrl;
  }

  setConcurrency(value: number): void {
    this.concurrency = Math.max(1, Math.min(3, Math.round(value)));
    this.pump();
  }

  getConcurrency(): number {
    return this.concurrency;
  }

  /** Number of jobs currently executing (queued jobs excluded). */
  get activeCount(): number {
    return this.running;
  }

  get queuedCount(): number {
    return this.queue.length;
  }

  recognize(request: RecognizeRequest): Promise<RecognizeOutcome> {
    return new Promise<RecognizeOutcome>((resolve, reject) => {
      this.queue.push({
        id: request.jobId,
        langs: request.langs,
        image: request.image,
        onProgress: request.onProgress,
        resolve,
        reject,
        cancelled: false,
        settled: false,
        stage: 'model',
        startedAt: 0,
      });
      this.pump();
    });
  }

  /** Cancel a queued or running job. Returns false when the job is unknown. */
  cancel(jobId: string): boolean {
    const index = this.queue.findIndex((job) => job.id === jobId);
    if (index !== -1) {
      const [job] = this.queue.splice(index, 1);
      job.cancelled = true;
      job.settled = true;
      job.reject(new OcrError('cancelled', 'Cancelled before it started'));
      return true;
    }

    for (const slot of this.slots) {
      if (slot.currentJob?.id !== jobId) continue;
      const job = slot.currentJob;
      job.cancelled = true;
      const worker = slot.worker;
      slot.worker = null;
      slot.creating = null;
      slot.currentJob = null;
      slot.langs = null;
      if (worker) void worker.terminate().catch(() => undefined);
      return true;
    }
    return false;
  }

  /** Terminate every worker and drop cached models from memory. */
  async reset(): Promise<void> {
    const workers = this.slots.map((slot) => slot.worker).filter((worker): worker is Worker => Boolean(worker));
    this.slots = [];
    await Promise.all(workers.map((worker) => worker.terminate().catch(() => undefined)));
  }

  private pump(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      this.running += 1;
      void this.runJob(job);
    }
  }

  private async acquireSlot(langs: LangKey): Promise<Slot> {
    const reusable = this.slots.find((slot) => !slot.busy && slot.worker && slot.langs === langs);
    if (reusable) {
      reusable.busy = true;
      return reusable;
    }

    // Any idle slot can be recycled: a warm worker for another language costs
    // memory, and the model is re-read from the local cache when needed.
    const idle = this.slots.find((slot) => !slot.busy && !slot.creating);
    const slot: Slot = idle ?? { langs: null, worker: null, creating: null, busy: false, currentJob: null };
    if (!idle) this.slots.push(slot);

    if (slot.worker && slot.langs !== langs) {
      const stale = slot.worker;
      slot.worker = null;
      void stale.terminate().catch(() => undefined);
    }

    slot.langs = langs;
    slot.busy = true;
    return slot;
  }

  private releaseSlot(slot: Slot): void {
    slot.busy = false;
    slot.currentJob = null;
    if (!slot.worker) {
      slot.langs = null;
      this.slots = this.slots.filter((candidate) => candidate !== slot);
    }
  }

  private handleWorkerLog(slot: Slot, message: { status?: string; progress?: number }): void {
    const job = slot.currentJob;
    if (!job || job.settled) return;
    const status = message.status ?? 'working';
    const ratio = typeof message.progress === 'number' ? Math.min(Math.max(message.progress, 0), 1) : 0;
    if (status === 'recognizing text') {
      job.stage = 'recognize';
      job.onProgress?.({ phase: 'recognize', ratio, status });
    } else {
      job.onProgress?.({ phase: 'model', ratio, status });
    }
  }

  private async ensureWorker(slot: Slot, langs: LangKey, job: Job): Promise<Worker> {
    if (slot.worker) return slot.worker;
    if (slot.creating) return slot.creating;

    slot.currentJob = job;
    const creating = createWorker(langsFor(langs), OEM.LSTM_ONLY, {
      workerPath: this.workerPath,
      logger: (message: { status?: string; progress?: number }) => this.handleWorkerLog(slot, message),
    })
      .then((worker) => {
        slot.worker = worker;
        slot.creating = null;
        return worker;
      })
      .catch((error: unknown) => {
        slot.creating = null;
        slot.worker = null;
        throw error;
      });

    slot.creating = creating;
    return creating;
  }

  private async runJob(job: Job): Promise<void> {
    job.startedAt = Date.now();
    let slot: Slot | null = null;
    let ticker: number | undefined;

    try {
      slot = await this.acquireSlot(job.langs);
      if (job.cancelled) throw new OcrError('cancelled', 'Cancelled while waiting for a worker');

      const worker = await this.ensureWorker(slot, job.langs, job);
      if (job.cancelled) {
        const abandoned = slot.worker;
        slot.worker = null;
        slot.langs = null;
        if (abandoned) void abandoned.terminate().catch(() => undefined);
        throw new OcrError('cancelled', 'Cancelled while loading the language model');
      }

      slot.currentJob = job;
      job.stage = 'recognize';

      // Cancellation hook: `cancel()` flips `job.cancelled`, this rejects the race.
      const cancelSignal = new Promise<never>((_, rejectRace) => {
        ticker = window.setInterval(() => {
          if (job.cancelled) rejectRace(new OcrError('cancelled', 'Cancelled by user'));
        }, 120);
      });

      const result = await Promise.race([worker.recognize(job.image), cancelSignal]);
      if (job.cancelled) throw new OcrError('cancelled', 'Cancelled before the result was read');

      if (job.settled) return;
      job.settled = true;
      job.resolve({
        text: typeof result.data.text === 'string' ? result.data.text : '',
        confidence: typeof result.data.confidence === 'number' ? result.data.confidence : null,
        durationMs: Date.now() - job.startedAt,
      });
    } catch (error) {
      if (job.cancelled) {
        if (!job.settled) {
          job.settled = true;
          job.reject(new OcrError('cancelled', 'Cancelled by user'));
        }
      } else if (!job.settled) {
        job.settled = true;
        job.reject(
          error instanceof OcrError
            ? error
            : new OcrError(
                job.stage === 'model' ? 'model-load-failed' : 'recognize-failed',
                error instanceof Error ? error.message : String(error),
              ),
        );
      }
    } finally {
      if (ticker !== undefined) window.clearInterval(ticker);
      if (slot) this.releaseSlot(slot);
      this.running = Math.max(0, this.running - 1);
      this.pump();
    }
  }
}

let engine: OcrEngine | null = null;

/** App-wide singleton: keeps language models warm between jobs. */
export function getOcrEngine(): OcrEngine {
  if (!engine) engine = new OcrEngine();
  return engine;
}
