import { useEffect, useRef, useState } from 'react';

import { type AudioRecorder, audioRecorder, type RecorderError } from '../services/audioRecorder';

const ERROR_MESSAGES: Record<RecorderError, string> = {
  unsupported: 'Este navegador no puede grabar audio. Actualízalo o usa otro.',
  'not-allowed': 'Permite el micrófono para usar la voz.',
  'no-microphone': 'No se encontró el micrófono.',
  unknown: 'No se pudo grabar. Intenta otra vez.',
};

export interface Recorder {
  isRecording: boolean;
  error: string;
  toggle: () => void;
  clearError: () => void;
}

/**
 * Tap to start, tap to stop. `onFinish` gets the audio when recording ends without error,
 * or null when it was too short to hold a sentence.
 */
export function useRecorder(
  onFinish: (audio: Blob | null) => void,
  recorder: AudioRecorder = audioRecorder,
): Recorder {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => () => recorder.stop(), [recorder]);

  function toggle(): void {
    if (isRecording) {
      recorder.stop();
      return;
    }
    setError('');
    setIsRecording(true);
    recorder.start({
      onError: (recorderError) => {
        setError(ERROR_MESSAGES[recorderError]);
        setIsRecording(false);
      },
      onEnd: (audio) => {
        setIsRecording(false);
        onFinishRef.current(audio);
      },
    });
  }

  return { isRecording, error, toggle, clearError: () => setError('') };
}
