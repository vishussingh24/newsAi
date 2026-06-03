import { db } from '../config/database.js';

export const queries = {
  /**
   * Fetch all active ingestion sources.
   */
  async getActiveSources() {
    const result = await db.query(
      'SELECT id, name, url FROM sources WHERE is_active = TRUE ORDER BY id'
    );
    return result.rows;
  },

  /**
   * Update the last polled timestamp of a source.
   */
  async updateSourceLastPolled(sourceId) {
    await db.query(
      'UPDATE sources SET last_polled_at = CURRENT_TIMESTAMP WHERE id = $1',
      [sourceId]
    );
  },

  /**
   * Insert a raw crawled article. Handles ON CONFLICT DO NOTHING to prevent duplicates.
   * Returns the inserted row, or null if duplicate.
   */
  async insertRawArticle(sourceId, externalId, title, url, publishedAt, rawContent) {
    const result = await db.query(
      `INSERT INTO raw_articles (source_id, external_id, title, url, published_at, raw_content, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       ON CONFLICT (external_id) DO NOTHING
       RETURNING *`,
      [sourceId, externalId, title, url, publishedAt, rawContent]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  /**
   * Fetch all raw articles awaiting LLM validation.
   */
  async getPendingRawArticles(limit = 50) {
    const result = await db.query(
      `SELECT ra.*, s.name as source_name 
       FROM raw_articles ra
       JOIN sources s ON ra.source_id = s.id
       WHERE ra.status = 'pending'
       ORDER BY ra.created_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  /**
   * Update raw article processing state.
   */
  async updateRawArticleStatus(articleId, status) {
    await db.query(
      'UPDATE raw_articles SET status = $1 WHERE id = $2',
      [status, articleId]
    );
  },

  /**
   * Insert LLM evaluated results.
   */
  async insertProcessedArticle(rawArticleId, isValid, relevanceScore, summary, keyTakeaways, category) {
    const result = await db.query(
      `INSERT INTO processed_articles (raw_article_id, is_valid, relevance_score, summary, key_takeaways, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [rawArticleId, isValid, relevanceScore, summary, JSON.stringify(keyTakeaways), category]
    );
    return result.rows[0];
  },

  /**
   * Fetch all valid verified articles that have not been dispatched via email.
   */
  async getUnsentProcessedArticles() {
    const result = await db.query(
      `SELECT pa.*, ra.title, ra.url, s.name as source_name, ra.published_at
       FROM processed_articles pa
       JOIN raw_articles ra ON pa.raw_article_id = ra.id
       JOIN sources s ON ra.source_id = s.id
       WHERE pa.is_valid = TRUE AND pa.email_sent = FALSE
       ORDER BY pa.relevance_score DESC, ra.published_at DESC`
    );
    return result.rows;
  },

  /**
   * Mark a list of processed articles as dispatched.
   */
  async markArticlesAsEmailed(articleIds) {
    if (!articleIds || articleIds.length === 0) return;
    await db.query(
      `UPDATE processed_articles 
       SET email_sent = TRUE, email_sent_at = CURRENT_TIMESTAMP 
       WHERE id = ANY($1)`,
      [articleIds]
    );
  }
};
