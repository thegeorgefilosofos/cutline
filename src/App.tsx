import { useCallback, useEffect, useState } from 'react';
import { analyze } from './lib/analyze';
import { initialParams, loadCollection, saveCollection } from './lib/store';
import type { Direction, Memory, Params, Work } from './lib/types';
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

  useEffect(() => {
    saveCollection(collection);
  }, [collection]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage]);

  const go = useCallback((s: Stage) => setStage(s), []);

  const submitMemory = (m: Memory) => {
    setMemory(m);
    setParams(initialParams(m));
    setStage('reading');
  };

  const choose = (d: Direction) => {
    setParams((p) => (p ? { ...p, direction: d } : initialParams(memory, d)));
    setStage('studio');
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
    };
    setCollection((c) => [work, ...c]);
    setViewing(work);
    setStage('kept');
  };

  const restart = () => {
    setMemory({ text: '', year: '', author: '' });
    setParams(null);
    setViewing(null);
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
        {stage === 'reading' && analysis && <Reading analysis={analysis} onDone={() => go('directions')} />}
        {stage === 'directions' && analysis && params && (
          <Directions memory={memory} analysis={analysis} params={params} onChoose={choose} onBack={() => go('memory')} />
        )}
        {stage === 'studio' && analysis && params && (
          <Studio memory={memory} analysis={analysis} params={params} onChange={setParams} onKeep={keep} onBack={() => go('directions')} />
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
