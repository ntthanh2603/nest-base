import { LoggerService } from '@/commons/logger/logger.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Kafka,
  Producer,
  Consumer,
  EachMessageHandler,
  EachBatchHandler,
  logLevel,
  Message,
} from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new LoggerService(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Consumer[] = [];

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('KAFKA_HOST', 'localhost');
    const port = this.configService.get<string>('KAFKA_PORT', '9092');
    const brokers = [`${host}:${port}`];
    const clientId = this.configService.get<string>(
      'KAFKA_CLIENT_ID',
      'nest-base',
    );

    this.kafka = new Kafka({
      clientId,
      brokers,
      logLevel: logLevel.ERROR,
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.logger.log('Kafka Producer connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect Kafka Producer', error);
    }
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    for (const consumer of this.consumers) {
      try {
        await consumer.stop();
        await consumer.disconnect();
      } catch (err) {
        this.logger.error('Error during consumer shutdown', err);
      }
    }
    this.logger.log('All Kafka connections closed');
  }

  /**
   * Send messages to a Kafka topic
   * Supports both raw payloads and KafkaJS Message objects (key, headers, etc.)
   */
  async produce(
    topic: string,
    messages: (Record<string, unknown> | Message)[],
  ) {
    try {
      await this.producer.send({
        topic,
        acks: -1, // Wait for all replicas to acknowledge
        messages: messages.map((m) => {
          if (m && typeof m === 'object' && 'value' in m) {
            const message = m as Message;
            return {
              ...message,
              value:
                typeof message.value === 'string' ||
                Buffer.isBuffer(message.value)
                  ? message.value
                  : JSON.stringify(message.value),
            };
          }
          return {
            value: typeof m === 'string' ? m : JSON.stringify(m),
          };
        }),
      });
    } catch (error) {
      this.logger.error(`Failed to produce message to topic ${topic}`, error);
      throw error;
    }
  }

  /**
   * Create a consumer and subscribe to a topic
   */
  async consume(topic: string, groupId: string, onMessage: EachMessageHandler) {
    const consumer = this.kafka.consumer({
      groupId,
      retry: { initialRetryTime: 100, retries: 8 },
    });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
      eachMessage: onMessage,
    });
    this.consumers.push(consumer);
    return consumer;
  }

  /**
   * Create a batch consumer and subscribe to a topic
   */
  async consumeBatch(
    topic: string,
    groupId: string,
    onBatch: EachBatchHandler,
  ) {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
      eachBatch: onBatch,
    });
    this.consumers.push(consumer);
    return consumer;
  }
}
