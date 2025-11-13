-- Create activity logs table for pharmacy operations tracking
CREATE TABLE public.pharmacy_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_details JSONB,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pharmacy_activity_logs ENABLE ROW LEVEL SECURITY;

-- Create index for better performance
CREATE INDEX idx_pharmacy_activity_logs_pharmacy_id ON public.pharmacy_activity_logs(pharmacy_id);
CREATE INDEX idx_pharmacy_activity_logs_user_id ON public.pharmacy_activity_logs(user_id);
CREATE INDEX idx_pharmacy_activity_logs_created_at ON public.pharmacy_activity_logs(created_at DESC);
CREATE INDEX idx_pharmacy_activity_logs_action_type ON public.pharmacy_activity_logs(action_type);

-- RLS Policies
CREATE POLICY "Pharmacy staff can view their pharmacy logs"
  ON public.pharmacy_activity_logs
  FOR SELECT
  USING (
    has_pharmacy_role(auth.uid(), pharmacy_id, 'owner'::pharmacy_role) OR 
    has_pharmacy_role(auth.uid(), pharmacy_id, 'admin'::pharmacy_role)
  );

CREATE POLICY "System can insert activity logs"
  ON public.pharmacy_activity_logs
  FOR INSERT
  WITH CHECK (true);

-- Create function to log activity
CREATE OR REPLACE FUNCTION public.log_pharmacy_activity(
  _pharmacy_id UUID,
  _user_id UUID,
  _action_type TEXT,
  _action_details JSONB DEFAULT NULL,
  _entity_type TEXT DEFAULT NULL,
  _entity_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.pharmacy_activity_logs (
    pharmacy_id,
    user_id,
    action_type,
    action_details,
    entity_type,
    entity_id
  ) VALUES (
    _pharmacy_id,
    _user_id,
    _action_type,
    _action_details,
    _entity_type,
    _entity_id
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;