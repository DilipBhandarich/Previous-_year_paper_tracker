import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, X, Upload, FileText, Image, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const EXAM_TYPES = ['IAT-1', 'IAT-2', 'SEE', 'Annual', 'Supplementary'];
const BRANCHES = ['Common', 'CSE', 'ECE', 'ME', 'CIVIL', 'EEE'];
const SEMESTERS = [1,2,3,4,5,6,7,8];
const EXAM_COLORS = { 'IAT-1': 'badge-indigo', 'IAT-2': 'badge-violet', 'SEE': 'badge-cyan', 'Annual': 'badge-green', 'Supplementary': 'badge-yellow' };
const makeUploadId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

const toUploadItems = (incoming) => {
  return Array.from(incoming || []).map((file) => ({
    id: makeUploadId(),
    file,
    previewUrl: URL.createObjectURL(file)
  }));
};

const appendUploadItems = (existing, incoming) => {
  if (!incoming?.length) return existing;
  return [...existing, ...toUploadItems(incoming)].slice(0, 10);
};

const toFileUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return url;
};

const byFileOrder = (a, b) => {
  const ao = a?.order ?? a?.file_order;
  const bo = b?.order ?? b?.file_order;
  if (ao == null && bo == null) return 0;
  if (ao == null) return 1;
  if (bo == null) return -1;
  return ao - bo;
};

const normalizeExamType = (examType) => {
  if (!examType) return '';
  if (examType === 'IUT-1') return 'IAT-1';
  if (examType === 'IUT-2') return 'IAT-2';
  if (examType === 'ESE') return 'SEE';
  return examType;
};

