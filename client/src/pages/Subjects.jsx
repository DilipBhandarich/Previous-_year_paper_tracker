import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, X, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const BRANCHES = ['Common', 'CSE', 'ECE', 'ME', 'CIVIL', 'EEE'];
const SEMESTERS = [1,2,3,4,5,6,7,8];

export default function Subjects() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ semester: '', branch: '', search: '', sort: 'semester' });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', semester: '', branch: 'CSE', description: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    const params = new URLSearchParams();
    if (filters.semester) params.set('semester', filters.semester);
    if (filters.branch) params.set('branch', filters.branch);
    if (filters.search) params.set('search', filters.search);
    if (filters.sort) params.set('sort', filters.sort);
    axios.get('/api/subjects?' + params).then(r => setSubjects(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters.semester, filters.branch, filters.sort]);
  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); }, [filters.search]);

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { data } = await axios.post('/api/subjects', { ...form, semester: parseInt(form.semester) || null });
      setSubjects(p => [data, ...p]);
      setShowModal(false);
      setForm({ name: '', code: '', semester: '', branch: 'CSE', description: '' });
      toast.success('Subject added!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this subject and all its papers?')) return;
    try {
      await axios.delete('/api/subjects/' + id);
      setSubjects(p => p.filter(s => s.id !== id));
      toast.success('Subject deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const semColors = (s) => ['badge-indigo','badge-violet','badge-cyan','badge-green','badge-yellow','badge-red','badge-indigo','badge-violet'][(s - 1) % 8] || 'badge-gray';

  return (
    <div className="page">
      <div className="container section">
        <motion.div className="page-header" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="header-left">
            <h1 className="page-title">Subjects</h1>
            <p className="page-subtitle">{subjects.length} subjects — click to browse papers and get AI insights</p>
          </div>
          <div className="header-right">
            {user && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Subject</button>}
          </div>
        </motion.div>

        <motion.div className="filters-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="search-input" style={{ paddingLeft: '2.25rem', width: '100%' }} placeholder="Search subjects..."
              value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} />
          </div>
          <select className="filter-select" value={filters.semester} onChange={e => setFilters(p => ({ ...p, semester: e.target.value }))}>
            <option value="">All Semesters</option>
            {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
          </select>
          <select className="filter-select" value={filters.branch} onChange={e => setFilters(p => ({ ...p, branch: e.target.value }))}>
            <option value="">All Branches</option>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="filter-select" value={filters.sort} onChange={e => setFilters(p => ({ ...p, sort: e.target.value }))}>
            <option value="semester">Sort: Semester</option>
            <option value="name">Sort: Name</option>
            <option value="branch">Sort: Branch</option>
            <option value="papers">Sort: Most Papers</option>
          </select>
          {(filters.semester || filters.branch || filters.search) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ semester: '', branch: '', search: '', sort: 'semester' })}><X size={14} /> Clear</button>
          )}
        </motion.div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : subjects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>No subjects found</h3>
            <p>Adjust filters or add a subject</p>
            {user && <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowModal(true)}><Plus size={15} /> Add Subject</button>}
          </div>
        ) : (
          <div className="grid-3">
            {subjects.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="card subject-card">
                  <div className="accent-line" />
                  <div className="card-header">
                    <div style={{ flex: 1 }}>
                      <div className="card-title">{s.name}</div>
                      <div className="card-subtitle">{s.code}</div>
                    </div>
                    {user && (
                      <button className="btn btn-danger btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '1rem' }} onClick={e => remove(s.id, e)}>x</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <span className={'badge ' + semColors(s.semester)}>Sem {s.semester}</span>
                    <span className="badge badge-gray">{s.branch}</span>
                  </div>
                  {s.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{s.description}</div>}
                  <div className="card-footer">
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>📄 {s.paper_count || 0} papers</span>
                    <Link to={'/subjects/' + s.id} className="btn btn-primary btn-sm">View <ArrowRight size={13} /></Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
            <motion.div className="modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">Add New Subject</span>
                <button className="modal-close" onClick={() => setShowModal(false)}>x</button>
              </div>
              <form onSubmit={save}>
                <div className="form-group">
                  <label className="form-label">Subject Name *</label>
                  <input className="form-control" placeholder="e.g. Data Structures" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Code</label>
                    <input className="form-control" placeholder="e.g. CS201" value={form.code} onChange={e => setForm(p => ({...p, code: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Semester</label>
                    <select className="form-control" value={form.semester} onChange={e => setForm(p => ({...p, semester: e.target.value}))}>
                      <option value="">Select</option>
                      {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <select className="form-control" value={form.branch} onChange={e => setForm(p => ({...p, branch: e.target.value}))}>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={2} placeholder="Topics covered..." value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Subject'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
