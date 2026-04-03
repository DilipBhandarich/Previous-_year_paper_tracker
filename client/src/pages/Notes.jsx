import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Plus, Trash2, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['default', 'blue', 'violet', 'cyan', 'green', 'yellow', 'red'];
const COLOR_LABELS = { default: '⚪', blue: '🔵', violet: '🟣', cyan: '🩵', green: '🟢', yellow: '🟡', red: '🔴' };

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ subject_id: '', title: '', content: '', color: 'default' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get('/api/notes').then(r => setNotes(r.data)),
      axios.get('/api/subjects').then(r => setSubjects(r.data))
    ]).finally(() => setLoading(false));
  }, []);

  const filtered = notes.filter(n =>
    !search || n.title?.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase())
  );

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { data } = await axios.post('/api/notes', { ...form, subject_id: form.subject_id || null });
      setNotes(p => [data, ...p]);
      setShowModal(false);
      setForm({ subject_id: '', title: '', content: '', color: 'default' });
      toast.success('Note shared anonymously!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this note?')) return;
    try {
      await axios.delete('/api/notes/' + id);
      setNotes(p => p.filter(n => n.id !== id));
      toast.success('Note deleted');
    } catch { toast.error('Failed'); }
  };

  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page">
      <div className="container section">
        <motion.div className="page-header" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="header-left">
            <h1 className="page-title">Anonymous Notes</h1>
            <p className="page-subtitle">Share tips, notes, and resources — completely anonymous, no name shown</p>
          </div>
          <div className="header-right">
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Share Note</button>
          </div>
        </motion.div>

        <motion.div className="filters-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="search-input" style={{ paddingLeft: '2.25rem', width: '100%' }} placeholder="Search notes..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {search && <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}><X size={14} /> Clear</button>}
        </motion.div>

        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '0.85rem 1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '1.2rem' }}>🔒</span>
          <span><strong style={{ color: 'var(--text-primary)' }}>100% Anonymous</strong> — No name, email, or identity is stored with your notes. Share freely.</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>{search ? 'No notes match your search' : 'No notes yet'}</h3>
            <p>{search ? 'Try different keywords' : 'Be the first to share a note with your batch!'}</p>
            {!search && <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowModal(true)}><Plus size={15} /> Share First Note</button>}
          </div>
        ) : (
          <div className="grid-3">
            {filtered.map((note, i) => (
              <motion.div key={note.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div className={'card note-card color-' + note.color}>
                  <button className="delete-note btn btn-danger btn-sm btn-icon" style={{ width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }} onClick={() => remove(note.id)}>
                    <Trash2 size={12} />
                  </button>
                  {note.title && <div className="card-title" style={{ marginBottom: '0.5rem', paddingRight: '2rem' }}>{note.title}</div>}
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{note.content}</div>
                  {note.subject_name && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <span className="badge badge-indigo">📚 {note.subject_name}</span>
                    </div>
                  )}
                  <div className="note-date">{fmt(note.created_at)}</div>
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
                <span className="modal-title">Share Anonymous Note</span>
                <button className="modal-close" onClick={() => setShowModal(false)}>x</button>
              </div>
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '0.65rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#6ee7b7' }}>
                🔒 Your note will be completely anonymous — no name or identity is recorded.
              </div>
              <form onSubmit={save}>
                <div className="form-group">
                  <label className="form-label">Title (Optional)</label>
                  <input className="form-control" placeholder="e.g. Important DBMS tips" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Note Content *</label>
                  <textarea className="form-control" rows={5} placeholder="Share your notes, tips, important topics, or resources..." value={form.content} onChange={e => setForm(p => ({...p, content: e.target.value}))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Related Subject (Optional)</label>
                  <select className="form-control" value={form.subject_id} onChange={e => setForm(p => ({...p, subject_id: e.target.value}))}>
                    <option value="">General / No specific subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name} (Sem {s.semester})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Color Tag</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {COLORS.map(c => (
                      <button key={c} type="button"
                        onClick={() => setForm(p => ({...p, color: c}))}
                        style={{ padding: '0.3rem 0.75rem', borderRadius: 100, border: form.color === c ? '2px solid var(--accent)' : '1px solid var(--border)', background: form.color === c ? 'rgba(99,102,241,0.15)' : 'transparent', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'inherit' }}>
                        {COLOR_LABELS[c]} {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Sharing...' : 'Share Anonymously'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
