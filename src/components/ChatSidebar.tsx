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

    // Charger toutes les conversations avec le nombre de messages
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages(count)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading conversations:', error);
      return;
    }

    // Filtrer et identifier les conversations vides
    const conversationsWithMessages: Conversation[] = [];
    const emptyConversationIds: string[] = [];

    for (const conv of data || []) {
      const messageCount = (conv.messages as any)?.[0]?.count || 0;
      
      if (messageCount > 0) {
        conversationsWithMessages.push({
          id: conv.id,
          title: conv.title,
          created_at: conv.created_at,
          updated_at: conv.updated_at
        });
      } else {
        // Vérifier l'âge de la conversation - ne supprimer que si elle a plus de 5 minutes
        const createdAt = new Date(conv.created_at);
        const now = new Date();
        const ageInMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
        
        if (ageInMinutes > 5) {
          emptyConversationIds.push(conv.id);
        }
      }
    }

    // Supprimer uniquement les conversations vides qui ont plus de 5 minutes
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
    <Sidebar className="w-64 md:w-72 bg-background border-r border-border">
      <SidebarHeader className="p-3 border-b border-border bg-background">
        <Button
          onClick={createNewConversation}
          className="w-full justify-start gap-2 text-sm"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          <span className="text-foreground">Nouvelle conversation</span>
        </Button>
      </SidebarHeader>

      <SidebarContent className="bg-background overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground px-3 py-2 text-xs">
            Historique
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {conversations.map((conv) => (
                <SidebarMenuItem key={conv.id}>
                  <SidebarMenuButton
                    onClick={() => navigate(`/chat?conversationId=${conv.id}`)}
                    className={`group relative text-foreground text-sm ${
                      isActive(conv.id)
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'hover:bg-accent/50 hover:text-accent-foreground'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="flex-1 truncate text-xs sm:text-sm">
                      {conv.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 flex-shrink-0"
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