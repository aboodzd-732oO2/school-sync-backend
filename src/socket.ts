import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './config/env';

let io: Server | null = null;

interface JwtPayload {
  userId: number;
  userType: 'admin' | 'institution' | 'warehouse';
}

export function initSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL === '*' ? true : env.FRONTEND_URL.split(',').map(s => s.trim()),
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('auth token مطلوب'));
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      (socket.data as any).userId = payload.userId;
      (socket.data as any).userType = payload.userType;
      return next();
    } catch {
      return next(new Error('رمز غير صالح'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket.data as any).userId as number | undefined;
    if (userId) {
      socket.join(`user:${userId}`);
    }
  });

  return io;
}

export function emitToUser(userId: number, event: string, data: unknown) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToUsers(userIds: Array<number | null | undefined>, event: string, data: unknown) {
  if (!io) return;
  for (const uid of userIds) {
    if (typeof uid === 'number') io.to(`user:${uid}`).emit(event, data);
  }
}

export function getIO(): Server | null {
  return io;
}
