import React from 'react';
import { useAuthStore } from '../stores/authStore';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <h1 className="logo">Mini Notes</h1>
          <div className="user-info">
            <span className="username">Welcome, {user?.username}</span>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>
        </div>
      </header>
      
      <div className="main-content">
        {children}
      </div>
    </div>
  );
};

export default Layout;