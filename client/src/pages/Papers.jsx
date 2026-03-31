import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

export default function Papers() {
  const [papers, setPapers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [subjectFilter, setSubjectFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [examTypeFilter, setExamTypeFilter] = useState('')

  const fetchPapers = () => {
    const params = {}
    if (subjectFilter) params.subject_id = subjectFilter
    if (yearFilter) params.year = yearFilter
    if (examTypeFilter) params.exam_type = examTypeFilter
    setLoading(true)
    axios.get('/api/papers', { params }).then(res => {
      setPapers(res.data)
    }).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    axios.get('/api/subjects').then(res => setSubjects(res.data)).catch(console.error)
    fetchPapers()
  }, [])

  useEffect(() => {
    fetchPapers()
  }, [subjectFilter, yearFilter, examTypeFilter])

  const handleDelete = async (paperId) => {
    if (!window.confirm('Delete this paper?')) return
    try {
      await axios.delete(`/api/papers/${paperId}`)
      setPapers(papers.filter(p => p.id !== paperId))
    } catch (err) {
      console.error(err)
    }
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i)

  return (
    <div>
      <div className="page-header">
        <span className="section-title">All Question Papers</span>
      </div>

      <div className="filters">
        <select className="filter-select" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select className="filter-select" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select className="filter-select" value={examTypeFilter} onChange={e => setExamTypeFilter(e.target.value)}>
          <option value="">All Exam Types</option>
          <option value="Annual">Annual</option>
          <option value="Mid-Term">Mid-Term</option>
          <option value="Supplementary">Supplementary</option>
          <option value="Internal">Internal</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading papers...</p>
        </div>
      ) : papers.length === 0 ? (
        <div className="empty-state">
          <h3>No papers found</h3>
          <p>Try changing the filters or add papers from the Subjects page.</p>
          <Link to="/subjects" className="btn btn-primary" style={{ marginTop: '1rem' }}>Browse Subjects</Link>
        </div>
      ) : (
        <div className="papers-list">
          {papers.map(paper => (
            <div key={paper.id} className="paper-item">
              <div className="paper-info">
                <h3>{paper.subject_name}</h3>
                <div className="paper-meta">
                  <span className="badge badge-blue">{paper.year}</span>
                  {' '}
                  <span className="badge badge-gray">{paper.exam_type}</span>
                  {' '}
                  {paper.subject_code && <span className="badge badge-green">{paper.subject_code}</span>}
                  {' '}
                  Semester {paper.semester} &bull; {paper.branch}
                </div>
                {paper.description && <div className="paper-meta" style={{ marginTop: '0.25rem' }}>{paper.description}</div>}
                {paper.file_url && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <a href={paper.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                      📄 Download
                    </a>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Link to={`/subjects/${paper.subject_id}`} className="btn btn-outline btn-sm">Subject</Link>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(paper.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
