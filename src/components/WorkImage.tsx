import { useState } from 'react';
import { photographUrl } from '../lib/photograph';
import type { Memory, Params, Photograph } from '../lib/types';
import { FRAME_RATIO } from '../lib/types';
import { ArtCanvas } from './ArtCanvas';

/**
 * A kept work's image: the photograph developed on Modal when one was kept, otherwise the canvas
 * artwork. If the stored photograph cannot be loaded, the canvas artwork is shown instead.
 */
export function WorkImage({
  memory,
  params,
  photograph,
  quality,
}: {
  memory: Memory;
  params: Params;
  photograph?: Photograph;
  quality?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!photograph || failed) return <ArtCanvas memory={memory} params={params} quality={quality} />;
  return (
    <div className="art art-photo" style={{ aspectRatio: String(FRAME_RATIO[photograph.frame] ?? FRAME_RATIO[params.frame]) }}>
      <img
        src={photographUrl(photograph.id)}
        alt={`Photograph developed on Modal for: ${memory.text}`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
