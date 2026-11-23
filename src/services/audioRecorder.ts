export type RecorderError = 'unsupported' | 'not-allowed' | 'no-microphone' | 'unknown';

export interface RecorderHandlers {
  onError: (error: RecorderError) => void;
  /** Recording is over. `audio` is null when it was too short or empty. Called once per start(). */
  onEnd: (audio: Blob | null) => void;
}

export interface AudioRecorder {
  start(handlers: RecorderHandlers): void;
  stop(): void;
}

export const MAX_RECORDING_MS = 60_000;
/** Shorter recordings are treated as silence: Whisper tends to invent text for them. */
export const MIN_RECORDING_MS = 500;

// Chrome and Firefox record webm/opus; Safari (iOS too) only mp4. Groq accepts both.
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4'];

const ERROR_MAP: Record<string, RecorderError> = {
  NotAllowedError: 'not-allowed',
  SecurityError: 'not-allowed',
  NotFoundError: 'no-microphone',
  NotReadableError: 'no-microphone',
};

type GetMedia = () => Promise<MediaStream>;

function getBrowserMedia(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

/** Records the microphone with MediaRecorder. Every track is stopped at the end so iOS frees the mic. */
export function createAudioRecorder(
  getMedia: GetMedia = getBrowserMedia,
  RecorderClass: typeof MediaRecorder | undefined = globalThis.MediaRecorder,
): AudioRecorder {
  let stopCurrent: (() => void) | null = null;

  return {
    start(handlers) {
      if (stopCurrent) return;
      if (!RecorderClass || typeof navigator === 'undefined' || !navigator.mediaDevices) {
        handlers.onError('unsupported');
        return;
      }
      const Recorder = RecorderClass;
      // stop() can arrive while the permission prompt is still open.
      let isStopRequested = false;
      stopCurrent = () => {
        isStopRequested = true;
      };

      void getMedia().then(
        (stream) => {
          const release = (): void => stream.getTracks().forEach((track) => track.stop());
          if (isStopRequested) {
            release();
            stopCurrent = null;
            handlers.onEnd(null);
            return;
          }

          const mimeType = MIME_TYPES.find((type) => Recorder.isTypeSupported(type));
          let recorder: MediaRecorder;
          try {
            recorder = new Recorder(stream, mimeType ? { mimeType } : undefined);
          } catch {
            release();
            stopCurrent = null;
            handlers.onError('unsupported');
            return;
          }

          const chunks: Blob[] = [];
          const startedAt = Date.now();
          let isDone = false;
          const finish = (isFailed: boolean): void => {
            if (isDone) return;
            isDone = true;
            clearTimeout(timer);
            release();
            stopCurrent = null;
            if (isFailed) {
              handlers.onError('unknown');
              return;
            }
            const audio = new Blob(chunks, { type: recorder.mimeType || mimeType || '' });
            const isTooShort = Date.now() - startedAt < MIN_RECORDING_MS || audio.size === 0;
            handlers.onEnd(isTooShort ? null : audio);
          };

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data);
          };
          recorder.onstop = () => finish(false);
          recorder.onerror = () => finish(true);
          stopCurrent = () => {
            if (recorder.state === 'inactive') finish(false);
            else recorder.stop();
          };
          const timer = setTimeout(() => stopCurrent?.(), MAX_RECORDING_MS);
          recorder.start();
        },
        (error: unknown) => {
          stopCurrent = null;
          handlers.onError(ERROR_MAP[(error as Error | undefined)?.name ?? ''] ?? 'unknown');
        },
      );
    },

    stop() {
      stopCurrent?.();
    },
  };
}

export const audioRecorder = createAudioRecorder();
