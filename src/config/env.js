import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

const requiredEnv = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASS',
  'TARGET_EMAIL'
];

// Validate critical variables
for (const envVar of requiredEnv) {
  if (!process.env[envVar]) {
    console.warn(`[WARNING] Missing environment variable: ${envVar}. Some features may fail.`);
  }
}

// Validate LLM provider specific keys
const provider = process.env.LLM_PROVIDER || 'gemini';
if (provider === 'gemini' && !process.env.GEMINI_API_KEY) {
  console.warn(`[WARNING] LLM_PROVIDER is set to 'gemini' but GEMINI_API_KEY is not defined.`);
} else if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
  console.warn(`[WARNING] LLM_PROVIDER is set to 'openai' but OPENAI_API_KEY is not defined.`);
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'news_user',
    password: process.env.DB_PASSWORD || 'news_password',
    database: process.env.DB_NAME || 'news_db'
  },
  llm: {
    provider,
    geminiApiKey: process.env.GEMINI_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY
  },
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    target: process.env.TARGET_EMAIL
  },
  cron: {
    scrape: process.env.SCRAPE_CRON || '*/30 * * * *',
    verify: process.env.LLM_VERIFY_CRON || '*/10 * * * *',
    digest: process.env.EMAIL_DIGEST_CRON || '0 9 * * *'
  }
};
