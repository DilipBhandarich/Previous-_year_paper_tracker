import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

export default function Home() {
  const [stats, setStats] = useState(null)
  const [recentPapers, setRecentPapers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      axios.get('/api/stats'),
      axios.get('/api/papers')
    ]).then(([statsRes, papersRes]) => {
      setStats(statsRes.data)
      setRecentPapers(papersRes.data.slice(0, 6))
    }).catch(err => {
      console.error(err)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="hero">
        <h1>NCET Previous Year Papers</h1>
        <p>Access and download previous year question papers for all subjects at NCET. Browse by subject, semester, or year.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/papers" className="btn btn-primary">Browse Papers</Link>
          <Link to="/subjects" className="btn btn-outline" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}>View Subjects</Link>
        </div>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="number">{stats.totalSubjects}</div>
            <div className="label">Total Subjects</div>
          </div>
          <div className="stat-card">
            <div className="number">{stats.totalPapers}</div>
            <div className="label">Question Papers</div>
          </div>
          <div className="stat-card">
            <div className="number">{stats.totalYears}</div>
            <div className="label">Years Covered</div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <div className="page-header">
          <span className="section-title">Recent Papers</span>
          <Link to="/papers" className="btn btn-outline btn-sm">View All</Link>
        </div>

        {recentPapers.length === 0 ? (
          <div className="empty-state">
            <h3>No papers yet</h3>
            <p>Add question papers to get started.</p>
          </div>
        ) : (
          <div className="papers-list">
            {recentPapers.map(paper => (
              <div key={paper.id} className="paper-item">
                <div className="paper-info">
                  <h3>{paper.subject_name}</h3>
                  <div className="paper-meta">
                    <span className="badge badge-blue">{paper.year}</span>
                    {' '}
                    <span className="badge badge-gray">{paper.exam_type}</span>
                    {' '}
                    Semester {paper.semester} &bull; {paper.branch}
                  </div>
                  {paper.description && <div className="paper-meta" style={{ marginTop: '0.25rem' }}>{paper.description}</div>}
                </div>
                <Link to={`/subjects/${paper.subject_id}`} className="btn btn-outline btn-sm">
                  View Subject
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
