import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ChatMessage from '@/components/ChatMessage';
import PromotionSlider from '@/components/PromotionSlider';
import ProductCard from '@/components/ProductCard';
import Footer from '@/components/Footer';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ChatSidebar } from '@/components/ChatSidebar';
import { useCart } from '@/contexts/CartContext';
import VoiceInterface from '@/components/VoiceInterface';
import VoiceVisualizer from '@/components/VoiceVisualizer';
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}
interface Promotion {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  valid_until: string;
  image_url?: string;
  original_price?: number;
}
const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [displayedProducts, setDisplayedProducts] = useState<any[]>([]);
  const [isArthurSpeaking, setIsArthurSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const cart = useCart();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const getUser = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Connexion requise",
          description: "Vous devez être connecté pour accéder au chat"
        });
        navigate('/auth');
        return;
      }
      setUserId(user.id);

      // Récupérer le nom d'utilisateur
      const {
        data: profileData
      } = await supabase.from('profiles').select('username').eq('id', user.id).single();
      if (profileData?.username) {
        setUsername(profileData.username);
      }
    };
    getUser();
    loadPromotions();
  }, []);

  // Surveiller les changements de conversationId dans l'URL
  useEffect(() => {
    const convId = searchParams.get('conversationId');
    if (convId && convId !== conversationId) {
      setConversationId(convId);
      loadConversationMessages(convId);
    } else if (!convId) {
      // Nouvelle conversation vide
      setConversationId(null);
      setMessages([]);
    }
  }, [searchParams]);
  useEffect(() => {
    // Scroll vers le haut du dernier message plutôt que vers le bas
    if (messages.length > 0) {
      lastMessageRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [messages]);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  const loadConversationMessages = async (convId: string) => {
    const {
      data,
      error
    } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', {
      ascending: true
    });
    if (error) {
      console.error('Error loading messages:', error);
      return;
    }
    const loadedMessages: Message[] = (data || []).map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
    setMessages(loadedMessages);
  };
  const createConversation = async (uid: string) => {
    const {
      data,
      error
    } = await supabase.from('conversations').insert({
      user_id: uid,
      title: 'Conversation avec Arthur'
    }).select().single();
    if (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la conversation",
        variant: "destructive"
      });
      return;
    }
    setConversationId(data.id);
  };
  const loadPromotions = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;

      // Utiliser la pharmacie sélectionnée du contexte
      const currentPharmacyId = cart.selectedPharmacyId;
      if (!currentPharmacyId) {
        setPromotions([]);
        return;
      }

      // Charger uniquement les promotions non expirées de la pharmacie sélectionnée
      const {
        data,
        error
      } = await supabase.from('promotions').select('*').eq('pharmacy_id', currentPharmacyId).gte('valid_until', new Date().toISOString()).order('created_at', {
        ascending: false
      });
      if (error) {
        console.error('Error loading promotions:', error);
        return;
      }
      setPromotions(data || []);
    } catch (error) {
      console.error('Error in loadPromotions:', error);
    }
  };
  const saveMessage = async (role: 'user' | 'assistant', content: string, convIdOverride?: string) => {
    const convId = convIdOverride ?? conversationId;
    if (!convId) return;
    const {
      error
    } = await supabase.from('messages').insert({
      conversation_id: convId,
      role,
      content
    });
    if (error) {
      console.error('Error saving message:', error);
      return;
    }

    // Mettre à jour l'horodatage de la conversation
    await supabase.from('conversations').update({
      updated_at: new Date().toISOString()
    }).eq('id', convId);
  };
  const handleSend = async () => {
    if (!input.trim() || loading || !userId) return;

    // Créer une conversation si elle n'existe pas encore
    let convIdToUse = conversationId as string | null;
    if (!convIdToUse) {
      const {
        data,
        error
      } = await supabase.from('conversations').insert({
        user_id: userId,
        title: 'Conversation avec Arthur'
      }).select().single();
      if (error) {
        console.error('Error creating conversation:', error);
        toast({
          title: "Erreur",
          description: "Impossible de créer la conversation",
          variant: "destructive"
        });
        return;
      }
      convIdToUse = data.id;
      setConversationId(data.id);
      // Mettre à jour l'URL avec le conversationId
      navigate(`/chat?conversationId=${data.id}`, {
        replace: true
      });
    }
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    await saveMessage('user', userMessage.content, convIdToUse || undefined);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('chat-with-arthur', {
        body: {
          messages: [{
            role: 'user',
            content: userMessage.content
          }],
          conversationId: convIdToUse,
          userId,
          selectedPharmacyId: cart.selectedPharmacyId
        }
      });
      if (error) {
        // Gérer les erreurs spécifiques
        if (error.message?.includes('402') || error.message?.includes('Crédits')) {
          toast({
            title: "Crédits épuisés",
            description: "Ajoutez des crédits dans Settings → Workspace → Usage pour continuer.",
            variant: "destructive",
            duration: 10000
          });
          return;
        }
        if (error.message?.includes('429') || error.message?.includes('Quota')) {
          toast({
            title: "Quota OpenAI dépassé",
            description: "Ajoutez des crédits sur platform.openai.com/account/billing",
            variant: "destructive",
            duration: 10000
          });
          return;
        }
        throw error;
      }
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message
      };
      setMessages(prev => [...prev, assistantMessage]);
      await saveMessage('assistant', assistantMessage.content, convIdToUse || undefined);

      // Generate conversation title after first exchange
      if (messages.length === 0 && convIdToUse) {
        try {
          const {
            data: titleData
          } = await supabase.functions.invoke('generate-conversation-title', {
            body: {
              firstUserMessage: userMessage.content
            }
          });
          if (titleData?.title) {
            await supabase.from('conversations').update({
              title: titleData.title
            }).eq('id', convIdToUse);
          }
        } catch (error) {
          console.error('Error generating title:', error);
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de contacter Arthur",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleSelectPromotion = async (promotion: Promotion) => {
    if (!userId) return;
    const {
      error
    } = await supabase.from('recommendations').insert({
      user_id: userId,
      conversation_id: conversationId,
      promotion_id: promotion.id,
      product_name: promotion.title,
      notes: promotion.description
    });
    if (error) {
      console.error('Error saving recommendation:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la promotion à vos recommandations",
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Promotion ajoutée",
      description: "La promotion a été ajoutée à vos recommandations"
    });
  };

  const handleDisplayProducts = (products: any[]) => {
    console.log('Displaying products in chat:', products);
    setDisplayedProducts(products);
  };

  const handleAddToCart = async (product: any) => {
    try {
      await cart.addToCart({
        id: product.productId,
        productId: product.productId,
        name: product.name,
        brand: product.brand,
        price: product.price,
        imageUrl: product.imageUrl || '',
        source: 'arthur',
        reason: 'Ajouté par Arthur'
      }, cart.selectedPharmacyId || '');

      toast({
        title: "✅ Ajouté au panier",
        description: `${product.name} (${product.brand})`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter au panier",
        variant: "destructive"
      });
    }
  };

  const handleTranscript = (text: string, isFinal: boolean) => {
    if (!text.trim()) return;

    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      
      if (isFinal) {
        // Message final, on crée ou finalise le message assistant
        if (lastMessage?.role === 'assistant' && !lastMessage.id.startsWith('final-')) {
          // Remplacer le message temporaire par le message final
          return [
            ...prev.slice(0, -1),
            {
              id: `final-${Date.now()}`,
              role: 'assistant' as const,
              content: text
            }
          ];
        } else {
          // Ajouter un nouveau message final
          return [
            ...prev,
            {
              id: `final-${Date.now()}`,
              role: 'assistant' as const,
              content: text
            }
          ];
        }
      } else {
        // Message temporaire (delta), on accumule
        if (lastMessage?.role === 'assistant' && !lastMessage.id.startsWith('final-')) {
          // Mettre à jour le message assistant en cours
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              content: lastMessage.content + text
            }
          ];
        } else {
          // Créer un nouveau message assistant temporaire
          return [
            ...prev,
            {
              id: `temp-${Date.now()}`,
              role: 'assistant' as const,
              content: text
            }
          ];
        }
      }
    });

    // Sauvegarder le message final dans la base de données
    if (isFinal && conversationId) {
      saveMessage('assistant', text);
    }
  };

  return <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-subtle">
        <ChatSidebar />
        
        {/* Voice Visualizer */}
        <VoiceVisualizer isSpeaking={isArthurSpeaking} />
        
        <div className="flex flex-col flex-1 h-screen">
          {/* Header */}
          <div className="bg-card border-b border-border shadow-sm sticky top-0 z-10">
            <div className="max-w-3xl w-full mx-auto px-3 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <SidebarTrigger className="flex-shrink-0 h-8 w-8" />
                <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full flex-shrink-0 h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <img src="/icon-192.png" alt="Arthur Logo" className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h1 className="font-semibold text-foreground text-sm truncate">Arthur</h1>
                    <p className="text-xs text-muted-foreground truncate hidden sm:block">Assistant parapharmacie</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto pb-80 sm:pb-72">
            <div className="max-w-3xl w-full mx-auto px-3 py-4">

              {/* Welcome Message */}
              {messages.length === 0 && <div className="text-center py-12 animate-in fade-in duration-500">
                  <div className="inline-flex h-16 w-16 items-center justify-center mb-4">
                    <img src="/icon-192.png" alt="Arthur Logo" className="h-16 w-16 rounded-full" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Bonjour{username ? ` ${username}` : ''} ! Je suis Arthur
                  </h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Votre assistant virtuel en parapharmacie. Posez-moi vos questions sur les produits de santé et de bien-être !
                  </p>
                </div>}

              {/* Chat Messages */}
              {messages.map((message, index) => <div key={message.id} ref={index === messages.length - 1 ? lastMessageRef : null}>
                  <ChatMessage role={message.role} content={message.content} onOptionSelect={selected => {
                setInput(selected);
                // Envoyer automatiquement le message après avoir sélectionné une option
                setTimeout(async () => {
                  if (!selected.trim() || loading) return;
                  const userMessage: Message = {
                    id: Date.now().toString(),
                    role: 'user',
                    content: selected.trim()
                  };
                  setMessages(prev => [...prev, userMessage]);
                  setInput('');
                  setLoading(true);
                  await saveMessage('user', userMessage.content);
                  try {
                    const {
                      data,
                      error
                    } = await supabase.functions.invoke('chat-with-arthur', {
                      body: {
                        messages: [{
                          role: 'user',
                          content: userMessage.content
                        }],
                        conversationId,
                        userId
                      }
                    });
                    if (error) throw error;
                    const assistantMessage: Message = {
                      id: (Date.now() + 1).toString(),
                      role: 'assistant',
                      content: data.message
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                    await saveMessage('assistant', assistantMessage.content);

                    // Generate conversation title after first exchange
                    if (messages.length === 0) {
                      try {
                        const {
                          data: titleData
                        } = await supabase.functions.invoke('generate-conversation-title', {
                          body: {
                            firstUserMessage: userMessage.content
                          }
                        });
                        if (titleData?.title && conversationId) {
                          await supabase.from('conversations').update({
                            title: titleData.title
                          }).eq('id', conversationId);
                        }
                      } catch (error) {
                        console.error('Error generating title:', error);
                      }
                    }
                  } catch (error: any) {
                    console.error('Error sending message:', error);
                    toast({
                      title: "Erreur",
                      description: error.message || "Impossible de contacter Arthur",
                      variant: "destructive"
                    });
                  } finally {
                    setLoading(false);
                  }
                }, 100);
              }} />
                </div>)}

              {loading && <div className="flex gap-3 justify-start mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
                    <div className="h-2 w-2 bg-primary-foreground rounded-full animate-pulse"></div>
                  </div>
                  <div className="bg-card border border-border rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                      <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{
                    animationDelay: '0.1s'
                  }}></div>
                      <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{
                    animationDelay: '0.2s'
                  }}></div>
                    </div>
                  </div>
                </div>}

              {/* Display products from Arthur */}
              {displayedProducts.length > 0 && (
                <div className="mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex gap-3 justify-start mb-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="bg-card border border-border rounded-2xl px-4 py-3 shadow-sm max-w-[85%]">
                      <p className="text-sm font-medium mb-3">Voici les produits disponibles :</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {displayedProducts.map((product) => (
                          <ProductCard 
                            key={product.id} 
                            product={product}
                            pharmacyId={cart.selectedPharmacyId || ''}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input & Voice Interface - positionné au-dessus du footer mobile */}
          <div className="fixed bottom-16 sm:bottom-20 left-0 right-0 bg-card shadow-lg z-30">
            {/* Promotions Slider - juste au-dessus de l'input */}
            {promotions.length > 0 && (
              <div className="border-t border-b border-border bg-card/95 backdrop-blur-sm">
                <div className="w-full px-2 sm:px-3 py-2 max-w-3xl mx-auto">
                  <PromotionSlider promotions={promotions} onSelectPromotion={handleSelectPromotion} />
                </div>
              </div>
            )}
            
            <div className="max-w-3xl w-full mx-auto px-3 py-3 border-t border-border">
              {/* Voice Interface - compact version */}
              <div className="mb-3">
                <VoiceInterface 
                  userId={userId} 
                  selectedPharmacyId={cart.selectedPharmacyId}
                  onDisplayProducts={handleDisplayProducts}
                  onAddToCart={handleAddToCart}
                  onTranscript={handleTranscript}
                  onSpeakingChange={setIsArthurSpeaking}
                />
              </div>
              
              {/* Text Input */}
              <div className="flex gap-2">
                <Input value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Ou écrivez votre question..." disabled={loading} className="flex-1 rounded-full border-2 focus-visible:ring-primary text-sm" />
                <Button onClick={handleSend} disabled={loading || !input.trim()} className="rounded-full bg-gradient-primary hover:opacity-90 transition-opacity px-6">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="fixed bottom-0 left-0 right-0 z-20">
            <Footer />
          </div>
        </div>
      </div>
    </SidebarProvider>;
};
export default Chat;