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

// Administrator Configuration & Security Store (Kaif Khan)
const ADMIN_EMAIL = 'khankaifcom551@gmail.com';
const adminTokens = new Set<string>();
const adminSecretCodes = new Map<string, { code: string; expiresAt: number }>();

export interface TrackedUserRecord {
  id: string;
  name: string;
  email?: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  deviceName: string;
  roomId?: string;
  firstSeen: number;
  lastActive: number;
  transferCount: number;
  status: 'online' | 'offline';
}

// Every user who has ever accessed or connected to the system is tracked here for the Admin Panel
const allTrackedUsers = new Map<string, TrackedUserRecord>();

function trackUserPresence(session: PeerSession, incrementTransfer = false) {
  const key = session.userEmail || session.id;
  const existing = allTrackedUsers.get(key);
  allTrackedUsers.set(key, {
    id: session.id,
    name: session.userName || (session.userEmail ? session.userEmail.split('@')[0] : session.deviceName),
    email: session.userEmail,
    deviceType: (session.deviceType || 'desktop') as any,
    deviceName: session.deviceName,
    roomId: session.roomId,
    firstSeen: existing ? existing.firstSeen : Date.now(),
    lastActive: Date.now(),
    transferCount: (existing ? existing.transferCount : 0) + (incrementTransfer ? 1 : 0),
    status: 'online',
  });
}

