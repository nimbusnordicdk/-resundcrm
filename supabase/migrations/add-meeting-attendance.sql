-- Add attendance tracking columns to meetings table
-- Run this in your Supabase SQL editor

-- Add attendance_status column: 'pending', 'show_up', 'no_show', 'cancelled'
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS attendance_status TEXT DEFAULT 'pending';

-- Add cancelled_at timestamp
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Add cancelled_reason
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- Add attended_at timestamp (when marked as show_up or no_show)
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;

-- Add constraint to ensure valid status values
ALTER TABLE meetings
DROP CONSTRAINT IF EXISTS meetings_attendance_status_check;

ALTER TABLE meetings
ADD CONSTRAINT meetings_attendance_status_check
CHECK (attendance_status IN ('pending', 'show_up', 'no_show', 'cancelled'));

-- Create index for faster queries on attendance status
CREATE INDEX IF NOT EXISTS idx_meetings_attendance_status ON meetings(attendance_status);

-- Create index for queries filtering by saelger and attendance
CREATE INDEX IF NOT EXISTS idx_meetings_saelger_attendance ON meetings(saelger_id, attendance_status);
