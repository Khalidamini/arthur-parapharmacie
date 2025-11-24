-- Améliorer la fonction de recherche pour inclure aussi le contenu des réponses
-- Cela permet de trouver les informations brutes stockées dans le RAG
DROP FUNCTION IF EXISTS search_arthur_knowledge(text, text, uuid, numeric, integer);

CREATE OR REPLACE FUNCTION search_arthur_knowledge(
  query_text text,
  context_type_filter text DEFAULT NULL,
  pharmacy_id_filter uuid DEFAULT NULL,
  similarity_threshold numeric DEFAULT 0.6,
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH scored_results AS (
    SELECT 
      kb.id,
      kb.question_original,
      kb.response_text,
      kb.response_type,
      kb.response_metadata,
      kb.usage_count,
      kb.confidence_score,
      -- Calculer la similarité à la fois sur la question ET sur la réponse
      GREATEST(
        calculate_text_similarity(query_text, kb.question_normalized),
        calculate_text_similarity(query_text, LOWER(REGEXP_REPLACE(kb.response_text, '[^\w\s]', '', 'g')))
      ) as similarity_score
    FROM arthur_knowledge_base kb
    WHERE 
      (context_type_filter IS NULL OR kb.context_type = context_type_filter)
      AND (pharmacy_id_filter IS NULL OR kb.pharmacy_id = pharmacy_id_filter)
      AND kb.confidence_score >= 0.5
  )
  SELECT 
    sr.id,
    sr.question_original,
    sr.response_text,
    sr.response_type,
    sr.response_metadata,
    sr.similarity_score,
    sr.usage_count,
    sr.confidence_score
  FROM scored_results sr
  WHERE sr.similarity_score >= similarity_threshold
  ORDER BY 
    sr.similarity_score DESC,
    sr.usage_count DESC,
    sr.confidence_score DESC
  LIMIT limit_results;
END;
$$;