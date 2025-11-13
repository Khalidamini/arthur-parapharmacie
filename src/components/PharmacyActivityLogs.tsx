import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Filter, Calendar, User, Activity, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  action_details: any;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface PharmacyActivityLogsProps {
  pharmacyId: string;
}

const PharmacyActivityLogs = ({ pharmacyId }: PharmacyActivityLogsProps) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; email: string; username: string | null }>>([]);
  
  // Filtres
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'user' | 'action'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const { toast } = useToast();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Récupérer les membres de l'équipe
      const { data: teamData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('pharmacy_id', pharmacyId);

      if (teamData) {
        const userIds = teamData.map(t => t.user_id);
        
        // Récupérer les emails des utilisateurs
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, username')
          .in('id', userIds);

        setTeamMembers(profilesData || []);

        // Récupérer les logs
        const { data: logsData, error } = await supabase
          .from('pharmacy_activity_logs')
          .select('*')
          .eq('pharmacy_id', pharmacyId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Enrichir les logs avec les infos utilisateur
        const enrichedLogs = (logsData || []).map(log => {
          const profile = profilesData?.find(p => p.id === log.user_id);
          return {
            ...log,
            user_email: profile?.email || 'Inconnu',
            user_name: profile?.username || profile?.email || 'Inconnu',
          };
        });

        setLogs(enrichedLogs);
        setFilteredLogs(enrichedLogs);
      }
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger le journal des activités',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [pharmacyId]);

  // Appliquer les filtres et le tri
  useEffect(() => {
    let result = [...logs];

    // Filtrer par utilisateur
    if (selectedUser !== 'all') {
      result = result.filter(log => log.user_id === selectedUser);
    }

    // Filtrer par type d'action
    if (selectedActionType !== 'all') {
      result = result.filter(log => log.action_type === selectedActionType);
    }

    // Recherche textuelle
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(log => 
        log.user_name?.toLowerCase().includes(query) ||
        log.action_type.toLowerCase().includes(query) ||
        JSON.stringify(log.action_details).toLowerCase().includes(query)
      );
    }

    // Trier
    result.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'date') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'user') {
        comparison = (a.user_name || '').localeCompare(b.user_name || '');
      } else if (sortBy === 'action') {
        comparison = a.action_type.localeCompare(b.action_type);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredLogs(result);
  }, [logs, selectedUser, selectedActionType, searchQuery, sortBy, sortOrder]);

  // Obtenir tous les types d'actions uniques
  const actionTypes = Array.from(new Set(logs.map(log => log.action_type)));

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'product_created': 'Produit créé',
      'product_updated': 'Produit modifié',
      'product_deleted': 'Produit supprimé',
      'promotion_created': 'Promotion créée',
      'promotion_updated': 'Promotion modifiée',
      'promotion_deleted': 'Promotion supprimée',
      'order_updated': 'Commande mise à jour',
      'team_member_invited': 'Membre invité',
      'team_member_updated': 'Membre modifié',
      'team_member_removed': 'Membre supprimé',
      'pharmacy_info_updated': 'Infos pharmacie mises à jour',
    };
    return labels[actionType] || actionType;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Journal des activités</CardTitle>
          <CardDescription>Chargement...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Journal des activités
            </CardTitle>
            <CardDescription>
              Suivi de toutes les opérations effectuées par votre équipe
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtres et recherche */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Collaborateur
            </label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les collaborateurs</SelectItem>
                {teamMembers.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.username || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Type d'action
            </label>
            <Select value={selectedActionType} onValueChange={setSelectedActionType}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les actions</SelectItem>
                {actionTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {getActionLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Trier par
            </label>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="user">Collaborateur</SelectItem>
                <SelectItem value="action">Type d'action</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ordre</label>
            <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Décroissant</SelectItem>
                <SelectItem value="asc">Croissant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-4">
          <Input
            placeholder="Rechercher dans le journal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Résumé */}
        <div className="text-sm text-muted-foreground mb-4">
          {filteredLogs.length} activité{filteredLogs.length > 1 ? 's' : ''} trouvée{filteredLogs.length > 1 ? 's' : ''}
        </div>

        {/* Tableau */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Heure</TableHead>
                <TableHead>Collaborateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Aucune activité trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{log.user_name}</div>
                      <div className="text-xs text-muted-foreground">{log.user_email}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {getActionLabel(log.action_type)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md">
                      {log.action_details && (
                        <pre className="text-xs text-muted-foreground overflow-auto">
                          {JSON.stringify(log.action_details, null, 2)}
                        </pre>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PharmacyActivityLogs;
