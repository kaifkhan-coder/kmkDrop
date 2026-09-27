import React from 'react';
import { Shield, Lock, Cpu, ServerOff, CheckCircle2, Key, Terminal } from 'lucide-react';

export const SecurityExplainer: React.FC = () => {
  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
        <div className="flex flex-col md:flex-row items-center gap-6 pb-6 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-1 text-xs font-semibold mb-3">
              <Shield className="h-3.5 w-3.5" />
              <span>Zero-Knowledge Architecture</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              End-to-End Encryption & Privacy Model
            </h2>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              BeamDrop uses browser-native Web Crypto API standards to guarantee that your files,
              documents, and media are completely encrypted before transmission and decrypted only on the target device.
            </p>
          </div>

          <div className="w-full md:w-48 shrink-0 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-inner">
            <img
              src="/src/assets/images/security_shield_lock_1790529174325.jpg"
              alt="Cryptographic security shield illustration"
              referrerPolicy="no-referrer"
              className="w-full h-auto object-cover"
              onError={(e) => {
                // Fallback container
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* 4 Core Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 dark:border-neutral-800/80 dark:bg-neutral-950/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white mb-1.5">
              <ServerOff className="h-4 w-4 text-emerald-500" />
              <span>Zero Server Storage</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-normal">
              No files are ever written to server disks, databases, or cloud buckets. Data streams directly from peer memory to peer memory.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 dark:border-neutral-800/80 dark:bg-neutral-950/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white mb-1.5">
              <Lock className="h-4 w-4 text-indigo-500" />
              <span>AES-256-GCM Military Grade</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-normal">
              Every single 64KB slice is individually encrypted with an authenticated 12-byte IV counter and 128-bit authentication tag.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 dark:border-neutral-800/80 dark:bg-neutral-950/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white mb-1.5">
              <Key className="h-4 w-4 text-amber-500" />
              <span>URL Hash Key Isolation</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-normal">
              The symmetric key exists only in the QR code’s URL fragment (<code className="font-mono text-[11px] bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded">#key=...</code>). By web standard, fragment identifiers are never sent to the signaling server.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 dark:border-neutral-800/80 dark:bg-neutral-950/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white mb-1.5">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              <span>SHA-256 Checksum Validation</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-normal">
              Before transmission, a cryptographic SHA-256 digest is generated. The receiver re-hashes the assembled payload to ensure not a single bit was modified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
