import { useEffect, useState } from 'react';
import type { Light, Motif } from '../lib/analyze';
import { developPhotograph, photographUrl } from '../lib/photograph';
import type { Frame, Photograph } from '../lib/types';

/**
 * PHOTOGRAPH: optional. Develops one photograph of the chosen direction on a Modal GPU.
 * Nothing is kept automatically: the person decides whether it stays with the work.
 */
export function PhotographPanel({
  request,
  photo,
  keepPhoto,
  onPhoto,
  onKeepPhoto,
}: {
  request: { frame: Frame; light: Light; motifs: Motif[]; words: string[]; composition?: string; seed: number };
  photo: Photograph | null;
  keepPhoto: boolean;
  onPhoto: (p: Photograph) => void;
  onKeepPhoto: (keep: boolean) => void;
}) {
  const [started, setStarted] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started === null) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(t);
  }, [started]);

  const run = async () => {
    setError(null);
    setElapsed(0);
    setStarted(Date.now());
    const out = await developPhotograph(request);
    setStarted(null);
    if (out.ok) {
      onPhoto(out.photo);
      onKeepPhoto(false);
    } else setError(out.error);
  };

  const busy = started !== null;

  return (
    <div className="ctl photo">
      <p className="ctl-label mono">
        <b>07</b> Photograph <span className="dim">optional · Modal</span>
      </p>
      <p className="mono dim small">
        Develops one photograph of this direction on a Modal GPU, from its composition, light, motifs and the words you
        kept. The canvas work stays as it is. You decide what is kept.
      </p>

      {photo && (
        <figure className={`photo-figure ${busy ? 'is-busy' : ''}`}>
          <img src={photographUrl(photo.id)} alt="Photograph developed on Modal from the chosen direction" />
          <figcaption className="mono">Developed on Modal · {photo.model.split('/').pop()}</figcaption>
        </figure>
      )}

      {busy && (
        <div className="photo-busy mono" role="status">
          <span>{elapsed < 20 ? 'Developing on Modal' : 'Waking the GPU — the first photograph takes longer'}</span>
          <span>{String(elapsed).padStart(2, '0')} s</span>
          <i />
        </div>
      )}
      {error && (
        <p className="photo-error mono" role="alert">
          {error}
        </p>
      )}

      <div className="photo-actions">
        <button type="button" className="btn btn-ghost" onClick={run} disabled={busy || request.words.length === 0}>
          {error ? 'Try again' : photo ? 'Develop another' : 'Develop a photograph'}
        </button>
        {photo && !busy && (
          <button
            type="button"
            className={`btn ${keepPhoto ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onKeepPhoto(!keepPhoto)}
            aria-pressed={keepPhoto}
          >
            {keepPhoto ? 'Kept with the work' : 'Keep with the work'}
          </button>
        )}
      </div>
    </div>
  );
}
