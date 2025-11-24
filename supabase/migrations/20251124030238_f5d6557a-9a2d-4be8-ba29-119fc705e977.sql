-- Create enhanced knowledge base table for Arthur's learning
CREATE TABLE IF NOT EXISTS public.arthur_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_normalized TEXT NOT NULL,
  question_original TEXT NOT NULL,
  response_text TEXT NOT NULL,
  response_type TEXT, -- 'message', 'products', 'sales_advice'
  response_metadata JSONB, -- store products, categories, etc.
  context_type TEXT, -- 'pharmacy', 'patient', 'general'
  pharmacy_id UUID REFERENCES public.pharmacies(id),
  conversation_id UUID REFERENCES public.conversations(id),
  user_feedback INTEGER CHECK (user_feedback >= -1 AND user_feedback <= 1), -- -1: bad, 0: neutral, 1: good
  usage_count INTEGER DEFAULT 1,
  confidence_score NUMERIC(3,2) DEFAULT 1.0, -- 0.0 to 1.0
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for fast text search
CREATE INDEX idx_knowledge_question_normalized ON public.arthur_knowledge_base(question_normalized);
CREATE INDEX idx_knowledge_context_type ON public.arthur_knowledge_base(context_type);
CREATE INDEX idx_knowledge_pharmacy_id ON public.arthur_knowledge_base(pharmacy_id) WHERE pharmacy_id IS NOT NULL;
CREATE INDEX idx_knowledge_usage_count ON public.arthur_knowledge_base(usage_count DESC);
CREATE INDEX idx_knowledge_confidence ON public.arthur_knowledge_base(confidence_score DESC);

-- Create trigger to update updated_at
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON public.arthur_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate simple text similarity (Levenshtein-based)
CREATE OR REPLACE FUNCTION public.calculate_text_similarity(text1 TEXT, text2 TEXT)
RETURNS NUMERIC AS $$
DECLARE
  len1 INT := length(text1);
  len2 INT := length(text2);
  max_len INT := GREATEST(len1, len2);
  common_words INT;
  words1 TEXT[];
  words2 TEXT[];
BEGIN
  -- Simple word-based similarity for now
  words1 := string_to_array(lower(text1), ' ');
  words2 := string_to_array(lower(text2), ' ');
  
  -- Count common words
  SELECT COUNT(*) INTO common_words
  FROM unnest(words1) w1
  WHERE w1 = ANY(words2);
  
  -- Return similarity score (0.0 to 1.0)
  IF max_len = 0 THEN
    RETURN 1.0;
  END IF;
  
  RETURN LEAST(1.0, (common_words::NUMERIC * 2.0) / (array_length(words1, 1) + array_length(words2, 1))::NUMERIC);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to search knowledge base
CREATE OR REPLACE FUNCTION public.search_arthur_knowledge(
  query_text TEXT,
  context_type_filter TEXT DEFAULT NULL,
  pharmacy_id_filter UUID DEFAULT NULL,
  similarity_threshold NUMERIC DEFAULT 0.6,
  limit_results INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  question_original TEXT,
  response_text TEXT,
  response_type TEXT,
  response_metadata JSONB,
  similarity_score NUMERIC,
  usage_count INT,
  confidence_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.id,
    kb.question_original,
    kb.response_text,
    kb.response_type,
    kb.response_metadata,
    calculate_text_similarity(query_text, kb.question_normalized) as similarity_score,
    kb.usage_count,
    kb.confidence_score
  FROM public.arthur_knowledge_base kb
  WHERE 
    (context_type_filter IS NULL OR kb.context_type = context_type_filter)
    AND (pharmacy_id_filter IS NULL OR kb.pharmacy_id = pharmacy_id_filter)
    AND kb.confidence_score >= 0.5 -- Only use responses with decent confidence
    AND calculate_text_similarity(query_text, kb.question_normalized) >= similarity_threshold
  ORDER BY 
    similarity_score DESC,
    kb.usage_count DESC,
    kb.confidence_score DESC
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to increment usage count
CREATE OR REPLACE FUNCTION public.increment_knowledge_usage(knowledge_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.arthur_knowledge_base
  SET 
    usage_count = usage_count + 1,
    last_used_at = now()
  WHERE id = knowledge_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies for knowledge base
ALTER TABLE public.arthur_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Everyone can read knowledge base (for Arthur to learn)
CREATE POLICY "Allow read access to knowledge base"
  ON public.arthur_knowledge_base
  FOR SELECT
  USING (true);

-- System can insert/update knowledge base
CREATE POLICY "System can manage knowledge base"
  ON public.arthur_knowledge_base
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comment for clarity
COMMENT ON TABLE public.arthur_knowledge_base IS 'Arthur''s learning database - stores question-response pairs for RAG system';
COMMENT ON FUNCTION public.search_arthur_knowledge IS 'Searches Arthur''s knowledge base using text similarity';
COMMENT ON FUNCTION public.calculate_text_similarity IS 'Calculates word-based similarity between two texts (0.0 to 1.0)';