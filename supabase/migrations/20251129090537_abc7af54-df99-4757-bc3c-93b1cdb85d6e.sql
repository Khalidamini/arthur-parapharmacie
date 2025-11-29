-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to arthur_knowledge_base
ALTER TABLE public.arthur_knowledge_base 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for fast vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS arthur_knowledge_embedding_idx 
ON public.arthur_knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Drop old search function
DROP FUNCTION IF EXISTS public.search_arthur_knowledge(text, text, uuid, numeric, integer);

-- Create new vector-based search function
CREATE OR REPLACE FUNCTION public.search_arthur_knowledge_vector(
  query_embedding vector(1536),
  context_type_filter text DEFAULT NULL,
  pharmacy_id_filter uuid DEFAULT NULL,
  similarity_threshold numeric DEFAULT 0.7,
  limit_results integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  question_original text,
  response_text text,
  response_type text,
  response_metadata jsonb,
  similarity_score numeric,
  usage_count integer,
  confidence_score numeric
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.id,
    kb.question_original,
    kb.response_text,
    kb.response_type,
    kb.response_metadata,
    -- Convert cosine distance to similarity (1 - distance)
    (1 - (kb.embedding <=> query_embedding))::numeric as similarity_score,
    kb.usage_count,
    kb.confidence_score
  FROM arthur_knowledge_base kb
  WHERE 
    kb.embedding IS NOT NULL
    AND (context_type_filter IS NULL OR kb.context_type = context_type_filter)
    AND (pharmacy_id_filter IS NULL OR kb.pharmacy_id = pharmacy_id_filter)
    AND kb.confidence_score >= 0.5
    AND (1 - (kb.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY 
    kb.embedding <=> query_embedding ASC,
    kb.usage_count DESC,
    kb.confidence_score DESC
  LIMIT limit_results;
END;
$$;