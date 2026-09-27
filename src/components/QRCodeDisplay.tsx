import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, ExternalLink, ShieldCheck, QrCode, Smartphone, RefreshCw } from 'lucide-react';

interface QRCodeDisplayProps {
  url: string;
  roomId: string;
  peersCount: number;
  onRegenerateRoom?: () => void;
  isSignedIn?: boolean;
  onRequireAuth?: () => void;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  url,
  roomId,
  peersCount,
  onRegenerateRoom,
  isSignedIn = true,
  onRequireAuth,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !url) return;

    QRCode.toCanvas(
      canvasRef.current,
      url,
      {
        width: 240,
        margin: 1.5,
        color: {
          dark: '#0a0a0a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      },
      (error) => {
        if (error) console.error('Failed to render QR code:', error);
      }
    );
  }, [url]);

  const handleCopy = async () => {
    if (!isSignedIn && onRequireAuth) {
      onRequireAuth();
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleOpenTestWindow = () => {
    if (!isSignedIn && onRequireAuth) {
      onRequireAuth();
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };


  return (
    <div className="flex flex-col items-center rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      {/* Title */}
      <div className="mb-4 text-center">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white flex items-center justify-center gap-2">
          <QrCode className="h-4 w-4" />
          <span>Scan to Connect & Transfer</span>
        </h3>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Point your smartphone camera at this QR code to establish an encrypted P2P bridge.
        </p>
      </div>

      {/* QR Code Canvas with rounded frame */}
      <div className="relative flex items-center justify-center rounded-2xl border border-neutral-200 bg-white p-3 shadow-inner dark:border-neutral-700">
        <canvas ref={canvasRef} className="rounded-xl" />

        {peersCount > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-neutral-950/85 backdrop-blur-[2px] p-4 text-center animate-fade-in">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white mb-2 shadow-lg">
              <Check className="h-5 w-5 stroke-[2.5]" />
            </div>
            <p className="text-xs font-semibold text-white">Peer Device Paired</p>
            <p className="text-[11px] text-neutral-300 mt-0.5">Ready for instant file transfer</p>
          </div>
        )}
      </div>

      {/* Room code and Quick Copy Link */}
      <div className="mt-4 w-full max-w-xs space-y-2">
        <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-950">
          <span className="text-neutral-500 dark:text-neutral-400">Room Code:</span>
          <span className="font-mono font-bold tracking-wider text-neutral-900 dark:text-white uppercase">
            {roomId}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white py-2 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-neutral-400" />
                <span>Copy Pairing Link</span>
              </>
            )}
          </button>

          <button
            onClick={handleOpenTestWindow}
            title="Open receiver in a new window/tab to test P2P transfer"
            className="flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-neutral-700 hover:bg-neutral-50 transition dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <ExternalLink className="h-3.5 w-3.5 text-neutral-400" />
          </button>

          {onRegenerateRoom && (
            <button
              onClick={() => {
                if (!isSignedIn && onRequireAuth) {
                  onRequireAuth();
                  return;
                }
                onRegenerateRoom();
              }}
              title="Generate new secure room & encryption key"
              className="flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-neutral-700 hover:bg-neutral-50 transition dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <RefreshCw className="h-3.5 w-3.5 text-neutral-400" />
            </button>
          )}

        </div>
      </div>

      {/* E2EE Info Footnote */}
      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <span>E2EE key stays in URL hash · Never hits our servers</span>
      </div>
    </div>
  );
};
