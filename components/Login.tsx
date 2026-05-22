import React, { useState } from 'react';
import { Lock, User, QrCode, AlertCircle } from 'lucide-react';
import { User as UserType } from '../types';
import { auth } from '../services/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

interface Props {
  onLogin: (user: UserType) => void;
  validUsers: UserType[];
}

export const Login: React.FC<Props> = ({ onLogin, validUsers }) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        onLogin({ username: result.user.displayName || result.user.email || 'User', password: '', role: 'user' });
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans bg-[#f8fafc]">
      {/* Background Layer (Desktop only to save mobile performance/layout) */}
      <div className="absolute inset-0 flex">
        <div className="w-full lg:w-1/2 bg-[#f8fafc]">
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-sky-200/40 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        </div>
        <div className="hidden lg:block w-1/2 bg-[#0088cc]"></div> 
      </div>

      {/* Main Card - Responsive Width & Height */}
      <div className="relative z-10 w-full max-w-[1000px] mx-4 bg-white rounded-[2rem] shadow-2xl flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Section: Branding */}
        <div className="w-full md:w-1/2 p-6 md:p-12 flex flex-col justify-center bg-white relative">
           <div className="mb-6 md:mb-8 text-center md:text-left flex flex-col items-center md:items-start">
              {/* Brand Logo 'G' */}
              <div className="w-20 h-16 bg-[#0088cc] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-sky-200">
                 <span className="text-white text-5xl font-black">G</span>
              </div>
              
              <h1 className="text-2xl md:text-3xl font-black text-slate-800 leading-none mb-2 tracking-tight">
                GREENZAR
              </h1>
              <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-4 tracking-tight">
                FOOD AND BEVERAGE
              </h2>
              <div className="bg-slate-900 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full mb-4">Billing System</div>
              <p className="text-slate-500 font-medium text-xs md:text-sm">
                Professional Invoicing & Management System.
              </p>
           </div>
        </div>

        {/* Right Section: Form */}
        <div className="w-full md:w-1/2 p-6 md:p-12 bg-white md:border-l border-slate-50 flex flex-col justify-center">
            <div className="space-y-4 md:space-y-5">
                {error && (
                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <div className="pt-2 space-y-3">
                    <button 
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full bg-[#0088cc] hover:bg-[#0077b3] active:scale-[0.98] text-white font-bold py-3 md:py-3.5 rounded-xl transition-all shadow-lg shadow-sky-200 flex items-center justify-center gap-2"
                    >
                        {isLoading ? 'Verifying...' : 'Sign in with Google'}
                    </button>
                    
                    <button 
                        type="button"
                        className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 md:py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <QrCode size={18} /> Scan ID Badge
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};