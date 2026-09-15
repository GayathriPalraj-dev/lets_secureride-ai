import { AppRoutes } from './app/router';
import { AppShell } from './components/AppShell';
export default function App() {
  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}
