import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/auth';

const DEPTS = ['CSE','ECE','EEE','ME','CE','MBA','MCA','Other'];
const YEARS = [1, 2, 3, 4];

export default function StudentSignup() {
  const [form, setForm] = useState({
    name: '', roll_number: '', email: '', phone: '',
    department: '', year: '', password: '', confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

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
        name: form.name, roll_number: form.roll_number,
        email: form.email, phone: form.phone,
        department: form.department, year: parseInt(form.year),
        password: form.password,
      });
      localStorage.setItem('studentToken', data.token);
      nav('/student');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container auth-container-wide">
        <button className="back-button" onClick={() => nav('/')}>← Back</button>
        <h1>Create Account</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label>Full Name *</label>
              <input type="text" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label>Roll Number *</label>
              <input type="text" value={form.roll_number} onChange={set('roll_number')} placeholder="22CS001" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email *</label>
              <input type="email" value={form.email} onChange={set('email')} required />
            </div>
            <div className="form-group">
              <label>Phone (10 digits) *</label>
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="9876543210" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Department *</label>
              <select value={form.department} onChange={set('department')} required>
                <option value="">Select…</option>
                {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Year *</label>
              <select value={form.year} onChange={set('year')} required>
                <option value="">Select…</option>
                {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Password (min 8 chars) *</label>
              <input type="password" value={form.password} onChange={set('password')} required />
            </div>
            <div className="form-group">
              <label>Confirm Password *</label>
              <input type="password" value={form.confirm} onChange={set('confirm')} required />
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
          <p className="auth-link">Already have an account? <Link to="/login">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
