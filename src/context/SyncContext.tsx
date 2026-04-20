/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface SyncQueueItem {
  id: string;
  table: string;
  payload: any;
  timestamp: number;
}

interface SyncContextType {
  isOnline: boolean;
  pendingCount: number;
  addToQueue: (table: string, payload: any) => Promise<void>;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);

  // Load queue from localStorage on mount
  useEffect(() => {
    const savedQueue = localStorage.getItem('edumark_sync_queue');
    if (savedQueue) {
      try {
        setQueue(JSON.parse(savedQueue));
      } catch (e) {
        console.error('Failed to parse sync queue', e);
      }
    }
  }, []);

  // Save queue to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('edumark_sync_queue', JSON.stringify(queue));
  }, [queue]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || queue.length === 0) return;

    const itemsToSync = [...queue];
    const remainingQueue = [...queue];

    for (const item of itemsToSync) {
      try {
        let error;
        if (item.table === 'attendance') {
          const { error: upsertError } = await supabase.from('attendance').upsert(item.payload, {
            onConflict: 'student_id, subject, date, lecture_no'
          });
          error = upsertError;
        } else {
          const { error: insertError } = await supabase.from(item.table).insert(item.payload);
          error = insertError;
        }

        if (!error) {
          const idx = remainingQueue.findIndex(i => i.id === item.id);
          if (idx !== -1) remainingQueue.splice(idx, 1);
        }
      } catch (e) {
        console.error('Sync failed for item', item.id, e);
      }
    }

    setQueue(remainingQueue);
  }, [queue]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      syncNow();
    }
  }, [isOnline, queue.length, syncNow]);

  const addToQueue = async (table: string, payload: any) => {
    const newItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      table,
      payload,
      timestamp: Date.now(),
    };

    setQueue(prev => [...prev, newItem]);

    if (navigator.onLine) {
      syncNow();
    }
  };

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount: queue.length, addToQueue, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
