import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

const STATUS_CLS = { approved: 'badge-approved', pending: 'badge-pending', rejected: 'badge-rejected' };
const LIMIT = 20;

export default function AllUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', department: '', year: '', status: '', game_id: '', category: '' });
  const [departments, setDepartments] = useState([]);
  const debounceRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    client.get('/departments').then(r => setDepartments(r.data)).catch(() => {});
  }, []);

  const fetchUsers = useCallback((f, p) => {
    setLoading(true);
    const params = new URLSearchParams({ ...f, page: p, limit: LIMIT });
    for (const [k, v] of [...params]) { if (!v) params.delete(k); }
    client.get(`/admin/users?${params}`)
      .then(r => { setUsers(r.data.users); setTotal(r.data.total); })
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchUsers(filters, page); }, [page]); // eslint-disable-line

  const setFilter = field => e => {
    const nf = { ...filters, [field]: e.target.value };
    setFilters(nf);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); fetchUsers(nf, 1); }, 400);
  };

  const exportCsv = () => {
    const params = new URLSearchParams({ ...filters });
    for (const [k, v] of [...params]) { if (!v) params.delete(k); }
    window.location.href = `/api/admin/users/export?${params}`;
  };

  const totalPages = Math.ceil(total / LIMIT);
  const fieldStyle = { height: 42, padding: '0 12px', border: '2px solid var(--field)', borderRadius: 10, fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--cherry-dark)', background: 'var(--white)' };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1>All users</h1>
        <p>{total} registered</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          style={{ ...fieldStyle, flex: '2 1 200px' }}
          placeholder="Search name, roll, email, phone…"
          value={filters.q}
          onChange={setFilter('q')}
        />
        <select style={fieldStyle} value={filters.department} onChange={setFilter('department')}>
          <option value="">All departments</option>
          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select style={fieldStyle} value={filters.year} onChange={setFilter('year')}>
          <option value="">All years</option>
          {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
        </select>
        <select style={fieldStyle} value={filters.category} onChange={setFilter('category')}>
          <option value="">All categories</option>
          {['solo','duo','team'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={fieldStyle} value={filters.status} onChange={setFilter('status')}>
          <option value="">All statuses</option>
          {['pending','approved','rejected'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={exportCsv}>Export CSV</button>
      </div>

      {error && <div className="error-message" role="alert" style={{marginBottom:12}}>{error}</div>}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : users.length === 0 ? (
        <p className="muted">No users found for these filters.</p>
      ) : (
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roll no.</th>
                  <th>Dept / Year</th>
                  <th>Contact</th>
                  <th>Games</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="clickable-row" onClick={() => nav(`/admin/users/${u.id}`)}>
                    <td style={{fontWeight:600}}>{u.name}</td>
                    <td style={{fontFamily:'monospace',fontSize:13}}>{u.roll_number}</td>
                    <td>{u.department}<br /><span style={{fontSize:12,color:'var(--muted-color)'}}>Year {u.year}</span></td>
                    <td>
                      <div>{u.email || <em style={{color:'var(--muted-color)'}}>No email</em>}</div>
                      <div style={{fontSize:12,color:'var(--muted-color)'}}>{u.phone}</div>
                    </td>
                    <td>
                      {(u.games || []).map((g, i) => (
                        <span key={i} className={`badge ${STATUS_CLS[g.status]}`} style={{ marginRight: 4 }}>
                          {g.game}
                        </span>
                      ))}
                    </td>
                    <td style={{fontSize:12,color:'var(--muted-color)'}}>{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn btn-sm btn-ghost">← Prev</button>
          <span style={{ padding: '0 12px', fontSize: 14 }}>Page {page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-sm btn-ghost">Next →</button>
        </div>
      )}
    </AdminLayout>
  );
}
