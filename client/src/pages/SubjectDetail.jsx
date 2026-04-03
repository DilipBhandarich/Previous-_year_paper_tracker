import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Brain, Send, Upload, Plus, Trash2, Eye, Bot, Sparkles, ChevronDown, ChevronUp, X } from 'lucide-react';
import toast from 'react-hot-toast';

const EXAM_TYPES = ['IUT-1', 'IUT-2', 'ESE', 'Annual', 'Supplementary'];
const EXAM_COLORS = { 'IUT-1': 'badge-indigo', 'IUT-2': 'badge-violet', 'ESE': 'badge-cyan', 'Annual': 'badge-green', 'Supplementary': 'badge-yellow' };

function SimpleMarkdown({ text }) {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)/gm, '<h3>$1</h3>')
    .replace(/^## (.+)/gm, '<h2>$1</h2>')
    .replace(/^# (.+)/gm, '<h1>$1</h1>')
    .replace(/^- (.+)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>')
    .split('\n\n').map(p => p.startsWith('<') ? p : '<p>' + p + '</p>').join('');
  return <div className="msg-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

function FileViewer({ files, onClose }) {
  const [active, setActive] = useState(0);
  const cur = files[active];
  const isImg = cur && cur.type && cur.type.startsWith('image/');
  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal modal-lg file-viewer-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Paper Files ({files.length})</div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="file-viewer-content">
          <div className="file-viewer-sidebar">
            {files.map((f, i) => (
              <button key={i} className={'file-thumb-btn' + (active === i ? ' active' : '')} onClick={() => setActive(i)}>
                {f.type && f.type.startsWith('image/') ? <img src={f.url} alt={f.name} /> : <div className="pdf-thumb" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>📄</div>}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="file-viewer-main">
              {cur && isImg ? (
                <img src={cur.url} alt={cur.name} style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }} />
              ) : cur ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>📄</div>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{cur.name}</div>
                  <a href={cur.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open PDF</a>
                </div>
              ) : null}
            </div>
            <div className="file-nav">
              <button className="btn btn-ghost btn-sm" onClick={() => setActive(p => Math.max(0, p-1))} disabled={active === 0}>Prev</button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{active+1} / {files.length}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setActive(p => Math.min(files.length-1, p+1))} disabled={active === files.length-1}>Next</button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function SubjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [subject, setSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('papers');
  const [viewFiles, setViewFiles] = useState(null);
  const [analysis, setAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ year: new Date().getFullYear(), exam_type: 'IUT-1', title: '', description: '' });
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  // AI CHAT
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hello! I am your AI exam advisor for this subject. I can help you:\n\n- **Predict important questions** for IUT-1, IUT-2, and ESE\n- **Identify repeated topics** across years\n- **Suggest what to focus on** for maximum marks\n\nWhat would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const msgEndRef = useRef();
  const sessionId = useRef('session_' + Date.now());

  const QUICK_QUESTIONS = [
    'What are the most important topics for IUT-1?',
    'What questions are likely in ESE?',
    'Which topics are repeated every year?',
    'What are the most important IUT-2 questions?',
    'Predict the top 5 questions for this subject'
  ];

  useEffect(() => {
    axios.get('/api/subjects/' + id).then(r => setSubject(r.data)).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const groupByYear = (papers) => {
    const g = {};
    for (const p of papers) {
      if (!g[p.year]) g[p.year] = [];
      g[p.year].push(p);
    }
    return Object.entries(g).sort(([a],[b]) => b - a);
  };

  const sendMsg = async (text) => {
    if (thinking) return;
    const q = text || input.trim();
    if (!q) return;
    setInput('');
    setMessages(p => [...p, { role: 'user', text: q }]);
    setThinking(true);
    try {
      const hist = messages.slice(-10).map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text }));
      const { data } = await axios.post('/api/ai/chat', { question: q, subjectId: parseInt(id), sessionId: sessionId.current, history: hist });
      setMessages(p => [...p, { role: 'bot', text: data.answer }]);
    } catch (err) {
      setMessages(p => [...p, { role: 'bot', text: 'Sorry, I encountered an error. Please try again.' }]);
    }
    setThinking(false);
  };

  const analyze = async () => {
    setAnalyzing(true); setTab('ai');
    try {
      const { data } = await axios.post('/api/ai/analyze', { subjectId: parseInt(id) });
      setAnalysis(data.analysis);
    } catch { toast.error('Analysis failed. Try again.'); }
    finally { setAnalyzing(false); }
  };

  const uploadPaper = async (e) => {
    e.preventDefault(); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('subject_id', id);
      Object.entries(uploadForm).forEach(([k,v]) => { if (v) fd.append(k, v); });
      uploadFiles.forEach(f => fd.append('files', f));
      const { data } = await axios.post('/api/papers', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSubject(p => ({ ...p, papers: [data, ...(p.papers || [])] }));
      setShowUpload(false);
      setUploadForm({ year: new Date().getFullYear(), exam_type: 'IUT-1', title: '', description: '' });
      setUploadFiles([]);
      toast.success('Paper uploaded with ' + (data.files?.length || 0) + ' files!');
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const deletePaper = async (paperId) => {
    if (!confirm('Delete this paper?')) return;
    try {
      await axios.delete('/api/papers/' + paperId);
      setSubject(p => ({ ...p, papers: p.papers.filter(x => x.id !== paperId) }));
      toast.success('Paper deleted');
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!subject) return <div className="page"><div className="container section"><div className="empty-state"><div className="empty-icon">❌</div><h3>Subject not found</h3><Link to="/subjects" className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Subjects</Link></div></div></div>;

  const papers = subject.papers || [];
  const grouped = groupByYear(papers);

  return (
    <div className="page">
      <div className="container section">
        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/subjects" className="btn btn-ghost btn-sm" style={{ marginBottom: '1.25rem', display: 'inline-flex' }}>
            <ArrowLeft size={14} /> Back to Subjects
          </Link>
          <div className="page-header">
            <div className="header-left">
              <h1 className="page-title">{subject.name}</h1>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-indigo">{subject.code}</span>
                <span className="badge badge-violet">Sem {subject.semester}</span>
                <span className="badge badge-gray">{subject.branch}</span>
                <span className="badge badge-green">{papers.length} papers</span>
              </div>
              {subject.description && <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>{subject.description}</p>}
            </div>
            <div className="header-right">
              <button className="btn btn-secondary" onClick={analyze} disabled={analyzing}>
                <Sparkles size={15} /> {analyzing ? 'Analyzing...' : 'Analyze with AI'}
              </button>
              {user && <button className="btn btn-primary" onClick={() => setShowUpload(true)}><Upload size={15} /> Upload Paper</button>}
            </div>
          </div>
        </motion.div>

        {/* TABS */}
        <div className="tabs">
          <button className={'tab-btn' + (tab === 'papers' ? ' active' : '')} onClick={() => setTab('papers')}>📄 Papers ({papers.length})</button>
          <button className={'tab-btn' + (tab === 'chat' ? ' active' : '')} onClick={() => setTab('chat')}>💬 AI Chat</button>
          <button className={'tab-btn' + (tab === 'ai' ? ' active' : '')} onClick={() => setTab('ai')}>
            <Brain size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
            Analysis {analysis && '✓'}
          </button>
        </div>

        {/* PAPERS TAB */}
        {tab === 'papers' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {papers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h3>No papers uploaded yet</h3>
                <p>Be the first to upload papers for this subject</p>
                {user && <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowUpload(true)}><Upload size={15} /> Upload First Paper</button>}
              </div>
            ) : (
              <div>
                {grouped.map(([year, yearPapers]) => (
                  <div key={year} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}>📅 {year}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{yearPapers.length} papers</span>
                    </div>
                    <div className="grid-3">
                      {yearPapers.map((p, i) => {
                        const imgFiles = (p.files || []).filter(f => f && f.type && f.type.startsWith('image/'));
                        const hasFiles = p.files && p.files.length > 0;
                        return (
                          <motion.div key={p.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                            <div className="card paper-card" style={{ cursor: hasFiles ? 'pointer' : 'default' }} onClick={() => hasFiles && setViewFiles(p.files)}>
                              <div className="card-header">
                                <div style={{ flex: 1 }}>
                                  <span className={'badge ' + (EXAM_COLORS[p.exam_type] || 'badge-gray')} style={{ marginBottom: '0.4rem', display: 'inline-flex' }}>{p.exam_type}</span>
                                  {p.title && <div className="card-title" style={{ fontSize: '0.85rem' }}>{p.title}</div>}
                                </div>
                                {user && (
                                  <button className="btn btn-danger btn-sm btn-icon" style={{ width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { e.stopPropagation(); deletePaper(p.id); }}>
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                              {p.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{p.description}</div>}
                              {hasFiles && (
                                <div className="files-preview">
                                  {imgFiles.slice(0, 4).map((f, fi) => (
                                    <div key={fi} className="file-thumb"><img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                                  ))}
                                  {p.files.filter(f => f && !(f.type && f.type.startsWith('image/'))).slice(0, 3 - imgFiles.slice(0,4).length).map((f, fi) => (
                                    <div key={'p'+fi} className="file-thumb" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📄</div>
                                  ))}
                                  {p.files.length > 4 && <div className="file-count-badge">+{p.files.length - 4}</div>}
                                </div>
                              )}
                              <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: hasFiles ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: hasFiles ? 600 : 400 }}>
                                {hasFiles ? <><Eye size={12} /> {p.files.length} files — click to view</> : '📭 No files attached'}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* AI CHAT TAB */}
        {tab === 'chat' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="ai-panel">
              <div className="ai-header">
                <div className="ai-avatar">🤖</div>
                <div>
                  <div className="ai-title">AI Exam Advisor</div>
                  <div className="ai-status">Online — Analyzing {subject.name}</div>
                </div>
              </div>
              <div className="ai-messages">
                {messages.map((m, i) => (
                  <div key={i} className={'ai-message' + (m.role === 'user' ? ' user' : '')}>
                    <div className={'msg-avatar ' + (m.role === 'user' ? 'user' : 'bot')}>
                      {m.role === 'user' ? 'U' : '🤖'}
                    </div>
                    <div className={'msg-bubble ' + (m.role === 'user' ? 'user' : 'bot')}>
                      <SimpleMarkdown text={m.text} />
                    </div>
                  </div>
                ))}
                {thinking && (
                  <div className="ai-message">
                    <div className="msg-avatar bot">🤖</div>
                    <div className="msg-bubble bot thinking">
                      <div className="typing-dots"><div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" /></div>
                    </div>
                  </div>
                )}
                <div ref={msgEndRef} />
              </div>
              <div className="ai-footer">
                <div className="ai-quick-btns">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button key={i} className="ai-quick-btn" onClick={() => sendMsg(q)}>{q}</button>
                  ))}
                </div>
                <div className="ai-input-area">
                  <input className="ai-input" placeholder="Ask about important topics, predicted questions..." value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMsg()} />
                  <button className="btn btn-primary btn-icon" style={{ width: 40, height: 40, borderRadius: 10, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => sendMsg()} disabled={thinking || !input.trim()}>
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* AI ANALYSIS TAB */}
        {tab === 'ai' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {!analysis && !analyzing && (
              <div className="empty-state">
                <div className="empty-icon">🧠</div>
                <h3>AI Analysis Not Generated Yet</h3>
                <p>Click "Analyze with AI" to get detailed predictions for IUT-1, IUT-2, and ESE.</p>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={analyze}>
                  <Sparkles size={15} /> Generate Analysis
                </button>
              </div>
            )}
            {analyzing && (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                <div style={{ color: 'var(--text-secondary)' }}>AI is analyzing question patterns...</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>This may take 15-20 seconds</div>
              </div>
            )}
            {analysis && !analyzing && (
              <div className="analysis-panel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                    <Brain size={18} style={{ color: 'var(--accent)' }} />
                    AI Analysis — {subject.name}
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={analyze}>Regenerate</button>
                </div>
                <div className="analysis-content">
                  <SimpleMarkdown text={analysis} />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* UPLOAD MODAL */}
      <AnimatePresence>
        {showUpload && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUpload(false)}>
            <motion.div className="modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
              <div className="modal-header">
                <span className="modal-title">Upload Paper for {subject.name}</span>
                <button className="modal-close" onClick={() => setShowUpload(false)}>x</button>
              </div>
              <form onSubmit={uploadPaper}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Year *</label>
                    <select className="form-control" value={uploadForm.year} onChange={e => setUploadForm(p => ({...p, year: e.target.value}))} required>
                      {Array.from({length:10},(_,i) => new Date().getFullYear()-i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Exam Type</label>
                    <select className="form-control" value={uploadForm.exam_type} onChange={e => setUploadForm(p => ({...p, exam_type: e.target.value}))}>
                      {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input className="form-control" placeholder="Optional" value={uploadForm.title} onChange={e => setUploadForm(p => ({...p, title: e.target.value}))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={2} placeholder="Notes about this paper..." value={uploadForm.description} onChange={e => setUploadForm(p => ({...p, description: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Files (up to 10)</label>
                  <div className={'upload-zone' + (dragging ? ' dragging' : '')}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); setUploadFiles(p => [...p, ...Array.from(e.dataTransfer.files)].slice(0,10)); }}
                    onClick={() => fileRef.current.click()}>
                    <div className="upload-icon">📎</div>
                    <p>Drag & drop or click to select</p>
                    <p className="upload-hint">JPG, PNG, PDF — up to 10 files</p>
                    <input ref={fileRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }} onChange={e => setUploadFiles(p => [...p, ...Array.from(e.target.files)].slice(0,10))} />
                  </div>
                  {uploadFiles.length > 0 && (
                    <div className="file-preview-grid">
                      {uploadFiles.map((f, i) => (
                        <div key={i} className="file-preview-item">
                          {f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt="" /> : <div className="file-type-icon">📄</div>}
                          <button className="remove-file" type="button" onClick={() => setUploadFiles(p => p.filter((_,fi) => fi !== i))}>x</button>
                          <div className="file-name">{f.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowUpload(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload Paper'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FILE VIEWER */}
      <AnimatePresence>
        {viewFiles && <FileViewer files={viewFiles} onClose={() => setViewFiles(null)} />}
      </AnimatePresence>
    </div>
  );
}
