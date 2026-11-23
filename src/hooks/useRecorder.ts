import { useEffect, useRef, useState } from 'react';

import { type SpeechError, type SpeechService, speechService } from '../services/speech';

const ERROR_MESSAGES: Record<SpeechError, string> = {
  unsupported: 'Este navegador no reconoce voz. Usa Chrome.',
  'not-allowed': 'Permite el micrófono para usar la voz.',
  'no-microphone': 'No se encontró el micrófono.',
  network: 'Sin conexión. Intenta otra vez.',
  unknown: 'No se pudo escuchar. Intenta otra vez.',
};

export interface Recorder {
  isRecording: boolean;
  /** Live text while recording. */
  transcript: string;
  error: string;
  toggle: () => void;
  clearError: () => void;
}

/** Tap to start, tap to stop. `onFinish` gets the final text when recording ends without error. */
export function useRecorder(
  onFinish: (transcript: string) => void,
  service: SpeechService = speechService,
): Recorder {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => () => service.stop(), [service]);

  function toggle(): void {
    if (isRecording) {
      service.stop();
      return;
    }
    let hasError = false;
    setTranscript('');
    setError('');
    setIsRecording(true);
    service.start({
      onTranscript: setTranscript,
      onError: (speechError) => {
        hasError = true;
        setError(ERROR_MESSAGES[speechError]);
        setIsRecording(false);
      },
      onEnd: (finalText) => {
        setIsRecording(false);
        if (!hasError) onFinishRef.current(finalText);
      },
    });
  }

  return { isRecording, transcript, error, toggle, clearError: () => setError('') };
}
