/** Minimal typing of the Web Speech API (not in TypeScript's DOM lib). */
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type RecognitionConstructor = new () => Recognition;

export type SpeechError = 'unsupported' | 'not-allowed' | 'no-microphone' | 'network' | 'unknown';

export interface SpeechHandlers {
  /** Full text so far: finished phrases plus the phrase being heard. */
  onTranscript: (text: string) => void;
  onError: (error: SpeechError) => void;
  /** Recording is over (after stop() or an error). Called once per start(). */
  onEnd: (finalText: string) => void;
}

export interface SpeechService {
  isSupported(): boolean;
  start(handlers: SpeechHandlers): void;
  stop(): void;
}

const ERROR_MAP: Record<string, SpeechError> = {
  'not-allowed': 'not-allowed',
  'service-not-allowed': 'not-allowed',
  'audio-capture': 'no-microphone',
  network: 'network',
};

// Errors that just mean "nothing heard yet": keep listening. On iOS 'aborted' is a real failure.
const IGNORED_ERRORS = new Set(['no-speech']);
const ANDROID_IGNORED_ERRORS = new Set(['no-speech', 'aborted']);

// Browsers don't always fire onend after stop() (e.g. mid-restart on Android); end it ourselves.
const STOP_TIMEOUT_MS = 1500;

/**
 * Chrome Android stops after each pause and duplicates results in continuous mode, so there each
 * session is one phrase (continuous = false) and a new session starts until the user taps stop.
 * iOS Safari can't restart that fast ("audio-capture: Source is stopped"), so it gets one
 * continuous session.
 */
export function createWebSpeechService(
  RecognitionClass: RecognitionConstructor | undefined = getBrowserRecognition(),
  isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent),
): SpeechService {
  const ignoredErrors = isAndroid ? ANDROID_IGNORED_ERRORS : IGNORED_ERRORS;
  let recognition: Recognition | null = null;
  let isWanted = false;
  let finishCurrent: (() => void) | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    isSupported: () => RecognitionClass !== undefined,

    start(handlers) {
      if (!RecognitionClass) {
        handlers.onError('unsupported');
        return;
      }
      if (recognition) {
        // Silence the previous session so its late end doesn't report as this one.
        recognition.onresult = recognition.onerror = recognition.onend = null;
        recognition.stop();
      }
      clearTimeout(stopTimer);
      const finished: string[] = [];
      let interim = '';
      let failed = false;
      let isDone = false;
      isWanted = true;

      const current = new RecognitionClass();
      recognition = current;
      current.lang = 'es-CO';
      current.continuous = !isAndroid;
      current.interimResults = true;

      const fullText = (): string => [...finished, interim].filter(Boolean).join(' ').trim();

      current.onresult = (event) => {
        interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result) continue;
          const text = result[0].transcript.trim();
          if (result.isFinal) finished.push(text);
          else interim += text;
        }
        handlers.onTranscript(fullText());
      };

      current.onerror = (event) => {
        if (ignoredErrors.has(event.error)) return;
        failed = true;
        isWanted = false;
        handlers.onError(ERROR_MAP[event.error] ?? 'unknown');
      };

      const finish = (): void => {
        if (isDone) return;
        isDone = true;
        clearTimeout(stopTimer);
        current.onresult = current.onerror = current.onend = null;
        // iOS may never end after stop(); abort releases the mic so the next recording can use it.
        try {
          current.abort();
        } catch {
          // Already ended.
        }
        // A phrase still marked interim when the session ended is kept as said.
        if (interim) finished.push(interim);
        interim = '';
        if (recognition === current) recognition = null;
        if (finishCurrent === finish) finishCurrent = null;
        handlers.onEnd(fullText());
      };
      finishCurrent = finish;

      current.onend = () => {
        if (isWanted && !failed && recognition === current) {
          if (interim) finished.push(interim);
          interim = '';
          try {
            current.start();
            return;
          } catch {
            // Restart refused (InvalidStateError): end the recording instead of hanging.
          }
        }
        finish();
      };

      try {
        current.start();
      } catch {
        failed = true;
        isWanted = false;
        handlers.onError('unknown');
        finish();
      }
    },

    stop() {
      isWanted = false;
      try {
        recognition?.stop();
      } catch {
        // Already stopped; the timeout below still ends the session.
      }
      const finishPending = finishCurrent;
      if (finishPending) stopTimer = setTimeout(finishPending, STOP_TIMEOUT_MS);
    },
  };
}

function getBrowserRecognition(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

export const speechService = createWebSpeechService();
