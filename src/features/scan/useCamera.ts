import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraState =
  | { readonly status: 'idle' }
  | { readonly status: 'starting' }
  | { readonly status: 'active' }
  | { readonly status: 'error'; readonly message: string };

function describeCameraError(cause: unknown): string {
  if (cause instanceof DOMException) {
    switch (cause.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur.';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'Aucune caméra compatible détectée.';
      case 'NotReadableError':
        return 'La caméra est utilisée par une autre application.';
    }
  }
  return 'Impossible de démarrer la caméra.';
}

/** Owns the MediaStream lifecycle: tracks are always stopped on unmount or stop(). */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>({ status: 'idle' });

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState({ status: 'idle' });
  }, []);

  const start = useCallback(async () => {
    if (!('mediaDevices' in navigator) || !window.isSecureContext) {
      setState({ status: 'error', message: 'La caméra nécessite HTTPS et un navigateur récent.' });
      return;
    }
    setState({ status: 'starting' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        return;
      }
      video.srcObject = stream;
      await video.play();
      setState({ status: 'active' });
    } catch (cause) {
      setState({ status: 'error', message: describeCameraError(cause) });
    }
  }, []);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    },
    [],
  );

  return { videoRef, state, start, stop };
}
