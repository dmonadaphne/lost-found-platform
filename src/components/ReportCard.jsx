// One report shown as a claim ticket: details on the left, status on the stub.
export const STATUS_LABEL = { active: 'Searching', matched: 'Match found', returned: 'Returned' };

export default function ReportCard({ report, children }) {
  return (
    <article className={`ticket ticket-${report.type}`}>
      <div className="ticket-main">
        <p className="ticket-kind">{report.type === 'lost' ? 'Lost' : 'Found'} item</p>
        <h3>{report.itemName}</h3>
        <p className="ticket-desc">{report.description}</p>
        <dl className="facts">
          <div><dt>Category</dt><dd>{report.category}</dd></div>
          <div><dt>Location</dt><dd>{report.location}</dd></div>
          <div><dt>Date</dt><dd>{report.date}{report.time ? ` at ${report.time}` : ''}</dd></div>
        </dl>
        {children && <div className="ticket-actions">{children}</div>}
      </div>
      <div className="ticket-stub">
        {report.imageUrl ? (
          <img src={report.imageUrl} alt={`Photo of ${report.itemName}`} loading="lazy" />
        ) : (
          <div className="no-photo">No photo</div>
        )}
        <span className={`badge badge-${report.status}`}>{STATUS_LABEL[report.status] || report.status}</span>
      </div>
    </article>
  );
}
