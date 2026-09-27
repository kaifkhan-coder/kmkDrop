import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, Upload, AlertCircle, RefreshCw } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedUrl: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scanning, setScanning] = useState(false);
  const animationFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let stream: MediaStream | null = null;
    setCameraError(null);
    setScanning(true);

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          scanFrame();
        }
      } catch (err: any) {
        console.warn('Camera access error:', err);
        setCameraError(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in your browser or upload a QR image.'
            : 'Unable to access camera. You can also upload a QR screenshot below.'
        );
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isOpen, facingMode]);

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameIdRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      onScanSuccess(code.data);
      onClose();
      return;
    }

    animationFrameIdRef.current = requestAnimationFrame(scanFrame);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          onScanSuccess(code.data);
          onClose();
        } else {
          setCameraError('No QR code detected in the selected image. Please try another.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 text-center">
          <h3 className="text-base font-bold text-neutral-900 dark:text-white">Scan QR Code</h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Align the sender QR code within the frame to pair automatically.
          </p>
        </div>

        {/* Video / Camera Box */}
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-neutral-200 bg-black dark:border-neutral-800">
          <video ref={videoRef} className="h-full w-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Reticle Overlay */}
          <div className="pointer-events-none absolute inset-8 border-2 border-white/70 rounded-xl">
            <div className="absolute -top-1 -left-1 h-4 w-4 border-t-2 border-l-2 border-emerald-400" />
            <div className="absolute -top-1 -right-1 h-4 w-4 border-t-2 border-r-2 border-emerald-400" />
            <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-emerald-400" />
            <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-emerald-400" />
            <div className="h-full w-full bg-emerald-500/5 animate-pulse" />
          </div>

          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/95 p-4 text-center text-xs text-neutral-300">
              <AlertCircle className="h-8 w-8 text-amber-400 mb-2" />
              <p>{cameraError}</p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-200 py-2 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Flip Camera</span>
          </button>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-200 py-2 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900">
            <Upload className="h-3.5 w-3.5" />
            <span>Upload QR Image</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};
