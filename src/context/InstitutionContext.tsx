/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Institution {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  address?: string;
  contact_email?: string;
  settings?: Record<string, any>;
}

interface InstitutionContextType {
  institution: Institution | null;
  isLoading: boolean;
  /** Scopes a Supabase query builder with .eq('institution_id', id) */
  scopeQuery: <T extends { eq: (col: string, val: string) => T }>(query: T) => T;
  /** Returns the institution_id for inserts */
  institutionId: string | null;
}

const InstitutionContext = createContext<InstitutionContextType>({
  institution: null,
  isLoading: true,
  scopeQuery: (q) => q,
  institutionId: null,
});

export function useInstitution() {
  return useContext(InstitutionContext);
}

interface InstitutionProviderProps {
  profileId: string | null;
  children: React.ReactNode;
}

export function InstitutionProvider({ profileId, children }: InstitutionProviderProps) {
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }

    const fetchInstitution = async () => {
      setIsLoading(true);

      // 1. Get the user's institution_id from their profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('institution_id')
        .eq('id', profileId)
        .single();

      if (!profile?.institution_id) {
        // No institution assigned — single-tenant mode (backward compat)
        setInstitution(null);
        setIsLoading(false);
        return;
      }

      // 2. Fetch the institution details
      const { data: inst } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', profile.institution_id)
        .single();

      if (inst) {
        setInstitution(inst as Institution);
      }
      setIsLoading(false);
    };

    fetchInstitution();
  }, [profileId]);

  const institutionId = institution?.id ?? null;

  const scopeQuery = <T extends { eq: (col: string, val: string) => T }>(query: T): T => {
    if (institutionId) {
      return query.eq('institution_id', institutionId);
    }
    return query;
  };

  return (
    <InstitutionContext.Provider value={{ institution, isLoading, scopeQuery, institutionId }}>
      {children}
    </InstitutionContext.Provider>
  );
}
