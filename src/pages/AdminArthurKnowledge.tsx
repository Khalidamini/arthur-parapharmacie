import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  ArrowLeft, 
  Brain, 
  Plus, 
  Trash2, 
  Edit, 
  Save,
  X,
  TrendingUp,
  Database
} from "lucide-react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Schéma de validation
const knowledgeSchema = z.object({
  entryType: z.enum(["question_response", "information"]),
  question: z.string().trim().max(2000, "Maximum 2000 caractères").optional(),
  response: z.string().trim().min(10, "Le contenu doit faire au moins 10 caractères").max(50000, "Maximum 50000 caractères"),
  contextType: z.enum(["pharmacy", "patient", "general"]),
  responseType: z.enum(["message", "products", "question", "sales_advice"]),
}).refine((data) => {
  if (data.entryType === "question_response") {
    return data.question && data.question.length >= 5;
  }
  return true;
}, {
  message: "La question est requise et doit faire au moins 5 caractères pour le type Question-Réponse",
  path: ["question"],
});

interface KnowledgeEntry {
  id: string;
  question_original: string;
  response_text: string;
  response_type: string;
  context_type: string;
  usage_count: number;
  confidence_score: number;
  created_at: string;
  last_used_at: string;
}

export default function AdminArthurKnowledge() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Formulaire
  const [formData, setFormData] = useState({
    entryType: "question_response" as "question_response" | "information",
    question: "",
    response: "",
    contextType: "general" as "pharmacy" | "patient" | "general",
    responseType: "message" as "message" | "products" | "question" | "sales_advice",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Accès refusé",
          description: "Vous devez être connecté",
          variant: "destructive",
        });
        navigate("/pharmacy-login");
        return;
      }

      const { data: adminRole } = await supabase
        .from("admin_roles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!adminRole) {
        toast({
          title: "Accès refusé",
          description: "Vous n'avez pas les permissions d'administrateur",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      fetchKnowledge();
    } catch (error) {
      console.error("Error checking admin status:", error);
      setLoading(false);
    }
  };

  const fetchKnowledge = async () => {
    try {
      const { data, error } = await supabase
        .from("arthur_knowledge_base")
        .select("*")
        .order("usage_count", { ascending: false });

      if (error) throw error;
      setKnowledgeEntries(data || []);
    } catch (error) {
      console.error("Error fetching knowledge:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les connaissances",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    try {
      knowledgeSchema.parse({
        entryType: formData.entryType,
        question: formData.question,
        response: formData.response,
        contextType: formData.contextType,
        responseType: formData.responseType,
      });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Erreur de validation",
        description: "Veuillez corriger les erreurs du formulaire",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Normaliser la question (ou utiliser la réponse si c'est une information brute)
      const textToNormalize = formData.entryType === "information" 
        ? formData.response 
        : formData.question;
      
      const normalized = textToNormalize
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Construire la réponse selon le type
      let responseText = formData.response;
      
      // Si c'est un type products/question/sales_advice, essayer de parser comme JSON
      if (formData.responseType !== "message") {
        try {
          JSON.parse(responseText); // Valider que c'est du JSON valide
        } catch {
          toast({
            title: "Format invalide",
            description: "Pour les types products/question/sales_advice, la réponse doit être au format JSON valide",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      }

      if (editingId) {
        // Mise à jour
        const { error } = await supabase
          .from("arthur_knowledge_base")
          .update({
            question_original: formData.entryType === "information" ? "[Information]" : formData.question,
            question_normalized: normalized,
            response_text: responseText,
            response_type: formData.responseType,
            context_type: formData.contextType,
          })
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "✅ Connaissance mise à jour",
          description: "La connaissance a été mise à jour avec succès",
        });
      } else {
        // Création
        const { error } = await supabase
          .from("arthur_knowledge_base")
          .insert({
            question_original: formData.entryType === "information" ? "[Information]" : formData.question,
            question_normalized: normalized,
            response_text: responseText,
            response_type: formData.responseType,
            context_type: formData.contextType,
            confidence_score: 1.0,
            usage_count: 0,
          });

        if (error) throw error;

        toast({
          title: "✅ Connaissance ajoutée",
          description: "Arthur va maintenant utiliser cette connaissance",
        });
      }

      // Reset form
      setFormData({
        entryType: "question_response",
        question: "",
        response: "",
        contextType: "general",
        responseType: "message",
      });
      setShowAddDialog(false);
      setEditingId(null);
      fetchKnowledge();
    } catch (error) {
      console.error("Error saving knowledge:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la connaissance",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry: KnowledgeEntry) => {
    const isInformation = entry.question_original === "[Information]";
    setFormData({
      entryType: isInformation ? "information" : "question_response",
      question: isInformation ? "" : entry.question_original,
      response: entry.response_text,
      contextType: entry.context_type as any,
      responseType: entry.response_type as any,
    });
    setEditingId(entry.id);
    setShowAddDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette connaissance ?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("arthur_knowledge_base")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Connaissance supprimée",
        description: "La connaissance a été retirée de la base d'Arthur",
      });
      fetchKnowledge();
    } catch (error) {
      console.error("Error deleting knowledge:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la connaissance",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      entryType: "question_response",
      question: "",
      response: "",
      contextType: "general",
      responseType: "message",
    });
    setEditingId(null);
    setErrors({});
    setShowAddDialog(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const stats = {
    total: knowledgeEntries.length,
    totalUsage: knowledgeEntries.reduce((sum, e) => sum + e.usage_count, 0),
    avgConfidence: knowledgeEntries.length > 0 
      ? (knowledgeEntries.reduce((sum, e) => sum + Number(e.confidence_score), 0) / knowledgeEntries.length).toFixed(2)
      : "0",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/pharmacies")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour Admin
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Brain className="h-8 w-8 text-primary" />
                Base de Connaissances Arthur
              </h1>
              <p className="text-muted-foreground">
                Gérez les connaissances qu'Arthur utilise pour répondre aux questions
              </p>
            </div>
          </div>
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une connaissance
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Connaissances totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Utilisations totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalUsage}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalUsage > 0 && `Économies: ${stats.totalUsage} appels OpenAI évités`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Confiance moyenne</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.avgConfidence}</div>
              <p className="text-xs text-muted-foreground mt-1">Score sur 1.0</p>
            </CardContent>
          </Card>
        </div>

        {/* Liste des connaissances */}
        <Card>
          <CardHeader>
            <CardTitle>Connaissances enregistrées</CardTitle>
            <CardDescription>
              Arthur consulte ces connaissances avant chaque question posée
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {knowledgeEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Aucune connaissance enregistrée</p>
                <p className="text-sm">Commencez par ajouter des connaissances pour qu'Arthur les utilise</p>
              </div>
            ) : (
              knowledgeEntries.map((entry) => (
                <Card key={entry.id} className="border-l-4 border-l-primary">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={entry.context_type === "pharmacy" ? "default" : entry.context_type === "patient" ? "secondary" : "outline"}>
                              {entry.context_type}
                            </Badge>
                            <Badge variant="outline">{entry.response_type}</Badge>
                            <Badge variant="secondary">
                              {entry.usage_count} utilisation{entry.usage_count > 1 ? "s" : ""}
                            </Badge>
                            <Badge variant="outline">
                              Confiance: {Number(entry.confidence_score).toFixed(2)}
                            </Badge>
                           </div>
                           <div>
                             {entry.question_original !== "[Information]" ? (
                               <>
                                 <p className="font-semibold text-foreground">❓ {entry.question_original}</p>
                                 <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                   💬 {entry.response_text.substring(0, 150)}...
                                 </p>
                               </>
                             ) : (
                               <>
                                 <p className="font-semibold text-foreground flex items-center gap-2">
                                   📚 <span className="text-primary">Information brute</span>
                                 </p>
                                 <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                                   {entry.response_text.substring(0, 200)}...
                                 </p>
                               </>
                             )}
                           </div>
                          <p className="text-xs text-muted-foreground">
                            Créé le {new Date(entry.created_at).toLocaleDateString("fr-FR")}
                            {entry.usage_count > 0 && ` • Dernière utilisation: ${new Date(entry.last_used_at).toLocaleDateString("fr-FR")}`}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Ajout/Édition */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifier la connaissance" : "Ajouter une connaissance"}
            </DialogTitle>
            <DialogDescription>
              Arthur utilisera cette connaissance pour répondre aux questions similaires ou enrichir ses connaissances
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="entryType">Type d'entrée *</Label>
              <Select
                value={formData.entryType}
                onValueChange={(value: any) => setFormData({ ...formData, entryType: value, question: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="question_response">❓ Question-Réponse</SelectItem>
                  <SelectItem value="information">📚 Information brute</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.entryType === "information" 
                  ? "Arthur intégrera cette information dans sa base de connaissances"
                  : "Arthur répondra directement quand il détecte cette question"}
              </p>
            </div>

            {formData.entryType === "question_response" && (
              <div className="space-y-2">
                <Label htmlFor="question">Question / Requête utilisateur *</Label>
                <Textarea
                  id="question"
                  placeholder="Ex: J'ai des problèmes de sommeil"
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  className={errors.question ? "border-destructive" : ""}
                  rows={2}
                />
                {errors.question && (
                  <p className="text-sm text-destructive">{errors.question}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contextType">Contexte *</Label>
                <Select
                  value={formData.contextType}
                  onValueChange={(value: any) => setFormData({ ...formData, contextType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Général</SelectItem>
                    <SelectItem value="patient">Patient</SelectItem>
                    <SelectItem value="pharmacy">Pharmacien</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="responseType">Type de réponse *</Label>
                <Select
                  value={formData.responseType}
                  onValueChange={(value: any) => setFormData({ ...formData, responseType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="message">Message simple</SelectItem>
                    <SelectItem value="products">Produits (JSON)</SelectItem>
                    <SelectItem value="question">Question (JSON)</SelectItem>
                    <SelectItem value="sales_advice">Conseil vente (JSON)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="response">
                {formData.entryType === "information" ? "Information / Connaissance *" : "Réponse d'Arthur *"}
                {formData.responseType !== "message" && (
                  <span className="text-muted-foreground text-xs ml-2">
                    (Format JSON requis)
                  </span>
                )}
              </Label>
              <Textarea
                id="response"
                placeholder={
                  formData.entryType === "information"
                    ? "Ex: Notre pharmacie propose des services de vaccination contre la grippe tous les mardis et jeudis de 14h à 18h. Le prix est de 25€..."
                    : formData.responseType === "message"
                    ? "Ex: Je vous recommande des solutions naturelles pour améliorer votre sommeil..."
                    : '{"type": "products", "message": "...", "products": [...]}'
                }
                value={formData.response}
                onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                className={errors.response ? "border-destructive" : ""}
                rows={12}
                style={{ fontFamily: "monospace", fontSize: "13px" }}
              />
              {errors.response && (
                <p className="text-sm text-destructive">{errors.response}</p>
              )}
              {formData.entryType === "information" && (
                <p className="text-xs text-muted-foreground">
                  💡 Arthur utilisera cette information comme contexte pour enrichir ses réponses
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm} disabled={submitting}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingId ? "Mettre à jour" : "Ajouter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}