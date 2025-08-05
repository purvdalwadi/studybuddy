import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";

export default function SignIn() {
  const [form, setForm] = useState({ email: "", password: "" });
  const { login, loading, error, setLoading } = useAuth();
  const location = useLocation();
  
  // Reset loading state when component mounts
  useEffect(() => {
    // Only reset if we're coming from logout
    if (location.state?.fromLogout) {
      setLoading(false);
    }
  }, [location.state, setLoading]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(form);
    } catch (err) {
      // Error is already handled in the auth context
      console.error('Login error:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-8 w-full max-w-md space-y-6"
        onSubmit={handleSubmit}
      >
        <h2 className="text-2xl font-bold mb-2 text-center">Sign In to StudyBuddy</h2>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <div>
          <label className="block mb-1 font-medium">Email</label>
          <Input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="you@email.com"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Password</label>
          <Input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            placeholder="••••••••"
          />
          <div className="text-right mt-1">
            <Link 
              to="/forgot-password" 
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" className="w-full mt-2" disabled={loading}>
          {loading ? "Signing In..." : "Sign In"}
        </Button>
        <div className="text-center mt-4 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Don't have an account? </span>
          <Link to="/signup" className="text-primary hover:underline font-medium">Sign Up</Link>
        </div>
      </form>
    </div>
  );
}
