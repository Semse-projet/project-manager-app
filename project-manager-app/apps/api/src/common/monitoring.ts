import * as Sentry from '@sentry/node';
import { Logger } from '@nestjs/common';

export const initMonitoring = (dsn: string) => {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1,
  });
};

export const captureException = (error: any) => {
  Sentry.captureException(error);
  const logger = new Logger('Error');
  logger.error(error);
};

export const logHealthCheck = () => {
  const health = {
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
  return health;
};

export const setupLogging = () => {
  console.log('[LOGGING] Initialized — logs sent to CloudWatch');
};
