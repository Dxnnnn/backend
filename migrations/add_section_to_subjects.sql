-- Migration: Add section column to subjects table
-- This allows subjects to be assigned to specific sections

ALTER TABLE `subjects` ADD COLUMN `section` varchar(50) DEFAULT NULL AFTER `strand`;

-- Add index for better query performance
CREATE INDEX idx_section ON subjects(section);
