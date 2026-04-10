import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3005',
};
