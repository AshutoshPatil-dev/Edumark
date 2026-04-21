import { supabase } from '../lib/supabase';
import type { AdminLogCategory } from '../types';

export async function writeAdminLog(
  actorId: string,
  category: AdminLogCategory,
  action: string,
  details?: string,
) {
  await supabase.from('admin_logs').insert({
    actor_id: actorId,
    category,
    action,
    details: details || null,
  });
}
