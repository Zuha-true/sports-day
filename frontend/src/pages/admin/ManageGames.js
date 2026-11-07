import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

const CATS = ['solo', 'duo', 'team'];
const EMPTY = {
  name: '', category: 'solo', description: '', rules: '', entry_fee: 50,
  schedule_at: '', venue: '', reg_open_at: '', reg_close_at: '', max_participants: '',
  min_team_size: '', max_team_size: '', substitutes_allowed: 0, is_active: true, image_url: '',
};

export default function ManageGames() {
  const [games, setGames] = useState([]);
  const [activeTab, setActiveTab] = useState('solo');
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  const fetchGames = () => {
    setLoading(true);
    client.get('/games')
      .then(r => setGames(r.data))
      .catch(() => setError('Failed to load games'))
      .finally(() => setLoading(false));
  };

  useEffect(fetchGames, []);

  const set = field => e => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [field]: val }));
  };

  const handleEdit = game => {
    setForm({ ...EMPTY, ...game });
    setEditId(game.id);
    setActiveTab(game.category);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const payload = { ...form };
      ['schedule_at','reg_open_at','reg_close_at','max_participants','min_team_size','max_team_size','image_url']
        .forEach(k => { if (payload[k] === '') payload[k] = null; });

      if (editId) {
        await client.put(`/games/${editId}`, payload);
        setSuccess('Game updated');
      } else {
        await client.post('/games', { ...payload, category: activeTab });
        setSuccess('Game created');
      }
      setForm({ ...EMPTY, category: activeTab });
      setEditId(null);
      fetchGames();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    }
  };

  const handleToggle = async id => {
    await client.patch(`/games/${id}/toggle`).catch(console.error);
    fetchGames();
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this game?')) return;
    try {
      await client.delete(`/games/${id}`);
      fetchGames();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const tabGames = games.filter(g => g.category === activeTab);

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1>Manage games</h1>
      </div>

      <div className="seg-wrap" style={{marginBottom:20}}>
        <div className="seg-control" role="group" aria-label="Game category">
          {CATS.map(c => (
            <button
              key={c}
              aria-pressed={activeTab === c}
              onClick={() => { setActiveTab(c); setForm({ ...EMPTY, category: c }); setEditId(null); }}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}s
            </button>
          ))}
        </div>
      </div>

      <div>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {/* Game list */}
        {loading
          ? <div className="loading">Loading…</div>
          : tabGames.length === 0
            ? <p className="muted">No {activeTab} games yet.</p>
            : (
              <div className="students-table-wrapper">
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Fee</th>
                      <th>Regs</th>
                      <th>Approved</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabGames.map(g => (
                      <tr key={g.id}>
                        <td>{g.name}</td>
                        <td>₹{g.entry_fee}</td>
                        <td>{g.registration_count}</td>
                        <td>{g.approved_count}</td>
                        <td>
                          <span className={g.is_active ? 'badge-approved' : 'badge-rejected'}>
                            {g.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(g)}>Edit</button>
                          <button className="btn btn-sm btn-ghost" onClick={() => handleToggle(g.id)}>
                            {g.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(g.id)}>Delete</button>
                          <button className="btn btn-sm btn-primary" onClick={() => nav(`/admin/sport/${g.id}`)}>Bracket</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }

        {/* Add / Edit form */}
        <div className="register-form-container" style={{ marginTop: 32 }}>
          <h2>{editId ? 'Edit Game' : `Add ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Game`}</h2>
          <form onSubmit={handleSubmit} className="register-form">
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input type="text" value={form.name} onChange={set('name')} required />
              </div>
              <div className="form-group">
                <label>Entry Fee (₹) *</label>
                <input type="number" min="0" step="0.01" value={form.entry_fee} onChange={set('entry_fee')} required />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={set('description')} rows={2} />
            </div>
            <div className="form-group">
              <label>Rules</label>
              <textarea value={form.rules} onChange={set('rules')} rows={3} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Venue</label>
                <input type="text" value={form.venue} onChange={set('venue')} />
              </div>
              <div className="form-group">
                <label>Schedule</label>
                <input type="datetime-local" value={form.schedule_at} onChange={set('schedule_at')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Registration Opens</label>
                <input type="datetime-local" value={form.reg_open_at} onChange={set('reg_open_at')} />
              </div>
              <div className="form-group">
                <label>Registration Closes</label>
                <input type="datetime-local" value={form.reg_close_at} onChange={set('reg_close_at')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Max Participants</label>
                <input type="number" min="1" value={form.max_participants} onChange={set('max_participants')} />
              </div>
              {activeTab === 'team' && (
                <>
                  <div className="form-group">
                    <label>Min Team Size *</label>
                    <input type="number" min="1" value={form.min_team_size} onChange={set('min_team_size')} required />
                  </div>
                  <div className="form-group">
                    <label>Max Team Size *</label>
                    <input type="number" min="1" value={form.max_team_size} onChange={set('max_team_size')} required />
                  </div>
                </>
              )}
            </div>
            <div className="form-group checkbox-label">
              <label>
                <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
                Active (visible to students)
              </label>
            </div>
            <div className="form-row">
              <button type="submit" className="btn btn-primary">{editId ? 'Save Changes' : 'Create Game'}</button>
              {editId && (
                <button type="button" className="btn btn-ghost" onClick={() => { setEditId(null); setForm({ ...EMPTY, category: activeTab }); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
