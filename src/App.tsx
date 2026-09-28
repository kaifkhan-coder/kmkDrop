/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  Laptop,
  QrCode,
  Camera,
  Download,
  Upload,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Lock,
  RefreshCw,
  FileText,
  Eye,
  ArrowRight,
  Share2,
  MessageSquare,
  Hash,
} from 'lucide-react';
import { Header } from './components/Header';
import { QRCodeDisplay } from './components/QRCodeDisplay';
import { QRScannerModal } from './components/QRScannerModal';
import { FileDropZone } from './components/FileDropZone';
import { TransferProgressView } from './components/TransferProgressView';
import { FilePreviewModal } from './components/FilePreviewModal';
import { TransferHistoryView } from './components/TransferHistoryView';
import { SecurityExplainer } from './components/SecurityExplainer';
import { AuthModal } from './components/AuthModal';
import { FeedbackSection } from './components/FeedbackSection';
import { TextMessageSection } from './components/TextMessageSection';
import { ActiveUsersModal } from './components/ActiveUsersModal';
import { MobileConnectionSteps } from './components/MobileConnectionSteps';
import { JoinRoomModal } from './components/JoinRoomModal';
import { useTransferEngine } from './hooks/useTransferEngine';
import { ThemeMode, UserSession, ReceivedFileItem } from './types';
import { formatBytes, getFileCategory } from './utils/format';