function FileViewer({ paper, onClose }) {
  const [active, setActive] = useState(0);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const files = (paper.files || []).map((f) => ({
    ...f,
    url: toFileUrl(f.url || f.file_url),
    type: f.type || f.file_type,
    name: f.name || f.original_name
  })).sort(byFileOrder);
  const cur = files[active];
  const isImg = cur && cur.type && cur.type.startsWith('image/');
  const imageCount = files.filter((f) => f.type && f.type.startsWith('image/')).length;

  const handleDownloadImagesPdf = async () => {
    setDownloadingPdf(true);
    try {
      const safeExam = String(paper.exam_type || 'paper').replace(/[^a-zA-Z0-9_-]+/g, '-');
      const safeYear = String(paper.year || 'year');
      const safeSubject = String(paper.subject_code || paper.subject_name || 'subject').replace(/[^a-zA-Z0-9_-]+/g, '-');
      const { downloadImagesAsPdf } = await import('../utils/downloadImagesPdf');
      await downloadImagesAsPdf(files, `${safeSubject}-${safeExam}-${safeYear}`);
      toast.success('Downloaded all images as PDF');
    } catch (err) {
      toast.error(err.message || 'Failed to generate PDF from images');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal modal-lg file-viewer-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{paper.subject_name || paper.title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{paper.year} • {paper.exam_type} • {files.length} file(s)</div>
          </div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        {files.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <div className="empty-icon">📄</div>
            <h3>No files attached</h3>
          </div>
        ) : (
          <div className="file-viewer-content">
            <div className="file-viewer-sidebar">
              {files.map((f, i) => {
                const isImg2 = f.type && f.type.startsWith('image/');
                return (
                  <button key={f.id ?? `${f.name}-${f.url}-${f.order ?? f.file_order ?? f._localOrder ?? i}`} className={'file-thumb-btn' + (active === i ? ' active' : '')} onClick={() => setActive(i)}>
                    {isImg2 ? <img src={f.url} alt={f.name} /> : <div className="pdf-thumb" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>📄</div>}
                  </button>
                );
              })}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="file-viewer-main">
                {cur && isImg ? (
                  <img src={cur.url} alt={cur.name} style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }} />
                ) : cur ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>📄</div>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{cur.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <a href={cur.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open PDF</a>
                      <a href={cur.url} download={cur.name || 'paper-file'} className="btn btn-secondary">Download</a>
                    </div>
                  </div>
                ) : null}
              </div>
              {cur && (
                <div className="file-info" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {cur.name} {cur.size && '• ' + (cur.size / 1024 < 1024 ? Math.round(cur.size/1024) + ' KB' : (cur.size/1048576).toFixed(1) + ' MB')}
                </div>
              )}
              <div className="file-nav">
                <button className="btn btn-ghost btn-sm" onClick={() => setActive(p => Math.max(0, p-1))} disabled={active === 0}>← Prev</button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{active+1} / {files.length}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setActive(p => Math.min(files.length-1, p+1))} disabled={active === files.length-1}>Next →</button>
              </div>
              {cur && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <a href={cur.url} download={cur.name || 'paper-file'} className="btn btn-secondary btn-sm">Download This File</a>
                  {imageCount > 0 && <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadImagesPdf} disabled={downloadingPdf}>{downloadingPdf ? 'Generating PDF...' : `Download All Images as PDF (${imageCount})`}</button>}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function Papers() {
  const { user } = useAuth();
  const [papers, setPapers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ subject_id: '', year: '', exam_type: '', branch: '', semester: '', search: '' });
  const [showModal, setShowModal] = useState(false);
  const [viewPaper, setViewPaper] = useState(null);
  const [form, setForm] = useState({ subject_id: '', year: new Date().getFullYear(), exam_type: 'IAT-1', title: '', description: '' });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();
  const filesRef = useRef([]);

  const load = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k,v]) => { if (v) params.set(k, v); });
    axios.get('/api/papers?' + params).then(r => setPapers(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters.subject_id, filters.year, filters.exam_type, filters.branch, filters.semester]);
  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); }, [filters.search]);
  useEffect(() => { axios.get('/api/subjects').then(r => setSubjects(r.data)); }, []);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => () => {
    filesRef.current.forEach((item) => {
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).slice(0, 10);
    setFiles(p => appendUploadItems(p, dropped));
  };

  const addFiles = (e) => setFiles(p => appendUploadItems(p, Array.from(e.target.files)));

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (!files.length) {
        toast.error('Please add at least one image');
        setSaving(false);
        return;
      }
      const hasImage = files.some((item) => String(item.file?.type || '').startsWith('image/'));
      if (!hasImage) {
        toast.error('At least one image file is required');
        setSaving(false);
        return;
      }
      const fd = new FormData();
      Object.entries(form).forEach(([k,v]) => { if (v) fd.append(k, v); });
      files.forEach((item, i) => fd.append(`files_${i}`, item.file));
      const { data } = await axios.post('/api/papers', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPapers(p => [data, ...p]);
      closeUploadModal();
      setForm({ subject_id: '', year: new Date().getFullYear(), exam_type: 'IAT-1', title: '', description: '' });
      toast.success('Paper added with ' + (data.files?.length || 0) + ' files!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this paper?')) return;
    try {
      await axios.delete('/api/papers/' + id);
      setPapers(p => p.filter(x => x.id !== id));
      toast.success('Paper deleted');
    } catch { toast.error('Failed'); }
  };

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  const closeUploadModal = () => {
    setFiles((prev) => {
      prev.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
    setShowModal(false);
  };

  return (
    <div className="page">
      <div className="container section">
        <motion.div className="page-header" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="header-left">
            <h1 className="page-title">Question Papers</h1>
            <p className="page-subtitle">{papers.length} papers found — click any card to view files</p>
          </div>
          <div className="header-right">
            {user && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Upload Paper</button>}
          </div>
        </motion.div>

        <motion.div className="filters-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="search-input" style={{ paddingLeft: '2.25rem', width: '100%' }} placeholder="Search papers..."
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
          <select className="filter-select" value={filters.year} onChange={e => setFilters(p => ({ ...p, year: e.target.value }))}>
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="filter-select" value={filters.exam_type} onChange={e => setFilters(p => ({ ...p, exam_type: e.target.value }))}>
            <option value="">All Exam Types</option>
            {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {Object.values(filters).some(v => v) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ subject_id: '', year: '', exam_type: '', branch: '', semester: '', search: '' })}><X size={14} /> Clear</button>
          )}
        </motion.div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : papers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>No papers found</h3>
            <p>Adjust filters or upload a paper</p>
            {user && <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowModal(true)}><Upload size={15} /> Upload Paper</button>}
          </div>
        ) : (
          <div className="grid-3">
            {papers.map((p, i) => {
              const normalizedFiles = (p.files || []).map((f) => ({
                ...f,
                url: toFileUrl(f.url || f.file_url),
                type: f.type || f.file_type,
                name: f.name || f.original_name
              }));
              const imgFiles = normalizedFiles.filter(f => f && f.type && f.type.startsWith('image/'));
              const otherFiles = normalizedFiles.filter(f => f && !(f.type && f.type.startsWith('image/')));
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className="card paper-card" onClick={() => setViewPaper({ ...p, files: normalizedFiles })}>
                    <div className="card-header">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.subject_name}</div>
                        <div className="card-subtitle">{p.subject_code} • Sem {p.semester} • {p.branch}</div>
                      </div>
                      <div className="card-actions">
                        <span className={'badge ' + (EXAM_COLORS[normalizeExamType(p.exam_type)] || 'badge-gray')}>{normalizeExamType(p.exam_type)}</span>
                        {user && <button className="btn btn-danger btn-sm btn-icon" style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => remove(p.id, e)}><Trash2 size={13} /></button>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span className="badge badge-gray">📅 {p.year}</span>
                      {normalizedFiles.length > 0 && <span className="badge badge-green">📎 {normalizedFiles.length} files</span>}
                    </div>
                    {p.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{p.description}</div>}
                    {normalizedFiles.length > 0 && (
                      <div className="files-preview">
                        {imgFiles.slice(0, 4).map((f, fi) => (
                          <div key={fi} className="file-thumb">
                            <img src={f.url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                        {otherFiles.slice(0, 4 - imgFiles.slice(0,4).length).map((f, fi) => (
                          <div key={'pdf'+fi} className="file-thumb">📄</div>
                        ))}
                        {normalizedFiles.length > 4 && <div className="file-count-badge">+{normalizedFiles.length - 4}</div>}
                      </div>
                    )}
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>
                      <Eye size={13} /> Click to view files
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* UPLOAD MODAL */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { if (e.target === e.currentTarget) closeUploadModal(); }}>
            <motion.div className="modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
              <div className="modal-header">
                <span className="modal-title">Upload Question Paper</span>
                <button className="modal-close" onClick={closeUploadModal}>x</button>
              </div>
              <form onSubmit={save}>
                <div className="form-group">
                  <label className="form-label">Subject *</label>
                  <select className="form-control" value={form.subject_id} onChange={e => setForm(p => ({...p, subject_id: e.target.value}))} required>
                    <option value="">Select Subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name} (Sem {s.semester} - {s.branch})</option>)}
                  </select>
                </div>
                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Year *</label>
                    <select className="form-control" value={form.year} onChange={e => setForm(p => ({...p, year: e.target.value}))} required>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Exam Type</label>
                    <select className="form-control" value={form.exam_type} onChange={e => setForm(p => ({...p, exam_type: e.target.value}))}>
                      {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input className="form-control" placeholder="Optional title" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={2} placeholder="Optional notes about this paper..." value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} />
                </div>

                <div className="form-group">
                  <label className="form-label">Upload Files (up to 10 — images or PDFs)</label>
                  <div className={'upload-zone' + (dragging ? ' dragging' : '')}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => fileRef.current.click()}>
                    <div className="upload-icon">📎</div>
                    <p>Drag & drop files here or click to browse</p>
                    <p className="upload-hint">Supports JPG, PNG, GIF, WEBP, PDF — up to 10 files, 50MB each</p>
                    <input ref={fileRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }} onChange={addFiles} />
                  </div>
                  {files.length > 0 && (
                    <Reorder.Group axis="x" values={files} onReorder={setFiles} className="file-preview-grid">
                      {files.map((item) => {
                        const isImg = item.file.type.startsWith('image/');
                        return (
                          <Reorder.Item value={item} key={item.id} className="file-preview-item" dragElastic={0.12}>
                            {isImg ? <img src={item.previewUrl} alt={item.file.name} /> : <div className="file-type-icon">📄</div>}
                            <button
                              className="remove-file"
                              onClick={() => setFiles(prev => {
                                const found = prev.find(x => x.id === item.id);
                                if (found) URL.revokeObjectURL(found.previewUrl);
                                return prev.filter(x => x.id !== item.id);
                              })}
                              type="button"
                            >
                              x
                            </button>
                            <div className="file-name">{item.file.name}</div>
                          </Reorder.Item>
                        );
                      })}
                    </Reorder.Group>
                  )}
                  {files.length > 1 && <p className="upload-hint">Drag files left/right to set final order</p>}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost" onClick={closeUploadModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Uploading...' : 'Upload Paper'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FILE VIEWER */}
      <AnimatePresence>
        {viewPaper && <FileViewer paper={viewPaper} onClose={() => setViewPaper(null)} />}
      </AnimatePresence>
    </div>
  );
}
