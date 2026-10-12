CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    min_magnitude NUMERIC(3,1) DEFAULT 4.5,
    subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_mag ON push_subscriptions(min_magnitude);