export default function App() {
  // Theme state: light, dark, oled
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('beamdrop_theme') as ThemeMode) || 'dark';
  });

  // Current active navigation tab
  const [currentTab, setCurrentTab] = useState<'send' | 'receive' | 'messages' | 'users' | 'history' | 'security'>('send');

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<ReceivedFileItem | null>(null);

  // Authenticated User Session
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('beamdrop_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Selected files queue for sending
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [autoDownload, setAutoDownload] = useState(true);

  // Transfer Engine Hook
  const {
    roomId,
    setRoomId,
    keyBase64,
    peers,
    isWsConnected,
    isP2PConnected,
    transportMode,
    currentTransfer,
    receivedFiles,
    history,
    isPaused,
    transferFile,
    togglePause,
    cancelTransfer,
    resetTransferState,
    getPairingUrl,
    textMessages,
    sendTextMessage,
    clearTextMessages,
    activeUsersStats,
    fetchActiveUsers,
    sendUserIdentification,
  } = useTransferEngine();

  // Apply Theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'oled');
    if (theme === 'oled') {
      root.classList.add('dark', 'oled');
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem('beamdrop_theme', theme);
  }, [theme]);

  // Handle URL parameters for instant room joining (when opened via QR scan)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && roomParam !== roomId) {
      setRoomId(roomParam);
      // Switch receiver to receive or send view
      setCurrentTab('receive');
    }
  }, [roomId, setRoomId]);

  // Auto-download files if enabled AND user is authenticated
  useEffect(() => {
    if (user && autoDownload && receivedFiles.length > 0) {
      const latest = receivedFiles[0];
      // Only trigger if received in the last 2 seconds
      if (Date.now() - latest.receivedAt < 2000) {
        const a = document.createElement('a');
        a.href = latest.url;
        a.download = latest.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  }, [receivedFiles, autoDownload, user]);


  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : prev === 'dark' ? 'oled' : 'light'));
  };

  const handleJoinRoom = useCallback((newRoomId: string) => {
    const cleanCode = newRoomId.trim().toUpperCase();
    if (!cleanCode) return;
    setRoomId(cleanCode);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('room', cleanCode);
    window.history.pushState({}, '', newUrl.toString());
  }, [setRoomId]);

  const handleFilesSelected = (newFiles: File[]) => {
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearFiles = () => {
    setSelectedFiles([]);
  };

  const handleStartTransfer = async () => {
    if (selectedFiles.length === 0) return;
    const fileToTransfer = selectedFiles[0];
    await transferFile(fileToTransfer);
    // Remove completed file from queue
    setSelectedFiles((prev) => prev.slice(1));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('beamdrop_user');
  };

  const handleAuthSuccess = (authenticatedUser: UserSession) => {
    setUser(authenticatedUser);
    localStorage.setItem('beamdrop_user', JSON.stringify(authenticatedUser));
  };

  const handleScanSuccess = (scannedUrl: string) => {
    try {
      const url = new URL(scannedUrl);
      const room = url.searchParams.get('room');
      const hash = url.hash; // #key=...
      if (room) {
        window.location.href = scannedUrl;
      }
    } catch {
      // If it was just a plain room ID
      setRoomId(scannedUrl);
    }
  };

  const pairingUrl = getPairingUrl();

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        theme === 'oled'
          ? 'bg-black text-neutral-100'
          : theme === 'dark'
          ? 'bg-neutral-950 text-neutral-100'
          : 'bg-neutral-50 text-neutral-900'
      }`}
    >
      {/* Strict Top Bar Contract Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        peersCount={peers.length}
        unreadMessagesCount={textMessages.filter((m) => m.direction === 'received').length}
        activeUsersCount={activeUsersStats?.totalOnlineUsers || Math.max(1, peers.length + 1)}
        onOpenActiveUsers={() => setIsUsersModalOpen(true)}
        onOpenJoinRoom={() => setIsJoinRoomOpen(true)}
        currentRoomId={roomId}
      />

      {/* Main Viewport Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* View-Only Mode Alert Banner when not signed in */}
        {!user && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">View-Only Mode Active</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  You can inspect the interface, scan QR codes, and preview files, but transferring or downloading requires signing in.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsAuthOpen(true)}
              className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition whitespace-nowrap"
            >
              Sign In with Gmail / Magic Link
            </button>
          </div>
        )}

        {/* TAB 1: SEND FILES */}
        {currentTab === 'send' && (
          <div className="space-y-8">
            {/* Quick helper banner to connect mobile */}
            {peers.length === 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-900 dark:text-white">
                      Connecting from your phone?
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Scan the QR code to pair your mobile camera or view the 3-step setup guide.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentTab('receive')}
                  className="flex items-center gap-1.5 shrink-0 rounded-xl bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition whitespace-nowrap"
                >
                  <span>Connect Mobile (3 Steps)</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
            {/* Hero Banner with Generated Asset */}
            <div className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60 sm:p-10">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="flex-1 space-y-4 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-100/80 px-3 py-1 text-xs font-semibold text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Peer-to-Peer · Zero Server Storage · AES-256-GCM</span>
                  </div>

                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-white leading-[1.15]">
                    Transfer files directly between Mobile & PC
                  </h1>

                  <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-xl leading-relaxed">
                    Select your files to generate an encrypted QR code. Scan from any smartphone or laptop
                    to stream files directly device-to-device with end-to-end cryptographic confidentiality.
                  </p>

                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
                    <button
                      onClick={() => {
                        if (!user) {
                          setIsAuthOpen(true);
                          return;
                        }
                        const el = document.getElementById('file-drop-area');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition"
                    >
                      <Upload className="h-4 w-4" />
                      <span>{user ? 'Select Files to Send' : 'Sign In to Select Files'}</span>
                    </button>

                    <button
                      onClick={() => setIsScannerOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 transition"
                    >
                      <Camera className="h-4 w-4 text-neutral-500" />
                      <span>Scan QR (Method 1)</span>
                    </button>

                    <button
                      onClick={() => setIsJoinRoomOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 transition"
                    >
                      <Hash className="h-4 w-4 text-emerald-500" />
                      <span>Enter Code (Method 2)</span>
                    </button>

                    <button
                      onClick={() => setCurrentTab('messages')}
                      className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition"
                    >
                      <MessageSquare className="h-4 w-4 text-indigo-500" />
                      <span>Send Text / Links to PC</span>
                    </button>
                  </div>
                </div>

                {/* Hero Graphic Asset */}
                <div className="w-full lg:w-96 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 shadow-lg dark:border-neutral-800">
                  <img
                    src="/src/assets/images/hero_device_sync_1790529157660.jpg"
                    alt="Peer to peer device transfer illustration"
                    referrerPolicy="no-referrer"
                    className="w-full h-auto object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Active Transfer Progress View */}
            {currentTransfer && (
              <TransferProgressView
                progress={currentTransfer}
                isPaused={isPaused}
                onTogglePause={togglePause}
                onCancel={cancelTransfer}
                onReset={resetTransferState}
              />
            )}

            {/* Main Interactive Grid: Drop Zone + QR Code Pairing Bridge */}
            <div id="file-drop-area" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: File Drop & Selection (8 cols) */}
              <div className="lg:col-span-7 space-y-6">
                <FileDropZone
                  selectedFiles={selectedFiles}
                  onFilesSelected={handleFilesSelected}
                  onRemoveFile={handleRemoveFile}
                  onClearFiles={handleClearFiles}
                  onStartTransfer={handleStartTransfer}
                  isPeerConnected={peers.length > 0}
                  onOpenQR={() => {
                    const qrEl = document.getElementById('qr-code-section');
                    qrEl?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  isSignedIn={Boolean(user)}
                  onRequireAuth={() => setIsAuthOpen(true)}
                />

                {/* Recently Received in this Session */}
                {receivedFiles.length > 0 && (
                  <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                      <h4 className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Download className="h-4 w-4 text-emerald-500" />
                        <span>Received Files in this Session ({receivedFiles.length})</span>
                      </h4>
                    </div>

                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 max-h-60 overflow-y-auto">
                      {receivedFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between py-2.5">
                          <div className="truncate pr-3">
                            <p className="truncate text-xs font-medium text-neutral-900 dark:text-white">
                              {file.name}
                            </p>
                            <p className="text-[11px] font-mono text-neutral-500">
                              {formatBytes(file.size)} · SHA-256 verified
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setPreviewFile(file)}
                              className="flex items-center gap-1 rounded-lg border border-neutral-200 py-1 px-2.5 text-xs text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => {
                                if (!user) {
                                  setIsAuthOpen(true);
                                  return;
                                }
                                const a = document.createElement('a');
                                a.href = file.url;
                                a.download = file.name;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                              className="flex items-center gap-1 rounded-lg bg-neutral-900 py-1 px-2.5 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
                            >
                              <Download className="h-3 w-3" />
                              <span>{user ? 'Save' : 'Sign In to Save'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Encrypted QR Code Pairing Card (5 cols) */}
              <div id="qr-code-section" className="lg:col-span-5 space-y-4">
                <QRCodeDisplay
                  url={pairingUrl}
                  roomId={roomId}
                  peersCount={peers.length}
                  isSignedIn={Boolean(user)}
                  onRequireAuth={() => setIsAuthOpen(true)}
                  onRegenerateRoom={() => {
                    if (!user) {
                      setIsAuthOpen(true);
                      return;
                    }
                    const newId = Math.random().toString(36).substring(2, 10);
                    setRoomId(newId);
                  }}
                />

                {/* Device Pairing Status */}
                <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Laptop className="h-4 w-4 text-neutral-500" />
                      <span>This Device</span>
                    </span>
                    <span className="text-neutral-500 font-mono text-[11px]">
                      {isWsConnected ? 'Signaling Online' : 'Connecting...'}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                    <span className="text-neutral-500 flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4" />
                      <span>Target Peer</span>
                    </span>
                    {peers.length > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {peers[0].deviceName}
                      </span>
                    ) : (
                      <span className="text-neutral-400">Waiting for scan...</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RECEIVE / PAIR MODE */}
        {currentTab === 'receive' && (
          <div className="space-y-8">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
                Receive Files on this Device
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Scan the QR code below from your mobile device to establish a direct P2P bridge.
                Any files selected on your mobile will stream and save directly here.
              </p>
            </div>

            {/* Step-by-Step Guide to Connect Mobile */}
            <MobileConnectionSteps
              pairingUrl={pairingUrl}
              roomId={roomId}
              peersCount={peers.length}
              onOpenQRScanner={() => setIsScannerOpen(true)}
              onOpenMessages={() => setCurrentTab('messages')}
              onOpenJoinModal={() => setIsJoinRoomOpen(true)}
              onJoinRoom={handleJoinRoom}
            />

            {/* Quick Action banner to switch to Text / Clipboard */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-neutral-900 dark:text-white">
                    Need to send text, notes, or links from Mobile to PC?
                  </h4>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    You can beam clipboard text, URLs, OTPs, and messages directly between paired devices.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCurrentTab('messages')}
                className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition whitespace-nowrap"
              >
                Open Text / Clipboard Beam
              </button>
            </div>

            {/* Active Transfer Progress */}
            {currentTransfer && (
              <TransferProgressView
                progress={currentTransfer}
                isPaused={isPaused}
                onTogglePause={togglePause}
                onCancel={cancelTransfer}
                onReset={resetTransferState}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start max-w-4xl mx-auto">
              {/* QR Code & Code Pairing (Both Methods) */}
              <QRCodeDisplay
                url={pairingUrl}
                roomId={roomId}
                peersCount={peers.length}
                isSignedIn={Boolean(user)}
                onRequireAuth={() => setIsAuthOpen(true)}
                onJoinRoom={handleJoinRoom}
                onOpenQRScanner={() => setIsScannerOpen(true)}
              />

              {/* Receiving Controls & Files Table */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-900 dark:text-white">
                        Incoming File Storage
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        Files are decrypted locally using AES-GCM and saved directly.
                      </p>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoDownload}
                        onChange={(e) => {
                          if (!user) {
                            setIsAuthOpen(true);
                            return;
                          }
                          setAutoDownload(e.target.checked);
                        }}
                        className="rounded border-neutral-300 text-neutral-900 focus:ring-0 dark:border-neutral-700"
                      />
                      <span>Auto-Save</span>
                    </label>
                  </div>

                  <div className="py-4">
                    {receivedFiles.length === 0 ? (
                      <div className="py-8 text-center text-xs text-neutral-400">
                        <Download className="h-8 w-8 mx-auto text-neutral-300 dark:text-neutral-700 mb-2" />
                        <p>No incoming files yet.</p>
                        <p className="text-[11px] text-neutral-500 mt-1">
                          Files transferred from your mobile device will appear here instantly.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 max-h-72 overflow-y-auto">
                        {receivedFiles.map((file) => (
                          <div key={file.id} className="flex items-center justify-between py-3">
                            <div className="truncate pr-3">
                              <p className="truncate text-xs font-medium text-neutral-900 dark:text-white">
                                {file.name}
                              </p>
                              <p className="text-[11px] font-mono text-neutral-500">
                                {formatBytes(file.size)} · {file.senderDevice || 'Mobile Peer'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => setPreviewFile(file)}
                                className="flex items-center gap-1 rounded-lg border border-neutral-200 py-1 px-2.5 text-xs text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
                              >
                                <Eye className="h-3 w-3" />
                                <span>Preview</span>
                              </button>
                              <button
                                onClick={() => {
                                  if (!user) {
                                    setIsAuthOpen(true);
                                    return;
                                  }
                                  const a = document.createElement('a');
                                  a.href = file.url;
                                  a.download = file.name;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                }}
                                className="flex items-center gap-1 rounded-lg bg-neutral-900 py-1 px-2.5 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
                              >
                                <Download className="h-3 w-3" />
                                <span>{user ? 'Save' : 'Sign In to Save'}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Built-in Camera Scanner Trigger */}
                <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/50 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-semibold text-neutral-900 dark:text-white">
                      Need to scan another device's QR code?
                    </h5>
                    <p className="text-[11px] text-neutral-500">
                      Use this computer or device's webcam to scan a sender's screen.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsScannerOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-neutral-300 py-2 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 transition shrink-0"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Launch Camera Scanner</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TEXT & CLIPBOARD BEAM (MOBILE TO PC INSTANT SYNC) */}
        {currentTab === 'messages' && (
          <TextMessageSection
            messages={textMessages}
            peers={peers}
            onSendMessage={sendTextMessage}
            onClearMessages={clearTextMessages}
            isSignedIn={Boolean(user)}
            onRequireAuth={() => setIsAuthOpen(true)}
            onOpenQR={() => setCurrentTab('receive')}
          />
        )}

        {/* TAB 4: TRANSFER HISTORY */}
        {currentTab === 'history' && (
          <TransferHistoryView
            history={history}
            onClearHistory={() => {
              localStorage.removeItem('beamdrop_history');
              window.location.reload();
            }}
          />
        )}

        {/* TAB: ACTIVE USERS & CONNECTED PEERS DIRECTORY */}
        {currentTab === 'users' && (
          <section className="rounded-3xl border border-neutral-200/90 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-100/80 px-3 py-1 text-xs font-semibold text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 mb-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real-time Active Users Monitor</span>
                </div>
                <h3 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  Active Users & Connected Devices ({activeUsersStats?.totalOnlineUsers || Math.max(1, peers.length + 1)})
                </h3>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Live directory of who is currently online, their active device types, connected rooms, and real-time status.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchActiveUsers}
                  className="flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-neutral-400" />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => setIsUsersModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition"
                >
                  <span>Focus View</span>
                </button>
              </div>
            </div>

            {/* List of active users */}
            <div className="space-y-3">
              {(!activeUsersStats?.users || activeUsersStats.users.length === 0) ? (
                <div className="py-12 text-center text-xs text-neutral-400">
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                    Your device is currently connected to room <span className="font-mono font-bold text-neutral-900 dark:text-white">{roomId}</span>
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Scan the QR code on your mobile phone to connect and see multiple devices here.
                  </p>
                </div>
              ) : (
                activeUsersStats.users.map((peer) => (
                  <div
                    key={peer.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 transition ${
                      peer.isSelf
                        ? 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/60 dark:bg-indigo-950/20'
                        : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
                        {peer.deviceType === 'mobile' ? (
                          <Smartphone className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Laptop className="h-4 w-4 text-indigo-500" />
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-neutral-900" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-900 dark:text-white">
                            {peer.name}
                          </span>
                          {peer.isSelf && (
                            <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                              You
                            </span>
                          )}
                          {peer.roomId === roomId && !peer.isSelf && (
                            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              Paired Room
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                          {peer.email ? (
                            <span className="font-mono text-neutral-700 dark:text-neutral-300 font-medium">
                              {peer.email}
                            </span>
                          ) : (
                            <span className="italic">Guest Peer ({peer.deviceName})</span>
                          )}
                          <span>·</span>
                          <span>Device: {peer.deviceName}</span>
                          <span>·</span>
                          <span>Room: <code className="font-mono text-[10px]">{peer.roomId.slice(0, 8)}</code></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {peer.roomId === roomId ? (
                        <button
                          onClick={() => setCurrentTab('messages')}
                          className="flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>Send Text to Device</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setRoomId(peer.roomId)}
                          className="flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 transition"
                        >
                          <span>Join Room</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* TAB 4: SECURITY & E2EE ARCHITECTURE */}
        {currentTab === 'security' && <SecurityExplainer />}

        {/* SYSTEM EVALUATION & FEEDBACK SECTION */}
        <FeedbackSection
          user={user}
          onOpenAuth={() => setIsAuthOpen(true)}
          transferStats={{
            totalSent: history.filter((h) => h.direction === 'sent').length,
            totalReceived: history.filter((h) => h.direction === 'received').length,
          }}
        />
      </main>


      {/* MODALS */}
      {/* 1. Auth Modal (Magic Link & Google Sign-In) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* 2. QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      {/* 3. In-Browser File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        isSignedIn={Boolean(user)}
        onRequireAuth={() => setIsAuthOpen(true)}
      />

      {/* 4. Active Users & Devices Directory Modal */}
      <ActiveUsersModal
        isOpen={isUsersModalOpen}
        onClose={() => setIsUsersModalOpen(false)}
        stats={activeUsersStats}
        onRefresh={fetchActiveUsers}
        currentRoomId={roomId}
        onSelectRoom={(newRoomId) => {
          setRoomId(newRoomId);
          setCurrentTab('send');
        }}
        onOpenMessages={() => setCurrentTab('messages')}
      />

      {/* 5. Join Room by Code Modal (Method 2) */}
      <JoinRoomModal
        isOpen={isJoinRoomOpen}
        onClose={() => setIsJoinRoomOpen(false)}
        currentRoomId={roomId}
        onJoinRoom={handleJoinRoom}
        onOpenQRScanner={() => setIsScannerOpen(true)}
      />


      {/* Minimal Footer */}
      <footer className="mt-16 border-t border-neutral-200/80 py-8 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 BeamDrop. Peer-to-peer file transfer engine with zero-knowledge end-to-end encryption.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>RFC WebRTC RTCDataChannel</span>
            <span>·</span>
            <span>Web Crypto AES-256-GCM</span>
            <span>·</span>
            <span>SHA-256 Digest Validation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
