import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import { appError, type AppError } from '../../lib/errors';
import { err, ok, type Result } from '../../lib/result';

export interface OcrText {
  readonly nameText: string;
  readonly numberText: string;
}

export type OcrProgress = (status: string, progress: number) => void;

let workerPromise: Promise<Worker> | null = null;
let progressListener: OcrProgress | null = null;

/**
 * Tesseract.js runs recognition inside its own Web Worker, so the UI thread stays responsive.
 * Worker and WASM core are served from our origin (see vite.config.ts); language models
 * (fra + eng for "PV"/"ex"/promo codes) come from jsDelivr once, then from IndexedDB.
 */
function getWorker(): Promise<Worker> {
  workerPromise ??= createWorker(['fra', 'eng'], OEM.LSTM_ONLY, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract',
    workerBlobURL: false,
    logger: (message: { status: string; progress: number }) => {
      progressListener?.(message.status, message.progress);
    },
  }).catch((cause: unknown) => {
    workerPromise = null;
    throw cause;
  });
  return workerPromise;
}

export async function recognizeCard(
  nameImage: HTMLCanvasElement,
  numberImage: HTMLCanvasElement,
  onProgress?: OcrProgress,
): Promise<Result<OcrText, AppError>> {
  progressListener = onProgress ?? null;
  try {
    const worker = await getWorker();
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const name = await worker.recognize(nameImage);
    // The bottom strip holds scattered fragments (illustrator, number, set code).
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const number = await worker.recognize(numberImage);
    return ok({ nameText: name.data.text, numberText: number.data.text });
  } catch {
    return err(appError('unavailable', 'La reconnaissance de texte a échoué. Réessayez.'));
  } finally {
    progressListener = null;
  }
}

/** Frees ~50 MB of WASM memory when the user leaves the scanner. */
export async function releaseOcr(): Promise<void> {
  const pending = workerPromise;
  workerPromise = null;
  if (!pending) return;
  try {
    await (await pending).terminate();
  } catch {
    // Worker already gone: nothing to release.
  }
}
