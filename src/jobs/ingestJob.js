import logger from '../config/logger.js';
import { runIngestionPipeline } from '../services/ingestion/index.js';

let isRunning = false;

export async function executeIngestJob() {
  if (isRunning) {
    logger.warn('Ingestion job is already running. Skipping execution to avoid overlap.');
    return;
  }

  isRunning = true;
  logger.info('[SCHEDULER] Triggering Ingestion job execution...');

  try {
    const start = Date.now();
    const count = await runIngestionPipeline();
    const duration = Date.now() - start;
    logger.info('[SCHEDULER] Ingestion job finished successfully in %dms. Added %d new items.', duration, count);
  } catch (error) {
    logger.error('[SCHEDULER] Ingestion job execution failed: %s', error.message);
  } finally {
    isRunning = false;
  }
}
