import { describe, expect, it, vi } from 'vitest';

import { createWebSpeechService, type RecognitionConstructor } from './speech';

/** Fake browser recognition: tests drive results, errors and session ends by hand. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = '';
  continuous = true;
  interimResults = false;
  onresult: ((event: { resultIndex: number; results: unknown[] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  starts = 0;
  start = (): void => {
    this.starts++;
  };
  stop = (): void => this.onend?.();

  constructor() {
    FakeRecognition.instances.push(this);
  }

  say(text: string, isFinal: boolean): void {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] });
  }
}

function setup(isAndroid = true) {
  FakeRecognition.instances = [];
  const service = createWebSpeechService(
    FakeRecognition as unknown as RecognitionConstructor,
    isAndroid,
  );
  const handlers = { onTranscript: vi.fn(), onError: vi.fn(), onEnd: vi.fn() };
  service.start(handlers);
  const recognition = FakeRecognition.instances[0] as FakeRecognition;
  return { service, handlers, recognition };
}

describe('speech service', () => {
  it('listens in es-CO, one phrase per session, with live interim text', () => {
    const { handlers, recognition } = setup();
    expect(recognition.lang).toBe('es-CO');
    expect(recognition.continuous).toBe(false);
    recognition.say('almuerzo', false);
    expect(handlers.onTranscript).toHaveBeenLastCalledWith('almuerzo');
  });

  it('restarts after each pause and joins phrases until stop', () => {
    const { service, handlers, recognition } = setup();
    recognition.say('almuerzo 20 mil', true);
    recognition.onend?.(); // Android ends the session after a pause
    expect(recognition.starts).toBe(2);
    expect(handlers.onEnd).not.toHaveBeenCalled();

    recognition.say('con nequi', false);
    expect(handlers.onTranscript).toHaveBeenLastCalledWith('almuerzo 20 mil con nequi');

    service.stop();
    expect(handlers.onEnd).toHaveBeenCalledWith('almuerzo 20 mil con nequi');
    expect(recognition.starts).toBe(2);
  });

  it('keeps listening through silence but stops on a real error', () => {
    const { handlers, recognition } = setup();
    recognition.onerror?.({ error: 'no-speech' });
    recognition.onend?.();
    expect(recognition.starts).toBe(2);

    recognition.onerror?.({ error: 'not-allowed' });
    recognition.onend?.();
    expect(handlers.onError).toHaveBeenCalledWith('not-allowed');
    expect(handlers.onEnd).toHaveBeenCalledTimes(1);
    expect(recognition.starts).toBe(2);
  });

  it('ends the recording on stop even if the browser never fires onend', () => {
    vi.useFakeTimers();
    const { service, handlers, recognition } = setup();
    recognition.stop = (): void => {}; // browser ignores stop mid-restart
    recognition.say('almuerzo', true);
    service.stop();
    expect(handlers.onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(handlers.onEnd).toHaveBeenCalledWith('almuerzo');
    recognition.onend?.(); // late end is ignored
    expect(handlers.onEnd).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('ends the recording when the browser refuses to restart', () => {
    const { handlers, recognition } = setup();
    recognition.say('almuerzo', true);
    recognition.start = (): void => {
      throw new Error('InvalidStateError');
    };
    recognition.onend?.();
    expect(handlers.onEnd).toHaveBeenCalledWith('almuerzo');
  });

  it('uses one continuous session on iOS and stops when it aborts', () => {
    const { handlers, recognition } = setup(false);
    expect(recognition.continuous).toBe(true);
    recognition.say('almuerzo', false);
    recognition.onerror?.({ error: 'aborted' });
    recognition.onend?.();
    expect(handlers.onError).toHaveBeenCalledWith('unknown');
    expect(handlers.onEnd).toHaveBeenCalledWith('almuerzo');
    expect(recognition.starts).toBe(1);
  });

  it('reports unsupported browsers', () => {
    const service = createWebSpeechService(undefined);
    const onError = vi.fn();
    service.start({ onTranscript: vi.fn(), onError, onEnd: vi.fn() });
    expect(service.isSupported()).toBe(false);
    expect(onError).toHaveBeenCalledWith('unsupported');
  });
});
