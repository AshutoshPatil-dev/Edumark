import { useState, useEffect } from 'react';
import { Megaphone, FileText, Calendar, Plus, Filter, Users, Tag, AlertCircle, CheckCircle2, Clock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile, Student, Announcement, AnnouncementType } from '../types';
import { SUBJECTS, DIVISIONS } from '../constants';
import { getCorrectBatchesForDivision } from '../utils/attendance';

interface AnnouncementsPageProps {
  profile: Profile;
  students: Student[];
}

export default function AnnouncementsPage({ profile, students }: AnnouncementsPageProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state for students and faculty
  const [filterType, setFilterType] = useState<'all' | 'announcement' | 'assignment'>('all');
  const [filterSubject, setFilterSubject] = useState<string>(
    profile.role === 'faculty' ? 'my_subjects' : 'all'
  );
  
  // Form state for faculty
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'announcement' as AnnouncementType,
    subject_id: profile.assigned_subjects?.[0] || SUBJECTS[0],
    target_divisions: [] as string[],
    target_batches: [] as string[],
    due_date: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Computed batches based on selected divisions, or all if none selected
  const relevantDivisions = formData.target_divisions.length > 0 ? formData.target_divisions : DIVISIONS;
  const BATCHES = Array.from(new Set(relevantDivisions.flatMap(div => getCorrectBatchesForDivision(div))));

  const studentData = profile.role === 'student' 
    ? students.find(s => s.rollNo === profile.roll_no)
    : null;

  useEffect(() => {
    fetchAnnouncements();
  }, [profile.role, filterType, filterSubject]);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('announcements')
        .select(`
          *,
          profiles:faculty_id(full_name)
        `)
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }
      
      if (filterSubject === 'my_subjects' && profile.role === 'faculty') {
        if (profile.assigned_subjects && profile.assigned_subjects.length > 0) {
          query = query.in('subject_id', profile.assigned_subjects);
        } else {
          setAnnouncements([]);
          setIsLoading(false);
          return; // No subjects assigned, so nothing to show
        }
      } else if (filterSubject !== 'all') {
        query = query.eq('subject_id', filterSubject);
      }
      // If faculty, optionally they see all or only their own subjects.
      // If student, filter out ones not meant for them.
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      let filteredData = data as Announcement[];
      
      // Post-process filtering for students since doing arrays intersection in Supabase simple query is trickier
      if (profile.role === 'student' && studentData) {
        filteredData = filteredData.filter(item => {
          // Check Division
          const divMatch = !item.target_divisions || item.target_divisions.length === 0 || item.target_divisions.includes(studentData.division);
          // Check Batch
          const batchMatch = !item.target_batches || item.target_batches.length === 0 || (studentData.batch && item.target_batches.includes(studentData.batch));
          
          return divMatch && batchMatch;
        });
      }

      setAnnouncements(filteredData);
    } catch (err: any) {
      console.error('Error fetching announcements:', err);
      setError('Failed to load announcements.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDivision = (div: string) => {
    setFormData(prev => ({
      ...prev,
      target_divisions: prev.target_divisions.includes(div)
        ? prev.target_divisions.filter(d => d !== div)
        : [...prev.target_divisions, div]
    }));
  };

  const handleToggleBatch = (batch: string) => {
    setFormData(prev => ({
      ...prev,
      target_batches: prev.target_batches.includes(batch)
        ? prev.target_batches.filter(b => b !== batch)
        : [...prev.target_batches, batch]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      const newAnnouncement = {
        title: formData.title,
        content: formData.content,
        type: formData.type,
        faculty_id: profile.id,
        subject_id: formData.subject_id,
        target_divisions: formData.target_divisions.length > 0 ? formData.target_divisions : null,
        target_batches: formData.target_batches.length > 0 ? formData.target_batches : null,
        due_date: formData.type === 'assignment' && formData.due_date ? new Date(formData.due_date).toISOString() : null
      };

      const { error: insertError } = await supabase
        .from('announcements')
        .insert([newAnnouncement]);

      if (insertError) throw insertError;

      setIsFormOpen(false);
      setFormData({
        title: '',
        content: '',
        type: 'announcement',
        subject_id: profile.assigned_subjects?.[0] || SUBJECTS[0],
        target_divisions: [],
        target_batches: [],
        due_date: ''
      });
      fetchAnnouncements();
    } catch (err: any) {
      console.error('Error creating announcement:', err);
      setError('Failed to create announcement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Failed to delete.');
    }
  };

  const getSubjectList = () => {
    return SUBJECTS;
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Announcements & Assignments</h1>
          <p className="text-ink-muted mt-1">Stay updated with class notices and coursework.</p>
        </div>
        
        {(profile.role === 'faculty' || profile.role === 'admin') && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 bg-ochre text-white px-4 py-2 rounded-xl font-medium hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Create New
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Faculty Create Form */}
      {isFormOpen && (profile.role === 'faculty' || profile.role === 'admin') && (
        <div className="bg-card border border-cream-border rounded-2xl shadow-sm p-6 animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-ink">New Announcement/Assignment</h2>
            <button onClick={() => setIsFormOpen(false)} className="text-ink-muted hover:text-ink">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        checked={formData.type === 'announcement'} 
                        onChange={() => setFormData({...formData, type: 'announcement'})}
                        className="text-ochre focus:ring-ochre"
                      />
                      <span className="text-ink">Announcement</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        checked={formData.type === 'assignment'} 
                        onChange={() => setFormData({...formData, type: 'assignment'})}
                        className="text-ochre focus:ring-ochre"
                      />
                      <span className="text-ink">Assignment</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full rounded-xl border border-cream-border bg-cream text-ink px-4 py-2 focus:ring-2 focus:ring-ochre/20 outline-none transition-all"
                    placeholder="E.g., Mid-term syllabus"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Subject</label>
                  <select
                    value={formData.subject_id}
                    onChange={e => setFormData({...formData, subject_id: e.target.value})}
                    className="w-full rounded-xl border border-cream-border bg-cream text-ink px-4 py-2 focus:ring-2 focus:ring-ochre/20 outline-none"
                  >
                    {getSubjectList().map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                
                {formData.type === 'assignment' && (
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">Due Date (Optional)</label>
                    <input
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={e => setFormData({...formData, due_date: e.target.value})}
                      className="w-full rounded-xl border border-cream-border bg-cream text-ink px-4 py-2 focus:ring-2 focus:ring-ochre/20 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Content/Description</label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                    rows={4}
                    className="w-full rounded-xl border border-cream-border bg-cream text-ink px-4 py-2 focus:ring-2 focus:ring-ochre/20 outline-none resize-none transition-all"
                    placeholder="Provide detailed instructions or information..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">Target Divisions (Leave empty for All)</label>
                  <div className="flex flex-wrap gap-2">
                    {DIVISIONS.map(div => (
                      <button
                        key={div}
                        type="button"
                        onClick={() => handleToggleDivision(div)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-all active:scale-95 ${
                          formData.target_divisions.includes(div) 
                            ? 'bg-ochre text-white' 
                            : 'bg-cream text-ink-muted border border-cream-border hover:bg-cream-border'
                        }`}
                      >
                        {div}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">Target Batches (For Practicals, leave empty for All)</label>
                  <div className="flex flex-wrap gap-2">
                    {BATCHES.map(batch => (
                      <button
                        key={batch}
                        type="button"
                        onClick={() => handleToggleBatch(batch)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-all active:scale-95 ${
                          formData.target_batches.includes(batch) 
                            ? 'bg-ochre text-white' 
                            : 'bg-cream text-ink-muted border border-cream-border hover:bg-cream-border'
                        }`}
                      >
                        {batch}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-cream-border">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 rounded-xl text-ink-muted hover:text-ink hover:bg-cream-soft active:scale-95 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-ochre text-white px-6 py-2 rounded-xl font-medium hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters and List */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex bg-cream p-1 rounded-xl border border-cream-border">
          {(['all', 'announcement', 'assignment'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-all active:scale-95 ${
                filterType === type 
                  ? 'bg-ink text-paper shadow-md' 
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {type === 'all' ? 'All' : type + 's'}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-ink-muted" />
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="rounded-xl border border-cream-border bg-cream text-ink px-3 py-2 text-sm focus:ring-2 focus:ring-ochre/20 outline-none"
          >
            {profile.role === 'faculty' && (
              <option value="my_subjects">My Subjects</option>
            )}
            <option value="all">All Subjects</option>
            {getSubjectList().map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-ink/10 border-t-ochre rounded-full animate-spin"></div>
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-card border border-cream-border rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-cream rounded-full flex items-center justify-center mx-auto mb-4 text-ink-muted">
            <Megaphone className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold text-ink">No announcements found</h3>
          <p className="text-ink-muted mt-2">
            {profile.role === 'faculty' 
              ? "You haven't posted any announcements or assignments matching this filter."
              : "There are no new announcements or assignments for your class right now."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {announcements.map((item) => (
            <div key={item.id} className="bg-card border border-cream-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-ochre/20 group-hover:bg-ochre transition-colors"></div>
              
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider ${
                    item.type === 'assignment' 
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                      : 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  }`}>
                    {item.type === 'assignment' ? <FileText className="w-3.5 h-3.5" /> : <Megaphone className="w-3.5 h-3.5" />}
                    {item.type}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-cream text-ink text-xs font-medium border border-cream-border">
                    <Tag className="w-3 h-3 text-ink-muted" />
                    {item.subject_id}
                  </span>
                </div>
                {(profile.role === 'admin' || (profile.role === 'faculty' && profile.id === item.faculty_id)) && (
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="text-ink-muted hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <h3 className="text-lg font-semibold text-ink mb-2 leading-tight">{item.title}</h3>
              <p className="text-ink-muted text-sm flex-1 whitespace-pre-wrap mb-4">{item.content}</p>
              
              <div className="mt-auto space-y-3">
                {item.type === 'assignment' && item.due_date && (
                  <div className="flex items-center gap-2 text-sm font-medium text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    <Clock className="w-4 h-4" />
                    Due: {new Date(item.due_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xs text-ink-muted border-t border-cream-border pt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-ochre/10 text-ochre-deep flex items-center justify-center font-bold text-[10px]">
                      {item.profiles?.full_name?.charAt(0) || 'F'}
                    </div>
                    <span>{item.profiles?.full_name || 'Faculty'}</span>
                  </div>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
