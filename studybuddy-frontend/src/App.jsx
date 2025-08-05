import React from 'react';
import { Toaster } from 'sonner';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import FindGroups from './pages/groups/FindGroups';
import MyGroups from './pages/groups/MyGroups';
import Messages from './pages/messages/Messages';
import Schedule from './pages/schedule/Schedule';
import ProfilePage from './pages/profile/ProfilePage';
import SettingsPage from './pages/settings/SettingsPage';
import MainLayout from './components/layout/MainLayout';
// If you use TanStack Query or AuthProvider, import and wrap below (uncomment if needed):
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { AuthProvider } from '@/contexts/AuthContext';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  

  
  // Define public routes that don't require authentication
  const publicRoutes = ['/signin', '/signup', '/forgot-password', '/reset-password'];
  
  // If no user but we're not on a public route, show the content but with a toast
  if (!user && !publicRoutes.some(route => location.pathname.startsWith(route))) {
    // Use a ref to prevent showing the toast multiple times
    const hasShownToast = React.useRef(false);
    
    React.useEffect(() => {
      if (!hasShownToast.current) {
        // Show toast but don't redirect
        window.dispatchEvent(new CustomEvent('show-auth-toast', { 
          detail: { 
            message: 'Please sign in to access all features',
            type: 'info'
          } 
        }));
        hasShownToast.current = true;
      }
    }, []);
  }
  
  return children;
}

function App() {
  return (
    // Uncomment providers below if you use them
    // <QueryClientProvider client={queryClient}>
    //   <AuthProvider>
    <>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<Navigate to="/groups" replace />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<FindGroups />} />
          <Route path="groups" element={<FindGroups />} />
          <Route path="my-groups" element={<MyGroups />} />
          <Route path="messages" element={<Messages />}>
            <Route path=":groupId" element={<Messages />} />
          </Route>
          <Route path="schedule" element={<Schedule />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/signin" />} />
      </Routes>
    </>
    //   </AuthProvider>
    // </QueryClientProvider>
  );
}

export default App;
