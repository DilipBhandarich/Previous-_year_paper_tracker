import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Brain, Send, Upload, Plus, Trash2, Eye, Bot, Sparkles, ChevronDown, ChevronUp, X } from 'lucide-react';
import toast from 'react-hot-toast';

const EXAM_TYPES = ['IAT-1', 'IAT-2', 'SEE', 'Annual', 'Supplementary'];
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

const renderInlineMarkdown = (text) => {
  const value = String(text || '');
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = value.split(pattern);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    return <span key={idx}>{part}</span>;
  });
};

function SimpleMarkdown({ text }) {
  const lines = String(text || '').split('\n');
  const nodes = [];
  let listItems = [];
  let paragraph = [];

  const flushList = () => {
    if (!listItems.length) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`}>
        {listItems.map((item, idx) => <li key={idx}>{renderInlineMarkdown(item)}</li>)}
      </ul>
    );
    listItems = [];
  };

  const flushParagraph = () => {
    if (!paragraph.length) return;
    nodes.push(
      <p key={`p-${nodes.length}`}>
        {renderInlineMarkdown(paragraph.join(' '))}
      </p>
    );
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      flushParagraph();
      continue;
    }

    const h3 = line.match(/^###\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h1 = line.match(/^#\s+(.+)/);
    const bullet = line.match(/^-\s+(.+)/);

    if (h1 || h2 || h3) {
      flushList();
      flushParagraph();
      const headingText = (h1 || h2 || h3)[1];
      if (h1) nodes.push(<h1 key={`h1-${nodes.length}`}>{renderInlineMarkdown(headingText)}</h1>);
      if (h2) nodes.push(<h2 key={`h2-${nodes.length}`}>{renderInlineMarkdown(headingText)}</h2>);
      if (h3) nodes.push(<h3 key={`h3-${nodes.length}`}>{renderInlineMarkdown(headingText)}</h3>);
      continue;
    }

    if (bullet) {
      flushParagraph();
      listItems.push(bullet[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushList();
  flushParagraph();

  return <div className="msg-content">{nodes}</div>;
}

function FileViewer({ files, onClose }) {
  const [active, setActive] = useState(0);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const normalizedFiles = files.map((f) => ({
    ...f,
    url: toFileUrl(f.url || f.file_url),
    type: f.type || f.file_type,
    name: f.name || f.original_name
  })).sort(byFileOrder);
  const cur = normalizedFiles[active];
  const isImg = cur && cur.type && cur.type.startsWith('image/');
  const imageCount = normalizedFiles.filter((f) => f.type && f.type.startsWith('image/')).length;

  const handleDownloadImagesPdf = async () => {
    setDownloadingPdf(true);
    try {
      const { downloadImagesAsPdf } = await import('../utils/downloadImagesPdf');
      await downloadImagesAsPdf(normalizedFiles, 'paper-images');
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
          <div className="modal-title">Paper Files ({files.length})</div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="file-viewer-content">
          <div className="file-viewer-sidebar">
            {normalizedFiles.map((f, i) => (
              <button key={f.id ?? `${f.name}-${f.url}-${f.order ?? f.file_order ?? f._localOrder ?? i}`} className={'file-thumb-btn' + (active === i ? ' active' : '')} onClick={() => setActive(i)}>
                {f.type && f.type.startsWith('image/') ? <img src={f.url} alt={f.name} /> : <div className="pdf-thumb" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }} >📄</div>}
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
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                    <a href={cur.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open PDF</a>
                    <a href={cur.url} download={cur.name || 'paper-file'} className="btn btn-secondary">Download</a>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="file-nav">
              <button className="btn btn-ghost btn-sm" onClick={() => setActive(p => Math.max(0, p-1))} disabled={active === 0}>Prev</button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{active+1} / {files.length}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setActive(p => Math.min(files.length-1, p+1))} disabled={active === files.length-1}>Next</button>
            </div>
            {cur && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href={cur.url} download={cur.name || 'paper-file'} className="btn btn-secondary btn-sm">Download This File</a>
                {imageCount > 0 && <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadImagesPdf} disabled={downloadingPdf}>{downloadingPdf ? 'Generating PDF...' : `Download All Images as PDF (${imageCount})`}</button>}
              </div>
            )}
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
  const [uploadForm, setUploadForm] = useState({ year: new Date().getFullYear(), exam_type: 'IAT-1', title: '', description: '' });
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  // AI CHAT
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hello! I am your AI exam advisor for this subject. I can help you:\n\n- **Predict important questions** for IAT-1, IAT-2, and SEE\n- **Identify repeated topics** across years\n- **Suggest what to focus on** for maximum marks\n\nWhat would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [aiCooldownSeconds, setAiCooldownSeconds] = useState(0);
  const msgEndRef = useRef();
  const sessionId = useRef('session_' + Date.now());
  const uploadFilesRef = useRef([]);

  const parseCooldownSeconds = (message) => {
    const match = String(message || '').match(/wait\s+(\d+)s/i);
    if (!match) return 0;
    const seconds = parseInt(match[1], 10);
    return Number.isFinite(seconds) ? seconds : 0;
  };

  const QUICK_QUESTIONS = [
    'What are the most important topics for IAT-1?',
    'What questions are likely in SEE?',
    'Which topics are repeated every year?',
    'What are the most important IAT-2 questions?',
    'Predict the top 5 questions for this subject'
  ];

  const closeUploadModal = () => {
    setUploadFiles((prev) => {
      prev.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
    setShowUpload(false);
  };

  useEffect(() => {
    axios.get('/api/subjects/' + id).then(r => setSubject(r.data)).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (aiCooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setAiCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [aiCooldownSeconds]);

  useEffect(() => {
    uploadFilesRef.current = uploadFiles;
  }, [uploadFiles]);

  useEffect(() => () => {
    uploadFilesRef.current.forEach((item) => {
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  const groupByYear = (papers) => {
    const g = {};
    for (const p of papers) {
      if (!g[p.year]) g[p.year] = [];
      g[p.year].push(p);
    }
    return Object.entries(g).sort(([a],[b]) => b - a);
  };

  const sendMsg = async (text) => {
    if (thinking || aiCooldownSeconds > 0) return;
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
      const errorText = err.response?.data?.error || 'Sorry, I encountered an error. Please try again.';
      const cooldown = parseCooldownSeconds(errorText);
      if (cooldown > 0) setAiCooldownSeconds(cooldown);
      setMessages(p => [...p, { role: 'bot', text: errorText }]);
    }
    setThinking(false);
  };

  const analyze = async () => {
    if (aiCooldownSeconds > 0) return;
    setAnalyzing(true); setTab('ai');
    try {
      const { data } = await axios.post('/api/ai/analyze', { subjectId: parseInt(id) });
      setAnalysis(data.analysis);
    } catch (err) {
      const msg = err.response?.data?.error || 'Analysis failed. Try again.';
      const cooldown = parseCooldownSeconds(msg);
      if (cooldown > 0) setAiCooldownSeconds(cooldown);
      toast.error(msg);
    }
    finally { setAnalyzing(false); }
  };

  const uploadPaper = async (e) => {
    e.preventDefault(); setUploading(true);
    try {
      if (!uploadFiles.length) {
        toast.error('Please add at least one image');
        setUploading(false);
        return;
      }
      const hasImage = uploadFiles.some((item) => String(item.file?.type || '').startsWith('image/'));
      if (!hasImage) {
        toast.error('At least one image file is required');
        setUploading(false);
        return;
      }
      const fd = new FormData();
      fd.append('subject_id', id);
      Object.entries(uploadForm).forEach(([k,v]) => { if (v) fd.append(k, v); });
      uploadFiles.forEach((item, i) => fd.append(`files_${i}`, item.file));
      const { data } = await axios.post('/api/papers', fd);
      setSubject(p => ({ ...p, papers: [data, ...(p.papers || [])] }));
      closeUploadModal();
      setUploadForm({ year: new Date().getFullYear(), exam_type: 'IAT-1', title: '', description: '' });
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
              <button className="btn btn-secondary" onClick={analyze} disabled={analyzing || aiCooldownSeconds > 0}>
                <Sparkles size={15} /> {analyzing ? 'Analyzing...' : aiCooldownSeconds > 0 ? `Retry in ${aiCooldownSeconds}s` : 'Analyze with AI'}
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
                        const normalizedFiles = (p.files || []).map((f) => ({
                          ...f,
                          url: toFileUrl(f.url || f.file_url),
                          type: f.type || f.file_type,
                          name: f.name || f.original_name
                        }));
                        const imgFiles = normalizedFiles.filter(f => f && f.type && f.type.startsWith('image/'));
                        const hasFiles = normalizedFiles.length > 0;
                        return (
                          <motion.div key={p.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                            <div className="card paper-card" style={{ cursor: hasFiles ? 'pointer' : 'default' }} onClick={() => hasFiles && setViewFiles(normalizedFiles)}>
                              <div className="card-header">
                                <div style={{ flex: 1 }}>
                                  <span className={'badge ' + (EXAM_COLORS[normalizeExamType(p.exam_type)] || 'badge-gray')} style={{ marginBottom: '0.4rem', display: 'inline-flex' }}>{normalizeExamType(p.exam_type)}</span>
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
                                  {normalizedFiles.filter(f => f && !(f.type && f.type.startsWith('image/'))).slice(0, 3 - imgFiles.slice(0,4).length).map((f, fi) => (
                                    <div key={'p'+fi} className="file-thumb" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📄</div>
                                  ))}
                                  {normalizedFiles.length > 4 && <div className="file-count-badge">+{normalizedFiles.length - 4}</div>}
                                </div>
                              )}
                              <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: hasFiles ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: hasFiles ? 600 : 400 }}>
                                {hasFiles ? <><Eye size={12} /> {normalizedFiles.length} files — click to view</> : '📭 No files attached'}
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
                    <button key={i} className="ai-quick-btn" onClick={() => sendMsg(q)} disabled={thinking || aiCooldownSeconds > 0}>{q}</button>
                  ))}
                </div>
                <div className="ai-input-area">
                  <input className="ai-input" placeholder="Ask about important topics, predicted questions..." value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMsg()} />
                  <button className="btn btn-primary btn-icon" style={{ width: 40, height: 40, borderRadius: 10, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => sendMsg()} disabled={thinking || aiCooldownSeconds > 0 || !input.trim()}>
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
                <p>Click "Analyze with AI" to get detailed predictions for IAT-1, IAT-2, and SEE.</p>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={analyze} disabled={aiCooldownSeconds > 0}>
                  <Sparkles size={15} /> {aiCooldownSeconds > 0 ? `Retry in ${aiCooldownSeconds}s` : 'Generate Analysis'}
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
                  <button className="btn btn-secondary btn-sm" onClick={analyze} disabled={aiCooldownSeconds > 0}>{aiCooldownSeconds > 0 ? `Retry in ${aiCooldownSeconds}s` : 'Regenerate'}</button>
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
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => { if (e.target === e.currentTarget) closeUploadModal(); }}>
            <motion.div className="modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
              <div className="modal-header">
                <span className="modal-title">Upload Paper for {subject.name}</span>
                <button className="modal-close" onClick={closeUploadModal}>x</button>
              </div>
              <form onSubmit={uploadPaper}>
                <div className="form-grid-3">
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
                    onDrop={e => { e.preventDefault(); setDragging(false); setUploadFiles(p => appendUploadItems(p, Array.from(e.dataTransfer.files))); }}
                    onClick={() => fileRef.current.click()}>
                    <div className="upload-icon">📎</div>
                    <p>Drag & drop or click to select</p>
                    <p className="upload-hint">JPG, PNG, PDF — up to 10 files</p>
                    <input ref={fileRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }} onChange={e => setUploadFiles(p => appendUploadItems(p, Array.from(e.target.files)))} />
                  </div>
                  {uploadFiles.length > 0 && (
                    <Reorder.Group axis="x" values={uploadFiles} onReorder={setUploadFiles} className="file-preview-grid">
                      {uploadFiles.map((item) => (
                        <Reorder.Item value={item} key={item.id} className="file-preview-item" dragElastic={0.12}>
                          {item.file.type.startsWith('image/') ? <img src={item.previewUrl} alt="" /> : <div className="file-type-icon">📄</div>}
                          <button
                            className="remove-file"
                            type="button"
                            onClick={() => setUploadFiles(prev => {
                              const found = prev.find(x => x.id === item.id);
                              if (found) URL.revokeObjectURL(found.previewUrl);
                              return prev.filter(x => x.id !== item.id);
                            })}
                          >
                            x
                          </button>
                          <div className="file-name">{item.file.name}</div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}
                  {uploadFiles.length > 1 && <p className="upload-hint">Drag files left/right to set final order</p>}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-ghost" onClick={closeUploadModal}>Cancel</button>
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
