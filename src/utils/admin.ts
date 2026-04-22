import type { AdminLogCategory } from '../types';

export async function writeAdminLog(
  actorId: string,
  category: AdminLogCategory,
  action: string,
  details?: string,
) {
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor_id: actorId,
        category,
        action,
        details: details || null,
      }),
    });
  } catch (err) {
    console.error('Failed to write admin log:', err);
  }
}
