import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function SubjectDetail({ navigate, id }) {
  const [subject, setSubject] = useState(null)
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ year: '', exam_type: 'Annual', description: '', file_url: '' })
  const [message, setMessage] = useState(null)

  const fetchData = async () => {
    try {
      const [subjectRes, papersRes] = await Promise.all([
        axios.get(`/api/subjects/${id}`),
        axios.get(`/api/papers?subject_id=${id}`)
      ])
      setSubject(subjectRes.data)
      setPapers(papersRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  const handleAddPaper = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/papers', { subject_id: parseInt(id), ...form, year: parseInt(form.year) })
      setMessage({ type: 'success', text: 'Paper added successfully!' })
      setShowModal(false)
      setForm({ year: '', exam_type: 'Annual', description: '', file_url: '' })
      fetchData()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to add paper' })
    }
  }

  const handleDelete = async (paperId) => {
    if (!window.confirm('Delete this paper?')) return
    try {
      await axios.delete(`/api/papers/${paperId}`)
      setPapers(papers.filter(p => p.id !== paperId))
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="loading"><div className="spinner"></div><p>Loading...</p></div>
  if (!subject) return <div className="empty-state"><h3>Subject not found</h3><button onClick={() => navigate('subjects')} className="btn btn-outline">Back to Subjects</button></div>

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('subjects')} style={{ color: '#2b6cb0', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
          ← Back to Subjects
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body" style={{ padding: '1.5rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1a365d', marginBottom: '0.75rem' }}>{subject.name}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {subject.code && <span className="badge badge-blue">{subject.code}</span>}
            {subject.semester && <span className="badge badge-green">Semester {subject.semester}</span>}
            {subject.branch && <span className="badge badge-gray">{subject.branch}</span>}
          </div>
        </div>
      </div>

      <div className="page-header">
        <span className="section-title">Question Papers ({papers.length})</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Paper</button>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {papers.length === 0 ? (
        <div className="empty-state">
          <h3>No papers yet</h3>
          <p>Add question papers for this subject.</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowModal(true)}>Add First Paper</button>
        </div>
      ) : (
        <div className="papers-list">
          {papers.map(paper => (
            <div key={paper.id} className="paper-item">
              <div className="paper-info">
                <h3>{paper.year} — {paper.exam_type} Exam</h3>
                {paper.description && <div className="paper-meta">{paper.description}</div>}
                {paper.file_url && (
                  <div style={{ marginTop: '0.3rem' }}>
                    <a href={paper.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">📄 Download Paper</a>
                  </div>
                )}
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(paper.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add Question Paper</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddPaper}>
              <div className="form-group">
                <label className="form-label">Year *</label>
                <input className="form-control" type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} required placeholder="e.g. 2023" min="2000" max="2030" />
              </div>
              <div className="form-group">
                <label className="form-label">Exam Type</label>
                <select className="form-control" value={form.exam_type} onChange={e => setForm({...form, exam_type: e.target.value})}>
                  <option value="Annual">Annual</option>
                  <option value="Mid-Term">Mid-Term</option>
                  <option value="Supplementary">Supplementary</option>
                  <option value="Internal">Internal</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-control" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Optional description" />
              </div>
              <div className="form-group">
                <label className="form-label">File URL (optional)</label>
                <input className="form-control" value={form.file_url} onChange={e => setForm({...form, file_url: e.target.value})} placeholder="https://..." />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Paper</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
