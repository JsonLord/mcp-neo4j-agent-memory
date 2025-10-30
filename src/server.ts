import express from 'express';
import { Neo4jClient } from './neo4j-client.js';
import { Neo4jServerConfig } from './types.js';
import { handleToolCall } from './handlers/index.js';

export class Neo4jServer {
  private neo4j: Neo4jClient | null;

  constructor(config?: Neo4jServerConfig) {
    this.neo4j = config ? new Neo4jClient(config.uri, config.username, config.password, config.database) : null;
    process.on('SIGINT', async () => {
      await this.close();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
        await this.close();
        process.exit(0);
    });
  }

  async start(): Promise<void> {
    const app = express();
    app.use(express.json());
    const port = process.env.PORT || 3000;

    app.get('/health-check', (_req, res) => {
      res.status(200).json({ status: 'online', message: 'Neo4j MCP Server is running' });
    });

    app.get('/', (_req, res) => {
        res.status(200).json({ status: 'online', message: 'Neo4j MCP Server is running' });
    });

    app.post('/mcp', async (req, res) => {
      if (!this.neo4j) {
        return res.status(500).json({
          content: [
            {
              type: 'text',
              text: 'Neo4j connection not configured. Please set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD environment variables.',
            },
          ],
          isError: true,
        });
      }
      try {
        const { name, arguments: args } = req.body;
        if (!name || args === undefined) {
          return res.status(400).json({
            content: [{
              type: 'text',
              text: 'Bad Request: "name" and "arguments" are required in the request body.'
            }],
            isError: true,
          });
        }
        const result = await handleToolCall(name, args, this.neo4j);
        res.status(200).json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        res.status(500).json({
            content: [{
                type: 'text',
                text: message,
            }],
            isError: true,
        });
      }
    });

    app.listen(port, () => {
      console.error(`Neo4j MCP server running on http://localhost:${port}`);
    });
  }

  async close(): Promise<void> {
    if (this.neo4j) {
      console.error('Closing Neo4j connection...');
      await this.neo4j.close();
      console.error('Neo4j connection closed.');
    }
  }
}
