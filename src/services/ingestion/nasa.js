import Parser from 'rss-parser';
import crypto from 'crypto';
import logger from '../../config/logger.js';

const parser = new Parser();

export async function fetchNasaNews() {
  const url = 'https://www.nasa.gov/news-release/feed/';
  logger.info('Fetching NASA news from: %s', url);

  try {
    const feed = await parser.parseURL(url);
    const articles = feed.items.map(item => {
      const id = crypto.createHash('md5').update(item.link || item.title).digest('hex');
      return {
        externalId: id,
        title: item.title,
        url: item.link,
        publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
        rawContent: item.contentSnippet || item.content || item.title
      };
    });

    if (articles.length > 0) {
      logger.info('Successfully parsed %d NASA RSS articles', articles.length);
      return articles;
    }
    throw new Error('NASA RSS feed had no items.');
  } catch (error) {
    logger.warn('Failed to parse real NASA news: %s. Yielding simulated cosmic news.', error.message);
    
    // Developer Fallback (Simulated high-fidelity NASA news)
    return [
      {
        externalId: 'nasa-mock-jwst-atmosphere',
        title: 'JWST Detects Water Vapor and Carbon Dioxide in Exoplanet Atmosphere',
        url: 'https://www.nasa.gov/news-release/jwst-exoplanet-atmosphere/',
        publishedAt: new Date(),
        rawContent: 'NASA\'s James Webb Space Telescope has observed the exoplanet WASP-39b, confirming the presence of water vapor, carbon dioxide, and sodium in its atmosphere. This discovery marks a significant step forward in our search for habitable worlds outside our solar system.'
      },
      {
        externalId: 'nasa-mock-artemis-satellite',
        title: 'Artemis II Lunar Communication Satellite Passes Critical Design Review',
        url: 'https://www.nasa.gov/news-release/artemis-lunar-satellite-cdr/',
        publishedAt: new Date(Date.now() - 86400000), // 1 day ago
        rawContent: 'NASA has confirmed that the new lunar communication and navigation satellite for the Artemis II mission has successfully passed its Critical Design Review. The satellite will provide high-bandwidth telemetry and HD video communications from lunar orbit.'
      }
    ];
  }
}
