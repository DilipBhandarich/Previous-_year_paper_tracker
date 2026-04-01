import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function Subjects({ navigate }) {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [semester, setSemester] = useState('')
  const [branch, setBranch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', semester: '', branch: '' })
  const [message, setMessage] = useState(null)

  const fetchSubjects = () => {
    const params = {}
    if (semester) params.semester = semester
    if (branch) params.branch = branch
    axios.get('/api/subjects', { params }).then(res => setSubjects(res.data))
      .catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { fetchSubjects() }, [semester, branch])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/subjects', { ...form, semester: parseInt(form.semester) || null })
      setMessage({ type: 'success', text: 'Subject added successfully!' })
      setShowModal(false)
      setForm({ name: '', code: '', semester: '', branch: '' })
      fetchSubjects()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to add subject' })
    }
  }

  const branches = ['Common', 'CSE', 'ECE', 'ME', 'CE', 'EEE']
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8]

  return (
    <div>
      <div className="page-header">
        <span className="section-title">Subjects</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Subject</button>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div className="filters">
        <select className="filter-select" value={semester} onChange={e => setSemester(e.target.value)}>
          <option value="">All Semesters</option>
          {semesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
        </select>
        <select className="filter-select" value={branch} onChange={e => setBranch(e.target.value)}>
          <option value="">All Branches</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div><p>Loading subjects...</p></div>
      ) : subjects.length === 0 ? (
        <div className="empty-state">
          <h3>No subjects found</h3>
          <p>Try changing the filters or add a new subject.</p>
        </div>
      ) : (
        <div className="subjects-grid">
          {subjects.map(subject => (
            <div key={subject.id} className="card">
              <div className="card-body">
                <div className="card-title">{subject.name}</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {subject.code && <span className="badge badge-blue">{subject.code}</span>}
                  {subject.semester && <span className="badge badge-green">Sem {subject.semester}</span>}
                  {subject.branch && <span className="badge badge-gray">{subject.branch}</span>}
                </div>
                <button onClick={() => navigate('subject', { id: subject.id })} className="btn btn-outline btn-sm">View Papers</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add New Subject</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Subject Name *</label>
                <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="e.g. Engineering Mathematics" />
              </div>
              <div className="form-group">
                <label className="form-label">Subject Code</label>
                <input className="form-control" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="e.g. MATH101" />
              </div>
              <div className="form-group">
                <label className="form-label">Semester</label>
                <select className="form-control" value={form.semester} onChange={e => setForm({...form, semester: e.target.value})}>
                  <option value="">Select Semester</option>
                  {semesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Branch</label>
                <select className="form-control" value={form.branch} onChange={e => setForm({...form, branch: e.target.value})}>
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Subject</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
