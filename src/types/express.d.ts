import { UserType } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        userType: UserType;
        institutionId?: number | null;
        warehouseId?: number | null;
      };
    }
  }
}

export {};
