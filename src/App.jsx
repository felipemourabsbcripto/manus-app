import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, Clock, AlertTriangle,
  DollarSign, Bell, Settings, Star, MessageSquare, MapPin, FileText, LogOut
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Funcionarios from './pages/Funcionarios';
import Escalas from './pages/Escalas';
import Presencas from './pages/Presencas';
import Furos from './pages/Furos';
import Notas from './pages/Notas';
import Pagamentos from './pages/Pagamentos';
import Avisos from './pages/Avisos';
import Configuracoes from './pages/Configuracoes';
import WhatsApp from './pages/WhatsApp';
import CheckIn from './pages/CheckIn';
import Relatorios from './pages/Relatorios';
import Register from './pages/Register';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { API_URL } from './config';
import './App.css';

// Componente para rotas privadas
const PrivateRoute = () => {
  const { signed, loading } = useAuth();

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return signed ? <Outlet /> : <Navigate to="/login" />;
};

// Layout principal com Sidebar
const AppLayout = () => {
  const [avisosNaoLidos, setAvisosNaoLidos] = useState(0);
  const { logout, user } = useAuth();

  useEffect(() => {
    fetchAvisosNaoLidos();
    const interval = setInterval(fetchAvisosNaoLidos, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAvisosNaoLidos = async () => {
    try {
      const res = await fetch(`${API_URL}/avisos?lido=false`);
      const data = await res.json();
      setAvisosNaoLidos(data.length);
    } catch (error) {
      console.error('Erro ao buscar avisos:', error);
    }
  };

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="logo">
          <Calendar size={32} className="text-primary" />
          <div>
            <h1 style={{ fontSize: '1rem', lineHeight: '1.2' }}>Gestor de Plantões Santa Casa Bh</h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Logado como: {user?.nome?.split(' ')[0]}</span>
          </div>
        </div>
        <ul className="nav-menu">
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/funcionarios" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              <span>Funcionários</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/escalas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Calendar size={20} />
              <span>Escalas</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/checkin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <MapPin size={20} />
              <span>Check-in/out</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/presencas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Clock size={20} />
              <span>Presenças</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/furos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <AlertTriangle size={20} />
              <span>Furos</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/whatsapp" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <MessageSquare size={20} />
              <span>WhatsApp</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/notas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Star size={20} />
              <span>Notas</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/pagamentos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <DollarSign size={20} />
              <span>Pagamentos</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/relatorios" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FileText size={20} />
              <span>Relatórios</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/avisos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="notification-badge">
                <Bell size={20} />
                {avisosNaoLidos > 0 && <span className="notification-count">{avisosNaoLidos}</span>}
              </div>
              <span>Avisos</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/configuracoes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Settings size={20} />
              <span>Configurações</span>
            </NavLink>
          </li>
        </ul>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <div onClick={logout} className="nav-item" style={{ color: 'var(--danger)' }}>
            <LogOut size={20} />
            <span>Sair</span>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<PrivateRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/funcionarios" element={<Funcionarios />} />
              <Route path="/escalas" element={<Escalas />} />
              <Route path="/checkin" element={<CheckIn />} />
              <Route path="/presencas" element={<Presencas />} />
              <Route path="/furos" element={<Furos />} />
              <Route path="/whatsapp" element={<WhatsApp />} />
              <Route path="/notas" element={<Notas />} />
              <Route path="/pagamentos" element={<Pagamentos />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/avisos" element={<Avisos />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
