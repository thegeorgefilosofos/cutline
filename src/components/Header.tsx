import type { Stage } from '../App';

const STEPS: { id: Stage; label: string }[] = [
  { id: 'memory', label: 'Memory' },
  { id: 'reading', label: 'Reading' },
  { id: 'directions', label: 'Directions' },
  { id: 'studio', label: 'Studio' },
  { id: 'kept', label: 'Kept' },
];

export function Header({
  stage,
  count,
  onNavigate,
  onHome,
}: {
  stage: Stage;
  count: number;
  onNavigate: (s: Stage) => void;
  onHome: () => void;
}) {
  const idx = STEPS.findIndex((s) => s.id === stage);
  return (
    <header className="hdr">
      <button className="wordmark" onClick={onHome} aria-label="CUTLINE — home">
        CUTLINE
      </button>
      <span className="hdr-ex mono">The Things We Keep. — Exhibition 01</span>
      <span className="hdr-step mono">
        {idx >= 0 ? (
          <>
            <b>{String(idx + 1).padStart(2, '0')}</b>&nbsp;/&nbsp;05 — {STEPS[idx].label}
          </>
        ) : stage === 'collection' ? (
          'The collection'
        ) : (
          'Now showing'
        )}
      </span>
      <button className="hdr-col mono" onClick={() => onNavigate('collection')}>
        Collection <sup>{String(count).padStart(3, '0')}</sup>
      </button>
    </header>
  );
}
