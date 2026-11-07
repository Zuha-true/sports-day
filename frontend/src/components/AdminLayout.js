import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import client from '../api/client';

const NAV = [
  { label: 'Approvals', path: '/admin/approvals', icon: '✓', badgeKey: 'pending' },
  { label: 'All users',       path: '/admin/users',      icon: '◎' },
  { label: 'Manage games',    path: '/admin/games',      icon: '▸' },
  { label: 'Payment settings',path: '/admin/payment-settings', icon: '⬡' },
  { label: 'Departments',      path: '/admin/departments',       icon: '≡' },
  { label: 'Register student', path: '/admin/register-student',  icon: '+' },
];

export default function AdminLayout({ children }) {
  const loc = useLocation();
  const nav = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    client.get('/registrations/pending')
      .then(r => setPendingCount(r.data.length))
      .catch(() => {});
  }, [loc.pathname]);

  const badges = { pending: pendingCount };

  return (
    <div className="admin-layout">
      {/* Mobile top bar */}
      <div className="admin-topbar-mobile">
        <span className="admin-topbar-logo">Girls' Sports Day · Admin</span>
        <button
          className="btn btn-matcha btn-sm"
          onClick={() => setMobileOpen(o => !o)}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? '✕ Close' : '☰ Menu'}
        </button>
      </div>
      {mobileOpen && (
        <div className="admin-mobile-nav">
          {NAV.map(item => (
            <button
              key={item.path}
              className={`admin-nav-item${loc.pathname === item.path ? ' active' : ''}`}
              onClick={() => { nav(item.path); setMobileOpen(false); }}
            >
              {item.label}
              {item.badgeKey && badges[item.badgeKey] > 0 && (
                <span className="admin-nav-badge">{badges[item.badgeKey]}</span>
              )}
            </button>
          ))}
          <button className="admin-nav-item" onClick={logout}>Sign out</button>
        </div>
      )}

      <div className="admin-layout-body">
        {/* Desktop sidebar */}
        <aside className="admin-sidebar" aria-label="Admin navigation">
          <div className="admin-sidebar-logo">
            <img src="/aitm-logo.png" alt="AITM" style={{width:36,height:36,objectFit:'contain',flexShrink:0}} />
            <strong>Girls'<br />Sports Day</strong>
          </div>
          {NAV.map(item => (
            <button
              key={item.path}
              className={`admin-nav-item${loc.pathname === item.path ? ' active' : ''}`}
              onClick={() => nav(item.path)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.badgeKey && badges[item.badgeKey] > 0 && (
                <span className="admin-nav-badge">{badges[item.badgeKey]}</span>
              )}
            </button>
          ))}
          <div style={{marginTop:'auto', paddingTop: 16}}>
            <button className="admin-nav-item" onClick={logout}>Sign out</button>
          </div>
        </aside>

        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
