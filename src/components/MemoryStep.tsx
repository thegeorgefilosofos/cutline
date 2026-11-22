import { useEffect, useRef, useState } from 'react';
import { EXAMPLES } from '../lib/store';
import type { Memory } from '../lib/types';

const PROMPTS = [
  'Where were you standing?',
  'What was the light like?',
  'Who else was there — or who wasn’t?',
  'What sound do you still hear?',
];

export function MemoryStep({ initial, onSubmit }: { initial: Memory; onSubmit: (m: Memory) => void }) {
  const [text, setText] = useState(initial.text);
  const [year, setYear] = useState(initial.year);
  const [author, setAuthor] = useState(initial.author);
  const [hint, setHint] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ta.current?.focus();
    const t = setInterval(() => setHint((h) => (h + 1) % PROMPTS.length), 3200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const ok = words >= 5;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (ok) onSubmit({ text: text.trim(), year: year.trim(), author: author.trim() });
  };

  return (
    <form className="memory" onSubmit={submit}>
      <div className="memory-side">
        <p className="mono label">01 — The memory</p>
        <p className="memory-lede">
          Not the biggest day. An ordinary one. A table, a window, a drive home. Describe it the way you would to a friend.
        </p>
        <p className="mono hint" key={hint}>
          {PROMPTS[hint]}
        </p>
      </div>

      <div className="memory-main">
        <label htmlFor="memory" className="sr">
          What ordinary moment would you keep forever?
        </label>
        <textarea
          id="memory"
          ref={ta}
          className="memory-input"
          placeholder="What ordinary moment would you keep forever?"
          value={text}
          rows={3}
          maxLength={420}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="memory-rule mono">
          <span>{String(words).padStart(3, '0')} words</span>
          <span>{ok ? 'Ready to be read' : 'At least five words'}</span>
        </div>

        <div className="memory-fields">
          <label>
            <span className="mono label">Year</span>
            <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="1998" inputMode="numeric" maxLength={9} />
          </label>
          <label>
            <span className="mono label">Directed by</span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" maxLength={40} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={!ok}>
            Read this moment <span className="arrow">→</span>
          </button>
        </div>

        <div className="memory-examples">
          <p className="mono label">Or begin with someone else’s</p>
          <ul>
            {EXAMPLES.map((m) => (
              <li key={m.text}>
                <button
                  type="button"
                  onClick={() => {
                    setText(m.text);
                    setYear(m.year);
                  }}
                >
                  <span className="mono">{m.year}</span>
                  {m.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </form>
  );
}
