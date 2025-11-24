-- Fix security warnings for new functions by setting search_path

-- Fix calculate_text_similarity
DROP FUNCTION IF EXISTS public.calculate_text_similarity(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.calculate_text_similarity(text1 TEXT, text2 TEXT)
RETURNS NUMERIC 
LANGUAGE plpgsql 
IMMUTABLE
SET search_path = 'public'
AS $$
DECLARE
  len1 INT := length(text1);
  len2 INT := length(text2);
  max_len INT := GREATEST(len1, len2);
  common_words INT;
  words1 TEXT[];
  words2 TEXT[];
BEGIN
  words1 := string_to_array(lower(text1), ' ');
  words2 := string_to_array(lower(text2), ' ');
  
  SELECT COUNT(*) INTO common_words
  FROM unnest(words1) w1
  WHERE w1 = ANY(words2);
  
  IF max_len = 0 THEN
    RETURN 1.0;
  END IF;
  
  RETURN LEAST(1.0, (common_words::NUMERIC * 2.0) / (array_length(words1, 1) + array_length(words2, 1))::NUMERIC);
END;
$$;

-- Fix search_arthur_knowledge
DROP FUNCTION IF EXISTS public.search_arthur_knowledge(TEXT, TEXT, UUID, NUMERIC, INT);
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
)
LANGUAGE plpgsql 
STABLE
SET search_path = 'public'
AS $$
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
  FROM arthur_knowledge_base kb
  WHERE 
    (context_type_filter IS NULL OR kb.context_type = context_type_filter)
    AND (pharmacy_id_filter IS NULL OR kb.pharmacy_id = pharmacy_id_filter)
    AND kb.confidence_score >= 0.5
    AND calculate_text_similarity(query_text, kb.question_normalized) >= similarity_threshold
  ORDER BY 
    similarity_score DESC,
    kb.usage_count DESC,
    kb.confidence_score DESC
  LIMIT limit_results;
END;
$$;

-- Fix increment_knowledge_usage
DROP FUNCTION IF EXISTS public.increment_knowledge_usage(UUID);
CREATE OR REPLACE FUNCTION public.increment_knowledge_usage(knowledge_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  UPDATE arthur_knowledge_base
  SET 
    usage_count = usage_count + 1,
    last_used_at = now()
  WHERE id = knowledge_id;
END;
$$;