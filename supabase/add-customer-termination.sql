-- Add termination fields to customers table
-- Run this in Supabase SQL Editor

-- Add termination columns
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS termination_reason TEXT,
ADD COLUMN IF NOT EXISTS termination_document_url TEXT,
ADD COLUMN IF NOT EXISTS termination_declared_by UUID REFERENCES users(id);

-- Create index for faster filtering on status
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- Update RLS policy to allow bureaus to update termination status
-- (assuming RLS is enabled on customers table)
