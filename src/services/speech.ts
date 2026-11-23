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

// Errors that just mean "nothing heard yet": keep listening.
const IGNORED_ERRORS = new Set(['no-speech', 'aborted']);

/**
 * Chrome Android stops after each pause and duplicates results in continuous mode, so each
 * session is one phrase (continuous = false) and a new session starts until the user taps stop.
 */
export function createWebSpeechService(
  RecognitionClass: RecognitionConstructor | undefined = getBrowserRecognition(),
): SpeechService {
  let recognition: Recognition | null = null;
  let isWanted = false;

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
      const finished: string[] = [];
      let interim = '';
      let failed = false;
      isWanted = true;

      const current = new RecognitionClass();
      recognition = current;
      current.lang = 'es-CO';
      current.continuous = false;
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
        if (IGNORED_ERRORS.has(event.error)) return;
        failed = true;
        isWanted = false;
        handlers.onError(ERROR_MAP[event.error] ?? 'unknown');
      };

      current.onend = () => {
        // A phrase still marked interim when the session ended is kept as said.
        if (interim) finished.push(interim);
        interim = '';
        if (isWanted && !failed && recognition === current) {
          current.start();
          return;
        }
        if (recognition === current) recognition = null;
        handlers.onEnd(fullText());
      };

      current.start();
    },

    stop() {
      isWanted = false;
      recognition?.stop();
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
