import {
  MemoryRouter as Router,
  Routes,
  Route,
  Outlet,
} from 'react-router-dom';
import icon from '../../assets/icon.svg';
import FileLoad from '../pages/FileLoad';
import './App.css';
import 'tailwindcss/tailwind.css';
import DocumentAnalysis from '../pages/DocumentAnalysis';
import MainLayout from '../layout/MainLayout';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <MainLayout>
              <Outlet />
            </MainLayout>
          }
        >
          <Route index element={<FileLoad />} />
          <Route path="/analysis" element={<DocumentAnalysis />} />
        </Route>
      </Routes>
    </Router>
  );
}
