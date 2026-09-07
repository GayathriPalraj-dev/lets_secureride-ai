import { Route, Routes } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { AccountPage } from '../pages/AccountPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { RoleRoute } from '../components/RoleRoute';
import { AdminPage } from '../pages/AdminPage';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { CarsPage } from '../pages/CarsPage';
import { CarDetailPage } from '../pages/CarDetailPage';
import { AdminCarsPage } from '../pages/AdminCarsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/account" element={<AccountPage />} />
        <Route path="/cars" element={<CarsPage />} />
        <Route path="/cars/:carId" element={<CarDetailPage />} />
      </Route>
      <Route element={<RoleRoute role="admin" />}>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/cars" element={<AdminCarsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
