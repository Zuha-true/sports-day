import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function ManualRegistration() {
  const [games, setGames] = useState([]);
  const [form, setForm] = useState({
    roll_number: '', game_id: '', payment_method: 'cash', utr: '',
    team_name: '', partner_roll: '', member_rolls: '',
  });
  const [newUser, setNewUser] = useState({
    name: '', roll_number: '', phone: '', department: '', year: '1',
  });
  const [departments, setDepartments] = useState([]);
  const [foundUser, setFoundUser] = useState(null); // null = not searched, false = not found
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedGame = games.find(g => String(g.id) === String(form.game_id));

  useEffect(() => {
    client.get('/games').then(r => setGames(r.data)).catch(() => {});
    client.get('/departments').then(r => setDepartments(r.data.filter(d => d.active))).catch(() => {});
  }, []);

  const setF = field => e => setForm(f => ({ ...f, [field]: e.target.value }));
  const setN = field => e => setNewUser(f => ({ ...f, [field]: e.target.value }));

  const searchUser = async () => {
    if (!form.roll_number.trim()) return;
    setSearching(true); setFoundUser(null); setError('');
    try {
      const r = await client.get(`/admin/users?q=${encodeURIComponent(form.roll_number)}&limit=1`);
      const match = r.data.users?.find(u =>
        u.roll_number.toLowerCase() === form.roll_number.trim().toLowerCase()
      );
      setFoundUser(match || false);
      if (match) setNewUser({ name: match.name, roll_number: match.roll_number, phone: match.phone || '', department: match.department || '', year: String(match.year) });
    } catch { setError('Search failed'); }
    finally { setSearching(false); }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const payload = {
        game_id: parseInt(form.game_id),
        payment_method: form.payment_method,
        utr: form.utr || undefined,
        team_name: form.team_name || undefined,
        partner_roll: form.partner_roll || undefined,
        member_rolls: form.member_rolls || undefined,
      };
      if (foundUser) {
        payload.user_id = foundUser.id;
      } else {
        payload.user_data = {
          name: newUser.name, roll_number: newUser.roll_number.toUpperCase(),
          phone: newUser.phone || '0000000000',
          department: newUser.department || 'Unknown', year: parseInt(newUser.year),
        };
      }
      await client.post('/admin/manual-registration', payload);
      setSuccess('Registration created and approved.');
      setForm({ roll_number: '', game_id: '', payment_method: 'cash', utr: '', team_name: '', partner_roll: '', member_rolls: '' });
      setFoundUser(null);
      setNewUser({ name: '', roll_number: '', phone: '', department: '', year: '1' });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = { height: 42, padding: '0 12px', border: '2px solid var(--field)', borderRadius: 10, fontSize: 14, fontFamily: 'var(--font-body)', background: 'var(--white)', color: 'var(--cherry-dark)' };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1>Register a student</h1>
        <p>Creates an approved registration — use for cash payments or walk-ins.</p>
      </div>

      {error && <div className="error-message" role="alert" style={{marginBottom:16}}>{error}</div>}
      {success && <div className="success-message" style={{marginBottom:16}}>{success}</div>}

      <div className="card" style={{maxWidth:560}}>
        {/* Step 1: find or create user */}
        <h2 style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:18,textTransform:'uppercase',color:'var(--cherry)',marginBottom:14}}>
          1. Find student
        </h2>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <input
            style={{...fieldStyle,flex:1}}
            placeholder="Roll number"
            value={form.roll_number}
            onChange={setF('roll_number')}
          />
          <button className="btn btn-ghost btn-sm" type="button" onClick={searchUser} disabled={searching}>
            {searching ? 'Searching…' : 'Look up'}
          </button>
        </div>

        {foundUser === false && (
          <div style={{marginBottom:16}}>
            <div className="blush-note" style={{marginBottom:12}}>No existing account found. Fill in details to create one.</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <input style={fieldStyle} placeholder="Full name *" value={newUser.name} onChange={setN('name')} required />
              <input style={fieldStyle} placeholder="Roll number *" value={newUser.roll_number} onChange={setN('roll_number')} required />
              <input style={fieldStyle} placeholder="Phone (10 digits)" value={newUser.phone} onChange={setN('phone')} />
              <select style={fieldStyle} value={newUser.department} onChange={setN('department')}>
                <option value="">Department</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <select style={fieldStyle} value={newUser.year} onChange={setN('year')}>
                {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
          </div>
        )}

        {foundUser && (
          <div style={{background:'var(--matcha-tint)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:14}}>
            Found: <strong>{foundUser.name}</strong> — {foundUser.department}, Year {foundUser.year}
          </div>
        )}

        {/* Step 2: game and payment */}
        <h2 style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:18,textTransform:'uppercase',color:'var(--cherry)',marginBottom:14,marginTop:8}}>
          2. Game and payment
        </h2>
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:12}}>
          <select style={fieldStyle} value={form.game_id} onChange={setF('game_id')} required>
            <option value="">Select game *</option>
            {games.filter(g => g.is_active).map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g.category}) — ₹{g.entry_fee}</option>
            ))}
          </select>
          <select style={fieldStyle} value={form.payment_method} onChange={setF('payment_method')}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="other">Other</option>
          </select>
          <input style={fieldStyle} placeholder="UTR / reference (optional)" value={form.utr} onChange={setF('utr')} />

          {/* Duo/team extra fields */}
          {(selectedGame?.category === 'duo' || selectedGame?.category === 'team') && (
            <input style={fieldStyle} placeholder="Team name *" value={form.team_name} onChange={setF('team_name')} required />
          )}
          {selectedGame?.category === 'duo' && (
            <input style={fieldStyle} placeholder="Partner's roll number *" value={form.partner_roll} onChange={setF('partner_roll')} required />
          )}
          {selectedGame?.category === 'team' && (
            <textarea
              style={{...fieldStyle, height:'auto', padding:'8px 12px', resize:'vertical', lineHeight:1.5}}
              rows={4}
              placeholder={'Member roll numbers (one per line)\n22CS002\n22CS003'}
              value={form.member_rolls}
              onChange={setF('member_rolls')}
              required
            />
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !form.game_id || (foundUser === null && !form.roll_number) || (foundUser === false && !newUser.name)}
          >
            {loading ? 'Registering…' : 'Register and approve'}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
