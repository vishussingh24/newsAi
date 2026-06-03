import logger from '../../config/logger.js';
import { queries } from '../../database/queries.js';
import { fetchOpenAINews } from './openai.js';
import { fetchGoogleNews } from './google.js';
import { fetchAnthropicNews } from './anthropic.js';
import { fetchTwitterNews } from './twitter.js';

const scrapers = {
  openai: fetchOpenAINews,
  google: fetchGoogleNews,
  anthropic: fetchAnthropicNews,
  x: fetchTwitterNews
};

export async function runIngestionPipeline() {
  logger.info('Starting Ingestion Pipeline...');
  const activeSources = await queries.getActiveSources();
  let totalNewArticles = 0;

  for (const source of activeSources) {
    const scraper = scrapers[source.name];
    if (!scraper) {
      logger.warn('No registered scraper found for source: %s', source.name);
      continue;
    }

    try {
      logger.info('Invoking scraper for source: %s', source.name);
      const articles = await scraper();
      let sourceNewArticles = 0;

      for (const article of articles) {
        const inserted = await queries.insertRawArticle(
          source.id,
          article.externalId,
          article.title,
          article.url,
          article.publishedAt,
          article.rawContent
        );

        if (inserted) {
          sourceNewArticles++;
        }
      }

      await queries.updateSourceLastPolled(source.id);
      logger.info('Source [%s] completed. Discovered %d total, %d new articles written.', source.name, articles.length, sourceNewArticles);
      totalNewArticles += sourceNewArticles;

    } catch (error) {
      logger.error('Error during ingestion for source %s: %s', source.name, error.message);
    }
  }

  logger.info('Ingestion Pipeline finished. Added %d new raw articles across all sources.', totalNewArticles);
  return totalNewArticles;
}
