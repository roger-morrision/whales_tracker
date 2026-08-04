import pino from 'pino';
import { Request, Response, NextFunction } from 'express';

// Create logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'whales-tracker',
    version: process.env.npm_package_version || '0.2.1',
    environment: process.env.NODE_ENV || 'development',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.secret',
      'req.body.token',
      'req.body.apiKey',
      'req.body.privateKey',
      '*.password',
      '*.secret',
      '*.token',
      '*.apiKey',
      '*.privateKey',
    ],
    censor: '[REDACTED]',
  },
});

// Create child logger for specific contexts
export function createContextLogger(context: Record<string, any>) {
  return logger.child(context);
}

// HTTP request logger middleware (for Express/Next.js API routes)
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  
  // Add request ID to response headers
  res.setHeader('x-request-id', requestId);
  
  const childLogger = logger.child({
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  // Log request
  childLogger.info({ body: sanitizeBody(req.body) }, 'Incoming request');

  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    const duration = Date.now() - start;
    childLogger.info(
      { 
        statusCode: res.statusCode, 
        duration,
        responseSize: JSON.stringify(body).length,
      },
      'Request completed'
    );
    return originalJson(body);
  };

  // Log errors
  res.on('error', (err) => {
    childLogger.error({ err: err.message, stack: err.stack }, 'Response error');
  });

  next();
}

// Sanitize sensitive data from request body
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'privateKey', 'authorization'];
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  }
  
  return sanitized;
}

// Logger for API routes (Next.js App Router)
export function createApiLogger(route: string) {
  return logger.child({ route });
}

// Logger for background jobs
export function createJobLogger(jobName: string) {
  return logger.child({ job: jobName, type: 'background' });
}

// Logger for WebSocket connections
export function createWsLogger(connectionId: string) {
  return logger.child({ connectionId, type: 'websocket' });
}

// Export default logger
export default logger;

// Re-export pino for advanced usage
export { pino };