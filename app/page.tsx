export default function Home() {
  return (
    <main className="main-container">
      <div className="hero-section">
        <h1 className="title">Fisherman Cash</h1>
        <p className="description">
          Welcome to your fisherman cash management application
        </p>
      </div>

      <style jsx>{`
        .main-container {
          min-height: 100vh;
          padding: 0 20px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            Segoe UI,
            Roboto,
            Oxygen,
            Ubuntu,
            Cantarell,
            Fira Sans,
            Droid Sans,
            Helvetica Neue,
            sans-serif;
        }

        .hero-section {
          text-align: center;
          color: white;
        }

        .title {
          font-size: 4rem;
          margin: 0 0 24px 0;
          font-weight: 700;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }

        .description {
          font-size: 1.25rem;
          margin: 0;
          opacity: 0.9;
        }

        @media (max-width: 768px) {
          .title {
            font-size: 2.5rem;
          }

          .description {
            font-size: 1rem;
            padding: 0 20px;
          }
        }
      `}</style>
    </main>
  );
}
