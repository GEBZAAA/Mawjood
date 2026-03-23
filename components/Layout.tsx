
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  user?: { fullName: string };
  onReset?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onReset }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-emerald-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onReset}>
            <div className="bg-emerald-700 p-2 rounded-full border border-emerald-500/30">
              <i className="fas fa-mosque text-xl text-emerald-100"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">MAW<span className="text-amber-400">JOOD</span></h1>
              <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-medium">Lost & Found Support</p>
            </div>
          </div>
          
          {user && (
            <div className="hidden md:flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium">{user.fullName}</p>
                <p className="text-[10px] text-emerald-300">Verified Visitor</p>
              </div>
              <button 
                onClick={onReset}
                className="bg-emerald-800 hover:bg-emerald-700 p-2 rounded-lg transition-colors"
                title="Logout"
              >
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow max-w-4xl mx-auto w-full px-4 py-8 md:py-12">
        {children}
      </main>

      <footer className="bg-slate-900 text-slate-400 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex justify-center space-x-6 mb-4">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Contact Support</a>
          </div>
          <p className="text-sm">&copy; 2024 Ministry of Hajj & Umrah. All Rights Reserved.</p>
          <p className="text-[10px] mt-2 text-slate-500 uppercase tracking-widest">Powered by AI Semantic Search</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
