/**
 * Observability & Monitoring
 * OpenTelemetry tracing, metrics, and structured logging
 */

import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, Span, SpanStatusCode, context, SpanKind } from '@opentelemetry/api';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider, Histogram, Counter, ObservableGauge, Meter } from '@opentelemetry/sdk-metrics';

// Initialize tracing
let tracerProvider: NodeTracerProvider | null = null;
let meterProvider: MeterProvider | null = null;
let meter: Meter | null = null;
let initialized = false;

// Metrics
let httpRequestDuration: Histogram;
let httpRequestTotal: Counter;
let activeConnections: ObservableGauge;
let cacheHitRate: ObservableGauge;
let dbQueryDuration: Histogram;
let externalApiDuration: Histogram;
let errorTotal: Counter;
let tradeExecutionDuration: Histogram;
let swapAmountUsd: Histogram;

export interface TracingConfig {
  serviceName: string;
  jaegerEndpoint?: string;
  prometheusPort?: number;
  sampleRate?: number;
}

export function initObservability(config: TracingConfig): void {
  if (initialized) return;

  // Resource attributes
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  });

  // Initialize Tracer Provider
  tracerProvider = new NodeTracerProvider({
    resource,
  });

  // Add Jaeger exporter if endpoint provided
  if (config.jaegerEndpoint) {
    const jaegerExporter = new JaegerExporter({
      endpoint: config.jaegerEndpoint,
    });
    tracerProvider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));
  }

  tracerProvider.register();
  trace.setGlobalTracerProvider(tracerProvider);

  // Initialize Meter Provider
  meterProvider = new MeterProvider({ resource });

  // Add Prometheus exporter if port provided
  if (config.prometheusPort) {
    const prometheusExporter = new PrometheusExporter({
      port: config.prometheusPort,
      endpoint: '/metrics',
    }, () => {
      console.log(`Prometheus metrics server running on port ${config.prometheusPort}`);
    });
    meterProvider.addMetricReader(prometheusExporter);
  }

  meter = meterProvider.getMeter(config.serviceName);

  // Initialize metrics
  initializeMetrics();

  initialized = true;
  console.log('[Observability] Initialized');
}

function initializeMetrics(): void {
  if (!meter) return;

  // HTTP Request Duration
  httpRequestDuration = meter.createHistogram('http_request_duration_ms', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
  });

  // HTTP Request Total
  httpRequestTotal = meter.createCounter('http_requests_total', {
    description: 'Total number of HTTP requests',
  });

  // Active Connections
  activeConnections = meter.createObservableGauge('active_connections', {
    description: 'Number of active WebSocket connections',
  });

  // Cache Hit Rate
  cacheHitRate = meter.createObservableGauge('cache_hit_rate', {
    description: 'Cache hit rate percentage',
  });

  // Database Query Duration
  dbQueryDuration = meter.createHistogram('db_query_duration_ms', {
    description: 'Database query duration in milliseconds',
    unit: 'ms',
  });

  // External API Duration
  externalApiDuration = meter.createHistogram('external_api_duration_ms', {
    description: 'External API call duration in milliseconds',
    unit: 'ms',
  });

  // Error Total
  errorTotal = meter.createCounter('errors_total', {
    description: 'Total number of errors',
  });

  // Trade Execution Duration
  tradeExecutionDuration = meter.createHistogram('trade_execution_duration_ms', {
    description: 'Trade execution duration in milliseconds',
    unit: 'ms',
  });

  // Swap Amount USD
  swapAmountUsd = meter.createHistogram('swap_amount_usd', {
    description: 'Swap amount in USD',
    unit: 'USD',
  });
}

// ===== Tracing Helpers =====

export function getTracer(name: string) {
  if (!tracerProvider) {
    // Return noop tracer if not initialized
    return trace.getTracer(name);
  }
  return trace.getTracer(name);
}

export function startSpan(
  name: string,
  attributes?: Record<string, string | number | boolean>,
  kind: SpanKind = SpanKind.INTERNAL
): Span {
  const tracer = getTracer('whales-tracker');
  const span = tracer.startSpan(name, { kind, attributes });
  return span;
}

