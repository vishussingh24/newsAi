import logger from '../config/logger.js';
import { queries } from '../database/queries.js';
import { sendIndividualNewsEmailPlaintext } from '../services/notification/email.js';

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

    logger.info('[SCHEDULER] Found %d unsent verified articles. Initiating individual plain-text dispatches...', unsentArticles.length);

    for (const article of unsentArticles) {
      const sent = await sendIndividualNewsEmailPlaintext(article);
      if (sent) {
        await queries.markArticlesAsEmailed([article.id]);
        logger.info('[SCHEDULER] Successfully processed and marked article ID %d as emailed.', article.id);
      }
      // Introduce a 1-second delay between email dispatches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    logger.info('[SCHEDULER] Completed all individual email dispatches.');
  } catch (error) {
    logger.error('[SCHEDULER] Email dispatch job cycle failed: %s', error.message);
  } finally {
    isRunning = false;
  }
}
