-- Add is_archived column to chat_rooms table
-- Run this in Supabase SQL Editor

ALTER TABLE chat_rooms
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_chat_rooms_is_archived ON chat_rooms(is_archived);
