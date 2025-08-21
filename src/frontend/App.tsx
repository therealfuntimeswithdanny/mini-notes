import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import Notes from './pages/Notes';
import Layout from './components/Layout';
import './App.css';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="App">
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/notes" /> : <Login />} 
        />
        <Route 
          path="/register" 
          element={isAuthenticated ? <Navigate to="/notes" /> : <Register />} 
        />
        
        {/* Protected routes */}
        <Route 
          path="/notes" 
          element={
            isAuthenticated ? (
              <Layout>
                <Notes />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        
        {/* Default redirect */}
        <Route 
          path="/" 
          element={<Navigate to={isAuthenticated ? "/notes" : "/login"} />} 
        />
      </Routes>
    </div>
  );
}

export default App;