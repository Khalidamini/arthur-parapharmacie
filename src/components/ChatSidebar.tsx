import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function ChatSidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentConvId = searchParams.get('conversationId');

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Charger toutes les conversations de l'utilisateur
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading conversations:', error);
      return;
    }

    // Filtrer les conversations qui ont au moins un message
    const conversationsWithMessages: Conversation[] = [];
    const emptyConversationIds: string[] = [];

    for (const conv of data || []) {
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conv.id)
        .limit(1);

      if (messages && messages.length > 0) {
        conversationsWithMessages.push(conv);
      } else {
        emptyConversationIds.push(conv.id);
      }
    }

    // Supprimer les conversations vides
    if (emptyConversationIds.length > 0) {
      await supabase
        .from('conversations')
        .delete()
        .in('id', emptyConversationIds);
    }

    setConversations(conversationsWithMessages);
  };

  const createNewConversation = () => {
    // Ne pas créer de conversation en base de données
    // La conversation sera créée automatiquement lors de l'envoi du premier message
    navigate('/chat');
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', convId);

    if (error) {
      console.error('Error deleting conversation:', error);
      toast.error("Impossible de supprimer la conversation");
      return;
    }

    setConversations(prev => prev.filter(c => c.id !== convId));
    
    if (currentConvId === convId) {
      navigate('/chat');
    }
    
    toast.success("Conversation supprimée");
  };

  const isActive = (convId: string) => currentConvId === convId;

  return (
    <Sidebar className="w-64 bg-background border-r border-border">
      <SidebarHeader className="p-4 border-b border-border bg-background">
        <Button
          onClick={createNewConversation}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          <span className="text-foreground">Nouvelle conversation</span>
        </Button>
      </SidebarHeader>

      <SidebarContent className="bg-background">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground px-4 py-2">
            Historique
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {conversations.map((conv) => (
                <SidebarMenuItem key={conv.id}>
                  <SidebarMenuButton
                    onClick={() => navigate(`/chat?conversationId=${conv.id}`)}
                    className={`group relative text-foreground ${
                      isActive(conv.id)
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'hover:bg-accent/50 hover:text-accent-foreground'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 truncate text-sm">
                      {conv.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                      onClick={(e) => deleteConversation(conv.id, e)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}