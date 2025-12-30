-- Add transcription column to call_logs table
ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS transcript TEXT,
ADD COLUMN IF NOT EXISTS transcript_created_at TIMESTAMPTZ;

-- Comment on columns
COMMENT ON COLUMN call_logs.transcript IS 'AI-generated transcription of the call recording (via OpenAI Whisper)';
COMMENT ON COLUMN call_logs.transcript_created_at IS 'When the transcription was generated';
