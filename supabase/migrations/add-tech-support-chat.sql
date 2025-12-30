-- Add is_tech_support column to chat_rooms
ALTER TABLE chat_rooms
ADD COLUMN IF NOT EXISTS is_tech_support BOOLEAN DEFAULT FALSE;

-- Create Tech Support chat room if it doesn't exist
INSERT INTO chat_rooms (name, is_group, is_team_chat, is_tech_support, is_archived, created_by)
SELECT
  'Tech Support',
  true,
  false,
  true,
  false,
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM chat_rooms WHERE is_tech_support = true
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_rooms_is_tech_support ON chat_rooms(is_tech_support);
