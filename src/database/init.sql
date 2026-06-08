-- Table 1: Ingestion Sources
CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'openai', 'google', 'anthropic', 'twitter'
    url VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_polled_at TIMESTAMP WITH TIME ZONE
);

-- Table 2: Raw Scraped News (to prevent processing duplication)
CREATE TABLE IF NOT EXISTS raw_articles (
    id SERIAL PRIMARY KEY,
    source_id INT REFERENCES sources(id) ON DELETE CASCADE,
    external_id VARCHAR(255) UNIQUE, -- Unique hash of URL or API post ID
    title VARCHAR(500) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    raw_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' -- 'pending', 'processed', 'failed'
);

-- Table 3: LLM Verified & Summarized Articles
CREATE TABLE IF NOT EXISTS processed_articles (
    id SERIAL PRIMARY KEY,
    raw_article_id INT REFERENCES raw_articles(id) ON DELETE CASCADE,
    is_valid BOOLEAN NOT NULL DEFAULT FALSE,
    relevance_score INT CHECK (relevance_score BETWEEN 0 AND 100),
    summary TEXT,
    key_takeaways JSONB, -- Array of bullet points
    category VARCHAR(100), -- e.g., 'LLM Release', 'Hardware', 'Corporate'
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_articles_status ON raw_articles(status);
CREATE INDEX IF NOT EXISTS idx_processed_articles_sent ON processed_articles(email_sent) WHERE is_valid = TRUE;

-- Seed initial sources
INSERT INTO sources (name, url) VALUES
('nasa', 'https://www.nasa.gov/news-release/feed/'),
('space_com', 'https://www.space.com/feeds/all'),
('esa', 'https://www.esa.int/rssfeed/Our_Activities/Space_Science'),
('universe_today', 'https://www.universetoday.com/feed/')
ON CONFLICT (name) DO NOTHING;

