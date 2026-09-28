import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  QrCode,
  Smartphone,
  RefreshCw,
  Hash,
  ArrowRight,
  ClipboardPaste,
} from 'lucide-react';

interface QRCodeDisplayProps {
  url: string;
  roomId: string;
  peersCount: number;
  onRegenerateRoom?: () => void;
  isSignedIn?: boolean;
  onRequireAuth?: () => void;
  onJoinRoom?: (newRoomId: string) => void;
  onOpenQRScanner?: () => void;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  url,
  roomId,
  peersCount,
  onRegenerateRoom,
  isSignedIn = true,
  onRequireAuth,
  onJoinRoom,
  onOpenQRScanner,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'qr' | 'code'>('qr');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinSuccess, setJoinSuccess] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !url) return;

    QRCode.toCanvas(
      canvasRef.current,
      url,
      {
        width: 230,
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
  }, [url, activeMethod]);

  const handleCopyLink = async () => {
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

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
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

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomCodeInput.trim().toUpperCase();
    if (!clean) return;
    if (onJoinRoom) {
      onJoinRoom(clean);
      setJoinSuccess(true);
      setRoomCodeInput('');
      setTimeout(() => setJoinSuccess(false), 3000);
    }
  };

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        let code = text.trim();
        if (code.includes('room=')) {
          const match = code.match(/room=([a-zA-Z0-9_-]+)/);
          if (match && match[1]) code = match[1];
        }
        setRoomCodeInput(code.toUpperCase());
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col items-center rounded-3xl border border-neutral-200/90 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      {/* Both Methods Switcher Tabs */}
      <div className="flex w-full items-center rounded-2xl bg-neutral-100 p-1 dark:bg-neutral-800/80 mb-5">
        <button
          type="button"
          onClick={() => setActiveMethod('qr')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
            activeMethod === 'qr'
              ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-white'
              : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <QrCode className="h-3.5 w-3.5 text-indigo-500" />
          <span>Method 1: Scan QR</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMethod('code')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
            activeMethod === 'code'
              ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-white'
              : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          }`}
        >
          <Hash className="h-3.5 w-3.5 text-emerald-500" />
          <span>Method 2: Enter Code</span>
        </button>
      </div>

      {activeMethod === 'qr' ? (
        <>
          {/* Title */}
          <div className="mb-4 text-center">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center justify-center gap-2">
              <QrCode className="h-4 w-4 text-indigo-500" />
              <span>Point Camera at QR Code</span>
            </h3>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 max-w-xs">
              Scan from your mobile phone camera or tablet to pair instantly via WebRTC.
            </p>
          </div>

          {/* QR Code Canvas */}
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
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold tracking-wider text-neutral-900 dark:text-white uppercase">
                  {roomId}
                </span>
                <button
                  onClick={handleCopyCode}
                  title="Copy room code"
                  className="rounded-lg p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
                >
                  {copiedCode ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
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
        </>
      ) : (
        /* Method 2: Enter Room Code to Join */
        <div className="w-full max-w-xs space-y-4 py-1">
          <div className="text-center">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center justify-center gap-2">
              <Hash className="h-4 w-4 text-emerald-500" />
              <span>Enter Room Code to Join</span>
            </h3>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Type or paste the 6-character room code from your mobile or another computer.
            </p>
          </div>

          {/* Current Room Indicator */}
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-950">
            <span className="text-neutral-500 dark:text-neutral-400">Current Room:</span>
            <div className="flex items-center gap-1.5 font-mono font-bold text-neutral-900 dark:text-white">
              <span>{roomId}</span>
              <button
                onClick={handleCopyCode}
                title="Copy code"
                className="rounded p-0.5 hover:text-indigo-500"
              >
                {copiedCode ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {/* Join Form */}
          <form onSubmit={handleJoinByCode} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="ENTER CODE (e.g. 8K2M)"
                className="w-full rounded-2xl border border-neutral-300 bg-white py-3 pl-3.5 pr-20 font-mono text-sm font-bold tracking-widest text-neutral-900 placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              />
              <button
                type="button"
                onClick={handlePasteCode}
                className="absolute right-2 top-2 rounded-xl bg-neutral-100 px-2 py-1.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 transition"
              >
                <ClipboardPaste className="h-3 w-3 inline mr-1" />
                Paste
              </button>
            </div>

            <button
              type="submit"
              disabled={!roomCodeInput.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-neutral-900 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition"
            >
              <span>Join Room</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          {joinSuccess && (
            <div className="rounded-xl bg-emerald-50 p-2.5 text-center text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 animate-fade-in flex items-center justify-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              <span>Joined room successfully!</span>
            </div>
          )}

          {onOpenQRScanner && (
            <button
              type="button"
              onClick={onOpenQRScanner}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-200 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800 transition"
            >
              <Smartphone className="h-3.5 w-3.5 text-indigo-500" />
              <span>Scan Peer's Screen with Webcam</span>
            </button>
          )}
        </div>
      )}

      {/* E2EE Info Footnote */}
      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <span>E2EE key stays in URL hash · Never hits our servers</span>
      </div>
    </div>
  );
};
