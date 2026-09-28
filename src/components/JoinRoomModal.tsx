import React, { useState } from 'react';
import {
  X,
  Hash,
  ArrowRight,
  ClipboardPaste,
  ShieldCheck,
  RefreshCw,
  QrCode,
  Check,
} from 'lucide-react';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId: string;
  onJoinRoom: (newRoomId: string) => void;
  onOpenQRScanner?: () => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  currentRoomId,
  onJoinRoom,
  onOpenQRScanner,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (!clean) {
      setError('Please enter a valid room code.');
      return;
    }
    if (clean.length < 3) {
      setError('Room code must be at least 3 characters.');
      return;
    }
    setError(null);
    onJoinRoom(clean);
    onClose();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        let code = text.trim();
        if (code.includes('room=')) {
          const match = code.match(/room=([a-zA-Z0-9_-]+)/);
          if (match && match[1]) {
            code = match[1];
          }
        }
        setInputCode(code.toUpperCase());
        setPasted(true);
        setTimeout(() => setPasted(false), 2000);
        setError(null);
      }
    } catch {
      setError('Unable to read clipboard. Please paste manually.');
    }
  };

  const handleGenerateRandom = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomCode = '';
    for (let i = 0; i < 6; i++) {
      randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setInputCode(randomCode);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 sm:p-7">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Hash className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Enter Room Code to Join
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Method 2: Manual Code Pairing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Room Info Banner */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-950/50">
          <span className="text-neutral-500 dark:text-neutral-400">Your Current Room:</span>
          <span className="font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
            {currentRoomId}
          </span>
        </div>

        {/* Room Code Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Enter 4 to 8 Character Room Code
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                autoFocus
                placeholder="e.g. 7X9K2P or paste link"
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                className="w-full rounded-2xl border border-neutral-300 bg-white py-3 pl-4 pr-24 font-mono text-base font-bold tracking-widest text-neutral-900 placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:border-neutral-400"
              />
              <button
                type="button"
                onClick={handlePaste}
                title="Paste room code from clipboard"
                className="absolute right-2 flex items-center gap-1 rounded-xl bg-neutral-100 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 transition"
              >
                {pasted ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Pasted</span>
                  </>
                ) : (
                  <>
                    <ClipboardPaste className="h-3.5 w-3.5 text-neutral-500" />
                    <span>Paste</span>
                  </>
                )}
              </button>
            </div>
            {error && (
              <p className="mt-1.5 text-[11px] font-medium text-rose-500">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <button
              type="button"
              onClick={handleGenerateRandom}
              className="flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Create Random Room Code</span>
            </button>
            <span>Alphanumeric (A-Z, 0-9)</span>
          </div>

          <button
            type="submit"
            disabled={!inputCode.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition"
          >
            <span>Connect & Join Room</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Alternative: Switch to Method 1 (QR Scanner) */}
        {onOpenQRScanner && (
          <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Prefer scanning a QR code instead?
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenQRScanner();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800 transition"
            >
              <QrCode className="h-3.5 w-3.5 text-indigo-500" />
              <span>Method 1: Scan QR</span>
            </button>
          </div>
        )}

        {/* Security Note */}
        <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-neutral-50 p-2.5 text-[11px] text-neutral-500 dark:bg-neutral-950/60 dark:text-neutral-400">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>Peers in the same room connect peer-to-peer over WebRTC with local AES-256 encryption.</span>
        </div>
      </div>
    </div>
  );
};
