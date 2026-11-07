import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import client from '../api/client';

const YEARS = [1, 2, 3, 4];

export default function Signup() {
  const [form, setForm] = useState({
    name: '', roll_number: '', email: '', phone: '',
    department: '', year: '', password: '', confirm: '',
  });
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    client.get('/departments')
      .then(r => setDepartments(r.data.filter(d => d.active)))
      .catch(() => {});
  }, []);

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    if (!/^\d{10}$/.test(form.phone)) return setError('Phone must be 10 digits');

    setLoading(true);
    try {
      const { data } = await authApi.signup({
        name: form.name,
        roll_number: form.roll_number,
        email: form.email || undefined,
        phone: form.phone,
        department: form.department,
        year: parseInt(form.year),
        password: form.password,
      });
      localStorage.setItem('studentToken', data.token);
      nav('/student/games');
    } catch (err) {
      setError(err.response?.data?.error || 'Sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container auth-container-wide">
        <button className="back-button" onClick={() => nav('/')}>← Back</button>
        <h1>Join the squad</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full name *</label>
            <input id="name" type="text" value={form.name} onChange={set('name')} required autoFocus />
          </div>

          <div className="form-group">
            <label htmlFor="roll_number">College roll number *</label>
            <input id="roll_number" type="text" value={form.roll_number} onChange={set('roll_number')} placeholder="22CS001" required />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email <span style={{fontWeight:400,color:'var(--muted-color)'}}>(optional)</span></label>
            <input id="email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
            <small>No email? Sign in with your roll number instead.</small>
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone *</label>
            <input id="phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="9876543210" required />
            <small>Only organisers can see this.</small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="department">Department *</label>
              <select id="department" value={form.department} onChange={set('department')} required>
                <option value="">Select…</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="year">Year *</label>
              <select id="year" value={form.year} onChange={set('year')} required>
                <option value="">Select…</option>
                {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input id="password" type="password" value={form.password} onChange={set('password')} required />
              <small>At least 8 characters.</small>
            </div>
            <div className="form-group">
              <label htmlFor="confirm">Confirm password *</label>
              <input id="confirm" type="password" value={form.confirm} onChange={set('confirm')} required />
            </div>
          </div>

          {error && <div className="error-message" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
          <p className="auth-link">Already registered? <Link to="/login">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
