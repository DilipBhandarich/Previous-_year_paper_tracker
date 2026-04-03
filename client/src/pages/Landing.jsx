import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, BookOpen, Brain, FileText, StickyNote, Upload, ChevronDown, Sparkles, ArrowRight, Star } from 'lucide-react';

const features = [
  { icon: '📚', title: 'Organized Paper Library', desc: 'Browse previous year papers sorted by semester, branch, subject and exam type — all in one place.' },
  { icon: '🤖', title: 'AI Question Predictor', desc: 'Our AI analyzes years of question papers to predict the most important and frequently repeated questions.' },
  { icon: '📎', title: 'Multi-File Upload', desc: 'Upload 5-10 images or PDFs per paper. View them in a beautiful gallery with a built-in viewer.' },
  { icon: '🗂️', title: 'Smart Sorting & Filter', desc: 'Filter by semester, branch, year, and exam type (IUT-1, IUT-2, ESE) instantly.' },
  { icon: '📝', title: 'Anonymous Notes', desc: 'Share notes and tips with your batch anonymously. No login required for reading.' },
  { icon: '⚡', title: 'Exam-Type Insights', desc: 'AI segregates predictions by IUT-1, IUT-2 and ESE — exactly what you need for each exam.' },
];

const FV = (props) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.5, delay: props.delay || 0 }}
    {...props}
  />
);

export default function Landing() {
  return (
    <div className="landing">
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
        </div>
        <div className="hero-content">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="hero-badge">
              <Sparkles size={13} /> AI-Powered Question Paper Analysis
            </div>
          </motion.div>

          <motion.h1 className="hero-title" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            Ace Your Exams with<br /><span className="gradient-text">NCET Paper Tracker</span>
          </motion.h1>

          <motion.p className="hero-desc" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            Access all previous year question papers, get AI-powered predictions for important questions, and collaborate with your batch — all in one beautiful platform.
          </motion.p>

          <motion.div className="hero-cta" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
            <Link to="/register" className="btn btn-primary btn-lg">
              Get Started Free <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn btn-ghost btn-lg">
              Sign In
            </Link>
          </motion.div>

          <motion.div className="hero-scroll" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
            <ChevronDown size={20} />
            <span>Scroll to explore</span>
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section className="stats-strip">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <FV><h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>Trusted by NCET Students</h2></FV>
            <FV delay={0.1}><p style={{ color: 'var(--text-secondary)' }}>Everything you need to prepare smarter, not harder</p></FV>
          </div>
          <div className="stats-grid">
            {[
              { num: '15+', label: 'Subjects Covered' },
              { num: '100+', label: 'Question Papers' },
              { num: '4+', label: 'Years of Data' },
              { num: '∞', label: 'AI Insights' },
            ].map((s, i) => (
              <FV key={i} delay={i * 0.1} className="stat-item">
                <div className="stat-number">{s.num}</div>
                <div className="stat-label">{s.label}</div>
              </FV>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <FV><h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.75rem' }}>Everything You Need to Score Big</h2></FV>
            <FV delay={0.1}><p style={{ color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto' }}>Comprehensive tools built specifically for engineering students preparing for university exams.</p></FV>
          </div>
          <div className="features-grid">
            {features.map((f, i) => (
              <FV key={i} delay={i * 0.08}>
                <div className="feature-card">
                  <div className="feature-icon">{f.icon}</div>
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              </FV>
            ))}
          </div>
        </div>
      </section>

      {/* AI SECTION */}
      <section style={{ padding: '6rem 1.5rem', background: 'var(--bg-primary)' }}>
        <div className="container" style={{ maxWidth: 1000 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
            <FV>
              <div>
                <div className="hero-badge" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>
                  <Brain size={13} /> Powered by AI
                </div>
                <h2 style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem' }}>
                  Your Personal <span className="gradient-text">Exam AI</span> Advisor
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                  Ask questions about any subject. Get predictions for IUT-1, IUT-2, and ESE exams. The AI analyzes years of question patterns and your syllabus to tell you exactly what to focus on.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {['IUT-1 & IUT-2 specific question predictions', 'Most repeated topics across years', 'High-weightage concepts to prioritize', 'Expected questions for current year'].map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      <Star size={14} style={{ color: '#6366f1', flexShrink: 0 }} /> {p}
                    </div>
                  ))}
                </div>
              </div>
            </FV>
            <FV delay={0.2}>
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, padding: '1.5rem', fontFamily: 'monospace' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  {['#ff5f57','#febc2e','#28c840'].map((c,i) => <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
                </div>
                {[
                  { role: 'user', text: 'What are the most important topics for DBMS IUT-1?' },
                  { role: 'ai', text: '🎯 Based on pattern analysis:\n\n**IUT-1 Top Topics:**\n• ER Diagrams & Normalization (appears in 90% of papers)\n• SQL Queries - Joins, Subqueries\n• ACID Properties & Transactions\n\n**Predicted Question:** "Explain 3NF with example and normalize the given relation."' },
                ].map((m, i) => (
                  <div key={i} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', color: m.role === 'ai' ? '#6366f1' : '#94a3b8', marginBottom: '0.2rem' }}>
                      {m.role === 'ai' ? '🤖 AI Advisor' : '👤 You'}
                    </div>
                    <div style={{ background: m.role === 'ai' ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '0.6rem 0.85rem', fontSize: '0.78rem', color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap', border: `1px solid ${m.role === 'ai' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
            </FV>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '6rem 1.5rem', textAlign: 'center', background: 'var(--bg-secondary)' }}>
        <FV>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem' }}>
              Ready to <span className="gradient-text">Study Smarter?</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.05rem' }}>
              Join your batchmates. Access all papers, get AI insights, and start scoring higher today.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/register" className="btn btn-primary btn-lg">
                Create Free Account <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="btn btn-ghost btn-lg">Already have an account?</Link>
            </div>
          </div>
        </FV>
      </section>

      {/* FOOTER */}
      <footer style={{ background: 'var(--bg-primary)', borderTop: '1px solid var(--border)', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <GraduationCap size={16} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
        NCET Previous Year Paper Tracker © {new Date().getFullYear()} — Built for NCET Students
      </footer>
    </div>
  );
}
