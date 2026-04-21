import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DIVISIONS, SUBJECTS, type DivisionId } from '../constants';
import { Calendar, Plus, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../utils/attendance';

export default function AdminTimetableEditor() {
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
      supabase.from('profiles').select('id, full_name').in('role', ['faculty', 'admin']),
      supabase.from('timetable').select('*').eq('division', selectedDivision)
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
    
    const payload = {
      day_of_week: editingSlot.day,
      lecture_no: editingSlot.lectureNo,
      subject_id: formSubject,
      faculty_id: formFaculty,
      division: selectedDivision,
      batch: formBatch || null
    };

    if (editingSlot.id) {
      await supabase.from('timetable').update(payload).eq('id', editingSlot.id);
    } else {
      await supabase.from('timetable').insert([payload]);
    }
    
    setIsModalOpen(false);
    fetchData();
  };

  const handleDeleteSlot = async () => {
    if (editingSlot?.id) {
      await supabase.from('timetable').delete().eq('id', editingSlot.id);
      setIsModalOpen(false);
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-ink">Weekly Schedule</h3>
          <p className="text-sm text-ink-muted">View and edit the timetable for each division.</p>
        </div>
        <select
          value={selectedDivision}
          onChange={(e) => setSelectedDivision(e.target.value as DivisionId)}
          className="w-full sm:w-auto p-2.5 bg-white border border-cream-border rounded-xl outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre font-bold text-ink transition-all cursor-pointer appearance-none px-4 pr-10 relative shadow-sm"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
        >
          {DIVISIONS.map(d => <option key={d} value={d}>Division {d}</option>)}
        </select>
      </div>

      <div className="overflow-hidden bg-white rounded-2xl border border-cream-border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className="w-32 p-4 bg-paper border-b border-r border-cream-border text-center text-[10px] font-black uppercase tracking-widest text-ink-muted">
                  Day
                </th>
                {Array.from({ length: maxLectures }).map((_, i) => (
                  <th key={i} className="p-4 bg-paper border-b border-cream-border text-center text-[10px] font-black uppercase tracking-widest text-ink-muted">
                    Lecture {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day, r) => {
                const dayNum = r + 1;
                return (
                  <tr key={day} className="group">
                    <td className="p-4 border-r border-b border-cream-border text-center font-bold text-ink-muted bg-paper/30 group-hover:bg-paper/50 transition-colors">
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
                              className="group/slot relative bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-white rounded-xl p-3 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold text-ink text-sm tracking-tight">{slot.subject_id}</p>
                                <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/slot:opacity-100 transition-opacity" />
                              </div>
                              <p className="text-[11px] font-medium text-slate-500 truncate">
                                {profiles.find(p => p.id === slot.faculty_id)?.full_name || 'Unknown'}
                              </p>
                              {slot.batch && (
                                <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-md shadow-sm">
                                  {slot.batch}
                                </span>
                              )}
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleCellClick(dayNum, lectureNo)}
                              className="w-full h-full min-h-[72px] border-2 border-dashed border-slate-100 hover:border-ochre/30 rounded-xl flex items-center justify-center text-slate-300 hover:text-ochre hover:bg-ochre/5 transition-all group/plus"
                            >
                              <Plus className="w-5 h-5 transform group-hover/plus:scale-110 transition-transform" />
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
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-xl font-black text-ink">
                {editingSlot?.id ? 'Edit Slot' : 'Add Slot'}
              </h3>
              <p className="text-sm text-ink-muted">Set subject and faculty for this lecture.</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-ink-muted ml-1">Subject</label>
                <select 
                  value={formSubject} 
                  onChange={e => setFormSubject(e.target.value)}
                  className="w-full p-3 bg-paper border border-cream-border rounded-xl outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre font-bold text-ink transition-all"
                >
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-ink-muted ml-1">Faculty</label>
                <select 
                  value={formFaculty} 
                  onChange={e => setFormFaculty(e.target.value)}
                  className="w-full p-3 bg-paper border border-cream-border rounded-xl outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre font-bold text-ink transition-all"
                >
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-ink-muted ml-1">Batch (Optional)</label>
                <input 
                  type="text" 
                  value={formBatch} 
                  placeholder="e.g. F1"
                  onChange={e => setFormBatch(e.target.value)}
                  className="w-full p-3 bg-paper border border-cream-border rounded-xl outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre font-bold text-ink transition-all placeholder:text-slate-300"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-4">
              {editingSlot?.id ? (
                <button onClick={handleDeleteSlot} className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors group">
                  <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
              ) : <div />}
              <div className="flex gap-3 flex-1 justify-end">
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-6 py-3 text-ink-muted hover:text-ink hover:bg-paper rounded-2xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveSlot} 
                  className="px-8 py-3 bg-ochre hover:bg-ochre-deep text-white rounded-2xl font-bold shadow-lg shadow-ochre/20 transform active:scale-95 transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
