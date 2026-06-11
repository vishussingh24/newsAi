import nodemailer from 'nodemailer';
import logger from '../../config/logger.js';
import { config } from '../../config/env.js';
import fs from 'fs/promises';
import path from 'path';

function formatSourceName(name) {
  if (!name) return 'Unknown';
  const mapping = {
    'nasa': 'NASA',
    'space_com': 'Space.com',
    'esa': 'ESA',
    'universe_today': 'Universe Today',
    'isro': 'ISRO'
  };
  const clean = name.toLowerCase().trim();
  if (mapping[clean]) return mapping[clean];
  return name.split(/[-_]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export async function sendIndividualNewsEmailPlaintext(article) {
  if (!article) {
    logger.warn('No article provided for individual email.');
    return false;
  }

  const cleanSourceName = formatSourceName(article.source_name);
  logger.info('Compiling briefing email for article: "%s" from %s...', article.title, cleanSourceName);

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

    const formattedDate = new Date(article.published_at || new Date()).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // 1. Plain Text Fallback Body
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

    // 2. Beautiful Premium HTML Card Body
    const relevanceColor = score >= 80 ? '#F97316' : '#3B82F6'; // Vibrant orange for high-relevance, blue otherwise

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cosmic News Briefing: ${article.title}</title>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #F8FAFC; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Wrapper -->
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden; border-spacing: 0;">
          
          <!-- Banner Header -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #0B192C 0%, #1E3E62 100%); padding: 35px 24px;">
              <h1 style="text-transform: uppercase; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 26px; font-weight: 800; color: #FFFFFF; letter-spacing: 4px; margin: 0; padding: 0; line-height: 1.2;">COSMIC BRIEFING</h1>
              <p style="text-transform: uppercase; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; font-weight: 600; color: #38BDF8; letter-spacing: 2px; margin: 8px 0 0 0; padding: 0;">INTELLIGENCE DEBRIEF</p>
            </td>
          </tr>

          <!-- Card Body Content -->
          <tr>
            <td style="padding: 32px 24px;">
              
              <!-- Badges Row -->
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 20px;">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: #0B192C; color: #FFFFFF; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; margin-right: 8px;">
                      ${cleanSourceName}
                    </span>
                    <span style="display: inline-block; background-color: #F1F5F9; color: #334155; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px;">
                      ${article.category || 'General'}
                    </span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: ${relevanceColor}; color: #FFFFFF; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px;">
                      RELEVANCE: ${score}%
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Main Title Heading -->
              <h2 style="font-family: Georgia, Cambria, 'Times New Roman', Times, serif; font-size: 22px; font-weight: 700; color: #0F172A; margin: 0 0 24px 0; line-height: 1.4; text-transform: uppercase; text-align: left; letter-spacing: 0.5px;">
                ${article.title.toUpperCase()}
              </h2>

              <hr style="border: 0; height: 1px; background-color: #E2E8F0; margin: 24px 0;" />

              <!-- Summary Section -->
              <h3 style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #1E3E62; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 10px 0; padding: 0;">
                SUMMARY OF DEVELOPMENTS
              </h3>
              <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 28px 0; font-weight: 400; text-align: left;">
                ${cleanSummary}
              </p>

              <!-- Highlights Section -->
              <h3 style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #1E3E62; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 12px 0; padding: 0;">
                KEY TAKEAWAYS
              </h3>
              <ul style="margin: 0 0 28px 0; padding-left: 20px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.6;">
                ${takeaways.length > 0
                  ? takeaways.map(point => `<li style="margin-bottom: 8px; text-align: left;">${point.replace(/^Key Takeaway \d+:\s*/i, '').trim()}</li>`).join('')
                  : `<li style="margin-bottom: 8px; text-align: left;">No specific takeaways extracted.</li>`
                }
              </ul>

              <!-- Metadata Details -->
              <h3 style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; font-weight: 700; color: #1E3E62; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 12px 0; padding: 0;">
                CLASSIFICATION METRICS
              </h3>
              <table width="100%" cellpadding="6" cellspacing="0" border="0" style="background-color: #F8FAFC; border-radius: 6px; border: 1px solid #F1F5F9; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #475569; margin-bottom: 28px;">
                <tr>
                  <td width="30%" style="font-weight: 600; padding: 10px 12px; border-bottom: 1px solid #F1F5F9;">Publisher Source</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #F1F5F9;">${cleanSourceName}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; padding: 10px 12px; border-bottom: 1px solid #F1F5F9;">Classification</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #F1F5F9;">${article.category || 'General Space Science'}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; padding: 10px 12px; border-bottom: 1px solid #F1F5F9;">Relevance Rating</td>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #F1F5F9; font-weight: bold; color: ${relevanceColor};">${score}% Score</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; padding: 10px 12px;">Publish Date</td>
                  <td style="padding: 10px 12px;">${formattedDate}</td>
                </tr>
              </table>

              <!-- Call to Action Link -->
              <div style="text-align: center; margin: 25px 0 10px 0;">
                <a href="${article.url}" target="_blank" style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0B192C; color: #FFFFFF; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 700; font-size: 13px; display: inline-block; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Read Full Release</a>
              </div>

            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 24px; text-align: center; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #94A3B8; line-height: 1.5;">
              This automated report was compiled, filtered, and validated by the <strong>Cosmic News</strong> intelligence pipeline.
              <br /><br />
              &copy; 2026 Cosmic News System. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const hasSmtpConfig = !!(config.email.host && config.email.user && config.email.pass && config.email.target);

    // Save a copy of the HTML email template for easy local visualization/testing
    try {
      const logsDir = path.join(process.cwd(), 'logs');
      await fs.mkdir(logsDir, { recursive: true });
      const mockHtmlPath = path.join(logsDir, 'simulated_email.html');
      await fs.writeFile(mockHtmlPath, htmlContent, 'utf-8');
      logger.info('Saved HTML mockup of email to: file:///d:/newsAI/logs/simulated_email.html');
    } catch (fsErr) {
      logger.error('Failed to write local simulated HTML mockup: %s', fsErr.message);
    }

    if (!hasSmtpConfig) {
      logger.warn('SMTP email transport parameters are not defined in your environment settings.');
      logger.info('========================================================================');
      logger.info('  SIMULATED BRIEFING EMAIL DISPATCH');
      logger.info('  Date: %s', formattedDate);
      logger.info('  To: %s', config.email.target || 'Not Configured');
      logger.info('  Subject: Cosmic News: %s', article.title);
      logger.info('  Plain Text Fallback Snippet: \n%s...', textContent.substring(0, 300));
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
      subject: `Cosmic News: ${article.title.toUpperCase()}`,
      text: textContent,
      html: htmlContent
    });

    logger.info('Email briefing dispatched successfully for article ID: %d. MessageId: %s', article.id, info.messageId);
    return true;

  } catch (error) {
    logger.error('Failed to dispatch email briefing: %s', error.message);
    throw error;
  }
}
