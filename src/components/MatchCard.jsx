// Shows a match as two tickets joined by the similarity score.
const STATUS = { potential: 'MATCH FOUND', confirmed: 'CONFIRMED', rejected: 'REJECTED', returned: 'RETURNED' };

function Mail({ label, value }) {
  const text = value === 'sent' ? 'Email sent \u2713' : value === 'failed' ? 'Email failed \u2717' : 'Pending';
  return <li className={`mail mail-${value}`}><span>{label}</span><strong>{text}</strong></li>;
}

export default function MatchCard({ match, banner = false, children }) {
  const percent = (match.similarityScore * 100).toFixed(1);
  return (
    <section className={`match ${banner ? 'match-banner' : ''}`} aria-label="Match result">
      {banner && <h3 className="match-title">Potential match found</h3>}
      <div className="match-pair">
        <div className="match-side match-lost">
          <p className="ticket-kind">Lost item</p>
          <strong>{match.lostItemName}</strong>
          {match.lostLocation && <span className="muted">{match.lostLocation}</span>}
        </div>
        <div className="match-score" aria-label={`Similarity ${percent} percent`}>
          <svg viewBox="0 0 36 36" className="gauge" aria-hidden="true">
            <circle cx="18" cy="18" r="15.9" className="gauge-bg" />
            <circle cx="18" cy="18" r="15.9" className="gauge-fg" strokeDasharray={`${percent} 100`} />
          </svg>
          <span>{percent}%</span>
          <small>similar</small>
        </div>
        <div className="match-side match-found">
          <p className="ticket-kind">Found item</p>
          <strong>{match.foundItemName}</strong>
          {match.foundLocation && <span className="muted">{match.foundLocation}</span>}
        </div>
      </div>

      <div className="match-meta">
        <div>
          <span className="meta-label">Status</span>
          <span className={`pill pill-${match.status}`}>{STATUS[match.status] || match.status}</span>
        </div>
        <ul className="mails">
          <Mail label="Owner" value={match.notifyStatus?.lost} />
          <Mail label="Finder" value={match.notifyStatus?.found} />
        </ul>
      </div>

      {match.counterpart && (
        <p className="contact">
          {match.role === 'owner' ? 'Finder' : 'Owner'}: <strong>{match.counterpart.name}</strong>,{' '}
          <a href={`mailto:${match.counterpart.email}`}>{match.counterpart.email}</a>
          {match.counterpart.phone && (
            <>, phone: <a href={`tel:${match.counterpart.phone}`}>{match.counterpart.phone}</a></>
          )}
        </p>
      )}
      {children && <div className="ticket-actions">{children}</div>}
    </section>
  );
}
