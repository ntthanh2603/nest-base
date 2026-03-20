import { LoggerService } from '@/commons/logger/logger.service';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new LoggerService(SearchService.name);
  private client: Client;

  constructor(private readonly configService: ConfigService) {
    /**
     * Initialize OpenSearch client.
     * Use OPENSEARCH_HOST, OPENSEARCH_PORT, OPENSEARCH_ADMIN_USER, OPENSEARCH_ADMIN_PASSWORD from .env
     */
    const host = this.configService.get<string>('OPENSEARCH_HOST', 'localhost');
    const port = this.configService.get<string>('OPENSEARCH_PORT', '9200');
    const protocol = this.configService.get<string>(
      'OPENSEARCH_PROTOCOL',
      'http',
    );
    const user = this.configService.get<string>(
      'OPENSEARCH_ADMIN_USER',
      'admin',
    );
    const password = this.configService.get<string>(
      'OPENSEARCH_ADMIN_PASSWORD',
      'admin',
    );

    this.client = new Client({
      node: `${protocol}://${user}:${password}@${host}:${port}`,
      ssl: {
        rejectUnauthorized: false, // For local development with self-signed certs
      },
    });
  }

  async onModuleInit() {
    try {
      const { body } = await this.client.cluster.health();
      this.logger.log(`OpenSearch cluster health: ${body.status}`);
    } catch (error) {
      this.logger.error('Failed to connect to OpenSearch', error);
    }
  }

  /**
   * Index a single document
   */
  async indexDocument(index: string, id: string, document: Record<string, unknown>) {
    try {
      return await this.client.index({
        index,
        id,
        body: document,
        refresh: true,
      });
    } catch (error) {
      this.logger.error(
        `Failed to index document in ${index} (ID: ${id})`,
        error,
      );
      throw error;
    }
  }

  /**
   * Universal search method
   */
  async search(index: string, query: Record<string, unknown>) {
    try {
      const result = await this.client.search({
        index,
        body: query,
      });
      return result.body;
    } catch (error) {
      this.logger.error(`Search query failed on index ${index}`, error);
      throw error;
    }
  }

  /**
   * Delete a document by ID
   */
  async deleteDocument(index: string, id: string) {
    try {
      return await this.client.delete({
        index,
        id,
      });
    } catch (error) {
      this.logger.error(
        `Failed to delete document in ${index} (ID: ${id})`,
        error,
      );
      throw error;
    }
  }

  /**
   * Perform bulk operations
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async bulk(operations: any[]) {
    try {
      const { body } = await this.client.bulk({ body: operations });
      if (body.errors) {
        this.logger.warn('Bulk operations completed with some errors');
      }
      return body;
    } catch (error) {
      this.logger.error('Bulk operation failed', error);
      throw error;
    }
  }

  /**
   * Check if an index exists
   */
  async indexExists(index: string) {
    const { body } = await this.client.indices.exists({ index });
    return body;
  }

  /**
   * Create an index with optional mappings and settings
   */
  async createIndex(index: string, settings?: Record<string, unknown>) {
    try {
      const exists = await this.indexExists(index);
      if (!exists) {
        return await this.client.indices.create({
          index,
          body: settings,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to create index ${index}`, error);
      throw error;
    }
  }

  /**
   * Delete an index
   */
  async deleteIndex(index: string) {
    try {
      const exists = await this.indexExists(index);
      if (exists) {
        return await this.client.indices.delete({ index });
      }
    } catch (error) {
      this.logger.error(`Failed to delete index ${index}`, error);
      throw error;
    }
  }

  /**
   * Get the raw OpenSearch client for advanced operations
   */
  getRawClient() {
    return this.client;
  }
}
