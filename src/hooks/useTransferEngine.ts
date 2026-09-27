import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileMetadata,
  TransferProgress,
  ReceivedFileItem,
  TransferHistoryItem,
  PeerDevice,
  TransferStatus,
} from '../types';
import {
  generateAESKey,
  exportKeyToBase64,
  importKeyFromBase64,
  encryptChunk,
  decryptChunk,
  computeSHA256,
  playChime,
} from '../utils/crypto';
import { detectDevice } from '../utils/format';

const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export function useTransferEngine(initialRoomId?: string, initialKeyBase64?: string) {
  // Session State
  const [roomId, setRoomId] = useState<string>(() => {
    if (initialRoomId) return initialRoomId;
    // Check URL query
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) return roomParam;
    // Generate new clean 8-character ID
    return Math.random().toString(36).substring(2, 10);
  });

  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [keyBase64, setKeyBase64] = useState<string>(initialKeyBase64 || '');
  const [peers, setPeers] = useState<PeerDevice[]>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isP2PConnected, setIsP2PConnected] = useState(false);
  const [transportMode, setTransportMode] = useState<'webrtc' | 'relay'>('relay');

  // Active Transfer State
  const [currentTransfer, setCurrentTransfer] = useState<TransferProgress | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFileItem[]>([]);
  const [history, setHistory] = useState<TransferHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('beamdrop_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Transfer Queue for sender
  const [transferQueue, setTransferQueue] = useState<File[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const activePeerIdRef = useRef<string | null>(null);
  const isInitiatorRef = useRef(false);

  // Inbound File Assembly Buffer
  const incomingFileMetaRef = useRef<FileMetadata | null>(null);
  const incomingChunksRef = useRef<Map<number, ArrayBuffer>>(new Map());
  const incomingBytesRef = useRef(0);
  const transferStartTimeRef = useRef(0);
  const lastSpeedUpdateRef = useRef({ time: 0, bytes: 0 });

  // Outbound File Transfer Tracking
  const cancelTransferRef = useRef(false);
  const pauseTransferRef = useRef(false);

  // Sync history to local storage
  const addToHistory = useCallback((item: Omit<TransferHistoryItem, 'id'>) => {
    const newItem: TransferHistoryItem = {
      ...item,
      id: crypto.randomUUID(),
    };
    setHistory((prev) => {
      const updated = [newItem, ...prev.slice(0, 49)];
      try {
        localStorage.setItem('beamdrop_history', JSON.stringify(updated));
      } catch {
        // quota exceeded fallback
      }
      return updated;
    });
  }, []);

  // 1. Initialize or load End-to-End Encryption Key
  useEffect(() => {
    async function initKey() {
      // Check URL hash for #key=...
      const hash = window.location.hash;
      let rawKey = keyBase64;
      if (!rawKey && hash.startsWith('#key=')) {
        rawKey = hash.replace('#key=', '');
      }

      if (rawKey) {
        try {
          const imported = await importKeyFromBase64(rawKey);
          setEncryptionKey(imported);
          setKeyBase64(rawKey);
          return;
        } catch (err) {
          console.error('Failed to import existing key from hash:', err);
        }
      }

      // If no key yet, generate a new 256-bit AES-GCM key
      try {
        const newKey = await generateAESKey();
        const exported = await exportKeyToBase64(newKey);
        setEncryptionKey(newKey);
        setKeyBase64(exported);
      } catch (err) {
        console.error('Failed to generate AES key:', err);
      }
    }

    initKey();
  }, [keyBase64]);

  // 2. Set up WebRTC Peer Connection
  const createPeerConnection = useCallback((targetPeerId: string, isOffer: boolean) => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    activePeerIdRef.current = targetPeerId;

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'signal',
            targetPeerId,
            signalData: { candidate: event.candidate },
          })
        );
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setIsP2PConnected(true);
        setTransportMode('webrtc');
        playChime('connected');
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setIsP2PConnected(false);
        setTransportMode('relay');
      }
    };

    if (isOffer) {
      // Create DataChannel
      const dc = pc.createDataChannel('beamdrop-data', {
        ordered: true,
      });
      setupDataChannel(dc);
      dataChannelRef.current = dc;

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'signal',
                targetPeerId,
                signalData: { desc: pc.localDescription },
              })
            );
          }
        })
        .catch((err) => console.warn('WebRTC offer error:', err));
    } else {
      pc.ondatachannel = (event) => {
        setupDataChannel(event.channel);
        dataChannelRef.current = event.channel;
      };
    }

    return pc;
  }, []);

  // 3. Set up WebRTC DataChannel handlers
  const setupDataChannel = (dc: RTCDataChannel) => {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      setIsP2PConnected(true);
      setTransportMode('webrtc');
    };

    dc.onclose = () => {
      setIsP2PConnected(false);
      setTransportMode('relay');
    };

    dc.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          handleControlMessage(msg);
        } catch (err) {
          console.error('Failed to parse data channel message:', err);
        }
      } else if (event.data instanceof ArrayBuffer) {
        handleRawChunkReceived(event.data);
      }
    };
  };

  // 4. Handle incoming control messages (via DataChannel or WebSocket Relay)
  const handleControlMessage = useCallback(
    (msg: any) => {
      const { type } = msg;

      if (type === 'transfer_meta') {
        const meta: FileMetadata = msg.fileMeta;
        incomingFileMetaRef.current = meta;
        incomingChunksRef.current.clear();
        incomingBytesRef.current = 0;
        transferStartTimeRef.current = performance.now();
        lastSpeedUpdateRef.current = { time: performance.now(), bytes: 0 };

        setCurrentTransfer({
          fileId: meta.id,
          fileName: meta.name,
          fileSize: meta.size,
          fileType: meta.type,
          bytesTransferred: 0,
          percent: 0,
          speedBps: 0,
          etaSeconds: 0,
          status: 'transferring',
          currentChunk: 0,
          totalChunks: meta.totalChunks,
          direction: 'receiving',
          peerDeviceName: msg.senderDeviceName || 'Connected Peer',
          transportMode: dataChannelRef.current?.readyState === 'open' ? 'webrtc' : 'relay',
        });

        playChime('receive');
        return;
      }

      if (type === 'transfer_complete') {
        finalizeIncomingTransfer();
        return;
      }

      if (type === 'cancel_transfer') {
        cancelTransferRef.current = true;
        setCurrentTransfer((prev) =>
          prev ? { ...prev, status: 'cancelled', error: 'Transfer was cancelled by peer.' } : null
        );
        return;
      }
    },
    []
  );

  // 5. Handle binary chunks received (E2EE Decryption in real-time)
  const handleRawChunkReceived = useCallback(
    async (rawBuffer: ArrayBuffer) => {
      const meta = incomingFileMetaRef.current;
      if (!meta) return;

      // Extract 4-byte chunk index prefix from rawBuffer
      const dataView = new DataView(rawBuffer);
      const chunkIndex = dataView.getUint32(0, false);
      const encryptedChunk = rawBuffer.slice(4);

      try {
        let decrypted: ArrayBuffer;
        if (encryptionKey) {
          decrypted = await decryptChunk(encryptedChunk, encryptionKey, meta.id, chunkIndex);
        } else {
          decrypted = encryptedChunk;
        }

        incomingChunksRef.current.set(chunkIndex, decrypted);
        incomingBytesRef.current += decrypted.byteLength;

        const now = performance.now();
        const elapsedSinceLast = (now - lastSpeedUpdateRef.current.time) / 1000;

        let speedBps = 0;
        if (elapsedSinceLast > 0.25) {
          const bytesDelta = incomingBytesRef.current - lastSpeedUpdateRef.current.bytes;
          speedBps = Math.max(0, bytesDelta / elapsedSinceLast);
          lastSpeedUpdateRef.current = { time: now, bytes: incomingBytesRef.current };
        }

        const percent = Math.min(100, Math.round((incomingBytesRef.current / meta.size) * 100));
        const remainingBytes = Math.max(0, meta.size - incomingBytesRef.current);
        const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;

        setCurrentTransfer((prev) =>
          prev
            ? {
                ...prev,
                bytesTransferred: incomingBytesRef.current,
                percent,
                speedBps: speedBps || prev.speedBps,
                etaSeconds,
                currentChunk: chunkIndex + 1,
              }
            : null
        );

        // If we have received all chunks, finalize
        if (incomingChunksRef.current.size >= meta.totalChunks) {
          finalizeIncomingTransfer();
        }
      } catch (err) {
        console.error('Decryption failed for chunk:', chunkIndex, err);
      }
    },
    [encryptionKey]
  );

  // 6. Finalize received file (Reassemble Blob + Verify SHA-256 Checksum)
  const finalizeIncomingTransfer = useCallback(async () => {
    const meta = incomingFileMetaRef.current;
    if (!meta) return;

    try {
      const chunksMap = incomingChunksRef.current;
      const sortedChunks: ArrayBuffer[] = [];
      for (let i = 0; i < meta.totalChunks; i++) {
        const chunk = chunksMap.get(i);
        if (chunk) {
          sortedChunks.push(chunk);
        }
      }

      const fullBlob = new Blob(sortedChunks, { type: meta.type || 'application/octet-stream' });
      const fullBuffer = await fullBlob.arrayBuffer();
      const calculatedChecksum = await computeSHA256(fullBuffer);

      const verified = meta.checksum ? calculatedChecksum === meta.checksum : true;
      const fileUrl = URL.createObjectURL(fullBlob);

      const receivedItem: ReceivedFileItem = {
        id: meta.id,
        name: meta.name,
        size: meta.size,
        type: meta.type,
        blob: fullBlob,
        url: fileUrl,
        checksum: calculatedChecksum,
        verified,
        receivedAt: Date.now(),
        senderDevice: currentTransfer?.peerDeviceName,
      };

      setReceivedFiles((prev) => [receivedItem, ...prev]);

      const avgSpeed =
        transferStartTimeRef.current > 0
          ? meta.size / Math.max(0.1, (performance.now() - transferStartTimeRef.current) / 1000)
          : 0;

      addToHistory({
        fileName: meta.name,
        fileSize: meta.size,
        fileType: meta.type,
        direction: 'received',
        timestamp: Date.now(),
        speedAvgBps: avgSpeed,
        peerName: currentTransfer?.peerDeviceName,
        status: 'completed',
        downloadUrl: fileUrl,
      });

      setCurrentTransfer((prev) =>
        prev
          ? {
              ...prev,
              bytesTransferred: meta.size,
              percent: 100,
              status: 'completed',
              speedBps: avgSpeed,
              etaSeconds: 0,
            }
          : null
      );

      playChime('complete');
      incomingFileMetaRef.current = null;
    } catch (err) {
      console.error('Finalize file error:', err);
      setCurrentTransfer((prev) =>
        prev ? { ...prev, status: 'failed', error: 'Failed to reassemble decrypted file.' } : null
      );
    }
  }, [addToHistory, currentTransfer?.peerDeviceName]);

  // 7. WebSocket Signaling Connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsWsConnected(true);
      const deviceInfo = detectDevice();
      ws.send(
        JSON.stringify({
          type: 'join',
          roomId,
          deviceName: deviceInfo.name,
          deviceType: deviceInfo.type,
        })
      );
    };

    ws.onclose = () => {
      setIsWsConnected(false);
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type } = msg;

        if (type === 'room_joined') {
          if (msg.peers && Array.isArray(msg.peers)) {
            setPeers(msg.peers);
            // If there's an existing peer, initiate WebRTC connection
            if (msg.peers.length > 0) {
              const target = msg.peers[0];
              isInitiatorRef.current = true;
              createPeerConnection(target.id, true);
            }
          }
          return;
        }

        if (type === 'peer_joined') {
          const { peer } = msg;
          setPeers((prev) => [...prev.filter((p) => p.id !== peer.id), peer]);
          playChime('connected');
          // If we are sender or ready, we can offer
          if (!pcRef.current) {
            createPeerConnection(peer.id, false);
          }
          return;
        }

        if (type === 'peer_left') {
          setPeers((prev) => prev.filter((p) => p.id !== msg.peerId));
          if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
          }
          setIsP2PConnected(false);
          return;
        }

        // WebRTC Signaling
        if (type === 'signal') {
          const { fromPeerId, signalData } = msg;
          if (!pcRef.current) {
            createPeerConnection(fromPeerId, false);
          }
          const pc = pcRef.current!;

          if (signalData.desc) {
            await pc.setRemoteDescription(new RTCSessionDescription(signalData.desc));
            if (signalData.desc.type === 'offer') {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(
                JSON.stringify({
                  type: 'signal',
                  targetPeerId: fromPeerId,
                  signalData: { desc: pc.localDescription },
                })
              );
            }
          } else if (signalData.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
            } catch (err) {
              console.warn('Error adding ICE candidate:', err);
            }
          }
          return;
        }

        // Encrypted WebSocket Relay Fallback
        if (type === 'transfer_meta') {
          handleControlMessage(msg);
          return;
        }

        if (type === 'relay_chunk') {
          const { chunkIndex, chunkBase64 } = msg;
          // Decode base64 to buffer
          const binaryStr = atob(chunkBase64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          // Pack with 4-byte chunk index prefix
          const fullBuffer = new ArrayBuffer(4 + bytes.byteLength);
          const view = new DataView(fullBuffer);
          view.setUint32(0, chunkIndex, false);
          new Uint8Array(fullBuffer, 4).set(bytes);

          handleRawChunkReceived(fullBuffer);
          return;
        }

        if (type === 'transfer_complete') {
          handleControlMessage(msg);
          return;
        }

        if (type === 'cancel_transfer') {
          handleControlMessage(msg);
          return;
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    return () => {
      ws.close();
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [roomId, createPeerConnection, handleControlMessage, handleRawChunkReceived]);

  // 8. Start transferring a single file (Sender side)
  const transferFile = async (file: File) => {
    if (!encryptionKey) {
      alert('Encryption key not initialized yet.');
      return;
    }

    cancelTransferRef.current = false;
    pauseTransferRef.current = false;
    setIsPaused(false);

    const fileId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const fileBuffer = await file.arrayBuffer();
    const checksum = await computeSHA256(fileBuffer);
    const deviceInfo = detectDevice();

    const fileMeta: FileMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      totalChunks,
      checksum,
    };

    const hasDataChannel = dataChannelRef.current?.readyState === 'open';
    const activeTransport: 'webrtc' | 'relay' = hasDataChannel ? 'webrtc' : 'relay';

    // Broadcast file metadata
    const metaMessage = {
      type: 'transfer_meta',
      roomId,
      fileMeta,
      senderDeviceName: deviceInfo.name,
    };

    if (hasDataChannel) {
      dataChannelRef.current!.send(JSON.stringify(metaMessage));
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(metaMessage));
    }

    setCurrentTransfer({
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      bytesTransferred: 0,
      percent: 0,
      speedBps: 0,
      etaSeconds: 0,
      status: 'transferring',
      currentChunk: 0,
      totalChunks,
      direction: 'sending',
      peerDeviceName: peers[0]?.deviceName || 'Connected Peer',
      transportMode: activeTransport,
    });

    const startTime = performance.now();
    let bytesSent = 0;
    let lastTime = startTime;
    let lastSent = 0;

    // Send chunks sequentially
    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      if (cancelTransferRef.current) {
        const cancelMsg = { type: 'cancel_transfer', roomId, fileId };
        if (hasDataChannel) dataChannelRef.current?.send(JSON.stringify(cancelMsg));
        else wsRef.current?.send(JSON.stringify(cancelMsg));
        setCurrentTransfer((prev) =>
          prev ? { ...prev, status: 'cancelled', error: 'Transfer cancelled by user.' } : null
        );
        return;
      }

      // Handle pause loop
      while (pauseTransferRef.current) {
        await new Promise((r) => setTimeout(r, 200));
        if (cancelTransferRef.current) break;
      }

      const startOffset = chunkIdx * CHUNK_SIZE;
      const endOffset = Math.min(file.size, startOffset + CHUNK_SIZE);
      const rawChunkSlice = fileBuffer.slice(startOffset, endOffset);

      // Encrypt chunk with AES-GCM
      const encryptedChunk = await encryptChunk(rawChunkSlice, encryptionKey, fileId, chunkIdx);

      if (hasDataChannel) {
        // Backpressure management for WebRTC RTCDataChannel
        while (dataChannelRef.current!.bufferedAmount > 256 * 1024) {
          await new Promise((r) => setTimeout(r, 15));
        }

        // Pack 4-byte chunk index prefix + encrypted chunk
        const packet = new ArrayBuffer(4 + encryptedChunk.byteLength);
        const view = new DataView(packet);
        view.setUint32(0, chunkIdx, false);
        new Uint8Array(packet, 4).set(new Uint8Array(encryptedChunk));

        dataChannelRef.current!.send(packet);
      } else {
        // WebSocket Relay fallback (Encode encrypted chunk to base64)
        const encBytes = new Uint8Array(encryptedChunk);
        let binary = '';
        for (let i = 0; i < encBytes.length; i++) {
          binary += String.fromCharCode(encBytes[i]);
        }
        const chunkBase64 = btoa(binary);

        wsRef.current?.send(
          JSON.stringify({
            type: 'relay_chunk',
            roomId,
            fileId,
            chunkIndex: chunkIdx,
            chunkBase64,
          })
        );
        // Small delay to prevent WebSocket congestion on large files
        if (chunkIdx % 10 === 0) {
          await new Promise((r) => setTimeout(r, 5));
        }
      }

      bytesSent += rawChunkSlice.byteLength;
      const now = performance.now();
      const elapsedSinceLast = (now - lastTime) / 1000;

      let speedBps = 0;
      if (elapsedSinceLast > 0.2) {
        speedBps = Math.max(0, (bytesSent - lastSent) / elapsedSinceLast);
        lastTime = now;
        lastSent = bytesSent;
      }

      const percent = Math.min(100, Math.round((bytesSent / file.size) * 100));
      const remainingBytes = Math.max(0, file.size - bytesSent);
      const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;

      setCurrentTransfer((prev) =>
        prev
          ? {
              ...prev,
              bytesTransferred: bytesSent,
              percent,
              speedBps: speedBps || prev.speedBps,
              etaSeconds,
              currentChunk: chunkIdx + 1,
            }
          : null
      );
    }

    // Transfer Complete
    const completeMsg = { type: 'transfer_complete', roomId, fileId };
    if (hasDataChannel) {
      dataChannelRef.current?.send(JSON.stringify(completeMsg));
    } else {
      wsRef.current?.send(JSON.stringify(completeMsg));
    }

    const totalDuration = Math.max(0.1, (performance.now() - startTime) / 1000);
    const avgSpeed = file.size / totalDuration;

    addToHistory({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      direction: 'sent',
      timestamp: Date.now(),
      speedAvgBps: avgSpeed,
      peerName: peers[0]?.deviceName || 'Connected Peer',
      status: 'completed',
    });

    setCurrentTransfer((prev) =>
      prev
        ? {
            ...prev,
            bytesTransferred: file.size,
            percent: 100,
            status: 'completed',
            speedBps: avgSpeed,
            etaSeconds: 0,
          }
        : null
    );

    playChime('complete');
  };

  // 9. Pause / Resume / Cancel Controls
  const togglePause = useCallback(() => {
    pauseTransferRef.current = !pauseTransferRef.current;
    setIsPaused(pauseTransferRef.current);
    setCurrentTransfer((prev) =>
      prev ? { ...prev, status: pauseTransferRef.current ? 'paused' : 'transferring' } : null
    );
  }, []);

  const cancelTransfer = useCallback(() => {
    cancelTransferRef.current = true;
    setCurrentTransfer((prev) =>
      prev ? { ...prev, status: 'cancelled', error: 'Transfer cancelled.' } : null
    );
  }, []);

  const resetTransferState = useCallback(() => {
    setCurrentTransfer(null);
    cancelTransferRef.current = false;
    pauseTransferRef.current = false;
    setIsPaused(false);
  }, []);

  // 10. Generate full shareable pairing URL (with encryption key in hash)
  const getPairingUrl = useCallback(() => {
    const origin = window.location.origin;
    return `${origin}/?room=${roomId}#key=${keyBase64}`;
  }, [roomId, keyBase64]);

  return {
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
    transferQueue,
    setTransferQueue,
    transferFile,
    togglePause,
    cancelTransfer,
    resetTransferState,
    getPairingUrl,
  };
}
