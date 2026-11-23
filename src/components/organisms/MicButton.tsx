import { IconMicrophone, IconPlayerStopFilled } from '@tabler/icons-react';
import type { ReactElement } from 'react';

interface MicButtonProps {
  isRecording: boolean;
  onToggle: () => void;
}

// The Web Speech API gives no audio levels, so the waveform is a steady animation, not a meter.
const WAVE_BARS = [
  { height: 14, delay: 0 },
  { height: 32, delay: 120 },
  { height: 20, delay: 240 },
  { height: 40, delay: 60 },
  { height: 18, delay: 300 },
  { height: 28, delay: 180 },
];

/** Tap to start, tap to stop. Recording logic lives in useRecorder; this only shows state. */
export function MicButton({ isRecording, onToggle }: MicButtonProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-4">
      {isRecording && (
        <div className="flex h-11 items-center gap-[5px]" aria-hidden>
          {WAVE_BARS.map(({ height, delay }) => (
            <span
              key={delay}
              className="w-1.5 animate-wave rounded-[3px] bg-accent"
              style={{ height, animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isRecording ? 'Terminar grabación' : 'Grabar movimiento'}
        className={`flex size-mic items-center justify-center rounded-lg bg-accent text-on-accent transition-transform active:scale-[0.98] ${
          isRecording ? 'ring-[12px] ring-surface-1' : ''
        }`}
      >
        {isRecording ? <IconPlayerStopFilled size={28} /> : <IconMicrophone size={30} stroke={2} />}
      </button>
      <span className="text-label text-ink-muted">
        {isRecording ? 'Toca para terminar' : 'Toca para hablar'}
      </span>
    </div>
  );
}
