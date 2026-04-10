import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import requestRoutes from './routes/request.routes';
import warehouseRoutes from './routes/warehouse.routes';
import inventoryRoutes from './routes/inventory.routes';
import reportRoutes from './routes/report.routes';
import lookupRoutes from './routes/lookup.routes';

const app = express();

// Middleware
app.use(cors({
  origin: env.FRONTEND_URL === '*' ? true : env.FRONTEND_URL.split(',').map(s => s.trim()),
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/requests', requestRoutes);
app.use('/api/v1/warehouse', warehouseRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1', lookupRoutes);

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Error handler
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});

export default app;
