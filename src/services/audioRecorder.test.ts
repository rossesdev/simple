import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAudioRecorder, MAX_RECORDING_MS, type RecorderHandlers } from './audioRecorder';

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static supported = ['audio/mp4'];
  static isTypeSupported = (type: string): boolean => FakeRecorder.supported.includes(type);

  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_stream: unknown, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? '';
    FakeRecorder.instances.push(this);
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio-bytes']) });
    this.onstop?.();
  }
}

function fakeStream(): { stream: MediaStream; stopped: () => number } {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  return {
    stream: { getTracks: () => tracks } as unknown as MediaStream,
    stopped: () => tracks.filter((track) => track.stop.mock.calls.length > 0).length,
  };
}

function handlers() {
  return {
    onError: vi.fn<RecorderHandlers['onError']>(),
    onEnd: vi.fn<RecorderHandlers['onEnd']>(),
  };
}

const Recorder = FakeRecorder as unknown as typeof MediaRecorder;
const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

describe('audio recorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { mediaDevices: {} });
    FakeRecorder.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('records, picks a supported type and frees every track', async () => {
    const { stream, stopped } = fakeStream();
    const recorder = createAudioRecorder(() => Promise.resolve(stream), Recorder);
    const h = handlers();

    recorder.start(h);
    await flush();
    expect(FakeRecorder.instances[0]?.mimeType).toBe('audio/mp4');
    vi.advanceTimersByTime(2000);
    recorder.stop();

    const audio = h.onEnd.mock.calls[0]?.[0] as Blob;
    expect(audio.type).toBe('audio/mp4');
    expect(audio.size).toBeGreaterThan(0);
    expect(stopped()).toBe(2);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('treats a very short recording as silence', async () => {
    const { stream } = fakeStream();
    const recorder = createAudioRecorder(() => Promise.resolve(stream), Recorder);
    const h = handlers();

    recorder.start(h);
    await flush();
    vi.advanceTimersByTime(200);
    recorder.stop();
    expect(h.onEnd).toHaveBeenCalledWith(null);
  });

  it('stops by itself after the maximum length', async () => {
    const { stream, stopped } = fakeStream();
    const recorder = createAudioRecorder(() => Promise.resolve(stream), Recorder);
    const h = handlers();

    recorder.start(h);
    await flush();
    vi.advanceTimersByTime(MAX_RECORDING_MS);
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    expect(h.onEnd.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(stopped()).toBe(2);
  });

  it('maps permission and device errors', async () => {
    const failWith = async (name: string): Promise<unknown> => {
      const h = handlers();
      createAudioRecorder(() => Promise.reject(new DOMException('x', name)), Recorder).start(h);
      await flush();
      return h.onError.mock.calls[0]?.[0];
    };
    expect(await failWith('NotAllowedError')).toBe('not-allowed');
    expect(await failWith('NotFoundError')).toBe('no-microphone');
    expect(await failWith('AbortError')).toBe('unknown');
  });

  it('reports unsupported browsers', () => {
    const h = handlers();
    createAudioRecorder(() => Promise.reject(new Error()), undefined).start(h);
    expect(h.onError).toHaveBeenCalledWith('unsupported');
  });

  it('frees the mic on recorder errors and allows a second recording', async () => {
    const { stream, stopped } = fakeStream();
    const recorder = createAudioRecorder(() => Promise.resolve(stream), Recorder);
    const first = handlers();

    recorder.start(first);
    await flush();
    FakeRecorder.instances[0]?.onerror?.();
    expect(first.onError).toHaveBeenCalledWith('unknown');
    expect(stopped()).toBe(2);

    const second = handlers();
    recorder.start(second);
    await flush();
    expect(FakeRecorder.instances).toHaveLength(2);
  });

  it('ends with nothing when stopped before the mic is ready', async () => {
    const { stream, stopped } = fakeStream();
    const recorder = createAudioRecorder(() => Promise.resolve(stream), Recorder);
    const h = handlers();

    recorder.start(h);
    recorder.stop();
    await flush();
    expect(h.onEnd).toHaveBeenCalledWith(null);
    expect(FakeRecorder.instances).toHaveLength(0);
    expect(stopped()).toBe(2);
  });
});
