import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ChatMessage from "@/components/ChatMessage";
import PromotionSlider from "@/components/PromotionSlider";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ChatSidebar } from "@/components/ChatSidebar";
import { useCart } from "@/contexts/CartContext";
import VoiceInterface from "@/components/VoiceInterface";
import PharmacyLogos from "@/components/PharmacyLogos";
interface Message {
  id: string;
  role: "user" | "assistant";
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
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [displayedProducts, setDisplayedProducts] = useState<any[]>([]);
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
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      // Récupérer le nom d'utilisateur
      const {
        data: profileData
      } = await supabase.from("profiles").select("username").eq("id", user.id).single();
      if (profileData?.username) {
        setUsername(profileData.username);
      }
    };
    getUser();
  }, []);

  // Charger les promotions quand la pharmacie sélectionnée change
  useEffect(() => {
    if (cart.selectedPharmacyId) {
      loadPromotions();
    }
  }, [cart.selectedPharmacyId]);

  // Surveiller les changements de conversationId dans l'URL
  useEffect(() => {
    const convId = searchParams.get("conversationId");
    const isNew = searchParams.get("new");
    if (isNew) {
      // Nouvelle conversation demandée - réinitialiser complètement l'état
      setConversationId(null);
      setMessages([]);
      setDisplayedProducts([]);
      return;
    }
    if (convId && convId !== conversationId) {
      // Conversation spécifiée dans l'URL : on la charge
      setConversationId(convId);
      loadConversationMessages(convId);
    } else if (!convId && !isNew && userId && !conversationId) {
      // Aucune conversation dans l'URL mais utilisateur connecté :
      // on recharge automatiquement la DERNIÈRE conversation de l'utilisateur
      const loadLastConversation = async () => {
        const {
          data,
          error
        } = await supabase.from("conversations").select("id").eq("user_id", userId).order("updated_at", {
          ascending: false
        }).limit(1).maybeSingle();
        if (error) {
          console.error("Error loading last conversation:", error);
          return;
        }
        if (data?.id) {
          setConversationId(data.id);
          // Mettre à jour l'URL pour refléter la conversation courante
          navigate(`/chat?conversationId=${data.id}`, {
            replace: true
          });
          loadConversationMessages(data.id);
        }
      };
      loadLastConversation();
    }
  }, [searchParams, userId]);
  useEffect(() => {
    // Scroll vers le haut du dernier message plutôt que vers le bas
    if (messages.length > 0) {
      lastMessageRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }, [messages]);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  };
  const loadConversationMessages = async (convId: string) => {
    const {
      data,
      error
    } = await supabase.from("messages").select("*").eq("conversation_id", convId).order("created_at", {
      ascending: true
    });
    if (error) {
      console.error("Error loading messages:", error);
      return;
    }
    const loadedMessages: Message[] = (data || []).map(msg => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      content: msg.content
    }));
    setMessages(loadedMessages);
  };
  const createConversation = async (uid: string) => {
    const {
      data,
      error
    } = await supabase.from("conversations").insert({
      user_id: uid,
      title: "Conversation avec Arthur"
    }).select().single();
    if (error) {
      console.error("Error creating conversation:", error);
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
      } = await supabase.from("promotions").select("*").eq("pharmacy_id", currentPharmacyId).gte("valid_until", new Date().toISOString()).order("created_at", {
        ascending: false
      });
      if (error) {
        console.error("Error loading promotions:", error);
        return;
      }
      setPromotions(data || []);
    } catch (error) {
      console.error("Error in loadPromotions:", error);
    }
  };
  const saveMessage = async (role: "user" | "assistant", content: string, convIdOverride?: string) => {
    const convId = convIdOverride ?? conversationId;
    if (!convId) return;
    const {
      error
    } = await supabase.from("messages").insert({
      conversation_id: convId,
      role,
      content
    });
    if (error) {
      console.error("Error saving message:", error);
      return;
    }

    // Mettre à jour l'horodatage de la conversation
    await supabase.from("conversations").update({
      updated_at: new Date().toISOString()
    }).eq("id", convId);
  };
  const handleSend = async () => {
    if (!input.trim() || loading || !userId) return;

    // Créer une conversation si elle n'existe pas encore
    let convIdToUse = conversationId as string | null;
    if (!convIdToUse) {
      const {
        data,
        error
      } = await supabase.from("conversations").insert({
        user_id: userId,
        title: "Conversation avec Arthur"
      }).select().single();
      if (error) {
        console.error("Error creating conversation:", error);
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
      role: "user",
      content: input.trim()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    await saveMessage("user", userMessage.content, convIdToUse || undefined);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("chat-with-arthur", {
        body: {
          messages: [{
            role: "user",
            content: userMessage.content
          }],
          conversationId: convIdToUse,
          userId,
          selectedPharmacyId: cart.selectedPharmacyId
        }
      });
      if (error) {
        // Gérer les erreurs spécifiques
        if (error.message?.includes("402") || error.message?.includes("Crédits")) {
          toast({
            title: "Crédits épuisés",
            description: "Ajoutez des crédits dans Settings → Workspace → Usage pour continuer.",
            variant: "destructive",
            duration: 10000
          });
          return;
        }
        if (error.message?.includes("429") || error.message?.includes("Quota")) {
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
      // Le edge function renvoie toujours data.message en chaîne de caractères
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message as string
      };
      setMessages(prev => [...prev, assistantMessage]);
      await saveMessage("assistant", assistantMessage.content, convIdToUse || undefined);

      // Generate conversation title after first exchange
      if (messages.length === 0 && convIdToUse) {
        try {
          const {
            data: titleData
          } = await supabase.functions.invoke("generate-conversation-title", {
            body: {
              firstUserMessage: userMessage.content
            }
          });
          if (titleData?.title) {
            await supabase.from("conversations").update({
              title: titleData.title
            }).eq("id", convIdToUse);
          }
        } catch (error) {
          console.error("Error generating title:", error);
        }
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
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
    } = await supabase.from("recommendations").insert({
      user_id: userId,
      conversation_id: conversationId,
      promotion_id: promotion.id,
      product_name: promotion.title,
      notes: promotion.description
    });
    if (error) {
      console.error("Error saving recommendation:", error);
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
  const handleDisplayProducts = async (products: any[]) => {
    console.log("✅ Displaying products in chat:", products);
    setDisplayedProducts(products);
    
    if (!products || products.length === 0) {
      console.warn('⚠️ No products to display');
      return;
    }
    
    // Créer un message Arthur avec le format JSON structuré type "products"
    const productsMessage = {
      type: "products",
      message: "Solutions pour votre besoin\n\nVoici les produits que je vous recommande.",
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        price: p.price,
        reason: p.description || "Produit recommandé par Arthur pour votre besoin",
        image_url: p.image_url,
        category: p.category,
        available_in_pharmacy: true
      }))
    };
    
    const assistantMessage: Message = {
      id: `voice-products-${Date.now()}`,
      role: "assistant",
      content: JSON.stringify(productsMessage)
    };
    
    console.log('📦 Adding products message to chat:', assistantMessage);
    setMessages(prev => [...prev, assistantMessage]);
    
    // Sauvegarder dans la base
    if (conversationId) {
      await saveMessage("assistant", JSON.stringify(productsMessage), conversationId);
    }
  };
  const handleAddToCart = async (product: any) => {
    try {
      await cart.addToCart({
        id: product.productId,
        productId: product.productId,
        name: product.name,
        brand: product.brand,
        price: product.price,
        imageUrl: product.imageUrl || "",
        source: "arthur",
        reason: "Ajouté par Arthur"
      }, cart.selectedPharmacyId || "");
      toast({
        title: "✅ Ajouté au panier",
        description: `${product.name} (${product.brand})`
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter au panier",
        variant: "destructive"
      });
    }
  };
  const handleNavigate = (page: string, message?: string, guidance?: string) => {
    console.log('Navigating to:', page, message, guidance);
    if (message) {
      toast({
        title: "Arthur vous guide",
        description: message
      });
    }

    // Navigate to the specified page
    navigate(page);

    // If there's guidance, add it as an assistant message
    if (guidance) {
      const assistantMessage: Message = {
        id: `nav-${Date.now()}`,
        role: "assistant",
        content: guidance
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Save to database if we have a conversation
      if (conversationId) {
        saveMessage("assistant", guidance, conversationId);
      }
    }
  };
  const handleTranscript = async (text: string, isFinal: boolean) => {
    if (!text.trim()) return;
    if (isFinal) {
      // S'assurer qu'une conversation existe (cas où l'utilisateur commence par la voix)
      let convIdToUse = conversationId as string | null;
      let isNewConversation = false;
      if (!convIdToUse && userId) {
        const {
          data,
          error
        } = await supabase.from("conversations").insert({
          user_id: userId,
          title: "Conversation avec Arthur"
        }).select().single();
        if (error) {
          console.error("Error creating conversation from voice:", error);
          toast({
            title: "Erreur",
            description: "Impossible de créer la conversation pour l'historique",
            variant: "destructive"
          });
          return;
        }
        convIdToUse = data.id;
        setConversationId(data.id);
        isNewConversation = true;
        // Mettre à jour l'URL avec le conversationId
        navigate(`/chat?conversationId=${data.id}`, {
          replace: true
        });
      }

      // Message final - ajouter à l'historique local
      const assistantMessage: Message = {
        id: `voice-${Date.now()}`,
        role: "assistant",
        content: text
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Sauvegarder dans la base de données si on a une conversation
      if (convIdToUse) {
        await saveMessage("assistant", text, convIdToUse);

        // Générer un titre si c'est une nouvelle conversation
        if (isNewConversation && messages.length === 0) {
          try {
            const {
              data: titleData
            } = await supabase.functions.invoke("generate-conversation-title", {
              body: {
                firstUserMessage: text
              }
            });
            if (titleData?.title) {
              await supabase.from("conversations").update({
                title: titleData.title
              }).eq("id", convIdToUse);
            }
          } catch (error) {
            console.error("Error generating title:", error);
          }
        }
      }
    }
  };
  return <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full bg-gradient-subtle">
        <ChatSidebar />

        <div className="flex flex-col flex-1 w-full">
          {/* Header */}
          <div className="bg-card border-b border-border shadow-sm sticky top-0 z-10">
            <div className="max-w-4xl w-full mx-auto px-4 py-3 flex items-center gap-3">
              <SidebarTrigger className="flex-shrink-0 h-9 w-9 lg:hidden" />
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full flex-shrink-0 h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <PharmacyLogos size="md" />
                <div className="min-w-0 flex-1">
                  <h1 className="font-semibold text-foreground text-base">Arthur</h1>
                  <p className="text-xs text-muted-foreground truncate">Assistant parapharmacie</p>
                </div>
              </div>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto pb-[340px] sm:pb-[300px]">
            <div className="max-w-4xl w-full mx-auto px-4 py-6">
              {/* Welcome Message */}
              {messages.length === 0 && <div className="text-center mt-0 mb-0 py-0">
                  <div className="flex justify-center items-center mb-4">
                    <PharmacyLogos size="xxl" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Bonjour{username ? ` ${username}` : ""} ! Je suis Arthur
                  </h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Votre assistant virtuel en parapharmacie. Posez-moi vos questions sur les produits de santé et de
                    bien-être !
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
                    role: "user",
                    content: selected.trim()
                  };
                  setMessages(prev => [...prev, userMessage]);
                  setInput("");
                  setLoading(true);
                  await saveMessage("user", userMessage.content);
                  try {
                    const {
                      data,
                      error
                    } = await supabase.functions.invoke("chat-with-arthur", {
                      body: {
                        messages: [{
                          role: "user",
                          content: userMessage.content
                        }],
                        conversationId,
                        userId
                      }
                    });
                    if (error) throw error;
                    // Le edge function renvoie toujours data.message en chaîne de caractères
                    const assistantMessage: Message = {
                      id: (Date.now() + 1).toString(),
                      role: "assistant",
                      content: data.message as string
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                    await saveMessage("assistant", assistantMessage.content);

                    // Generate conversation title after first exchange
                    if (messages.length === 0) {
                      try {
                        const {
                          data: titleData
                        } = await supabase.functions.invoke("generate-conversation-title", {
                          body: {
                            firstUserMessage: userMessage.content
                          }
                        });
                        if (titleData?.title && conversationId) {
                          await supabase.from("conversations").update({
                            title: titleData.title
                          }).eq("id", conversationId);
                        }
                      } catch (error) {
                        console.error("Error generating title:", error);
                      }
                    }
                  } catch (error: any) {
                    console.error("Error sending message:", error);
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
                    animationDelay: "0.1s"
                  }}></div>
                      <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{
                    animationDelay: "0.2s"
                  }}></div>
                    </div>
                  </div>
                </div>}

              {/* Display products from Arthur */}
              {displayedProducts.length > 0 && <div className="mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex gap-3 justify-start mb-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="bg-card border border-border rounded-2xl px-4 py-3 shadow-sm max-w-[85%]">
                      <p className="text-sm font-medium mb-3">Voici les produits disponibles :</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {displayedProducts.map(product => <ProductCard key={product.id} product={product} pharmacyId={cart.selectedPharmacyId || ""} />)}
                      </div>
                    </div>
                  </div>
                </div>}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input, Voice Interface & Footer - grouped container */}
          <div className="fixed bottom-0 left-0 right-0 z-30">
            {/* Input & Voice Interface - directly above footer */}
            <div className="bg-card border-t border-border shadow-xl">
              {/* Promotions Slider */}
              {promotions.length > 0 && <div className="border-b border-border bg-muted/30 backdrop-blur-sm">
                  <div className="w-full px-4 py-3 max-w-4xl mx-auto">
                    <PromotionSlider promotions={promotions} onSelectPromotion={handleSelectPromotion} />
                  </div>
                </div>}

              <div className="max-w-4xl w-full mx-auto px-4 py-4 pb-[62px]">
                {/* Voice Interface */}
                <div className="mb-4">
                  <VoiceInterface userId={userId} selectedPharmacyId={cart.selectedPharmacyId} onDisplayProducts={handleDisplayProducts} onAddToCart={handleAddToCart} onTranscript={handleTranscript} onNavigate={handleNavigate} />
                </div>

                {/* Text Input */}
                <div className="flex gap-3 pb-[11px]">
                  <Input value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === "Enter" && handleSend()} placeholder="Écrivez votre question..." disabled={loading} className="flex-1 rounded-full border-2 focus-visible:ring-primary h-12 px-5 text-base" />
                  <Button onClick={handleSend} disabled={loading || !input.trim()} className="rounded-full bg-gradient-primary hover:opacity-90 transition-opacity h-12 w-12 p-0 flex items-center justify-center">
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer Menu - directly under input area, no gap */}
            <div className="relative z-20">
              <Footer />
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>;
};
export default Chat;