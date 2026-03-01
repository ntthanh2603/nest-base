import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger, Logger, format, transports } from 'winston';
import type { Logform } from 'winston';
import { generateId } from '../../utils/nanoid-generators';
import * as dayjs from 'dayjs';
import * as chalk from 'chalk';
import * as path from 'path';
import 'winston-daily-rotate-file';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: Logger;
  private consoleOnlyLogger: Logger;

  constructor(private readonly configService: ConfigService) {
    const consoleLogLevel =
      this.configService.get<string>('LOG_LEVEL') ?? 'debug';

    this.logger = createLogger({
      level: 'silly',
      transports: [
        this.createConsoleTransport(consoleLogLevel),
        new transports.DailyRotateFile({
          level: 'info',
          dirname: path.join(process.cwd(), 'logs'),
          filename: 'app-%DATE%.json',
          datePattern: 'YYYY-MM-DD',
          maxSize: '100m',
          format: format.combine(format.timestamp(), format.json()),
        }),
      ],
    });

    this.consoleOnlyLogger = createLogger({
      level: 'silly',
      transports: [this.createConsoleTransport(consoleLogLevel)],
    });
  }

  // Public API — NestLoggerService interface

  log(message: string, context?: string, correlationId?: string) {
    this.emit(this.logger, 'info', message, context, correlationId);
  }

  error(
    message: string,
    trace?: string,
    context?: string,
    correlationId?: string,
  ) {
    this.emit(this.logger, 'error', message, context, correlationId, trace);
  }

  warn(message: string, context?: string, correlationId?: string) {
    this.emit(this.logger, 'warn', message, context, correlationId);
  }

  debug(message: string, context?: string, correlationId?: string) {
    this.emit(this.logger, 'debug', message, context, correlationId);
  }

  verbose(message: string, context?: string, correlationId?: string) {
    this.emit(this.logger, 'verbose', message, context, correlationId);
  }

  // Console-only variants (no file logging)
  logConsoleOnly(message: string, context?: string, correlationId?: string) {
    this.emit(this.consoleOnlyLogger, 'info', message, context, correlationId);
  }

  errorConsoleOnly(message: string, context?: string, correlationId?: string) {
    this.emit(this.consoleOnlyLogger, 'error', message, context, correlationId);
  }

  warnConsoleOnly(message: string, context?: string, correlationId?: string) {
    this.emit(this.consoleOnlyLogger, 'warn', message, context, correlationId);
  }

  /**
   * Single point of emission — eliminates DRY violation across all log methods.
   */
  private emit(
    logger: Logger,
    level: string,
    message: string,
    context?: string,
    correlationId?: string,
    trace?: string,
  ): void {
    const time = dayjs().format('DD/MM/YYYY, h:mm:ss A');
    const logId = generateId();
    logger.log(level, message, {
      context: context || 'App',
      time,
      id: logId,
      ...(trace && { trace }),
      ...(correlationId && { correlationId }),
    });
  }

  /**
   * Creates a reusable console transport — eliminates format duplication.
   */
  private createConsoleTransport(
    level: string,
  ): transports.ConsoleTransportInstance {
    return new transports.Console({
      level,
      format: this.createConsoleFormat(),
    });
  }

  /**
   * Shared console format — defined once, used by both loggers.
   */
  private createConsoleFormat(): Logform.Format {
    return format.combine(
      format.printf((info) => {
        const msg = info.message as string;
        const ctx = info.context as string;
        const level = info.level;
        const time = info.time as string;
        const pid = process.pid;
        const strApp = chalk.green('[Nest]');
        const strPid = chalk.green(`${pid}`);
        const strContext = chalk.yellow(`[${ctx || 'App'}]`);

        const levelColors: Record<string, (s: string) => string> = {
          info: chalk.green,
          error: chalk.red,
          warn: chalk.yellow,
          debug: chalk.magenta,
          verbose: chalk.cyan,
        };

        const colorFn = levelColors[level];
        const formattedLevel = colorFn
          ? colorFn(level === 'info' ? 'LOG' : level.toUpperCase())
          : level.toUpperCase();

        return `${strApp} ${strPid}  - ${time}     ${formattedLevel} ${strContext} ${msg}`;
      }),
    );
  }
}
