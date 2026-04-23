import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DIVISIONS, SUBJECTS, type DivisionId } from '../constants';
import { Calendar, Plus, Edit2, Trash2, Info } from 'lucide-react';
import { cn, getCorrectBatchesForDivision } from '../utils/attendance';
import { useInstitution } from '../context/InstitutionContext';
import { writeAdminLog } from '../utils/admin';

export default function AdminTimetableEditor() {
  const { institutionId, scopeQuery } = useInstitution();
  const [selectedDivision, setSelectedDivision] = useState<DivisionId>('A');
  const [timetable, setTimetable] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{ day: number; lectureNo: number; id?: string } | null>(null);
  const [formSubject, setFormSubject] = useState('');
  const [formFaculty, setFormFaculty] = useState('');
  const [formBatch, setFormBatch] = useState('');

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const maxLectures = 6;

  useEffect(() => {
    fetchData();
  }, [selectedDivision]);

  const fetchData = async () => {
    setIsLoading(true);
    const [profilesRes, timetableRes] = await Promise.all([
      scopeQuery(supabase.from('profiles').select('id, full_name').in('role', ['faculty', 'admin'])),
      scopeQuery(supabase.from('timetable').select('*').eq('division', selectedDivision))
    ]);
    
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (timetableRes.data) setTimetable(timetableRes.data);
    setIsLoading(false);
  };

  const handleCellClick = (day: number, lectureNo: number, existingSlot?: any) => {
    if (existingSlot) {
      setEditingSlot({ day, lectureNo, id: existingSlot.id });
      setFormSubject(existingSlot.subject_id);
      setFormFaculty(existingSlot.faculty_id || '');
      setFormBatch(existingSlot.batch || '');
    } else {
      setEditingSlot({ day, lectureNo });
      setFormSubject(SUBJECTS[0]);
      setFormFaculty(profiles[0]?.id || '');
      setFormBatch('');
    }
    setIsModalOpen(true);
  };

  const handleSaveSlot = async () => {
    if (!editingSlot) return;
    setIsLoading(true);
    
    const payload = {
      day_of_week: editingSlot.day,
      lecture_no: editingSlot.lectureNo,
      subject_id: formSubject,
      faculty_id: formFaculty,
      division: selectedDivision,
      batch: formBatch || null,
      institution_id: institutionId
    };

    try {
      let error;
      if (editingSlot.id) {
        const { error: updateError } = await supabase.from('timetable').update(payload).eq('id', editingSlot.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('timetable').insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      
      setIsModalOpen(false);
      fetchData();

      // Log the change
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await writeAdminLog(
          user.id,
          'timetable',
          editingSlot.id ? 'Updated timetable slot' : 'Added timetable slot',
          `${formSubject} | Day ${editingSlot.day}, Lec ${editingSlot.lectureNo} | Div ${selectedDivision}${formBatch ? `, Batch ${formBatch}` : ''}`
        );
      }
    } catch (err: any) {
      console.error('Error saving timetable slot:', err);
      alert(err.message || 'Failed to save timetable slot');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (editingSlot?.id) {
      setIsLoading(true);
      try {
        const { error } = await supabase.from('timetable').delete().eq('id', editingSlot.id);
        if (error) throw error;
        
        setIsModalOpen(false);
        fetchData();

        // Log the deletion
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await writeAdminLog(
            user.id,
            'timetable',
            'Deleted timetable slot',
            `Removed slot | Day ${editingSlot.day}, Lec ${editingSlot.lectureNo} | Div ${selectedDivision}`
          );
        }
      } catch (err: any) {
        console.error('Error deleting timetable slot:', err);
        alert(err.message || 'Failed to delete timetable slot');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ink">Visual Editor</h2>
        <select
          value={selectedDivision}
          onChange={(e) => setSelectedDivision(e.target.value as DivisionId)}
          className="w-full sm:w-auto p-2.5 bg-paper border border-cream-border rounded-xl outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink transition-all cursor-pointer appearance-none px-4 pr-10 relative"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
        >
          {DIVISIONS.map(d => <option key={d} value={d}>Division {d}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto bg-card rounded-2xl border border-cream-border p-1">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr>
              <th className="w-32 p-3 bg-paper border-b border-r border-cream-border text-center text-xs font-semibold uppercase tracking-wider text-ink">
                Day
              </th>
              {Array.from({ length: maxLectures }).map((_, i) => (
                <th key={i} className="p-3 bg-paper border-b border-cream-border text-center text-xs font-semibold uppercase tracking-wider text-ink">
                  Lecture {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, r) => {
              const dayNum = r + 1;
              return (
                <tr key={day}>
                  <td className="p-3 border-r border-b border-cream-border text-center font-bold text-ink bg-paper/50">
                    {day}
                  </td>
                  {Array.from({ length: maxLectures }).map((_, c) => {
                    const lectureNo = c + 1;
                    const slot = timetable.find(t => t.day_of_week === dayNum && t.lecture_no === lectureNo);
                    
                    return (
                      <td key={lectureNo} className="p-2 border-b border-cream-border">
                        {slot ? (
                          <div 
                            onClick={() => handleCellClick(dayNum, lectureNo, slot)}
                            className="group relative bg-ochre/10 border border-ochre/20 hover:border-ochre/50 rounded-xl p-2 cursor-pointer transition-all"
                          >
                            <p className="font-semibold text-ink dark:text-white/75 text-sm">{slot.subject_id}</p>
                            <p className="text-xs text-ink-muted truncate mt-0.5">
                              {profiles.find(p => p.id === slot.faculty_id)?.full_name || 'Unknown'}
                            </p>
                            {slot.batch && (
                              <span className="absolute top-2 right-2 text-[0.6rem] font-bold bg-white/50 px-1.5 py-0.5 rounded text-ochre-deep">
                                {slot.batch}
                              </span>
                            )}
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleCellClick(dayNum, lectureNo)}
                            className="w-full h-full min-h-[64px] border border-dashed border-cream-border hover:border-ochre/40 rounded-xl flex items-center justify-center text-ink/30 hover:text-ochre hover:bg-ochre/5 transition-colors"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-card p-6 rounded-2xl w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-ink">
              {editingSlot?.id ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
            </h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-ink-muted mb-1 font-medium">Subject</label>
                <select 
                  value={formSubject} 
                  onChange={e => setFormSubject(e.target.value)}
                  className="w-full p-2.5 bg-paper border border-cream-border rounded-xl outline-none focus:ring-2 focus:ring-ochre/20"
                >
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-ink-muted mb-1 font-medium">Faculty</label>
                <select 
                  value={formFaculty} 
                  onChange={e => setFormFaculty(e.target.value)}
                  className="w-full p-2.5 bg-paper border border-cream-border rounded-xl outline-none focus:ring-2 focus:ring-ochre/20"
                >
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-ink-muted mb-1 font-medium">Batch (Optional)</label>
                <input 
                  type="text" 
                  value={formBatch} 
                  placeholder="e.g. F1"
                  onChange={e => setFormBatch(e.target.value)}
                  className="w-full p-2.5 bg-paper border border-cream-border rounded-xl outline-none focus:ring-2 focus:ring-ochre/20"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {getCorrectBatchesForDivision(selectedDivision).map(b => (
                    <button
                      key={b}
                      onClick={() => setFormBatch(b)}
                      className={cn(
                        "px-2 py-1 rounded-lg text-[0.65rem] font-bold border transition-all",
                        formBatch === b 
                          ? "bg-ochre text-white border-ochre" 
                          : "bg-paper text-ink-muted border-cream-border hover:border-ochre/40"
                      )}
                    >
                      {b}
                    </button>
                  ))}
                  <button
                    onClick={() => setFormBatch('')}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[0.65rem] font-bold border transition-all",
                      formBatch === '' 
                        ? "bg-night text-white border-night" 
                        : "bg-paper text-ink-muted border-cream-border hover:border-ochre/40"
                    )}
                  >
                    NONE
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              {editingSlot?.id ? (
                <button 
                  onClick={handleDeleteSlot} 
                  disabled={isLoading}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  disabled={isLoading}
                  className="px-4 py-2 text-ink hover:bg-paper rounded-xl font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveSlot} 
                  disabled={isLoading}
                  className="px-4 py-2 bg-ochre hover:bg-ochre-deep text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {editingSlot?.id ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
