import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/AuthContext";
import { RoutePaths } from "../../constants/RoutePaths";
import { Icon } from "../common";
import { LogoImage } from "../common/ui/LogoImage";
import { useTheme } from "../../context/ThemeContext";
import { showErrorToast } from "../../utils/toastHelper";

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login, loading } = useAuthContext();
  const { toggleTheme, isDarkMode } = useTheme();
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(userid, password);
      navigate(RoutePaths.DASHBOARD, { replace: true });
    } catch (err) {
      console.error('[LOGIN] error=', err);
      showErrorToast("Invalid user ID or password");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-steel-50 to-brand-100 dark:from-brand-900 dark:to-slate-900 transition-colors duration-300">
      <div className="absolute top-6 right-6">
        <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-brand-300 dark:border-brand-700 text-slate-500 dark:text-slate-400 hover:text-brand-600 transition-all active:scale-95 shadow-sm" aria-label="Toggle theme">
          <Icon name={isDarkMode ? "sun" : "moon"} size={20} weight="regular" />
        </button>
      </div>
      <div className="w-full max-w-[420px] px-4">
        <div className="bg-white dark:bg-slate-800 px-8 py-10 rounded-3xl border border-brand-200 dark:border-brand-800 shadow-xl shadow-brand-200/30 dark:shadow-none transition-all">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 border border-brand-100 rounded-2xl flex items-center justify-center mb-4 overflow-hidden">
              <LogoImage className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Padelitics</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">User ID</label>
              <input
                type="text"
                required
                value={userid}
                onChange={(e) => setUserid(e.target.value)}
                placeholder="admin"
                className="w-full px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:border-brand-600 dark:focus:border-brand-500 focus:bg-brand-50 dark:focus:bg-slate-600 transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-12 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:border-brand-600 dark:focus:border-brand-500 focus:bg-brand-50 dark:focus:bg-slate-600 transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  tabIndex={-1}
                >
                  <Icon name={showPassword ? "view-off" : "view"} size={20} />
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-white font-semibold rounded-lg bg-brand-700 dark:bg-brand-600 hover:bg-brand-600 dark:hover:bg-brand-500 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.98]"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};