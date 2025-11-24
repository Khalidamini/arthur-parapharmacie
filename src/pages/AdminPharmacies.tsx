import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Clock, ArrowLeft } from "lucide-react";

interface PharmacyRegistration {
  id: string;
  pharmacy_name: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string | null;
  owner_name: string;
  owner_email: string;
  status: string;
  created_at: string;
}

export default function AdminPharmacies() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<PharmacyRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("[Admin] Current user:", user?.id, user?.email);
      setCurrentUserEmail(user?.email ?? null);
      
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: adminRole, error: adminErr } = await supabase
        .from("admin_roles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      console.log("[Admin] admin_roles query:", { adminRole, adminErr });

      if (!adminRole) {
        toast({
          title: "Accès refusé",
          description: "Vous n'avez pas les permissions d'administrateur",
          variant: "destructive",
        });
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      fetchRegistrations();
    } catch (error) {
      console.error("[Admin] Error checking admin status:", error);
      setLoading(false);
    }
  };

  const fetchRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from("pharmacy_registrations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRegistrations(data || []);
    } catch (error) {
      console.error("Error fetching registrations:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les demandes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (registration: PharmacyRegistration) => {
    setProcessingId(registration.id);
    
    try {
      const { data, error } = await supabase.functions.invoke("approve-pharmacy", {
        body: { registrationId: registration.id },
      });

      if (error) throw error;

      toast({
        title: "Pharmacie approuvée",
        description: `${registration.pharmacy_name} a été ajoutée au système`,
      });

      fetchRegistrations();
    } catch (error: any) {
      console.error("Error approving pharmacy:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'approuver la pharmacie",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    
    try {
      const { error } = await supabase
        .from("pharmacy_registrations")
        .update({ status: "rejected" })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Demande rejetée",
        description: "La demande a été rejetée",
      });

      fetchRegistrations();
    } catch (error) {
      console.error("Error rejecting pharmacy:", error);
      toast({
        title: "Erreur",
        description: "Impossible de rejeter la demande",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> En attente</Badge>;
      case "approved":
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Approuvée</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejetée</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>Vous n'avez pas les permissions d'administrateur.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentUserEmail ? (
              <p className="text-sm text-muted-foreground">Connecté en tant que {currentUserEmail}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Vous n'êtes pas connecté.</p>
            )}
            <div className="flex gap-2">
              <Button onClick={() => navigate('/auth')}>Se connecter</Button>
              <Button variant="outline" onClick={() => navigate('/')}>Retour à l'accueil</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/")} size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Administration des pharmacies</h1>
            <p className="text-muted-foreground">Gérez les demandes d'inscription des pharmacies</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/arthur-knowledge")}>
              🧠 Base de connaissances Arthur
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin/permissions")}>
              Gérer les permissions
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {registrations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Aucune demande d'inscription
              </CardContent>
            </Card>
          ) : (
            registrations.map((reg) => (
              <Card key={reg.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{reg.pharmacy_name}</CardTitle>
                      <CardDescription className="mt-1">
                        Demande du {new Date(reg.created_at).toLocaleDateString("fr-FR")}
                      </CardDescription>
                    </div>
                    {getStatusBadge(reg.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="font-semibold mb-2">Informations pharmacie</h4>
                      <p className="text-sm text-muted-foreground">{reg.address}</p>
                      <p className="text-sm text-muted-foreground">
                        {reg.postal_code} {reg.city}
                      </p>
                      {reg.phone && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Tél: {reg.phone}
                        </p>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Propriétaire</h4>
                      <p className="text-sm text-muted-foreground">{reg.owner_name}</p>
                      <p className="text-sm text-muted-foreground">{reg.owner_email}</p>
                    </div>
                  </div>

                  {reg.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(reg)}
                        disabled={processingId === reg.id}
                        className="gap-2"
                      >
                        {processingId === reg.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Approuver
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleReject(reg.id)}
                        disabled={processingId === reg.id}
                        className="gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Rejeter
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
