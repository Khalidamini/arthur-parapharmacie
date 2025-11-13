-- Enable realtime for carts table
ALTER TABLE public.carts REPLICA IDENTITY FULL;

-- Add carts table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.carts;