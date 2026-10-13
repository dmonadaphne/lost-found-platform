import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  ['AI-based matching', 'Sentence-BERT embeddings compare what items mean, not just which words they share.'],
  ['Cloud database', 'Reports live in Firebase Firestore, so they are available from any device.'],
  ['Automatic notifications', 'When two reports match, the owner and the finder both get an email.'],
  ['Real-time reporting', 'Your reports and their status update live, without refreshing.'],
];

export default function Home() {
  const { user } = useAuth();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>Lost something? Found something? Let&apos;s reunite it.</h1>
          <p className="lead">
            An AI-powered cloud-based Lost &amp; Found platform that automatically matches lost and found
            item descriptions using semantic similarity.
          </p>
          <div className="row">
            <Link className="btn btn-lost btn-big" to="/report/lost">Report Lost Item</Link>
            <Link className="btn btn-found btn-big" to="/report/found">Report Found Item</Link>
          </div>
          <p className="row small-links">
            <Link to="/browse">View reports</Link>
            {!user && <><Link to="/login">Log in</Link><Link to="/register">Register</Link></>}
          </p>
        </div>

        {/* A real example from the project brief, drawn as the two tickets the app produces. */}
        <div className="hero-demo" aria-label="Example of a match">
          <div className="demo-ticket demo-lost">
            <span className="ticket-kind">Lost</span>
            <strong>Black Samsung Galaxy S23</strong>
            <span>&ldquo;Cracked screen and a blue transparent case, near the central library.&rdquo;</span>
          </div>
          <div className="demo-score"><strong>87.6%</strong><span>similar</span></div>
          <div className="demo-ticket demo-found">
            <span className="ticket-kind">Found</span>
            <strong>Samsung mobile phone</strong>
            <span>&ldquo;Black phone outside the central library. Screen has a crack, blue cover.&rdquo;</span>
          </div>
        </div>
      </section>

      <section className="page">
        <h2>How a match happens</h2>
        <ol className="steps">
          <li><strong>You describe it.</strong> Fill in the lost or found form in a minute.</li>
          <li><strong>The AI reads it.</strong> Your description becomes a vector, and we compare it with every opposite report.</li>
          <li><strong>Both people hear back.</strong> If the score passes the threshold, you each get an email and a match page.</li>
        </ol>
        <div className="feature-grid">
          {FEATURES.map(([title, text]) => (
            <div key={title} className="feature"><h3>{title}</h3><p>{text}</p></div>
          ))}
        </div>
      </section>
    </>
  );
}
