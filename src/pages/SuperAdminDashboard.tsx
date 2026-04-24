import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, CheckCircle2, XCircle, Clock, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

export default function SuperAdminDashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'requests' | 'institutions'>('requests');

  const fetchData = async () => {
    setIsLoading(true);
    const [reqRes, instRes] = await Promise.all([
      supabase.from('institution_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('institutions').select('*').order('name')
    ]);
    
    if (reqRes.data) setRequests(reqRes.data);
    if (instRes.data) setInstitutions(instRes.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (request: any) => {
    if (!window.confirm(`Approve ${request.school_name} and create their institution workspace?`)) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const baseSlug = request.school_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
      
      // 1. Create the institution
      const { error: instError } = await supabase
        .from('institutions')
        .insert([{ name: request.school_name, slug: uniqueSlug, created_by: user?.id ?? null }]);

      if (instError) throw instError;

      // 2. Mark request as approved
      const { error: updateError } = await supabase
        .from('institution_requests')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', request.id);
        
      if (updateError) throw updateError;

      alert(`Successfully created ${request.school_name} workspace! Next step: Invite ${request.contact_email} as an admin from the Supabase Auth dashboard.`);
      fetchData();
    } catch (error: any) {
      alert('Error approving request: ' + error.message);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Reject this request?')) return;
    await supabase
      .from('institution_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id);
    fetchData();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col gap-4">
        <div>
          <p className="eyebrow text-ochre flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Super Admin</p>
          <h1 className="font-sans text-3xl font-semibold text-ink mt-2 tracking-tight">Platform Operations</h1>
          <p className="text-ink-muted mt-2">Manage incoming school requests and monitor active institutions.</p>
        </div>
      </header>

      <div className="flex gap-2 border-b border-cream-border mb-6">
        <button onClick={() => setActiveTab('requests')} className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'requests' ? 'border-ochre text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}>Pending Requests ({requests.filter(r => r.status === 'pending').length})</button>
        <button onClick={() => setActiveTab('institutions')} className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'institutions' ? 'border-ochre text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}>Active Institutions ({institutions.length})</button>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-ochre/20 border-t-ochre rounded-full animate-spin"/></div>
      ) : activeTab === 'requests' ? (
        <div className="grid gap-4">
          {requests.length === 0 ? (
            <div className="bg-card border border-cream-border p-12 text-center rounded-2xl">
              <p className="text-ink-muted font-medium">No requests found.</p>
            </div>
          ) : (
            requests.map(req => (
              <div key={req.id} className="bg-card border border-cream-border p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-sans text-lg font-semibold text-ink">{req.school_name}</h3>
                    {req.status === 'pending' && <span className="bg-amber-100 text-amber-800 text-[0.65rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"><Clock className="w-3 h-3"/> Pending</span>}
                    {req.status === 'approved' && <span className="bg-emerald-100 text-emerald-800 text-[0.65rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Approved</span>}
                    {req.status === 'rejected' && <span className="bg-rose-100 text-rose-800 text-[0.65rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"><XCircle className="w-3 h-3"/> Rejected</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 mt-3">
                    <p className="text-sm text-ink-muted"><strong className="text-ink font-medium">Contact:</strong> {req.contact_name}</p>
                    <p className="text-sm text-ink-muted"><strong className="text-ink font-medium">Email:</strong> <a href={`mailto:${req.contact_email}`} className="text-ochre hover:underline">{req.contact_email}</a></p>
                    {req.phone && <p className="text-sm text-ink-muted"><strong className="text-ink font-medium">Phone:</strong> {req.phone}</p>}
                    <p className="text-sm text-ink-muted"><strong className="text-ink font-medium">Date:</strong> {new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                  {req.message && (
                    <div className="mt-4 bg-paper p-3 rounded-lg border border-cream-border">
                      <p className="text-xs text-ink-muted leading-relaxed">"{req.message}"</p>
                    </div>
                  )}
                </div>
                
                {req.status === 'pending' && (
                  <div className="flex flex-row md:flex-col gap-2 shrink-0">
                    <button onClick={() => handleApprove(req)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                    <button onClick={() => handleReject(req.id)} className="bg-paper hover:bg-rose-50 text-rose-600 border border-cream-border hover:border-rose-200 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {institutions.map(inst => (
            <div key={inst.id} className="bg-card border border-cream-border p-6 rounded-2xl shadow-sm flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-cream border border-cream-border rounded-2xl flex items-center justify-center">
                <Building2 className="w-8 h-8 text-ink/40" />
              </div>
              <div>
                <h3 className="font-sans text-lg font-semibold text-ink">{inst.name}</h3>
                <p className="text-xs text-ink-muted font-mono mt-1">{inst.id.split('-')[0]}...</p>
              </div>
              <div className="mt-auto pt-4 w-full border-t border-cream-border">
                <p className="text-xs text-ink-muted">Joined {new Date(inst.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
