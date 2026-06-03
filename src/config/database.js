import pg from 'pg';
import { config } from './env.js';
import logger from './logger.js';

const { Pool } = pg;

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

export const db = {
  query: async (text, params) => {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query: %s, duration: %dms, rows: %d', text.replace(/\s+/g, ' ').substring(0, 100), duration, res.rowCount);
      return res;
    } catch (error) {
      logger.error('PostgreSQL query execution error: %O. Query: %s', error, text);
      throw error;
    }
  },
  getClient: async () => {
    const client = await pool.connect();
    const query = client.query;
    const release = client.release;
    
    // Set a timeout of 5 seconds to safeguard against leaking clients
    const timeout = setTimeout(() => {
      logger.error('A database client has been checked out for more than 5 seconds!');
      logger.error('The checkout call stack was: %s', new Error().stack);
    }, 5000);
    
    client.query = (...args) => {
      return query.apply(client, args);
    };
    
    client.release = () => {
      clearTimeout(timeout);
      client.query = query;
      client.release = release;
      return release.apply(client);
    };
    
    return client;
  },
  close: async () => {
    await pool.end();
    logger.info('PostgreSQL pool has been closed.');
  }
};
