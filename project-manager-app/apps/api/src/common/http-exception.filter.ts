import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { SemseLoggerService } from "../infrastructure/observability/semse-logger.service.js";
import { resolveRequestId } from "./request-id.js";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: SemseLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const requestId = resolveRequestId(request?.headers ?? {});

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      this.logger.warn("http_exception", {
        status,
        requestId,
        path: request?.url,
        method: request?.method
      });

      response.status(status).send({
        requestId,
        error: {
          status,
          message: payload
        }
      });
      return;
    }

    const error = exception instanceof Error
      ? {
          name: exception.name,
          message: exception.message,
          stack: exception.stack
        }
      : {
          value: String(exception)
        };

    this.logger.error("http_unhandled_exception", {
      requestId,
      path: request?.url,
      method: request?.method,
      error
    });
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      requestId,
      error: {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal server error"
      }
    });
  }
}
