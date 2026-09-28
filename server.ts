import express from 'express';
import type { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

interface PeerSession {
  id: string;
  ws: WebSocket;
  deviceName: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  joinedAt: number;
  lastActive: number;
  userEmail?: string;
  userName?: string;
  roomId: string;
}

interface MagicLinkRecord {
  email: string;
  code: string;
  token: string;
  expiresAt: number;
}

function isValidEmail(email: unknown): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!regex.test(trimmed)) return false;
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const domainParts = parts[1].split('.');
  if (domainParts.length < 2) return false;
  const tld = domainParts[domainParts.length - 1];
  return Boolean(tld && tld.length >= 2 && /^[a-zA-Z]+$/.test(tld));
}

// In-memory rooms: roomId -> Map<peerId, PeerSession>
const rooms = new Map<string, Map<string, PeerSession>>();

// In-memory magic link tokens: token -> MagicLinkRecord
const magicTokens = new Map<string, MagicLinkRecord>();
const codeTokens = new Map<string, MagicLinkRecord>(); // code -> MagicLinkRecord

async function bootstrap() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // HTTP server
  const server = http.createServer(app);

  // WebSocket Server on /ws
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    let currentRoomId: string | null = null;
    let peerId = crypto.randomUUID();

    ws.on('message', (rawMessage: string | Buffer) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        const { type } = message;

        if (type === 'join') {
          const { roomId, deviceName = 'Unknown Device', deviceType = 'desktop', userEmail, userName } = message;
          currentRoomId = roomId;

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }

          const room = rooms.get(roomId)!;
          const session: PeerSession = {
            id: peerId,
            ws,
            deviceName,
            deviceType,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            userEmail: isValidEmail(userEmail) ? userEmail.toLowerCase().trim() : undefined,
            userName: typeof userName === 'string' && userName.trim() ? userName.trim() : undefined,
            roomId,
          };
          room.set(peerId, session);

          // Get existing peers (excluding self)
          const existingPeers: Array<{ id: string; deviceName: string; deviceType: string }> = [];
          room.forEach((p, id) => {
            if (id !== peerId && p.ws.readyState === WebSocket.OPEN) {
              existingPeers.push({
                id: p.id,
                deviceName: p.deviceName,
                deviceType: p.deviceType,
              });
            }
          });

          // Acknowledge join to the sender
          ws.send(JSON.stringify({
            type: 'room_joined',
            peerId,
            roomId,
            peers: existingPeers,
          }));

          // Notify existing peers that a new peer joined
          room.forEach((p, id) => {
            if (id !== peerId && p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(JSON.stringify({
                type: 'peer_joined',
                peer: {
                  id: peerId,
                  deviceName,
                  deviceType,
                },
              }));
            }
          });
          return;
        }

        // Handle user authentication identification
        if (type === 'identify') {
          const { userEmail, userName } = message;
          if (currentRoomId && rooms.has(currentRoomId)) {
            const room = rooms.get(currentRoomId)!;
            const session = room.get(peerId);
            if (session) {
              if (isValidEmail(userEmail)) session.userEmail = userEmail.toLowerCase().trim();
              if (typeof userName === 'string' && userName.trim()) session.userName = userName.trim();
              session.lastActive = Date.now();
            }
          }
          return;
        }

        if (currentRoomId && rooms.has(currentRoomId)) {
          const room = rooms.get(currentRoomId)!;
          const session = room.get(peerId);
          if (session) {
            session.lastActive = Date.now();
          }
        }

        if (!currentRoomId || !rooms.has(currentRoomId)) {
          return;
        }

        const room = rooms.get(currentRoomId)!;

        // Forward WebRTC signals directly to specific target or broadcast to room
        if (type === 'signal') {
          const { targetPeerId, signalData } = message;
          if (targetPeerId && room.has(targetPeerId)) {
            const targetPeer = room.get(targetPeerId);
            if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
              targetPeer.ws.send(JSON.stringify({
                type: 'signal',
                fromPeerId: peerId,
                signalData,
              }));
            }
          } else {
            // Broadcast to other peers in room
            room.forEach((p, id) => {
              if (id !== peerId && p.ws.readyState === WebSocket.OPEN) {
                p.ws.send(JSON.stringify({
                  type: 'signal',
                  fromPeerId: peerId,
                  signalData,
                }));
              }
            });
          }
          return;
        }

        // Encrypted Relay Messages (transfer_meta, relay_chunk, chunk_ack, transfer_complete, cancel, peer_text_message)
        if (
          type === 'transfer_meta' ||
          type === 'relay_chunk' ||
          type === 'chunk_ack' ||
          type === 'transfer_complete' ||
          type === 'cancel_transfer' ||
          type === 'peer_text_message'
        ) {
          room.forEach((p, id) => {
            if (id !== peerId && p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(JSON.stringify({
                ...message,
                fromPeerId: peerId,
              }));
            }
          });
          return;
        }

        // Ping / Pong
        if (type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    const cleanup = () => {
      if (currentRoomId && rooms.has(currentRoomId)) {
        const room = rooms.get(currentRoomId)!;
        room.delete(peerId);

        // Notify remaining peers
        room.forEach((p) => {
          if (p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(JSON.stringify({
              type: 'peer_left',
              peerId,
            }));
          }
        });

        if (room.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  // REST API Routes

  // 1. Magic Link generation (Strict valid email required)
  app.post('/api/auth/magic-link', (req: Request, res: Response) => {
    const { email } = req.body;
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address (e.g. name@domain.com).' });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const token = crypto.randomBytes(24).toString('hex');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    const record: MagicLinkRecord = { email: cleanEmail, code, token, expiresAt };
    magicTokens.set(token, record);
    codeTokens.set(code, record);

    return res.json({
      success: true,
      message: `Magic link & verification code generated for ${cleanEmail}`,
      token,
      code,
      expiresInMinutes: 15,
    });
  });

  // 2. Auth Verification (via token or 6-digit code)
  app.post('/api/auth/verify', (req: Request, res: Response) => {
    const { token, code, email } = req.body;
    let record: MagicLinkRecord | undefined;

    if (token && magicTokens.has(token)) {
      record = magicTokens.get(token);
    } else if (code && codeTokens.has(code)) {
      record = codeTokens.get(code);
    }

    if (!record || record.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Invalid or expired verification credentials.' });
    }

    // Clean up
    magicTokens.delete(record.token);
    codeTokens.delete(record.code);

    const username = record.email.split('@')[0];
    const formattedName = username.charAt(0).toUpperCase() + username.slice(1);

    return res.json({
      success: true,
      user: {
        id: crypto.createHash('md5').update(record.email).digest('hex').slice(0, 12),
        email: record.email,
        name: formattedName,
        initials: formattedName.slice(0, 2).toUpperCase(),
        authenticatedAt: Date.now(),
      },
    });
  });

  // 3. Quick Google Sign-In Simulation (Valid email required, no hardcoded default)
  app.post('/api/auth/google', (req: Request, res: Response) => {
    const { email, name } = req.body;
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address to sign in with Google.' });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const rawName = (name && typeof name === 'string' && name.trim()) ? name.trim() : cleanEmail.split('@')[0];
    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    return res.json({
      success: true,
      user: {
        id: crypto.createHash('md5').update(cleanEmail).digest('hex').slice(0, 12),
        email: cleanEmail,
        name: formattedName,
        initials: formattedName.slice(0, 2).toUpperCase() || 'US',
        provider: 'google',
        authenticatedAt: Date.now(),
      },
    });
  });

  // 4. Live Active Users & Connected Peers Directory (Who and how many users are in it)
  app.get('/api/users/active', (_req: Request, res: Response) => {
    const allUsers: Array<{
      id: string;
      name: string;
      email?: string;
      deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
      deviceName: string;
      roomId: string;
      joinedAt: number;
      lastActive: number;
      status: 'active' | 'idle' | 'online';
    }> = [];

    const now = Date.now();
    rooms.forEach((roomPeers, rId) => {
      roomPeers.forEach((p) => {
        if (p.ws.readyState === WebSocket.OPEN) {
          const isRecentlyActive = now - p.lastActive < 45000;
          allUsers.push({
            id: p.id,
            name: p.userName || (p.userEmail ? p.userEmail.split('@')[0] : p.deviceName),
            email: p.userEmail || undefined,
            deviceType: p.deviceType,
            deviceName: p.deviceName,
            roomId: rId,
            joinedAt: p.joinedAt,
            lastActive: p.lastActive,
            status: isRecentlyActive ? 'active' : 'online',
          });
        }
      });
    });

    return res.json({
      success: true,
      totalOnlineUsers: allUsers.length,
      totalRooms: rooms.size,
      users: allUsers,
      timestamp: now,
    });
  });

  // 4. Room Info & Active Status Check
  app.get('/api/room/:roomId', (req: Request, res: Response) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);
    if (!room) {
      return res.json({ exists: false, peerCount: 0 });
    }
    return res.json({
      exists: true,
      peerCount: room.size,
      peers: Array.from(room.values()).map(p => ({
        id: p.id,
        deviceName: p.deviceName,
        deviceType: p.deviceType,
      })),
    });
  });

  // In-memory feedback store
  const feedbackList: any[] = [];

  // 5. Submit Suggestion, Feedback, Rating & Evaluation data (recorded securely)
  app.post('/api/feedback', (req: Request, res: Response) => {
    const { rating, category, feedbackText, userEmail, userName, deviceInfo, transferStats } = req.body;

    if (!feedbackText || !rating) {
      return res.status(400).json({ error: 'Rating and feedback message are required.' });
    }

    const submission = {
      id: crypto.randomUUID(),
      targetRecipient: 'feedback@beamdrop.app',
      rating: Number(rating),
      category: category || 'suggestion',
      feedbackText: String(feedbackText).trim(),
      userEmail: userEmail || 'anonymous',
      userName: userName || 'Anonymous User',
      deviceInfo: deviceInfo || 'Not specified',
      transferStats: transferStats || null,
      submittedAt: Date.now(),
      status: 'dispatched_to_recipient',
    };

    feedbackList.unshift(submission);

    console.log(`[BeamDrop Feedback] New submission recorded:`, {
      from: submission.userEmail,
      rating: submission.rating,
      category: submission.category,
      textLength: submission.feedbackText.length,
    });

    return res.json({
      success: true,
      message: 'Thank you! Your feedback and evaluation data have been successfully recorded.',
      submissionId: submission.id,
      recipient: 'feedback@beamdrop.app',
    });
  });

  // 6. Get submissions for evaluation display / verification
  app.get('/api/feedback', (_req: Request, res: Response) => {
    return res.json({
      recipient: 'khankaifcom551@gmail.com',
      totalSubmissions: feedbackList.length,
      submissions: feedbackList.slice(0, 50),
    });
  });

  // 7. System Health Check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'active',
      timestamp: Date.now(),
      activeRooms: rooms.size,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });


  // Attach Vite middleware in development; serve dist in production
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[BeamDrop] Server listening on http://0.0.0.0:${PORT} (env: ${isProd ? 'prod' : 'dev'})`);
  });
}

bootstrap().catch((err) => {
  console.error('[BeamDrop] Failed to start server:', err);
  process.exit(1);
});
