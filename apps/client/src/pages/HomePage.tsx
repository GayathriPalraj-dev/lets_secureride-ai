import { HealthStatus } from '../components/HealthStatus';

export function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header>
        <p className="eyebrow">Step 2 · Application foundation</p>
        <h1>lets_secureride-ai</h1>
      </header>
      <main id="main" tabIndex={-1}>
        <h2>The project foundation is ready</h2>
        <p>
          A starting point for a car-booking application. Booking and account
          features are planned for later milestones.
        </p>
        <HealthStatus />
      </main>
      <footer>
        Foundation only · No booking or payment services are active.
      </footer>
    </>
  );
}
