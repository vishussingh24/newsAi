import cron from 'node-cron';
import logger from '../config/logger.js';
import { config } from '../config/env.js';
import { executeIngestJob } from './ingestJob.js';
import { executeValidatorJob } from './validatorJob.js';
import { executeEmailJob } from './emailJob.js';

export function initScheduler() {
  logger.info('Initializing job schedules...');

  // 1. Scraping / Ingestion Job
  logger.info('Scheduling Ingestion Job with Cron: "%s"', config.cron.scrape);
  cron.schedule(config.cron.scrape, async () => {
    logger.info('Cron trigger: Ingestion Job started.');
    await executeIngestJob();
  });

  // 2. LLM Validation Job
  logger.info('Scheduling LLM Validation Job with Cron: "%s"', config.cron.verify);
  cron.schedule(config.cron.verify, async () => {
    logger.info('Cron trigger: LLM Validation Job started.');
    await executeValidatorJob();
  });

  // 3. Email Dispatch Job
  logger.info('Scheduling Email Dispatch Job with Cron: "%s"', config.cron.digest);
  cron.schedule(config.cron.digest, async () => {
    logger.info('Cron trigger: Email Dispatch Job started.');
    await executeEmailJob();
  });

  // Proactive Bootstrapping Check
  if (config.nodeEnv !== 'production') {
    logger.info('Development environment detected. Bootstrapping tasks immediately...');
    bootstrapImmediately();
  }
}

async function bootstrapImmediately() {
  // Execute sequentially on start for clean, log-traceable data ingestion flow in development
  try {
    logger.info('=== [DEVELOPMENT] Starting Sequential Bootstrap Pipeline ===');
    
    logger.info('Step 1/3: Running initial web ingestion...');
    await executeIngestJob();
    
    logger.info('Step 2/3: Running initial LLM classifications...');
    await executeValidatorJob();
    
    logger.info('Step 3/3: Running initial email digest simulations...');
    await executeEmailJob();
    
    logger.info('=== [DEVELOPMENT] Pipeline Bootstrap completed ===');
  } catch (error) {
    logger.error('Pipeline bootstrap failed: %s', error.message);
  }
}
