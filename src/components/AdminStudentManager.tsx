import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useInstitution } from '../context/InstitutionContext';
import { Plus, Upload, Edit2, Trash2, Search, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DIVISIONS, type DivisionId } from '../constants';
import { cn, getCorrectBatchesForDivision } from '../utils/attendance';
import { writeAdminLog } from '../utils/admin';

interface AdminStudentManagerProps {
  onStudentsChanged: () => Promise<void>;
}

interface Student {
  id: string;
  name: string;
  roll_no: string;
  division: string;
  batch: string | null;
}

function getDivisionFromRollNo(rollNo: string): DivisionId {
  if (rollNo && rollNo.length >= 5) {
    const divChar = rollNo.charAt(4);
    const divNum = parseInt(divChar, 10);
    if (!isNaN(divNum) && divNum >= 1 && divNum <= 26) {
      const divLetter = String.fromCharCode(64 + divNum);
      if (DIVISIONS.includes(divLetter as DivisionId)) {
        return divLetter as DivisionId;
      }
    }
  }
  return 'A';
}

export default function AdminStudentManager({ onStudentsChanged }: AdminStudentManagerProps) {
  const { institutionId, scopeQuery } = useInstitution();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [batch, setBatch] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    const { data } = await scopeQuery(
      supabase.from('students').select('*').order('division').order('roll_no')
    );
    if (data) setStudents(data);
    setIsLoading(false);
  }, [scopeQuery]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const getCurrentUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  };

  const requireInstitutionId = () => {
    if (!institutionId) {
      throw new Error('Institution context is required to manage students.');
    }
    return institutionId;
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setName(student.name);
    setRollNo(student.roll_no);
    setBatch(student.batch || '');
    setIsAddModalOpen(true);
  };

  const closeModals = () => {
    setIsAddModalOpen(false);
    setIsBulkModalOpen(false);
    setEditingStudent(null);
    setName('');
    setRollNo('');
    setBatch('');
    setBulkText('');
    setMessage(null);
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage(null);
    try {
      const activeInstitutionId = requireInstitutionId();
      const division = getDivisionFromRollNo(rollNo);
      const payload = { name, roll_no: rollNo, division, batch: batch || null, institution_id: activeInstitutionId };
      
      let error;
      if (editingStudent) {
        const { error: updateError } = await supabase
          .from('students')
          .update(payload)
          .eq('id', editingStudent.id)
          .eq('institution_id', activeInstitutionId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('students').insert([payload]);
        error = insertError;
      }
      
      if (error) throw error;

      const actorId = await getCurrentUserId();
      if (actorId) {
        await writeAdminLog(
          actorId,
          'student',
          editingStudent ? 'Updated student' : 'Added student',
          `${name} (${rollNo}) → Division ${division}${batch ? `, Batch ${batch}` : ''}`,
          activeInstitutionId,
        );
      }

      closeModals();
      await Promise.all([fetchStudents(), onStudentsChanged()]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save student.' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage(null);
    try {
      const activeInstitutionId = requireInstitutionId();
      let lines = bulkText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length > 0 && lines[0].toLowerCase().includes('name') && lines[0].toLowerCase().includes('roll')) {
        lines = lines.slice(1);
      }
      const studentsToInsert = lines.map((line, index) => {
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length < 2) throw new Error(`Invalid format on line ${index + 1}. Expected: Name, RollNo, Batch`);
        const [n, r, b] = parts;
        const d = getDivisionFromRollNo(r);
        return { name: n, roll_no: r, division: d, batch: b || null, institution_id: activeInstitutionId };
      });

      const { error } = await supabase
        .from('students')
        .upsert(studentsToInsert, { onConflict: 'institution_id,roll_no' });
      if (error) throw error;

      const actorId = await getCurrentUserId();
      if (actorId) {
        await writeAdminLog(actorId, 'student', 'Bulk added students', `${studentsToInsert.length} students uploaded`, activeInstitutionId);
      }

      closeModals();
      await Promise.all([fetchStudents(), onStudentsChanged()]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to bulk upload.' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (student: Student) => {
    if (!window.confirm(`Are you sure you want to delete ${student.name}?`)) return;
    try {
      const activeInstitutionId = requireInstitutionId();
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id)
        .eq('institution_id', activeInstitutionId);
      if (error) throw error;

      const actorId = await getCurrentUserId();
      if (actorId) {
        await writeAdminLog(actorId, 'student', 'Deleted student', `${student.name} (${student.roll_no}) removed`, activeInstitutionId);
      }
      await Promise.all([fetchStudents(), onStudentsChanged()]);
    } catch (err: any) {
      alert(err.message || 'Failed to delete student.');
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.roll_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.division.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input 
            type="text" 
            placeholder="Search students by name, roll no, or division..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ochre/20 text-sm text-ink"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-ochre hover:bg-ochre-deep text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Student
          </button>
          <button 
            onClick={() => setIsBulkModalOpen(true)}
            className="bg-paper hover:bg-cream border border-cream-border text-ink px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" /> Bulk Upload
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card rounded-2xl border border-cream-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-cream-border bg-paper/50">
                <th className="px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Roll No</th>
                <th className="px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Division</th>
                <th className="px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">Batch</th>
                <th className="px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="w-6 h-6 border-2 border-ink/10 border-t-ochre rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-ink-muted">
                    No students found. Add a student to get started.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-paper/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-ink">{student.name}</td>
                    <td className="px-5 py-3 text-sm text-ink-muted font-mono">{student.roll_no}</td>
                    <td className="px-5 py-3">
                      <span className="bg-cream border border-cream-border text-ink px-2 py-0.5 rounded text-xs font-bold">
                        Div {student.division}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {student.batch ? (
                        <span className="bg-ochre/10 border border-ochre/20 text-ochre-deep px-2 py-0.5 rounded text-xs font-bold">
                          {student.batch}
                        </span>
                      ) : (
                        <span className="text-ink-muted text-sm">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEditModal(student)} className="p-1.5 text-ink-muted hover:text-ochre hover:bg-ochre/10 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(student)} className="p-1.5 text-ink-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={closeModals} />
          <div className="relative bg-card p-6 rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-ink">{editingStudent ? 'Edit Student' : 'Add New Student'}</h3>
              <button onClick={closeModals} className="text-ink-muted hover:text-ink"><X className="w-5 h-5" /></button>
            </div>
            {message && <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium border border-rose-200 flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0"/>{message.text}</div>}
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div>
                <label className="eyebrow block mb-1">Full name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ochre/20 text-ink" placeholder="John Doe" />
              </div>
              <div>
                <label className="eyebrow block mb-1">Roll number</label>
                <input type="text" required value={rollNo} onChange={(e) => setRollNo(e.target.value)} className="w-full px-4 py-2.5 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ochre/20 text-ink font-mono" placeholder="25FC304" />
                <p className="text-[0.65rem] text-ink-muted mt-1">Division {getDivisionFromRollNo(rollNo)} automatically inferred.</p>
              </div>
              <div>
                <label className="eyebrow block mb-1">Batch (optional)</label>
                <input type="text" value={batch} onChange={(e) => setBatch(e.target.value)} className="w-full px-4 py-2.5 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ochre/20 text-ink" placeholder="e.g. F1" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {getCorrectBatchesForDivision(getDivisionFromRollNo(rollNo)).map(b => (
                    <button key={b} type="button" onClick={() => setBatch(b)} className={cn("px-2 py-1 rounded-md text-[0.65rem] font-bold border transition-all", batch === b ? "bg-ochre text-white border-ochre" : "bg-paper text-ink-muted border-cream-border")}>{b}</button>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={formLoading} className="w-full bg-ochre hover:bg-ochre-deep text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors">
                  {formLoading ? 'Saving...' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={closeModals} />
          <div className="relative bg-card p-6 rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-ink">Bulk Upload Students</h3>
              <button onClick={closeModals} className="text-ink-muted hover:text-ink"><X className="w-5 h-5" /></button>
            </div>
            {message && <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium border border-rose-200 flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0"/>{message.text}</div>}
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div>
                <p className="text-[0.8rem] text-ink-muted mb-2">Format: <code className="font-mono bg-cream px-1.5 py-0.5 rounded text-ink">Name, RollNo, Batch</code> (One per line)</p>
                <textarea required value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={8} className="w-full px-4 py-3 bg-paper border border-cream-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ochre/20 font-mono text-sm text-ink whitespace-pre" placeholder={"John Doe, 25FC304, F1\nJane Smith, 25FC205, F2"} />
              </div>
              <div className="pt-2">
                <button type="submit" disabled={formLoading} className="w-full bg-night hover:bg-black text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" /> {formLoading ? 'Processing...' : 'Upload CSV'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
