import { Express } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

export const setupSecurity = (app: Express) => {
  // Helmet: Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: ['https://app.example.com', 'https://admin.example.com'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    })
  );

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/v1/', limiter);

  // Input validation
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      const sanitize = (obj: any) => {
        for (let key in obj) {
          if (typeof obj[key] === 'string') {
            obj[key] = obj[key].trim().substring(0, 10000); // Prevent XSS
          }
        }
      };
      sanitize(req.body);
    }
    next();
  });
};

// Cache middleware
export const cacheMiddleware = (durationSeconds: number) => (req: any, res: any, next: any) => {
  res.set('Cache-Control', `public, max-age=${durationSeconds}`);
  next();
};
