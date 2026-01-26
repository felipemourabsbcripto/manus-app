import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, Clock, AlertTriangle,
  DollarSign, Bell, Settings, Star, MessageSquare, MapPin, FileText, LogOut, Heart
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
          <div className="logo-icon">
            <Heart size={24} fill="white" color="white" />
          </div>
          <div>
            <h1>Santa Casa BH</h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>GESTÃO DE PLANTÕES</span>
          </div>
        </div>

        <div className="nav-menu">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/escalas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Calendar />
            <span>Escalas</span>
          </NavLink>

          <NavLink to="/funcionarios" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users />
            <span>Médicos e Equipe</span>
          </NavLink>

          <NavLink to="/presencas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Clock />
            <span>Presenças</span>
          </NavLink>

          <NavLink to="/furos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <AlertTriangle />
            <span>Furos e Faltas</span>
          </NavLink>

          <NavLink to="/pagamentos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <DollarSign />
            <span>Pagamentos</span>
          </NavLink>

          <NavLink to="/avisos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Bell />
            <span>Avisos</span>
          </NavLink>

          <NavLink to="/whatsapp" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <MessageSquare />
            <span>Comunicação</span>
          </NavLink>

          <NavLink to="/relatorios" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText />
            <span>Relatórios</span>
          </NavLink>

          <NavLink to="/configuracoes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings />
            <span>Configurações</span>
          </NavLink>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{
              padding: '1rem',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '1rem',
              marginBottom: '1rem',
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{user?.nome}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }}></div>
                {user?.tipo?.toUpperCase()}
              </div>
            </div>

            <button onClick={logout} className="nav-item" style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '0.75rem' }}>
              <LogOut size={20} color="var(--danger)" />
              <span style={{ color: 'var(--danger)' }}>Sair do Sistema</span>
            </button>
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
