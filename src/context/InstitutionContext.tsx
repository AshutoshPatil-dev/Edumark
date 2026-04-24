/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Institution {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  address?: string;
  contact_email?: string;
  created_by?: string | null;
  settings?: Record<string, any>;
}

interface InstitutionContextType {
  institution: Institution | null;
  isLoading: boolean;
  scopeQuery: <T extends { eq: (col: string, val: string) => T }>(query: T) => T;
  institutionId: string | null;
}

const InstitutionContext = createContext<InstitutionContextType>({
  institution: null,
  isLoading: true,
  scopeQuery: (query) => query,
  institutionId: null,
});

export function useInstitution() {
  return useContext(InstitutionContext);
}

interface InstitutionProviderProps {
  institutionId: string | null;
  children: React.ReactNode;
}

export function InstitutionProvider({ institutionId, children }: InstitutionProviderProps) {
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!institutionId) {
      setInstitution(null);
      setIsLoading(false);
      return;
    }

    const fetchInstitution = async () => {
      setIsLoading(true);

      const { data: inst } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', institutionId)
        .single();

      setInstitution((inst as Institution | null) ?? null);
      setIsLoading(false);
    };

    fetchInstitution();
  }, [institutionId]);

  const scopeQuery = useCallback(<T extends { eq: (col: string, val: string) => T }>(query: T): T => {
    if (institutionId) {
      return query.eq('institution_id', institutionId);
    }
    return query;
  }, [institutionId]);

  return (
    <InstitutionContext.Provider value={{ institution, isLoading, scopeQuery, institutionId }}>
      {children}
    </InstitutionContext.Provider>
  );
}
