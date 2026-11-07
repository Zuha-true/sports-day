import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

const STATUS_CLS = { approved: 'badge-approved', pending: 'badge-pending', rejected: 'badge-rejected' };

export default function UserDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reason, setReason] = useState({});
  const [tempPwd, setTempPwd] = useState('');

  const fetchUser = () => {
    setLoading(true);
    client.get(`/admin/users/${id}`)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load user'))
      .finally(() => setLoading(false));
  };

  useEffect(fetchUser, [id]);

  const updateRegStatus = async (regId, status, rejectionReason) => {
    try {
      await client.patch(`/registrations/${regId}/status`, { status, reason: rejectionReason });
      fetchUser();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    }
  };

  const handleResetPwd = async () => {
    try {
      const r = await client.post(`/admin/users/${id}/reset-password`);
      setTempPwd(r.data.temp_password);
    } catch (err) {
      setError('Failed to reset password');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete ${data.name}? This removes all their registrations and team memberships.`)) return;
    try {
      await client.delete(`/admin/users/${id}`);
      nav('/admin/users');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  if (loading) return <div className="loading">Loading…</div>;
  if (!data) return <div className="error-message" style={{ margin: 20 }}>User not found.</div>;

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1>{data.name}</h1>
        <button className="back-button" style={{marginTop:4}} onClick={() => nav('/admin/users')}>← All users</button>
      </div>
      <div>
        {error && <div className="error-message">{error}</div>}

        <div className="game-detail-card">
          <h2>Account Info</h2>
          <div className="game-meta-block">
            <span>Roll: {data.roll_number}</span>
            <span>Email: {data.email}</span>
            <span>Phone: {data.phone}</span>
            <span>Dept: {data.department}</span>
            <span>Year: {data.year}</span>
            <span>Joined: {new Date(data.created_at).toLocaleDateString('en-IN')}</span>
            <span className={data.is_active ? 'badge-approved' : 'badge-rejected'}>
              {data.is_active ? 'Active' : 'Deactivated'}
            </span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-danger" onClick={() =>
              client.patch(`/admin/users/${id}`, { is_active: !data.is_active }).then(fetchUser)
            }>
              {data.is_active ? 'Deactivate Account' : 'Reactivate Account'}
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleResetPwd}>Reset Password</button>
            <button className="btn btn-sm btn-danger" onClick={handleDelete}>Delete User</button>
            {tempPwd && (
              <span className="success-message" style={{ padding: '4px 12px' }}>
                Temp password: <strong>{tempPwd}</strong> — give this to the student
              </span>
            )}
          </div>
        </div>

        <h2 style={{ marginTop: 24 }}>Registration History</h2>
        {data.registrations.length === 0
          ? <p className="muted">No registrations.</p>
          : (
            <div className="students-table-wrapper">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Category</th>
                    <th>Fee</th>
                    <th>UTR</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Approved by</th>
                    <th>Screenshot</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.registrations.map(r => (
                    <tr key={r.id}>
                      <td>{r.game_name}</td>
                      <td>{r.category}</td>
                      <td>₹{r.fee_paid}</td>
                      <td>{r.utr || '—'}</td>
                      <td>{r.payment_method}</td>
                      <td><span className={`badge ${STATUS_CLS[r.status]}`}>{r.status}</span></td>
                      <td>{r.rejected_reason || '—'}</td>
                      <td>{r.approved_by || '—'}</td>
                      <td>
                        {r.screenshot_url
                          ? <a href={r.screenshot_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">View</a>
                          : '—'
                        }
                      </td>
                      <td>
                        {r.status === 'pending' && (
                          <div className="actions-cell">
                            <button className="btn btn-sm btn-primary" onClick={() => updateRegStatus(r.id, 'approved')}>Approve</button>
                            <input
                              type="text" placeholder="Reason…"
                              value={reason[r.id] || ''}
                              onChange={e => setReason(p => ({ ...p, [r.id]: e.target.value }))}
                              style={{ width: 120, fontSize: 12 }}
                            />
                            <button className="btn btn-sm btn-danger" onClick={() => updateRegStatus(r.id, 'rejected', reason[r.id])}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        {data.teams.length > 0 && (
          <>
            <h2 style={{ marginTop: 24 }}>Team Memberships</h2>
            <ul>
              {data.teams.map((t, i) => (
                <li key={i}>{t.game_name} — {t.team_name}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
