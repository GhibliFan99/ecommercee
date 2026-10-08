-- Glazy E-Commerce: Ready to Claim Notification System Migration
-- Migration 002: Notifications, Queue Numbers, Claim Verification & Push Subscriptions

-- 1. Add queue and notification tracking columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS queue_number VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_notified_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMPTZ;

-- Backfill tracking token for legacy orders if empty
UPDATE orders 
SET tracking_token = MD5(id::text || order_number || created_at::text)
WHERE tracking_token IS NULL;

-- 2. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('ready', 'reminder', 'claimed')),
  channel VARCHAR(50) NOT NULL CHECK (channel IN ('in_app', 'push', 'email', 'sms')),
  status VARCHAR(50) NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevent duplicate notifications for the same order, type, and channel (Idempotency guarantee)
  CONSTRAINT uq_order_type_channel UNIQUE (order_id, type, channel)
);

-- 3. Web Push Subscriptions Table (Optional / Free VAPID push)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Notification Settings Table (Lazy configurable rules)
CREATE TABLE IF NOT EXISTS notification_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default settings
INSERT INTO notification_settings (key, value)
VALUES 
  ('unclaimed_rules', '{"orangeThresholdMinutes": 10, "redThresholdMinutes": 20, "autoRemindMinutes": 15, "noShowHours": 24}'::jsonb),
  ('tts_settings', '{"enabled": true, "rate": 0.9, "repeatCount": 1, "language": "en-US"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_orders_queue_number ON orders(queue_number);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_token ON orders(tracking_token);
CREATE INDEX IF NOT EXISTS idx_orders_ready_notified ON orders(ready_notified_at);
CREATE INDEX IF NOT EXISTS idx_notifications_order_type ON notifications(order_id, type);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at DESC);
