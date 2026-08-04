-- TimescaleDB initialization script for whales-tracker
-- This runs automatically when the timescaledb container starts

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create custom schema
CREATE SCHEMA IF NOT EXISTS whales;

-- ========== OHLCV TABLE ==========
CREATE TABLE IF NOT EXISTS whales.ohlcv (
    token_mint TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    timestamp BIGINT NOT NULL,  -- Unix seconds (bucket start)
    interval TEXT NOT NULL,      -- '1m', '5m', '15m', '1h', '4h', '1d'
    open DOUBLE PRECISION NOT NULL,
    high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL,
    close DOUBLE PRECISION NOT NULL,
    volume DOUBLE PRECISION NOT NULL,
    volume_usd DOUBLE PRECISION NOT NULL,
    trades_count BIGINT NOT NULL,
    vwap DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (token_mint, interval, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('whales.ohlcv', 'timestamp', 
    if_not_exists => TRUE,
    chunk_time_interval => 86400,  -- 1 day chunks
    migrate_data => TRUE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_time ON whales.ohlcv (token_symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ohlcv_interval_time ON whales.ohlcv (interval, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ohlcv_mint_interval_time ON whales.ohlcv (token_mint, interval, timestamp DESC);

-- Compression policy (compress chunks older than 7 days)
ALTER TABLE whales.ohlcv SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'token_mint, interval'
);

SELECT add_compression_policy('whales.ohlcv', INTERVAL '7 days', if_not_exists => TRUE);

-- ========== TRADES TABLE ==========
CREATE TABLE IF NOT EXISTS whales.trades (
    id TEXT PRIMARY KEY,
    token_mint TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    signature TEXT NOT NULL UNIQUE,
    buyer TEXT NOT NULL,
    seller TEXT NOT NULL,
    amount_token DOUBLE PRECISION NOT NULL,
    amount_quote DOUBLE PRECISION NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    dex TEXT NOT NULL,
    pool_address TEXT NOT NULL,
    timestamp BIGINT NOT NULL,  -- Unix seconds
    slot BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable
SELECT create_hypertable('whales.trades', 'timestamp',
    if_not_exists => TRUE,
    chunk_time_interval => 86400,
    migrate_data => TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trades_token_time ON whales.trades (token_mint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_buyer_time ON whales.trades (buyer, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_seller_time ON whales.trades (seller, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_dex_time ON whales.trades (dex, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_signature ON whales.trades (signature);

-- Compression
ALTER TABLE whales.trades SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'token_mint, dex'
);

SELECT add_compression_policy('whales.trades', INTERVAL '7 days', if_not_exists => TRUE);

-- ========== WALLET ACTIVITY TABLE ==========
CREATE TABLE IF NOT EXISTS whales.wallet_activity (
    wallet_address TEXT NOT NULL,
    token_mint TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'transfer', 'stake', 'unstake')),
    amount DOUBLE PRECISION NOT NULL,
    amount_usd DOUBLE PRECISION NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    signature TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    pnl_usd DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (wallet_address, signature)
);

-- Convert to hypertable
SELECT create_hypertable('whales.wallet_activity', 'timestamp',
    if_not_exists => TRUE,
    chunk_time_interval => 86400,
    migrate_data => TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_activity_wallet_time ON whales.wallet_activity (wallet_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_activity_token_time ON whales.wallet_activity (token_mint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_activity_type_time ON whales.wallet_activity (type, timestamp DESC);

-- Compression
ALTER TABLE whales.wallet_activity SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'wallet_address, token_mint'
);

SELECT add_compression_policy('whales.wallet_activity', INTERVAL '7 days', if_not_exists => TRUE);

-- ========== TOKEN METADATA TABLE ==========
CREATE TABLE IF NOT EXISTS whales.token_metadata (
    token_mint TEXT PRIMARY KEY,
    token_symbol TEXT NOT NULL,
    token_name TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    total_supply DOUBLE PRECISION,
    creator_address TEXT,
    created_at BIGINT,
    is_renounced BOOLEAN,
    is_frozen BOOLEAN,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_metadata_symbol ON whales.token_metadata (token_symbol);
CREATE INDEX IF NOT EXISTS idx_token_metadata_creator ON whales.token_metadata (creator_address);

-- ========== CONTINUOUS AGGREGATES ==========

-- 1-hour OHLCV aggregate (from 1m data)
CREATE MATERIALIZED VIEW IF NOT EXISTS whales.ohlcv_1h
WITH (timescaledb.continuous) AS
SELECT 
    token_mint,
    token_symbol,
    time_bucket('1 hour', timestamp) AS bucket,
    interval,
    FIRST(open, timestamp) AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, timestamp) AS close,
    SUM(volume) AS volume,
    SUM(volume_usd) AS volume_usd,
    SUM(trades_count) AS trades_count,
    SUM(vwap * volume_usd) / NULLIF(SUM(volume_usd), 0) AS vwap
FROM whales.ohlcv
WHERE interval = '1m'
GROUP BY token_mint, token_symbol, bucket, interval
WITH NO DATA;

SELECT add_continuous_aggregate_policy('whales.ohlcv_1h',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- 4-hour OHLCV aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS whales.ohlcv_4h
WITH (timescaledb.continuous) AS
SELECT 
    token_mint,
    token_symbol,
    time_bucket('4 hours', timestamp) AS bucket,
    interval,
    FIRST(open, timestamp) AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, timestamp) AS close,
    SUM(volume) AS volume,
    SUM(volume_usd) AS volume_usd,
    SUM(trades_count) AS trades_count,
    SUM(vwap * volume_usd) / NULLIF(SUM(volume_usd), 0) AS vwap
FROM whales.ohlcv
WHERE interval = '1h'
GROUP BY token_mint, token_symbol, bucket, interval
WITH NO DATA;

SELECT add_continuous_aggregate_policy('whales.ohlcv_4h',
    start_offset => INTERVAL '8 hours',
    end_offset => INTERVAL '4 hours',
    schedule_interval => INTERVAL '4 hours',
    if_not_exists => TRUE
);

-- 1-day OHLCV aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS whales.ohlcv_1d
WITH (timescaledb.continuous) AS
SELECT 
    token_mint,
    token_symbol,
    time_bucket('1 day', timestamp) AS bucket,
    interval,
    FIRST(open, timestamp) AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, timestamp) AS close,
    SUM(volume) AS volume,
    SUM(volume_usd) AS volume_usd,
    SUM(trades_count) AS trades_count,
    SUM(vwap * volume_usd) / NULLIF(SUM(volume_usd), 0) AS vwap
FROM whales.ohlcv
WHERE interval = '1h'
GROUP BY token_mint, token_symbol, bucket, interval
WITH NO DATA;

SELECT add_continuous_aggregate_policy('whales.ohlcv_1d',
    start_offset => INTERVAL '2 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- ========== DAILY TOKEN STATS AGGREGATE ==========
CREATE MATERIALIZED VIEW IF NOT EXISTS whales.daily_token_stats
WITH (timescaledb.continuous) AS
SELECT 
    token_mint,
    token_symbol,
    time_bucket('1 day', timestamp) AS day,
    FIRST(open, timestamp) AS open_price,
    MAX(high) AS high_price,
    MIN(low) AS low_price,
    LAST(close, timestamp) AS close_price,
    SUM(volume_usd) AS volume_usd,
    SUM(trades_count) AS trades_count,
    SUM(vwap * volume_usd) / NULLIF(SUM(volume_usd), 0) AS vwap,
    (LAST(close, timestamp) - FIRST(open, timestamp)) / FIRST(open, timestamp) * 100 AS price_change_pct
FROM whales.ohlcv
WHERE interval = '1h'
GROUP BY token_mint, token_symbol, day
WITH NO DATA;

SELECT add_continuous_aggregate_policy('whales.daily_token_stats',
    start_offset => INTERVAL '2 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- ========== HOURLY WALLET STATS ==========
CREATE MATERIALIZED VIEW IF NOT EXISTS whales.hourly_wallet_stats
WITH (timescaledb.continuous) AS
SELECT 
    wallet_address,
    time_bucket('1 hour', timestamp) AS hour,
    COUNT(*) AS trades_count,
    SUM(amount_usd) AS volume_usd,
    SUM(CASE WHEN type = 'buy' THEN amount_usd ELSE 0 END) AS buy_volume_usd,
    SUM(CASE WHEN type = 'sell' THEN amount_usd ELSE 0 END) AS sell_volume_usd,
    SUM(pnl_usd) AS pnl_usd,
    COUNT(DISTINCT token_mint) AS unique_tokens
FROM whales.wallet_activity
GROUP BY wallet_address, hour
WITH NO DATA;

SELECT add_continuous_aggregate_policy('whales.hourly_wallet_stats',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- ========== FUNCTIONS ==========

-- Function to get latest price for a token
CREATE OR REPLACE FUNCTION whales.get_latest_price(p_token_mint TEXT)
RETURNS TABLE (
    token_mint TEXT,
    token_symbol TEXT,
    price DOUBLE PRECISION,
    timestamp BIGINT,
    interval TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT o.token_mint, o.token_symbol, o.close as price, o.timestamp, o.interval
    FROM whales.ohlcv o
    WHERE o.token_mint = p_token_mint
    ORDER BY o.timestamp DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get OHLCV for backtesting
CREATE OR REPLACE FUNCTION whales.get_ohlcv_range(
    p_token_mint TEXT,
    p_interval TEXT,
    p_start_time BIGINT,
    p_end_time BIGINT
)
RETURNS TABLE (
    token_mint TEXT,
    token_symbol TEXT,
    timestamp BIGINT,
    interval TEXT,
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION,
    volume DOUBLE PRECISION,
    volume_usd DOUBLE PRECISION,
    trades_count BIGINT,
    vwap DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT o.token_mint, o.token_symbol, o.timestamp, o.interval,
           o.open, o.high, o.low, o.close,
           o.volume, o.volume_usd, o.trades_count, o.vwap
    FROM whales.ohlcv o
    WHERE o.token_mint = p_token_mint
      AND o.interval = p_interval
      AND o.timestamp >= p_start_time
      AND o.timestamp <= p_end_time
    ORDER BY o.timestamp ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get token stats
CREATE OR REPLACE FUNCTION whales.get_token_stats(
    p_token_mint TEXT,
    p_hours INTERVAL DEFAULT '24 hours'
)
RETURNS TABLE (
    token_mint TEXT,
    token_symbol TEXT,
    price_change_pct DOUBLE PRECISION,
    volume_usd DOUBLE PRECISION,
    trades_count BIGINT,
    vwap DOUBLE PRECISION,
    high_price DOUBLE PRECISION,
    low_price DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT d.token_mint, d.token_symbol,
           d.price_change_pct,
           d.volume_usd,
           d.trades_count,
           d.vwap,
           d.high_price,
           d.low_price
    FROM whales.daily_token_stats d
    WHERE d.token_mint = p_token_mint
      AND d.day >= EXTRACT(EPOCH FROM NOW() - p_hours)
    ORDER BY d.day DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get top tokens by volume
CREATE OR REPLACE FUNCTION whales.get_top_tokens_by_volume(
    p_hours INTERVAL DEFAULT '24 hours',
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    token_mint TEXT,
    token_symbol TEXT,
    volume_usd DOUBLE PRECISION,
    price_change_pct DOUBLE PRECISION,
    trades_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT d.token_mint, d.token_symbol,
           d.volume_usd,
           d.price_change_pct,
           d.trades_count
    FROM whales.daily_token_stats d
    WHERE d.day >= EXTRACT(EPOCH FROM NOW() - p_hours)
    ORDER BY d.volume_usd DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get wallet leaderboard
CREATE OR REPLACE FUNCTION whales.get_wallet_leaderboard(
    p_metric TEXT DEFAULT 'volume',  -- 'volume', 'pnl', 'trades', 'winrate'
    p_hours INTERVAL DEFAULT '24 hours',
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    wallet_address TEXT,
    value DOUBLE PRECISION,
    token_count INTEGER
) AS $$
DECLARE
    v_sql TEXT;
BEGIN
    CASE p_metric
        WHEN 'volume' THEN
            v_sql := '
                SELECT wallet_address, 
                       SUM(volume_usd) as value,
                       COUNT(DISTINCT token_mint) as token_count
                FROM whales.hourly_wallet_stats
                WHERE hour >= EXTRACT(EPOCH FROM NOW() - $1)
                GROUP BY wallet_address
                ORDER BY value DESC
                LIMIT $2
            ';
        WHEN 'pnl' THEN
            v_sql := '
                SELECT wallet_address,
                       SUM(pnl_usd) as value,
                       COUNT(DISTINCT token_mint) as token_count
                FROM whales.hourly_wallet_stats
                WHERE hour >= EXTRACT(EPOCH FROM NOW() - $1)
                GROUP BY wallet_address
                ORDER BY value DESC
                LIMIT $2
            ';
        WHEN 'trades' THEN
            v_sql := '
                SELECT wallet_address,
                       SUM(trades_count) as value,
                       COUNT(DISTINCT token_mint) as token_count
                FROM whales.hourly_wallet_stats
                WHERE hour >= EXTRACT(EPOCH FROM NOW() - $1)
                GROUP BY wallet_address
                ORDER BY value DESC
                LIMIT $2
            ';
        WHEN 'winrate' THEN
            v_sql := '
                SELECT wallet_address,
                       COUNT(CASE WHEN pnl_usd > 0 THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) * 100 as value,
                       COUNT(DISTINCT token_mint) as token_count
                FROM whales.hourly_wallet_stats
                WHERE hour >= EXTRACT(EPOCH FROM NOW() - $1)
                GROUP BY wallet_address
                HAVING COUNT(*) >= 10
                ORDER BY value DESC
                LIMIT $2
            ';
        ELSE
            RAISE EXCEPTION 'Invalid metric: %', p_metric;
    END CASE;

    RETURN QUERY EXECUTE v_sql USING p_hours, p_limit;
END;
$$ LANGUAGE plpgsql;

-- ========== GRANTS ==========

-- Grant permissions to application user
GRANT USAGE ON SCHEMA whales TO whales_tracker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA whales TO whales_tracker;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA whales TO whales_tracker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA whales TO whales_tracker;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA whales GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO whales_tracker;
ALTER DEFAULT PRIVILEGES IN SCHEMA whales GRANT EXECUTE ON FUNCTIONS TO whales_tracker;

-- ========== RETENTION POLICIES ==========

-- Keep raw 1m data for 30 days
SELECT add_retention_policy('whales.ohlcv', INTERVAL '30 days', if_not_exists => TRUE);

-- Keep trades for 90 days
SELECT add_retention_policy('whales.trades', INTERVAL '90 days', if_not_exists => TRUE);

-- Keep wallet activity for 180 days
SELECT add_retention_policy('whales.wallet_activity', INTERVAL '180 days', if_not_exists => TRUE);

-- Continuous aggregates kept longer (no retention policy needed - they're smaller)

-- ========== VACUUM SETTINGS ==========

-- Optimize autovacuum for hypertables
ALTER TABLE whales.ohlcv SET (autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE whales.trades SET (autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE whales.wallet_activity SET (autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_scale_factor = 0.05);

-- ========== COMPLETION ==========

\echo 'TimescaleDB schema initialized successfully!'
\echo 'Tables created: ohlcv, trades, wallet_activity, token_metadata'
\echo 'Continuous aggregates: ohlcv_1h, ohlcv_4h, ohlcv_1d, daily_token_stats, hourly_wallet_stats'
\echo 'Functions: get_latest_price, get_ohlcv_range, get_token_stats, get_top_tokens_by_volume, get_wallet_leaderboard'
\echo 'Compression and retention policies configured'