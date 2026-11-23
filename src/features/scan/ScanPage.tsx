import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { CardImage } from '../../components/CardImage';
import { Spinner } from '../../components/Spinner';
import { EmptyState, ErrorState } from '../../components/StateMessages';
import { parseCollectorNumber } from '../../lib/cardNumber';
import type { ScoredCandidate } from '../../lib/matching/score';
import { readCard, type OcrReading } from '../../lib/ocr/normalize';
import { getCardProvider } from '../../providers/cards/registry';
import { findCandidates } from './findCandidates';
import {
  cardGuideRect,
  cropForOcr,
  NAME_REGION,
  NUMBER_REGION,
  regionToPixels,
  type PixelRect,
} from './imageProcessing';
import { recognizeCard, releaseOcr } from './ocrService';
import { useCamera } from './useCamera';
import { formString } from '../../lib/forms';

type Phase =
  | { readonly kind: 'capture' }
  | { readonly kind: 'processing'; readonly label: string; readonly progress: number | null }
  | {
      readonly kind: 'results';
      readonly reading: OcrReading;
      readonly candidates: ScoredCandidate[];
    }
  | { readonly kind: 'error'; readonly message: string; readonly reading: OcrReading | null };

const OCR_STEPS: Record<string, string> = {
  'loading tesseract core': 'Chargement du moteur OCR…',
  'loading language traineddata': 'Téléchargement des données de langue…',
  'initializing api': 'Initialisation…',
  'recognizing text': 'Lecture de la carte…',
};