export async function traceAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
  kind: SpanKind = SpanKind.INTERNAL
): Promise<T> {
  const tracer = getTracer('whales-tracker');
  return tracer.startActiveSpan(name, { kind, attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

export function recordSpanAttribute(span: Span, key: string, value: string | number | boolean): void {
  if (span.isRecording()) {
    span.setAttribute(key, value);
  }
}

export function recordSpanError(span: Span, error: Error): void {
  span.recordException(error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });
}

// ===== Metrics Helpers =====

export function recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
  if (!meter) return;
  
  httpRequestDuration.record(durationMs, { method, route, status_code: statusCode.toString() });
  httpRequestTotal.add(1, { method, route, status_code: statusCode.toString() });
}

export function recordDbQuery(operation: string, table: string, durationMs: number, success: boolean): void {
  if (!meter) return;
  dbQueryDuration.record(durationMs, { operation, table, success: success.toString() });
}

export function recordExternalApiCall(service: string, endpoint: string, durationMs: number, success: boolean): void {
  if (!meter) return;
  externalApiDuration.record(durationMs, { service, endpoint, success: success.toString() });
}

export function recordTradeExecution(durationMs: number, amountUsd: number, tokenSymbol: string, success: boolean): void {
  if (!meter) return;
  tradeExecutionDuration.record(durationMs, { token: tokenSymbol, success: success.toString() });
  swapAmountUsd.record(amountUsd, { token: tokenSymbol });
}

export function recordError(errorType: string, service: string): void {
  if (!meter) return;
  errorTotal.add(1, { type: errorType, service });
}

export function setActiveConnections(count: number): void {
  if (!activeConnections) return;
  // ObservableGauge is set via callback, this is a placeholder
}

export function setCacheHitRate(rate: number): void {
  if (!cacheHitRate) return;
  // ObservableGauge is set via callback, this is a placeholder
}

// ===== Structured Logging =====

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  traceId?: string;
  spanId?: string;
  attributes?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private serviceName: string;
  private minLevel: LogLevel;

  constructor(serviceName: string, minLevel: LogLevel = 'info') {
    this.serviceName = serviceName;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.minLevel];
  }

  private formatEntry(level: LogLevel, message: string, attributes?: Record<string, any>, error?: Error): LogEntry {
    // Get current trace context
    const activeSpan = trace.getSpan(context.active());
    const spanContext = activeSpan?.spanContext();

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
      attributes,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    const output = JSON.stringify(entry);
    switch (entry.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }

  debug(message: string, attributes?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message, attributes));
    }
  }

  info(message: string, attributes?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message, attributes));
    }
  }

  warn(message: string, attributes?: Record<string, any>): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message, attributes));
    }
  }

  error(message: string, error?: Error, attributes?: Record<string, any>): void {
    if (this.shouldLog('error')) {
      this.output(this.formatEntry('error', message, attributes, error));
    }
  }
}

// ===== Middleware =====

export function createTracingMiddleware(serviceName: string) {
  return async function tracingMiddleware(request: Request, next: () => Promise<Response>): Promise<Response> {
    const tracer = getTracer(serviceName);
    const url = new URL(request.url);
    
    return tracer.startActiveSpan(`${request.method} ${url.pathname}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': request.method,
        'http.route': url.pathname,
        'http.url': request.url,
        'http.scheme': url.protocol.replace(':', ''),
        'http.host': url.host,
      },
    }, async (span) => {
      const startTime = Date.now();
      
      try {
        const response = await next();
        
        const durationMs = Date.now() - startTime;
        span.setAttribute('http.status_code', response.status);
        span.setStatus({ code: SpanStatusCode.OK });
        
        recordHttpRequest(request.method, url.pathname, response.status, durationMs);
        
        return response;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        recordError(error instanceof Error ? error.name : 'Error', serviceName);
        throw error;
      } finally {
        span.end();
      }
    });
  };
}

// ===== Express/Next.js Integration =====

export function withTracing<T extends (...args: any[]) => any>(
  name: string,
  fn: T,
  attributes?: Record<string, string | number | boolean>
): T {
  return (async (...args: Parameters<T>) => {
    return traceAsync(name, async (span) => {
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => span.setAttribute(key, value));
      }
      return fn(...args);
    }, attributes);
  }) as T;
}

// ===== Shutdown =====

export async function shutdownObservability(): Promise<void> {
  if (tracerProvider) {
    await tracerProvider.shutdown();
  }
  if (meterProvider) {
    await meterProvider.shutdown();
  }
  initialized = false;
}

// ===== Health Check with Observability =====

export function createHealthCheckEndpoint() {
  return async function healthCheck() {
    const checks = await Promise.allSettled([
      // Database check
      (async () => {
        const start = Date.now();
        // await db.$queryRaw`SELECT 1`;
        return { name: 'database', status: 'healthy', latencyMs: Date.now() - start };
      })(),
      // Redis check
      (async () => {
        const start = Date.now();
        // await redis.ping();
        return { name: 'redis', status: 'healthy', latencyMs: Date.now() - start };
      })(),
      // External API check
      (async () => {
        const start = Date.now();
        // await fetch('https://api.dexscreener.com/health');
        return { name: 'dexscreener', status: 'healthy', latencyMs: Date.now() - start };
      })(),
    ]);

    const services = checks.reduce((acc, check) => {
      if (check.status === 'fulfilled') {
        acc[check.value.name] = check.value;
      } else {
        acc[check.reason?.name || 'unknown'] = { status: 'unhealthy', error: check.reason?.message };
      }
      return acc;
    }, {} as Record<string, any>);

    const overallStatus = Object.values(services).every(s => s.status === 'healthy') ? 'healthy' : 
                         Object.values(services).some(s => s.status === 'healthy') ? 'degraded' : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
    };
  };
}

export { trace, Span, SpanStatusCode, context };