import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, Clock, AlertTriangle,
  DollarSign, Bell, Settings, MessageSquare, FileText, LogOut, Heart, Menu, X,
  ArrowRightLeft
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
import Trocas from './pages/Trocas';
import Register from './pages/Register';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { API_URL } from './config';
import './App.css';
import logo from './assets/logo-login.png';


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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout, user, hasPermission, isGestorOrAdmin, isMedico } = useAuth();

  useEffect(() => {
    const fetchAvisosNaoLidos = async () => {
      try {
        const res = await fetch(`${API_URL}/avisos?lido=false`);
        const data = await res.json();
        setAvisosNaoLidos(data.length);
      } catch (error) {
        console.error('Erro ao buscar avisos:', error);
      }
    };

    fetchAvisosNaoLidos();
    const interval = setInterval(fetchAvisosNaoLidos, 30000);
    return () => clearInterval(interval);
  }, []);

  // Badge de avisos não lidos (usado no futuro)
  const _avisosCount = avisosNaoLidos;

  return (
    <div className="app-container">
      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          <Menu size={24} color="var(--text-primary)" />
        </button>
        <div className="mobile-logo">
          <Heart size={20} fill="#e11d48" color="#e11d48" />
          <span>Gestor de Plantões</span>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      <nav className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        {isMobileMenuOpen && (
          <button className="mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        )}
        <div className="logo">
          <div className="logo-icon">
            <img src={logo} alt="EscalaPro" style={{ width: '50px', height: '50px' }} />
          </div>
        </div>

        <div className="nav-menu">
          <NavLink to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/escalas" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Calendar />
            <span>Escalas</span>
          </NavLink>

          {hasPermission('canManageFuncionarios') && (
            <NavLink to="/funcionarios" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users />
              <span>Médicos e Equipe</span>
            </NavLink>
          )}

          {hasPermission('canViewPresencas') && (
            <NavLink to="/presencas" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Clock />
              <span>Plantões</span>
            </NavLink>
          )}

          {isGestorOrAdmin() && (
            <NavLink to="/furos" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <AlertTriangle />
              <span>Atrasos e Ausências</span>
            </NavLink>
          )}

          <NavLink to="/trocas" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ArrowRightLeft />
            <span>Trocas de Plantão</span>
          </NavLink>

          {hasPermission('canManagePagamentos') && (
            <NavLink to="/pagamentos" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <DollarSign />
              <span>Pagamentos</span>
            </NavLink>
          )}

          <NavLink to="/avisos" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Bell />
            <span>Avisos</span>
          </NavLink>

          {isGestorOrAdmin() && (
            <NavLink to="/whatsapp" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <MessageSquare />
              <span>Comunicação</span>
            </NavLink>
          )}

          {hasPermission('canViewRelatorios') && (
            <NavLink to="/relatorios" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FileText />
              <span>Relatórios</span>
            </NavLink>
          )}

          {hasPermission('canAccessConfig') && (
            <NavLink to="/configuracoes" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Settings />
              <span>Configurações</span>
            </NavLink>
          )}

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
              <Route path="/trocas" element={<Trocas />} />
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
