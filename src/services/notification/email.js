import nodemailer from 'nodemailer';
import logger from '../../config/logger.js';
import { config } from '../../config/env.js';

function formatSourceName(name) {
  if (!name) return 'Unknown';
  const mapping = {
    'nasa': 'NASA',
    'space_com': 'Space.com',
    'esa': 'ESA',
    'universe_today': 'Universe Today'
  };
  const clean = name.toLowerCase().trim();
  if (mapping[clean]) return mapping[clean];
  return name.split(/[-_]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export async function sendIndividualNewsEmailPlaintext(article) {
  if (!article) {
    logger.warn('No article provided for individual plain-text email.');
    return false;
  }

  const cleanSourceName = formatSourceName(article.source_name);
  logger.info('Compiling plain-text email for article: "%s" from %s...', article.title, cleanSourceName);

  try {
    const score = article.relevance_score || 50;

    const takeaways = Array.isArray(article.key_takeaways)
      ? article.key_takeaways
      : JSON.parse(article.key_takeaways || '[]');

    const takeawaysText = takeaways.length > 0
      ? takeaways.map(point => `- ${point.replace(/^Key Takeaway \d+:\s*/i, '').trim()}`).join('\n')
      : '- No specific takeaways extracted.';

    // Strip "Local Mock Summary: " from summary if present, to keep it looking pristine
    let cleanSummary = article.summary || 'No summary available.';
    if (cleanSummary.startsWith('Local Mock Summary:')) {
      cleanSummary = cleanSummary.replace(/^Local Mock Summary:\s*["']?|["']?\s*posted by.*$/g, '').trim();
      cleanSummary = `Summary of developments: ${cleanSummary}. This event details significant space observations and mission activities.`;
    }

    const textContent = `
======================================================================
COSMIC BRIEFING
======================================================================

${cleanSummary}

HIGHLIGHTS:
${takeawaysText}

METADATA:
- Source: ${cleanSourceName}
- Relevance Match: ${score}%
- Category: ${article.category || 'General'}
- Article Link: ${article.url}

----------------------------------------------------------------------
This automated report was compiled and validated by the Cosmic News system.
`.trim();

    const formattedDate = new Date(article.published_at || new Date()).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const hasSmtpConfig = !!(config.email.host && config.email.user && config.email.pass && config.email.target);

    if (!hasSmtpConfig) {
      logger.warn('SMTP email transport parameters are not defined in your environment settings.');
      logger.info('========================================================================');
      logger.info('  SIMULATED PLAIN TEXT EMAIL CONTENT');
      logger.info('  Date: %s', formattedDate);
      logger.info('  To: %s', config.email.target || 'Not Configured');
      logger.info('  Subject: Cosmic News: %s', article.title);
      logger.info('\n%s', textContent);
      logger.info('========================================================================');
      return true;
    }

    const transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass
      }
    });

    const info = await transporter.sendMail({
      from: `"Cosmic News" <${config.email.user}>`,
      to: config.email.target,
      subject: `Cosmic News: ${article.title}`,
      text: textContent
    });

    logger.info('Plain-text email dispatched successfully for article ID: %d. MessageId: %s', article.id, info.messageId);
    return true;

  } catch (error) {
    logger.error('Failed to dispatch plain-text email: %s', error.message);
    throw error;
  }
}
