import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../config/logger.js';
import { config } from '../../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function sendNewsEmailDigest(articles) {
  if (!articles || articles.length === 0) {
    logger.info('No new verified articles found. Skipping email digest.');
    return false;
  }

  logger.info('Compiling email digest for %d verified articles...', articles.length);

  try {
    // 1. Read the HTML template
    const templatePath = path.join(__dirname, 'templates', 'digest.html');
    let htmlContent = await fs.readFile(templatePath, 'utf-8');

    // 2. Generate articles HTML segment
    let articlesHtml = '';
    for (const article of articles) {
      const score = article.relevance_score || 50;
      let scoreClass = 'score-mid';
      if (score >= 80) scoreClass = 'score-high';
      else if (score < 40) scoreClass = 'score-low';

      const takeaways = Array.isArray(article.key_takeaways)
        ? article.key_takeaways
        : JSON.parse(article.key_takeaways || '[]');

      const takeawaysHtml = takeaways
        .map(point => `<li>${point}</li>`)
        .join('');

      articlesHtml += `
        <div class="article-card">
          <div class="meta-row">
            <span class="source-tag">${article.source_name || 'unknown'}</span>
            <div class="badge-row">
              <span class="score-badge ${scoreClass}">Relevance: ${score}%</span>
            </div>
          </div>
          <h2 class="article-title">
            <a href="${article.url}" target="_blank">${article.title}</a>
          </h2>
          <p class="summary-text">${article.summary || ''}</p>
          <div class="takeaways-title">Key Takeaways</div>
          <ul class="takeaways-list">
            ${takeawaysHtml || '<li>No specific takeaways extracted.</li>'}
          </ul>
        </div>
      `;
    }

    const formattedDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    htmlContent = htmlContent
      .replace('{{DATE}}', formattedDate)
      .replace('{{ARTICLES}}', articlesHtml);

    // 3. Dispatch using Nodemailer
    const hasSmtpConfig = !!(config.email.host && config.email.user && config.email.pass && config.email.target);

    if (!hasSmtpConfig) {
      logger.warn('SMTP email transport parameters are not defined in your environment settings.');
      logger.info('========================================================================');
      logger.info('  SIMULATED EMAIL DIGEST CONTENT');
      logger.info('  Date: %s', formattedDate);
      logger.info('  To: %s', config.email.target || 'Not Configured');
      logger.info('  Subject: AI Intelligence Digest - %d New Updates', articles.length);
      logger.info('  Articles to send: %s', articles.map(a => `\n    - [${a.source_name.toUpperCase()}] ${a.title}`).join(''));
      logger.info('========================================================================');
      logger.info('To enable real email dispatches, please configure SMTP details inside your .env file.');
      return true;
    }

    const transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465, // true for 465, false for other ports like 587
      auth: {
        user: config.email.user,
        pass: config.email.pass
      }
    });

    const info = await transporter.sendMail({
      from: `"AI News Aggregator" <${config.email.user}>`,
      to: config.email.target,
      subject: `AI Intelligence Digest: ${articles.length} New Updates (${formattedDate})`,
      html: htmlContent
    });

    logger.info('Email digest dispatched successfully. MessageId: %s', info.messageId);
    return true;

  } catch (error) {
    logger.error('Failed to dispatch email digest: %s', error.message);
    throw error;
  }
}
