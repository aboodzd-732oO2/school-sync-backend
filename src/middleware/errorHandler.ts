import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err.message);

  // body-parser يرمي خطأ بنوع 'entity.too.large' عند تجاوز الحد
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'حجم الطلب كبير جداً' });
  }

  // JSON parse error
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'صيغة JSON غير صحيحة' });
  }

  res.status(err.status || 500).json({ success: false, error: err.message || 'خطأ في الخادم' });
}
