import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { BookOpen, FileText, Calendar, Users, StickyNote, ArrowRight, Brain, TrendingUp } from 'lucide-react';

const FV = ({ children, delay = 0, className = '' }) => (
  <motion.div className={className} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay }}>
    {children}
  </motion.div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentPapers, setRecentPapers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/stats'),
      axios.get('/api/papers?limit=6'),
      axios.get('/api/subjects?sort=semester')
    ]).then(([s, p, sub]) => {
      setStats(s.data);
      setRecentPapers(p.data.slice(0, 6));
      setSubjects(sub.data.slice(0, 6));
    }).finally(() => setLoading(false));
  }, []);

  const statCards = stats ? [
    { icon: '📚', num: stats.totalSubjects, label: 'Subjects', color: 'indigo', link: '/subjects' },
    { icon: '📄', num: stats.totalPapers, label: 'Papers', color: 'violet', link: '/papers' },
    { icon: '📅', num: stats.totalYears, label: 'Years Covered', color: 'cyan', link: '/papers' },
    { icon: '👥', num: stats.totalUsers, label: 'Students', color: 'green', link: null },
    { icon: '📝', num: stats.totalNotes, label: 'Notes Shared', color: 'yellow', link: '/notes' },
  ] : [];

  const examColors = { 'IUT-1': 'badge-indigo', 'IUT-2': 'badge-violet', 'ESE': 'badge-cyan', 'Annual': 'badge-green' };

  return (
    <div className="page">
      <div className="container section">
        {/* WELCOME */}
        <FV>
          <div className="dashboard-welcome">
            <div className="welcome-title">Hello, {user?.name?.split(' ')[0]} 👋</div>
            <div className="welcome-subtitle">
              Ready to ace your exams? Browse papers, get AI insights, or check your notes below.
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <Link to="/subjects" className="btn btn-primary btn-sm"><BookOpen size={14} /> Browse Subjects</Link>
              <Link to="/papers" className="btn btn-secondary btn-sm"><FileText size={14} /> All Papers</Link>
              <Link to="/notes" className="btn btn-secondary btn-sm"><StickyNote size={14} /> Notes</Link>
            </div>
          </div>
        </FV>

        {/* STATS */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}><div className="spinner" /></div>
        ) : (
          <div className="stats-row">
            {statCards.map((s, i) => (
              <FV key={i} delay={i * 0.07}>
                {s.link ? (
                  <Link to={s.link} style={{ textDecoration: 'none' }}>
                    <div className="stat-card">
                      <div className="stat-icon">{s.icon}</div>
                      <div className={`stat-number ${s.color}`}>{s.num}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  </Link>
                ) : (
                  <div className="stat-card">
                    <div className="stat-icon">{s.icon}</div>
                    <div className={`stat-number ${s.color}`}>{s.num}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                )}
              </FV>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* RECENT PAPERS */}
          <FV delay={0.3}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 className="section-title"><FileText size={18} /> Recent Papers</h2>
                <Link to="/papers" className="btn btn-ghost btn-sm">View All <ArrowRight size={13} /></Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {recentPapers.length === 0 && !loading && (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <div className="empty-icon">📄</div>
                    <h3>No papers yet</h3>
                    <Link to="/papers" className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }}>Add First Paper</Link>
                  </div>
                )}
                {recentPapers.map((p, i) => (
                  <motion.div key={p.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.05 }}>
                    <Link to={`/subjects/${p.subject_id}`} style={{ textDecoration: 'none' }}>
                      <div className="card" style={{ cursor: 'pointer', padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.subject_name}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              {p.year} • Sem {p.semester} • {p.branch}
                            </div>
                          </div>
                          <span className={`badge ${examColors[p.exam_type] || 'badge-gray'}`}>{p.exam_type}</span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </FV>

          {/* SUBJECTS */}
          <FV delay={0.35}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 className="section-title"><BookOpen size={18} /> Quick Access</h2>
                <Link to="/subjects" className="btn btn-ghost btn-sm">All Subjects <ArrowRight size={13} /></Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {subjects.map((s, i) => (
                  <motion.div key={s.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.05 }}>
                    <Link to={`/subjects/${s.id}`} style={{ textDecoration: 'none' }}>
                      <div className="card" style={{ cursor: 'pointer', padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                            📖
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sem {s.semester} • {s.branch} • {s.paper_count || 0} papers</div>
                          </div>
                          <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </FV>
        </div>

        {/* AI PROMO */}
        <FV delay={0.5}>
          <div style={{ marginTop: '1.5rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius)', padding: '1.75rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 4px 20px rgba(99,102,241,0.4)', flexShrink: 0 }}>
              🤖
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.3rem' }}>Try the AI Question Predictor</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Open any subject and click "Analyze with AI" to get IUT-1, IUT-2 & ESE predictions.</div>
            </div>
            <Link to="/subjects" className="btn btn-primary"><Brain size={15} /> Explore Now <ArrowRight size={15} /></Link>
          </div>
        </FV>
      </div>
    </div>
  );
}
