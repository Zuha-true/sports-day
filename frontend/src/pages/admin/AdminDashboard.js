import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    Promise.all([
      client.get('/games'),
      client.get('/registrations/pending'),
      client.get('/admin/users?limit=1'),
    ]).then(([gr, pr, ur]) => setStats({
      games: gr.data.length,
      pending: pr.data.length,
      total_users: ur.data.total,
    })).catch(console.error);
  }, []);

  const tiles = [
    { label: 'Approvals queue',  path: '/admin/approvals',         desc: stats ? `${stats.pending} pending` : '…' },
    { label: 'All users',        path: '/admin/users',             desc: stats ? `${stats.total_users} registered` : '…' },
    { label: 'Manage games',     path: '/admin/games',             desc: stats ? `${stats.games} games` : '…' },
    { label: 'Payment settings', path: '/admin/payment-settings',  desc: 'UPI ID, QR code' },
    { label: 'Departments',      path: '/admin/departments',       desc: 'Add or rename departments' },
  ];

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <p>Girls' Sports Day organiser area</p>
      </div>
      <div className="sports-grid">
        {tiles.map(t => (
          <div key={t.path} className="sport-card clickable" onClick={() => nav(t.path)}>
            <h3>{t.label}</h3>
            <p>{t.desc}</p>
            <div style={{marginTop: 16}}>
              <button className="btn btn-primary btn-sm">Open →</button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
