import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LogActivityParams {
  pharmacyId: string;
  actionType: string;
  actionDetails?: any;
  entityType?: string;
  entityId?: string;
}

export const usePharmacyActivityLog = () => {
  const { toast } = useToast();

  const logActivity = async ({
    pharmacyId,
    actionType,
    actionDetails,
    entityType,
    entityId,
  }: LogActivityParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No user found for activity logging');
        return;
      }

      const { error } = await supabase.rpc('log_pharmacy_activity', {
        _pharmacy_id: pharmacyId,
        _user_id: user.id,
        _action_type: actionType,
        _action_details: actionDetails || null,
        _entity_type: entityType || null,
        _entity_id: entityId || null,
      });

      if (error) {
        console.error('Error logging activity:', error);
      }
    } catch (error) {
      console.error('Error in logActivity:', error);
    }
  };

  return { logActivity };
};
