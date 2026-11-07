import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

const SAMPLE_REGS = [
  { game: 'Badminton', status: 'Registered', chip: 'chip-registered' },
  { game: 'Chess', status: 'Waiting for approval', chip: 'chip-waiting' },
  { game: 'Kho-kho', status: 'Registered', chip: 'chip-registered' },
  { game: 'Throwball', status: 'Registered', chip: 'chip-registered' },
  { game: 'Carrom', status: 'Waiting for approval', chip: 'chip-waiting' },
];

const CATEGORY_SLOGANS = {
  solo: { label: 'Solos', slogan: 'Just you and the clock.' },
  duo:  { label: 'Duos',  slogan: 'Two players, one plan.' },
  team: { label: 'Teams', slogan: 'Squad up and register with your full team.' },
};

export default function Home() {
  const nav = useNavigate();
  const [games, setGames] = useState([]);
  const [regCloseDate, setRegCloseDate] = useState(null);

  useEffect(() => {
    // Load game names for category cards (unauthenticated endpoint)
    client.get('/games').then(r => setGames(r.data)).catch(() => {});
    // Try to get reg_close from settings (may 401 — that's fine)
    client.get('/settings/payment-info').then(r => {
      if (r.data?.reg_close_at) setRegCloseDate(r.data.reg_close_at);
    }).catch(() => {});
  }, []);

  const grouped = { solo: [], duo: [], team: [] };
  games.forEach(g => { if (grouped[g.category]) grouped[g.category].push(g.name); });

  return (
    <div>
      {/* Top bar */}
      <header className="home-topbar">
        <div className="home-logo">
          <img src="/aitm-logo.png" alt="AITM" style={{width:36,height:36,objectFit:'contain'}} />
          <div className="logo-text">
            <strong>Girls' Sports Day</strong>
            <span>AITM</span>
          </div>
        </div>
        <nav className="home-nav" aria-label="Site navigation">
          <a href="#games">Games</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <div className="home-nav-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/login')}>Sign in</button>
          <button className="btn btn-primary btn-sm" onClick={() => nav('/signup')}>Create account</button>
        </div>
      </header>

      {/* Hero */}
      <section className="home-hero">
        <div>
          <p className="hero-eyebrow">Sports Day · AITM</p>
          <h1 className="hero-headline">Girls'<br />Sports<br />Day</h1>
          <p className="hero-slogan">Game on, girls.</p>
          <p className="hero-body">
            Pick your games, pay ₹50 for each one by UPI,
            and follow every bracket and result from your phone.
          </p>
          <div className="hero-ctas">
            <button className="btn btn-primary" onClick={() => nav('/signup')}>Create account</button>
            <button className="btn btn-ghost"   onClick={() => nav('/login')}>Sign in</button>
          </div>
        </div>

        {/* Sample registrations panel */}
        <aside className="hero-panel" aria-label="Sample registrations">
          <h3 style={{color:'#fff'}}>Your registrations</h3>
          <div className="hero-panel-cards">
            {SAMPLE_REGS.map(r => (
              <div key={r.game} className="hero-reg-card">
                <span>{r.game}</span>
                <span className={`chip ${r.chip}`}>{r.status}</span>
              </div>
            ))}
          </div>
          <p style={{marginTop:'auto',paddingTop:16,fontSize:12,color:'var(--cherry-dark)',fontWeight:500,lineHeight:1.5}}>
            ₹50 per game · Pay by UPI · Results updated live
          </p>
        </aside>
      </section>

      {/* Category cards */}
      <section className="home-categories" id="games">
        <div className="home-section-wrap">
          <h2 className="home-section-title">Play solo. Pair up. Team up.</h2>
          <div className="category-cards">
            {(['solo', 'duo', 'team']).map(cat => (
              <div key={cat} className="category-card">
                <div className="category-card-label">{CATEGORY_SLOGANS[cat].label}</div>
                <div className="category-card-title">{CATEGORY_SLOGANS[cat].label}</div>
                <div className="category-card-slogan">{CATEGORY_SLOGANS[cat].slogan}</div>
                {grouped[cat].length > 0 && (
                  <div className="category-card-games">
                    {grouped[cat].map(name => <span key={name}>{name}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Four steps */}
      <section className="home-steps" id="how-it-works">
        <h2 className="home-section-title" style={{textAlign:'left', marginBottom: 28}}>Four steps to game day</h2>
        <div className="steps-grid">
          {[
            { n: '1', title: 'Make your account', body: 'Sign up with your roll number. Email is optional.' },
            { n: '2', title: 'Pay ₹50 a game', body: 'Scan the UPI QR, enter your UTR, and optionally upload a screenshot.' },
            { n: '3', title: 'Get the green light', body: 'Organisers verify your payment and approve your registration.' },
            { n: '4', title: 'Follow every point', body: 'See brackets, results, and your team\'s progress from your phone.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-num">{s.n}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-body">{s.body}</div>
            </div>
          ))}
        </div>
        <div className="home-blush-note">
          <span>🔒</span>
          <span>Other players only see your name. Phone numbers and email stay with the organisers.</span>
        </div>
      </section>

      {/* Cherry band CTA */}
      <section className="home-band">
        <div className="home-band-headline">Your game. Your squad. Your moment.</div>
        {regCloseDate && (
          <div className="home-band-sub">
            Registration closes {new Date(regCloseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}
        <button className="btn btn-matcha" onClick={() => nav('/signup')}>Create account</button>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <p>AITM · Girls' Sports Day Committee</p>
      </footer>
    </div>
  );
}