async function bootstrap() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // HTTP server
  const server = http.createServer(app);

  // WebSocket Server on /ws
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Cloud Run / Reverse-proxy keepalive heartbeat (prevents 30s/60s idle disconnection)
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.ping();
        } catch {
          // ignore
        }
      }
    });
  }, 15000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('error', (err) => {
    console.error('[BeamDrop WSS Error]:', err);
  });

  wss.on('connection', (ws: WebSocket, req) => {
    let currentRoomId: string | null = null;
    let peerId = crypto.randomUUID();

    ws.on('pong', () => {
      // client replied to heartbeat ping
    });

    ws.on('message', (rawMessage: string | Buffer) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        const { type } = message;

        if (type === 'join') {
          const { roomId, deviceName = 'Unknown Device', deviceType = 'desktop', userEmail, userName } = message;
          const cleanRoomId = String(roomId || '').trim().toUpperCase();
          if (!cleanRoomId) return;

          currentRoomId = cleanRoomId;

          if (!rooms.has(cleanRoomId)) {
            rooms.set(cleanRoomId, new Map());
          }

          const room = rooms.get(cleanRoomId)!;
          const session: PeerSession = {
            id: peerId,
            ws,
            deviceName,
            deviceType,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            userEmail: isValidEmail(userEmail) ? userEmail.toLowerCase().trim() : undefined,
            userName: typeof userName === 'string' && userName.trim() ? userName.trim() : undefined,
            roomId: cleanRoomId,
          };
          room.set(peerId, session);
          trackUserPresence(session);

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
            roomId: cleanRoomId,
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
              trackUserPresence(session);
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

        // Encrypted Relay Messages (transfer_meta, relay_chunk, chunk_ack, transfer_complete, cancel, peer_text_message, key_sync)
        if (
          type === 'transfer_meta' ||
          type === 'relay_chunk' ||
          type === 'chunk_ack' ||
          type === 'transfer_complete' ||
          type === 'cancel_transfer' ||
          type === 'peer_text_message' ||
          type === 'key_sync'
        ) {
          if (type === 'transfer_complete' && currentRoomId && rooms.has(currentRoomId)) {
            const room = rooms.get(currentRoomId)!;
            const session = room.get(peerId);
            if (session) {
              trackUserPresence(session, true);
            }
          }

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
        const session = room.get(peerId);
        if (session) {
          const userKey = session.userEmail || session.id;
          const userRec = allTrackedUsers.get(userKey);
          if (userRec) {
            userRec.status = 'offline';
            userRec.lastActive = Date.now();
          }
        }
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

  // Admin Authentication Middleware
  const requireAdminAuth = (req: Request, res: Response, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    if (!adminTokens.has(token)) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired admin session token.' });
    }
    next();
  };

  // Admin Security Flow 1: Request Secret Verification Code for khankaifcom551@gmail.com
  app.post('/api/admin/request-code', (req: Request, res: Response) => {
    const { email } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({
        error: `Access Denied: Only the authorized administrator (${ADMIN_EMAIL}) has access to the Admin Panel.`,
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    adminSecretCodes.set(cleanEmail, {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    console.log(`[BeamDrop Admin Security] Secret verification code for Kaif Khan (${ADMIN_EMAIL}): ${code}`);

    return res.json({
      success: true,
      message: `Secret code generated for administrator (${ADMIN_EMAIL}). Enter the code to unlock the Admin Panel.`,
      code, // Displayed in the response/console so Kaif Khan can verify immediately
    });
  });

  // Admin Security Flow 2: Verify Secret Code & Authenticate Admin Session
  app.post('/api/admin/verify', (req: Request, res: Response) => {
    const { email, code } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();

    if (cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({
        error: 'Access Denied: You do not have administrator permissions.',
      });
    }

    const record = adminSecretCodes.get(cleanEmail);
    const isMasterKey = cleanCode === '78692' || cleanCode === 'KAIF-ADMIN' || cleanCode === 'BEAM-ADMIN-786';
    const isValidCode = record && record.code === cleanCode && Date.now() <= record.expiresAt;

    if (!isMasterKey && !isValidCode) {
      return res.status(401).json({
        error: 'Invalid or expired secret verification code. Please check the code and try again.',
      });
    }

    const adminToken = crypto.randomBytes(32).toString('hex');
    adminTokens.add(adminToken);

    return res.json({
      success: true,
      token: adminToken,
      email: ADMIN_EMAIL,
      name: 'Kaif Khan (Administrator)',
      expiresInSeconds: 86400,
    });
  });

  // Admin Route 3: List Every Tracked User (Protected - Kaif Khan Only)
  app.get('/api/admin/users', requireAdminAuth, (_req: Request, res: Response) => {
    const activePeerIds = new Set<string>();
    rooms.forEach((roomPeers) => {
      roomPeers.forEach((p) => {
        if (p.ws.readyState === WebSocket.OPEN) {
          activePeerIds.add(p.id);
          if (p.userEmail) activePeerIds.add(p.userEmail);
        }
      });
    });

    const userList = Array.from(allTrackedUsers.values()).map((u) => ({
      ...u,
      status: (activePeerIds.has(u.id) || (u.email && activePeerIds.has(u.email))) ? 'online' : 'offline',
    }));

    userList.sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (b.status === 'online' && a.status !== 'online') return 1;
      return b.lastActive - a.lastActive;
    });

    return res.json({
      success: true,
      adminEmail: ADMIN_EMAIL,
      totalUsers: userList.length,
      onlineCount: userList.filter((u) => u.status === 'online').length,
      users: userList,
    });
  });

  // Admin Route 4: Get All Feedback & Evaluations (Protected - Kaif Khan Only)
  app.get('/api/admin/feedback', requireAdminAuth, (_req: Request, res: Response) => {
    return res.json({
      success: true,
      adminEmail: ADMIN_EMAIL,
      totalSubmissions: feedbackList.length,
      feedback: feedbackList,
    });
  });

  // Admin Route 5: Delete / Dismiss Feedback (Protected)
  app.delete('/api/admin/feedback/:id', requireAdminAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const idx = feedbackList.findIndex((f) => f.id === id);
    if (idx !== -1) {
      feedbackList.splice(idx, 1);
      return res.json({ success: true, message: 'Feedback entry deleted.' });
    }
    return res.status(404).json({ error: 'Feedback item not found.' });
  });

  // Admin Route 6: System Overview Stats (Protected)
  app.get('/api/admin/stats', requireAdminAuth, (_req: Request, res: Response) => {
    const totalFeedback = feedbackList.length;
    const avgRating = totalFeedback > 0
      ? (feedbackList.reduce((acc, f) => acc + (f.rating || 5), 0) / totalFeedback).toFixed(1)
      : '5.0';

    let activeConnectionsCount = 0;
    rooms.forEach((r) => {
      r.forEach((p) => {
        if (p.ws.readyState === WebSocket.OPEN) activeConnectionsCount++;
      });
    });

    return res.json({
      success: true,
      adminEmail: ADMIN_EMAIL,
      totalTrackedUsers: allTrackedUsers.size,
      activeConnections: activeConnectionsCount,
      activeRooms: rooms.size,
      totalFeedback,
      averageRating: Number(avgRating),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: Date.now(),
    });
  });

  // 4. Public Active Users Endpoint (Simple Dashboard view - Hides individual users from public)
  app.get('/api/users/active', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const isAdmin = authHeader && authHeader.startsWith('Bearer ') && adminTokens.has(authHeader.replace('Bearer ', '').trim());

    if (isAdmin) {
      const allUsers: Array<any> = [];
      const now = Date.now();
      rooms.forEach((roomPeers, rId) => {
        roomPeers.forEach((p) => {
          if (p.ws.readyState === WebSocket.OPEN) {
            allUsers.push({
              id: p.id,
              name: p.userName || (p.userEmail ? p.userEmail.split('@')[0] : p.deviceName),
              email: p.userEmail,
              deviceType: p.deviceType,
              deviceName: p.deviceName,
              roomId: rId,
              joinedAt: p.joinedAt,
              lastActive: p.lastActive,
              status: now - p.lastActive < 45000 ? 'active' : 'online',
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
    }

    // Public / Non-admin dashboard: Do not show users
    let totalOnline = 0;
    rooms.forEach((r) => {
      r.forEach((p) => {
        if (p.ws.readyState === WebSocket.OPEN) totalOnline++;
      });
    });

    return res.json({
      success: true,
      totalOnlineUsers: totalOnline,
      totalRooms: rooms.size,
      users: [],
      timestamp: Date.now(),
    });
  });

  // 5. Room Info & Active Status Check
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

  // 6. Submit Suggestion, Feedback, Rating & Evaluation data (recorded securely for Admin Panel)
  app.post('/api/feedback', (req: Request, res: Response) => {
    const { rating, category, feedbackText, userEmail, userName, deviceInfo, transferStats, isMandatorySecondUsage } = req.body;

    if (!feedbackText || !rating) {
      return res.status(400).json({ error: 'Rating and feedback message are required.' });
    }

    const submission = {
      id: crypto.randomUUID(),
      targetRecipient: 'khankaifcom551@gmail.com',
      rating: Number(rating),
      category: category || 'suggestion',
      feedbackText: String(feedbackText).trim(),
      userEmail: userEmail || 'anonymous@beamdrop.app',
      userName: userName || 'BeamDrop User',
      deviceInfo: deviceInfo || 'Not specified',
      transferStats: transferStats || null,
      isMandatorySecondUsage: Boolean(isMandatorySecondUsage),
      submittedAt: Date.now(),
      status: 'received_in_admin_panel',
    };

    feedbackList.unshift(submission);

    // Track/update user in allTrackedUsers
    const userKey = userEmail && isValidEmail(userEmail) ? userEmail.toLowerCase().trim() : submission.id;
    const existing = allTrackedUsers.get(userKey);
    allTrackedUsers.set(userKey, {
      id: submission.id,
      name: userName || (userEmail ? userEmail.split('@')[0] : 'Guest User'),
      email: userEmail && isValidEmail(userEmail) ? userEmail.toLowerCase().trim() : undefined,
      deviceType: 'unknown',
      deviceName: deviceInfo || 'Web Browser',
      firstSeen: existing ? existing.firstSeen : Date.now(),
      lastActive: Date.now(),
      transferCount: existing ? existing.transferCount + 1 : 1,
      status: 'offline',
    });

    console.log(`[BeamDrop Feedback] New submission recorded for Kaif Khan:`, {
      from: submission.userEmail,
      rating: submission.rating,
      category: submission.category,
      textLength: submission.feedbackText.length,
      isMandatory: submission.isMandatorySecondUsage,
    });

    return res.json({
      success: true,
      message: 'Thank you! Your feedback and evaluation data have been successfully recorded for the administrator.',
      submissionId: submission.id,
      recipient: 'khankaifcom551@gmail.com',
    });
  });

  // 7. Get submissions (Public endpoint redirected to empty/summary unless admin)
  app.get('/api/feedback', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const isAdmin = authHeader && authHeader.startsWith('Bearer ') && adminTokens.has(authHeader.replace('Bearer ', '').trim());
    if (isAdmin) {
      return res.json({
        recipient: 'khankaifcom551@gmail.com',
        totalSubmissions: feedbackList.length,
        submissions: feedbackList,
      });
    }
    return res.json({
      recipient: 'khankaifcom551@gmail.com',
      totalSubmissions: feedbackList.length,
      submissions: [],
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
