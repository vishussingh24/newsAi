import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './config/logger.js';
import { config } from './config/env.js';
import { db } from './config/database.js';
import { initScheduler } from './jobs/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkDatabaseSchema() {
  logger.info('Verifying database schema initialized...');
  try {
    // Check if table 'sources' exists
    const checkTable = await db.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables 
         WHERE table_name = 'sources'
       );`
    );

    const exists = checkTable.rows[0].exists;
    if (!exists) {
      logger.info('Database schema not found. Initializing from init.sql...');
      const sqlPath = path.join(__dirname, 'database', 'init.sql');
      const sql = await fs.readFile(sqlPath, 'utf-8');
      
      // Execute the init schema SQL script
      await db.query(sql);
      logger.info('Database schema successfully initialized.');
    } else {
      logger.info('Database tables verified. Schema matches specifications.');
    }
  } catch (error) {
    logger.error('Critical database initialization failure: %s', error.message);
    throw error;
  }
}

async function startServer() {
  // 1. Check and build database schemas
  await checkDatabaseSchema();

  // 2. Start Cron Scheduler
  initScheduler();

  // 3. Launch Health status dashboard API
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health' || req.url === '/') {
      try {
        // Fetch diagnostic counts for dashboard
        const sourceCount = await db.query('SELECT COUNT(*) FROM sources');
        const rawCount = await db.query('SELECT COUNT(*), status FROM raw_articles GROUP BY status');
        const processedCount = await db.query('SELECT COUNT(*), is_valid FROM processed_articles GROUP BY is_valid');

        const metrics = {
          status: 'healthy',
          timestamp: new Date(),
          uptime: process.uptime(),
          env: config.nodeEnv,
          sources: parseInt(sourceCount.rows[0]?.count || '0', 10),
          rawArticles: rawCount.rows.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count, 10);
            return acc;
          }, { pending: 0, processed: 0, failed: 0 }),
          processedArticles: processedCount.rows.reduce((acc, row) => {
            const key = row.is_valid ? 'valid' : 'invalid';
            acc[key] = parseInt(row.count, 10);
            return acc;
          }, { valid: 0, invalid: 0 }),
          schedules: config.cron
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metrics, null, 2));
      } catch (err) {
        logger.error('Health API error: %s', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'unhealthy', error: err.message }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.listen(config.port, () => {
    logger.info('AI News Aggregator API active on port: %d', config.port);
    logger.info('Health Diagnostic Dashboard URL: http://localhost:%d/health', config.port);
  });

  // Graceful termination handler
  const shutdown = async (signal) => {
    logger.info('Received %s. Commencing graceful shutdown...', signal);
    server.close(() => {
      logger.info('HTTP Server closed.');
    });
    await db.close();
    logger.info('Shutdown workflow concluded.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(err => {
  logger.error('Process bootstrap failed: %O', err);
  process.exit(1);
});
