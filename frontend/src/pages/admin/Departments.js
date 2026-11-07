import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function Departments() {
  const [depts, setDepts] = useState([]);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => client.get('/departments').then(r => setDepts(r.data)).catch(() => setError('Failed to load'));
  useEffect(() => { load(); }, []);

  const handleAdd = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await client.post('/departments', { name: newName });
      setNewName('');
      setSuccess('Department added');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add');
    }
  };

  const handleRename = async (id) => {
    setError(''); setSuccess('');
    try {
      await client.patch(`/departments/${id}`, { name: editing[id] });
      setEditing(e => { const n = { ...e }; delete n[id]; return n; });
      setSuccess('Renamed');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Rename failed');
    }
  };

  const handleToggle = async (id, active) => {
    setError('');
    try {
      await client.patch(`/departments/${id}`, { active: !active });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Toggle failed');
    }
  };

  const fieldStyle = { height: 42, padding: '0 12px', border: '2px solid var(--field)', borderRadius: 10, fontSize: 14, fontFamily: 'var(--font-body)' };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1>Departments</h1>
        <p>Manage the department list shown on sign-up.</p>
      </div>

      {error && <div className="error-message" role="alert" style={{marginBottom:12}}>{error}</div>}
      {success && <div className="success-message" style={{marginBottom:12}}>{success}</div>}

      {/* Add new */}
      <div className="card" style={{marginBottom: 24, maxWidth: 480}}>
        <h2 style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:18,textTransform:'uppercase',color:'var(--cherry)',marginBottom:14}}>Add department</h2>
        <form onSubmit={handleAdd} style={{display:'flex',gap:8}}>
          <input
            style={{...fieldStyle, flex:1}}
            type="text"
            placeholder="Department name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary btn-sm">Add</button>
        </form>
      </div>

      {/* List */}
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {depts.map(d => (
              <tr key={d.id}>
                <td>
                  {editing[d.id] !== undefined ? (
                    <div style={{display:'flex',gap:6}}>
                      <input
                        style={{...fieldStyle, height:36, fontSize:13}}
                        value={editing[d.id]}
                        onChange={e => setEditing(ed => ({ ...ed, [d.id]: e.target.value }))}
                      />
                      <button className="btn btn-sm btn-primary" onClick={() => handleRename(d.id)}>Save</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(ed => { const n = {...ed}; delete n[d.id]; return n; })}>Cancel</button>
                    </div>
                  ) : (
                    <span style={{fontWeight:500}}>{d.name}</span>
                  )}
                </td>
                <td>
                  <span className={d.active ? 'badge badge-approved' : 'badge badge-rejected'}>
                    {d.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="actions-cell">
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditing(ed => ({ ...ed, [d.id]: d.name }))}>Rename</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleToggle(d.id, d.active)}>
                      {d.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {depts.length === 0 && (
              <tr><td colSpan={3} style={{textAlign:'center',color:'var(--muted-color)',padding:32}}>No departments yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
