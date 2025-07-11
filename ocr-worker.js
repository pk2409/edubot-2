// ocr-worker.js

import 'dotenv/config'; // or require('dotenv').config(); if using CommonJS


import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // use service role key for backend
);
import ocrInstance from './src/services/grading/ocrService.js';

ocrInstance.startProcessing(); // Start polling for OCR jobs
