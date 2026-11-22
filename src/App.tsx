import { useCallback, useEffect, useRef, useState } from 'react';
import { analyze } from './lib/analyze';
import { initialParams, loadCollection, saveCollection } from './lib/store';
import type { Direction, Interpretation, Memory, Params, Photograph, Work } from './lib/types';
import { applyDirection, directionFor, interpretMemory } from './lib/interpret';
import { Header } from './components/Header';
import { Intro } from './components/Intro';
import { MemoryStep } from './components/MemoryStep';
import { Reading } from './components/Reading';
import { Directions } from './components/Directions';
import { Studio } from './components/Studio';
import { Kept } from './components/Kept';
import { Collection } from './components/Collection';

export type Stage = 'intro' | 'memory' | 'reading' | 'directions' | 'studio' | 'kept' | 'collection';

export default function App() {
  const [stage, setStage] = useState<Stage>('intro');
  const [memory, setMemory] = useState<Memory>({ text: '', year: '', author: '' });
  const [params, setParams] = useState<Params | null>(null);
  const [collection, setCollection] = useState<Work[]>(() => loadCollection());
  const [viewing, setViewing] = useState<Work | null>(null);
  // null while Hermes is being asked; then a Hermes result or an honest local fallback.
  const [interp, setInterp] = useState<Interpretation | null>(null);
  const request = useRef(0);
  // A photograph developed on Modal in the studio; kept only if the person chooses to.
  const [photo, setPhoto] = useState<Photograph | null>(null);
  const [keepPhoto, setKeepPhoto] = useState(false);

  useEffect(() => {
    saveCollection(collection);
  }, [collection]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage]);

  const go = useCallback((s: Stage) => setStage(s), []);

  const submitMemory = (m: Memory) => {
    const id = ++request.current;
    const sameText = m.text === memory.text && interp;
    setMemory(m);
    setParams(initialParams(m));
    setPhoto(null);
    setKeepPhoto(false);
    setStage('reading');
    if (sameText) return; // memory unchanged: keep the interpretation we already have
    setInterp(null);
    interpretMemory(m).then((r) => {
      if (request.current === id) setInterp(r);
    });
  };

  const choose = (d: Direction) => {
    const a = analyze(memory.text);
    setParams((p) => applyDirection(p ?? initialParams(memory, d), interp, d, a));
    setStage('studio');
  };

  // In the studio, switching direction brings that direction's motifs but keeps the director's light and words.
  const changeParams = (next: Params) => {
    setParams((prev) =>
      prev && next.direction !== prev.direction ? applyDirection(next, interp, next.direction, analyze(memory.text), false) : next,
    );
  };

  const keep = () => {
    if (!params) return;
    const no = collection.reduce((n, w) => Math.max(n, w.no), 0) + 1;
    const work: Work = {
      id: `${Date.now().toString(36)}-${params.seed}`,
      no,
      memory,
      params,
      keptAt: Date.now(),
      interpretation: interp
        ? { source: interp.source, model: interp.model, direction: directionFor(interp, params.direction) }
        : { source: 'local' },
      ...(photo && keepPhoto ? { photograph: photo } : {}),
    };
    setPhoto(null);
    setKeepPhoto(false);
    setCollection((c) => [work, ...c]);
    setViewing(work);
    setStage('kept');
  };

  const restart = () => {
    setMemory({ text: '', year: '', author: '' });
    setParams(null);
    setViewing(null);
    setInterp(null);
    setPhoto(null);
    setKeepPhoto(false);
    setStage('memory');
  };

  const open = (w: Work) => {
    setViewing(w);
    setStage('kept');
  };

  const remove = (id: string) => setCollection((c) => c.filter((w) => w.id !== id));

  const analysis = memory.text ? analyze(memory.text) : null;

  return (
    <div className={`app stage-${stage}`}>
      <Header stage={stage} count={collection.length} onNavigate={go} onHome={() => go('intro')} />
      <main key={stage} className="stage">
        {stage === 'intro' && <Intro onBegin={() => go('memory')} onCollection={() => go('collection')} />}
        {stage === 'memory' && <MemoryStep initial={memory} onSubmit={submitMemory} />}
        {stage === 'reading' && analysis && <Reading analysis={analysis} interp={interp} onDone={() => go('directions')} />}
        {stage === 'directions' && analysis && params && (
          <Directions memory={memory} analysis={analysis} params={params} interp={interp} onChoose={choose} onBack={() => go('memory')} />
        )}
        {stage === 'studio' && analysis && params && (
          <Studio
            memory={memory}
            analysis={analysis}
            params={params}
            onChange={changeParams}
            onKeep={keep}
            onBack={() => go('directions')}
            composition={directionFor(interp, params.direction)?.composition}
            photo={photo}
            keepPhoto={keepPhoto}
            onPhoto={setPhoto}
            onKeepPhoto={setKeepPhoto}
          />
        )}
        {stage === 'kept' && viewing && (
          <Kept work={viewing} onAnother={restart} onCollection={() => go('collection')} />
        )}
        {stage === 'collection' && (
          <Collection works={collection} onOpen={open} onRemove={remove} onBegin={restart} />
        )}
      </main>
    </div>
  );
}
