import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LayoutDashboard, FileText, StickyNote, LogOut, GraduationCap, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };
  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className="navbar">
      <NavLink to="/dashboard" className="navbar-brand">
        <GraduationCap size={22} />
        NCET Papers
      </NavLink>

      <button className="navbar-mobile-toggle" onClick={() => setMobileOpen((p) => !p)} aria-label="Toggle menu" aria-expanded={mobileOpen}>
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <ul className="navbar-nav">
        <li>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
            <LayoutDashboard size={15} /> Dashboard
          </NavLink>
        </li>
        <li>
          <NavLink to="/subjects" className={({ isActive }) => isActive ? 'active' : ''}>
            <BookOpen size={15} /> Subjects
          </NavLink>
        </li>
        <li>
          <NavLink to="/papers" className={({ isActive }) => isActive ? 'active' : ''}>
            <FileText size={15} /> Papers
          </NavLink>
        </li>
        <li>
          <NavLink to="/notes" className={({ isActive }) => isActive ? 'active' : ''}>
            <StickyNote size={15} /> Notes
          </NavLink>
        </li>
      </ul>

      <div className="navbar-user">
        <div className="user-avatar" title={user?.name}>
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Logout"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600, padding: '0.4rem 0.75rem', borderRadius: '8px', transition: 'background 0.2s' }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
          onMouseOut={e => e.currentTarget.style.background = 'none'}>
          <LogOut size={15} /> Logout
        </button>
      </div>

      {mobileOpen && (
        <div className="navbar-mobile-menu" onClick={closeMobile}>
          <NavLink to="/dashboard" className={({ isActive }) => 'mobile-link' + (isActive ? ' active' : '')}>
            <LayoutDashboard size={15} /> Dashboard
          </NavLink>
          <NavLink to="/subjects" className={({ isActive }) => 'mobile-link' + (isActive ? ' active' : '')}>
            <BookOpen size={15} /> Subjects
          </NavLink>
          <NavLink to="/papers" className={({ isActive }) => 'mobile-link' + (isActive ? ' active' : '')}>
            <FileText size={15} /> Papers
          </NavLink>
          <NavLink to="/notes" className={({ isActive }) => 'mobile-link' + (isActive ? ' active' : '')}>
            <StickyNote size={15} /> Notes
          </NavLink>
          <button className="mobile-link mobile-logout" onClick={handleLogout}>
            <LogOut size={15} /> Logout
          </button>
        </div>
      )}
    </nav>
  );
}
