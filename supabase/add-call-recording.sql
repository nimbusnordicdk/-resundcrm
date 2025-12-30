-- Add recording columns to call_logs table
ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS recording_sid TEXT,
ADD COLUMN IF NOT EXISTS call_sid TEXT;

-- Create index on call_sid for faster lookups when saving recording URL
CREATE INDEX IF NOT EXISTS idx_call_logs_call_sid ON call_logs(call_sid);

-- Comment on columns
COMMENT ON COLUMN call_logs.recording_url IS 'URL to the Twilio recording MP3 file';
COMMENT ON COLUMN call_logs.recording_sid IS 'Twilio Recording SID';
COMMENT ON COLUMN call_logs.call_sid IS 'Twilio Call SID for matching recordings';
