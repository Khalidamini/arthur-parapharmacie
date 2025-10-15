import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, Tag, Trash2, MessageSquare, Bot, User, MessageCircle, UserX, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Recommendation {
  id: string;
  product_name: string;
  notes: string;
  created_at: string;
  conversation_id: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  messages: Message[];
}

interface ProductRecommendation {
  productName: string;
  conversationId: string;
  conversationDate: string;
  context: string;
}

const Recommendations = () => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [productRecommendations, setProductRecommendations] = useState<ProductRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [profileData, setProfileData] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    // Charger le profil
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    setProfileData(profile);

    // Load recommendations
    const { data: recsData, error: recsError } = await supabase
      .from('recommendations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (recsError) {
      console.error('Error loading recommendations:', recsError);
      toast({
        title: "Erreur",
        description: "Impossible de charger vos recommandations",
        variant: "destructive",
      });
    } else {
      setRecommendations(recsData || []);
    }

    // Load conversations with messages
    const { data: convsData, error: convsError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (convsError) {
      console.error('Error loading conversations:', convsError);
    } else if (convsData) {
      // Load messages for each conversation
      const conversationsWithMessages = await Promise.all(
        convsData.map(async (conv) => {
          const { data: messagesData } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });

          return {
            ...conv,
            messages: (messagesData || []).map(msg => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              created_at: msg.created_at
            }))
          };
        })
      );
      setConversations(conversationsWithMessages);
      
      // Extract product recommendations from assistant messages
      const products: ProductRecommendation[] = [];
      conversationsWithMessages.forEach(conv => {
        conv.messages.forEach(msg => {
          if (msg.role === 'assistant') {
            // Extract products mentioned in bold (e.g., **Product Name**)
            const productMatches = msg.content.match(/\*\*([^*]+)\*\*/g);
            if (productMatches) {
              productMatches.forEach(match => {
                const productName = match.replace(/\*\*/g, '').trim();
                // Filter out common text that's not a product
                if (!productName.toLowerCase().includes('pour') && 
                    !productName.toLowerCase().includes('conseils') &&
                    productName.length > 5 &&
                    productName.length < 100) {
                  products.push({
                    productName,
                    conversationId: conv.id,
                    conversationDate: conv.created_at,
                    context: msg.content.substring(0, 200) + '...'
                  });
                }
              });
            }
          }
        });
      });
      setProductRecommendations(products);
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from('recommendations')
      .delete()
      .eq('id', deleteId);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la recommandation",
        variant: "destructive",
      });
    } else {
      setRecommendations(prev => prev.filter(r => r.id !== deleteId));
      toast({
        title: "Supprimé",
        description: "La recommandation a été supprimée",
      });
    }

    setDeleteId(null);
  };

  const handleDeleteConversation = async () => {
    if (!deleteConversationId) return;

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', deleteConversationId);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la conversation",
        variant: "destructive",
      });
    } else {
      setConversations(prev => prev.filter(c => c.id !== deleteConversationId));
      toast({
        title: "Supprimé",
        description: "La conversation a été supprimée",
      });
    }

    setDeleteConversationId(null);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') {
      toast({
        title: "Confirmation invalide",
        description: "Veuillez taper SUPPRIMER pour confirmer",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Supprimer toutes les données utilisateur
      await (supabase as any).from('recommendations').delete().eq('user_id', user.id);
      await (supabase as any).from('conversations').delete().eq('user_id', user.id);
      await (supabase as any).from('user_pharmacy_affiliation').delete().eq('user_id', user.id);
      await (supabase as any).from('profiles').delete().eq('id', user.id);
      
      // Supprimer le compte auth
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      
      if (error) throw error;

      toast({
        title: "Compte supprimé",
        description: "Votre compte a été supprimé définitivement",
      });

      await supabase.auth.signOut();
      navigate('/');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le compte. Contactez le support.",
        variant: "destructive",
      });
    }
  };

  // Group recommendations by date
  const groupedByDate = recommendations.reduce((acc, rec) => {
    const date = new Date(rec.created_at).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(rec);
    return acc;
  }, {} as Record<string, Recommendation[]>);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Mon compte</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <Tabs defaultValue="conversations" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="conversations">Conversations</TabsTrigger>
              <TabsTrigger value="account">Paramètres</TabsTrigger>
            </TabsList>

            <TabsContent value="conversations">
              {conversations.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Aucune conversation
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Vos conversations avec Arthur apparaîtront ici
                  </p>
                  <Button onClick={() => navigate('/chat')} className="bg-gradient-primary">
                    Démarrer un chat
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
            {conversations.map((conv) => {
              const date = new Date(conv.created_at).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              // Get products for this conversation
              const convProducts = productRecommendations.filter(p => p.conversationId === conv.id);
              
              // Get promotions for this conversation
              const convPromotions = recommendations.filter(r => r.conversation_id === conv.id);

              return (
                <Card key={conv.id} className="border-2 border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-lg">{conv.title}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{date}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/chat?conversationId=${conv.id}`)}
                          className="flex items-center gap-2"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Reprendre
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConversationId(conv.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Messages - Show only first 3 */}
                    <div className="space-y-3">
                      {conv.messages.slice(0, 3).map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {msg.role === 'assistant' && (
                            <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                              <Bot className="h-4 w-4 text-primary-foreground" />
                            </div>
                          )}
                          <div
                            className={`rounded-2xl px-4 py-2 max-w-[80%] ${
                              msg.role === 'user'
                                ? 'bg-gradient-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          {msg.role === 'user' && (
                            <div className="h-8 w-8 rounded-full bg-gradient-secondary flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-secondary-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
                      {conv.messages.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{conv.messages.length - 3} message{conv.messages.length - 3 > 1 ? 's' : ''} supplémentaire{conv.messages.length - 3 > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    {/* Products recommended in this conversation */}
                    {convProducts.length > 0 && (
                      <div className="border-t border-border pt-4 space-y-2">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Tag className="h-4 w-4 text-primary" />
                          Produits recommandés
                        </h3>
                        <div className="space-y-2">
                          {convProducts.map((product, index) => (
                            <div 
                              key={index}
                              className="bg-muted/50 rounded-lg p-3 border border-border/50"
                            >
                              <p className="text-sm font-medium text-foreground">{product.productName}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Promotions saved from this conversation */}
                    {convPromotions.length > 0 && (
                      <div className="border-t border-border pt-4 space-y-2">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Tag className="h-4 w-4 text-primary" />
                          Promotions sauvegardées
                        </h3>
                        <div className="space-y-2">
                          {convPromotions.map((promo) => (
                            <div 
                              key={promo.id}
                              className="bg-primary/5 rounded-lg p-3 border border-primary/20 flex items-start justify-between"
                            >
                              <div>
                                <p className="text-sm font-medium text-foreground">{promo.product_name}</p>
                                {promo.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">{promo.notes}</p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(promo.id)}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="account">
        <div className="space-y-6">
          {/* Informations du profil */}
          {profileData && (
            <Card>
              <CardHeader>
                <CardTitle>Informations personnelles</CardTitle>
                <CardDescription>Vos informations médicales pour des conseils personnalisés</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Sexe</p>
                    <p className="font-medium">{profileData.gender || 'Non renseigné'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Âge</p>
                    <p className="font-medium">{profileData.age ? `${profileData.age} ans` : 'Non renseigné'}</p>
                  </div>
                </div>
                {profileData.gender === 'femme' && profileData.is_pregnant && (
                  <div>
                    <p className="text-sm text-muted-foreground">Grossesse</p>
                    <p className="font-medium">Enceinte</p>
                  </div>
                )}
                {profileData.allergies && (
                  <div>
                    <p className="text-sm text-muted-foreground">Allergies</p>
                    <p className="font-medium">{profileData.allergies}</p>
                  </div>
                )}
                {profileData.medical_history && (
                  <div>
                    <p className="text-sm text-muted-foreground">Antécédents médicaux</p>
                    <p className="font-medium">{profileData.medical_history}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Zone danger - Suppression du compte */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Zone de danger
              </CardTitle>
              <CardDescription>
                Actions irréversibles sur votre compte
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  La suppression de votre compte est définitive. Toutes vos données seront supprimées :
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Conversations avec Arthur</li>
                  <li>Recommandations sauvegardées</li>
                  <li>Informations personnelles</li>
                  <li>Affiliation aux pharmacies</li>
                </ul>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteAccount(true)}
                className="w-full"
              >
                <UserX className="h-4 w-4 mr-2" />
                Supprimer définitivement mon compte
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
      </Tabs>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette recommandation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La recommandation sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConversationId} onOpenChange={() => setDeleteConversationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La conversation et tous ses messages seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAccount} onOpenChange={setShowDeleteAccount}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Supprimer définitivement votre compte ?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>Cette action est <strong>irréversible</strong>. Toutes vos données seront supprimées :</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Conversations et messages</li>
                <li>Recommandations</li>
                <li>Informations personnelles</li>
                <li>Affiliation aux pharmacies</li>
              </ul>
              <div className="space-y-2 pt-4">
                <Label htmlFor="confirm-delete" className="text-foreground">
                  Tapez <strong>SUPPRIMER</strong> pour confirmer
                </Label>
                <Input
                  id="confirm-delete"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="SUPPRIMER"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'SUPPRIMER'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Recommendations;
