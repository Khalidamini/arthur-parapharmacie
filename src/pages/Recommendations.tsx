import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, Tag, Trash2, MessageSquare, Bot, User, MessageCircle, UserX, AlertTriangle, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Footer from '@/components/Footer';
import PharmacyLogos from '@/components/PharmacyLogos';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'account';
  
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expandedConversationId, setExpandedConversationId] = useState<string | null>(null);
  const [productRecommendations, setProductRecommendations] = useState<ProductRecommendation[]>([]);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [profileData, setProfileData] = useState<any>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState({
    gender: '',
    age: '',
    is_pregnant: false,
    allergies: '',
    medical_history: ''
  });
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Appeler la fonction edge pour supprimer le compte
      const { error } = await supabase.functions.invoke('delete-user-account', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
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

  const handleEditProfile = () => {
    console.log('Opening edit profile dialog');
    setEditProfileData({
      gender: profileData?.gender || '',
      age: profileData?.age?.toString() || '',
      is_pregnant: profileData?.is_pregnant || false,
      allergies: profileData?.allergies || '',
      medical_history: profileData?.medical_history || ''
    });
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          gender: editProfileData.gender || null,
          age: editProfileData.age ? parseInt(editProfileData.age) : null,
          is_pregnant: editProfileData.gender === 'femme' ? editProfileData.is_pregnant : false,
          allergies: editProfileData.allergies || null,
          medical_history: editProfileData.medical_history || null
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été sauvegardées",
      });

      setShowEditProfile(false);
      loadData();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le profil",
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
    <div className="min-h-screen bg-gradient-subtle pb-20">{/* Ajout de padding-bottom pour le footer */}
      {/* Header */}
      <div className="bg-card border-b border-border shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {/* Header with Logos and Back Button */}
          <div className="flex items-center justify-between mb-2">
            <PharmacyLogos size="md" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
          <h1 className="text-xl font-bold text-foreground">Mon compte</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-6">
          {/* Informations du profil */}
          {profileData && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Informations personnelles</CardTitle>
                    <CardDescription>Vos informations médicales pour des conseils personnalisés</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleEditProfile}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
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

      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier mes informations</DialogTitle>
            <DialogDescription>
              Mettez à jour vos informations pour des conseils personnalisés
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="gender">Sexe</Label>
              <Select
                value={editProfileData.gender}
                onValueChange={(value) => setEditProfileData(prev => ({ ...prev, gender: value }))}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Sélectionnez votre sexe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homme">Homme</SelectItem>
                  <SelectItem value="femme">Femme</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="age">Âge</Label>
              <Input
                id="age"
                type="number"
                min="0"
                max="120"
                value={editProfileData.age}
                onChange={(e) => setEditProfileData(prev => ({ ...prev, age: e.target.value }))}
                placeholder="Votre âge"
              />
            </div>

            {editProfileData.gender === 'femme' && (
              <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="is_pregnant" className="cursor-pointer">Enceinte</Label>
                  <p className="text-sm text-muted-foreground">
                    Cochez si vous êtes actuellement enceinte
                  </p>
                </div>
                <Switch
                  id="is_pregnant"
                  checked={editProfileData.is_pregnant}
                  onCheckedChange={(checked) => setEditProfileData(prev => ({ ...prev, is_pregnant: checked }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Textarea
                id="allergies"
                value={editProfileData.allergies}
                onChange={(e) => setEditProfileData(prev => ({ ...prev, allergies: e.target.value }))}
                placeholder="Vos allergies (médicaments, aliments, etc.)"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medical_history">Antécédents médicaux</Label>
              <Textarea
                id="medical_history"
                value={editProfileData.medical_history}
                onChange={(e) => setEditProfileData(prev => ({ ...prev, medical_history: e.target.value }))}
                placeholder="Vos antécédents médicaux importants"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditProfile(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveProfile}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </div>
  );
};

export default Recommendations;