export function ScanPage() {
  const { videoRef, state: cameraState, start: startCamera, stop: stopCamera } = useCamera();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ kind: 'capture' });
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const searchController = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      searchController.current?.abort();
      void releaseOcr();
    },
    [],
  );

  async function search(reading: OcrReading) {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setPhase({
      kind: 'processing',
      label: 'Recherche des cartes correspondantes…',
      progress: null,
    });
    const result = await findCandidates(reading, getCardProvider(), controller.signal);
    if (controller.signal.aborted) return;
    setPhase(
      result.ok
        ? { kind: 'results', reading, candidates: result.value }
        : { kind: 'error', message: result.error.message, reading },
    );
  }

  async function analyse(source: CanvasImageSource, guide: PixelRect) {
    setPhase({ kind: 'processing', label: 'Préparation de l’image…', progress: null });
    const nameImage = cropForOcr(source, regionToPixels(guide, NAME_REGION));
    const numberImage = cropForOcr(source, regionToPixels(guide, NUMBER_REGION));

    const ocr = await recognizeCard(nameImage, numberImage, (status, progress) => {
      setPhase({ kind: 'processing', label: OCR_STEPS[status] ?? 'Analyse…', progress });
    });
    if (!ocr.ok) {
      setPhase({ kind: 'error', message: ocr.error.message, reading: null });
      return;
    }
    await search(readCard(ocr.value.nameText, ocr.value.numberText));
  }

  function captureFromVideo() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const guide = cardGuideRect(video.videoWidth, video.videoHeight);
    stopCamera();
    void analyse(video, guide);
  }

  async function analyseFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setPhase({ kind: 'error', message: 'Ce fichier n’est pas une image.', reading: null });
      return;
    }
    stopCamera();
    try {
      const bitmap = await createImageBitmap(file);
      // A photo is assumed to be framed on the card, so the guide covers almost all of it.
      await analyse(bitmap, cardGuideRect(bitmap.width, bitmap.height, 0.98));
      bitmap.close();
    } catch {
      setPhase({ kind: 'error', message: 'Image illisible.', reading: null });
    }
  }

  function restart() {
    searchController.current?.abort();
    setPhase({ kind: 'capture' });
  }

  const guide = frame ? cardGuideRect(frame.width, frame.height) : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Scanner une carte</h1>

      <div className={phase.kind === 'capture' ? 'flex flex-col gap-3' : 'hidden'}>
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            onLoadedMetadata={(e) => {
              setFrame({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight });
            }}
            className="aspect-[3/4] w-full object-contain"
          />
          {cameraState.status === 'active' && frame && guide && (
            <svg
              viewBox={`0 0 ${frame.width} ${frame.height}`}
              preserveAspectRatio="xMidYMid meet"
              className="pointer-events-none absolute inset-0 size-full"
              aria-hidden="true"
            >
              <rect
                x={guide.x}
                y={guide.y}
                width={guide.width}
                height={guide.height}
                rx={guide.width * 0.04}
                fill="none"
                stroke="#f5c542"
                strokeWidth={Math.max(3, frame.width / 200)}
              />
            </svg>
          )}
          {cameraState.status !== 'active' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              {cameraState.status === 'starting' ? (
                <Spinner label="Démarrage de la caméra…" />
              ) : (
                <>
                  <p className="text-sm text-slate-300">
                    Cadrez la carte dans le rectangle, bien éclairée et sans reflet.
                  </p>
                  <button type="button" className="btn-primary" onClick={() => void startCamera()}>
                    Activer la caméra
                  </button>
                </>
              )}
              {cameraState.status === 'error' && (
                <p role="alert" className="text-sm text-red-300">
                  {cameraState.message}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={cameraState.status !== 'active'}
            onClick={captureFromVideo}
          >
            Capturer
          </button>
          <label className="btn-ghost cursor-pointer">
            Photo…
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void analyseFile(file);
              }}
            />
          </label>
        </div>
      </div>

      {phase.kind === 'processing' && (
        <div className="card-panel flex flex-col items-center gap-3">
          <Spinner label={phase.label} />
          {phase.progress !== null && (
            <progress value={phase.progress} max={1} className="w-full accent-accent" />
          )}
        </div>
      )}

      {phase.kind === 'error' && (
        <>
          <ErrorState message={phase.message} onRetry={restart} />
          {phase.reading && (
            <ReadingForm reading={phase.reading} onSubmit={(r) => void search(r)} />
          )}
        </>
      )}

      {phase.kind === 'results' && (
        <>
          <ReadingForm reading={phase.reading} onSubmit={(r) => void search(r)} />
          {phase.candidates.length === 0 ? (
            <EmptyState title="Aucune carte correspondante">
              Corrigez la lecture ci-dessus ou{' '}
              <Link to="/" className="text-accent underline">
                cherchez manuellement
              </Link>
              .
            </EmptyState>
          ) : (
            <section aria-labelledby="suggestions-title" className="flex flex-col gap-2">
              <h2 id="suggestions-title" className="text-sm font-semibold text-slate-300">
                Est-ce l’une de ces cartes ?
              </h2>
              <ul className="flex flex-col gap-2">
                {phase.candidates.map((candidate) => (
                  <li key={candidate.card.id}>
                    <button
                      type="button"
                      onClick={() =>
                        void navigate(`/card/${encodeURIComponent(candidate.card.id)}`)
                      }
                      className="card-panel flex w-full items-center gap-3 p-3 text-left hover:bg-panel-2"
                    >
                      <span className="w-14 shrink-0">
                        <CardImage
                          src={candidate.card.image?.small ?? null}
                          alt={candidate.card.name}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{candidate.card.name}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {candidate.set?.name ?? candidate.card.setId} · #{candidate.card.localId}
                          {candidate.set?.officialCount != null
                            ? `/${candidate.set.officialCount}`
                            : ''}
                        </span>
                      </span>
                      <span className="text-xs text-slate-400">
                        {Math.round(candidate.score * 100)} %
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <button type="button" className="btn-ghost" onClick={restart}>
            Scanner une autre carte
          </button>
        </>
      )}
    </div>
  );
}

/** Lets the user correct what the OCR read before searching again (confirmation step). */
function ReadingForm({
  reading,
  onSubmit,
}: {
  reading: OcrReading;
  onSubmit: (reading: OcrReading) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = formString(form, 'name').trim().slice(0, 60);
    const numberInput = formString(form, 'number').trim();
    const number = numberInput ? parseCollectorNumber(numberInput) : null;
    if (numberInput && !number) {
      setError('Numéro invalide (ex. 025/165)');
      return;
    }
    setError(null);
    onSubmit({ name: name || null, number });
  }

  const numberValue = reading.number
    ? `${reading.number.key}${reading.number.total !== null ? `/${reading.number.total}` : ''}`
    : '';

  return (
    <form onSubmit={handleSubmit} className="card-panel flex flex-col gap-2" noValidate>
      <p className="text-xs text-slate-400">Texte lu sur la carte (modifiable) :</p>
      <div className="grid grid-cols-[2fr_1fr] gap-2">
        <input
          name="name"
          defaultValue={reading.name ?? ''}
          placeholder="Nom"
          aria-label="Nom lu"
          className="input"
          maxLength={60}
        />
        <input
          name="number"
          defaultValue={numberValue}
          placeholder="025/165"
          aria-label="Numéro lu"
          className="input"
          maxLength={12}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
      <button type="submit" className="btn-ghost">
        Relancer la recherche
      </button>
    </form>
  );
}
