import logger from '../config/logger.js';
import { queries } from '../database/queries.js';
import { sendNewsEmailDigest } from '../services/notification/email.js';

let isRunning = false;

export async function executeEmailJob() {
  if (isRunning) {
    logger.warn('Email dispatch job is already active. Skipping overlap.');
    return;
  }

  isRunning = true;
  logger.info('[SCHEDULER] Triggering email notification job...');

  try {
    const unsentArticles = await queries.getUnsentProcessedArticles();

    if (unsentArticles.length === 0) {
      logger.info('[SCHEDULER] No unsent processed articles found. No email sent.');
      return;
    }

    logger.info('[SCHEDULER] Found %d unsent verified articles. Initiating email dispatch...', unsentArticles.length);

    const sent = await sendNewsEmailDigest(unsentArticles);
    
    if (sent) {
      const articleIds = unsentArticles.map(a => a.id);
      await queries.markArticlesAsEmailed(articleIds);
      logger.info('[SCHEDULER] Dispatched email update containing %d articles and updated databases.', unsentArticles.length);
    }
  } catch (error) {
    logger.error('[SCHEDULER] Email dispatch job cycle failed: %s', error.message);
  } finally {
    isRunning = false;
  }
}
