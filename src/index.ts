import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { initSocket } from './socket';

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import requestRoutes from './routes/request.routes';
import warehouseRoutes from './routes/warehouse.routes';
import institutionRoutes from './routes/institution.routes';
import inventoryRoutes from './routes/inventory.routes';
import reportRoutes from './routes/report.routes';
import lookupRoutes from './routes/lookup.routes';
import notificationRoutes from './routes/notification.routes';

const app = express();

// Trust Railway/Netlify/Cloudflare proxy — required for express-rate-limit to read X-Forwarded-For
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: env.FRONTEND_URL === '*' ? true : env.FRONTEND_URL.split(',').map(s => s.trim()),
  credentials: true
}));

// Body parser with size limit (DoS protection)
app.use(express.json({ limit: '1mb' }));

// Brute-force protection on login (يحصي المحاولات الفاشلة فقط)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'محاولات تسجيل دخول كثيرة، حاول لاحقاً' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
app.use('/api/v1/auth/login', loginLimiter);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/requests', requestRoutes);
app.use('/api/v1/warehouse', warehouseRoutes);
app.use('/api/v1/institution', institutionRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1', lookupRoutes);

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Error handler
app.use(errorHandler);

const server = http.createServer(app);
initSocket(server);
server.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});

export default app;
