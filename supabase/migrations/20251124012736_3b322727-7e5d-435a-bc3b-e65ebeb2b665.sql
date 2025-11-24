-- Ajouter CASCADE DELETE sur la foreign key de messages vers conversations
ALTER TABLE public.messages 
DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;

ALTER TABLE public.messages 
ADD CONSTRAINT messages_conversation_id_fkey 
FOREIGN KEY (conversation_id) 
REFERENCES public.conversations(id) 
ON DELETE CASCADE;

-- Ajouter une politique DELETE pour que les utilisateurs puissent supprimer les messages de leurs conversations
CREATE POLICY "Users can delete messages from own conversations"
ON public.messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = auth.uid()
  )
);