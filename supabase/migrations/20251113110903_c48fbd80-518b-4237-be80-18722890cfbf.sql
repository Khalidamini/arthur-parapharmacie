-- Allow pharmacy team members to view profiles of other team members in the same pharmacy
CREATE POLICY "Pharmacy team members can view other members profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur1
    INNER JOIN user_roles ur2 ON ur1.pharmacy_id = ur2.pharmacy_id
    WHERE ur1.user_id = auth.uid()
    AND ur2.user_id = profiles.id
  )
);