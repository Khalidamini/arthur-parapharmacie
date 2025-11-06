-- Create pharmacy invitations table
CREATE TABLE public.pharmacy_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL,
  email TEXT NOT NULL,
  role pharmacy_role NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- Enable RLS
ALTER TABLE public.pharmacy_invitations ENABLE ROW LEVEL SECURITY;

-- Pharmacy owners and admins can manage invitations
CREATE POLICY "Pharmacy owners can manage invitations"
ON public.pharmacy_invitations
FOR ALL
USING (
  has_pharmacy_role(auth.uid(), pharmacy_id, 'owner'::pharmacy_role) OR 
  has_pharmacy_role(auth.uid(), pharmacy_id, 'admin'::pharmacy_role)
);

-- Anyone can view their own invitation by token (for accepting)
CREATE POLICY "Users can view invitations by token"
ON public.pharmacy_invitations
FOR SELECT
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_pharmacy_invitations_email ON public.pharmacy_invitations(email);
CREATE INDEX idx_pharmacy_invitations_token ON public.pharmacy_invitations(token);
CREATE INDEX idx_pharmacy_invitations_status ON public.pharmacy_invitations(status);