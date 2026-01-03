import React, { useState, useEffect } from 'react';
import { BrainCircuit, Calendar, Home, Sun, Moon } from 'lucide-react';

const Header = ({ currentView, setCurrentView, darkMode, toggleTheme }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show header if scrolling up or at the top
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 80) {
        // Hide header if scrolling down and past the header height
        setIsVisible(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <header className={`w-full py-3 px-4 fixed top-0 z-50 border-b shadow-lg h-[80px] flex items-center transition-transform duration-300 transform-gpu ${
      isVisible ? 'translate-y-0' : '-translate-y-full'
    } ${
      darkMode 
        ? 'border-slate-800 bg-slate-900/95 backdrop-blur-md' 
        : 'border-white/20 bg-[#07c707ad] backdrop-blur-md shadow-lg shadow-brand-500/20'
    }`}>
      <div className="max-w-6xl mx-auto flex items-center justify-between w-full">
        
        {/* Logo Container - Unified Dimensions */}
        <div 
          className={`flex items-center gap-2 md:gap-3 cursor-pointer group py-2 px-3 md:px-4 rounded-full transition-all duration-300 hover:scale-105 ${
            darkMode 
              ? 'border border-transparent' 
              : 'bg-white/30 backdrop-blur-md shadow-lg border border-white/40'
          }`} 
          onClick={() => setCurrentView('home')}
        >
          <div className="relative">
            {darkMode && (
              <div className="absolute inset-0 bg-brand-500/10 blur-xl rounded-full group-hover:bg-brand-500/20 transition-all" />
            )}
            <img 
              src="/logo.png" 
              alt="NJBET Logo" 
              className={`relative w-8 h-8 md:w-10 md:h-10 object-contain ${darkMode ? 'drop-shadow-lg' : 'drop-shadow-sm'}`} 
            />
          </div>
          <div>
            <h1 className={`text-lg md:text-xl font-bold tracking-wider leading-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              NJ<span className={darkMode ? 'text-brand-500' : 'text-brand-700'}>BET</span>
            </h1>
            <p className={`text-[10px] md:text-xs tracking-widest uppercase hidden md:block font-medium ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}>
              Inteligencia Artificial Deportiva
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          {/* Navigation - Unified Sliding Pill */}
          <nav className={`relative flex items-center p-1 rounded-full backdrop-blur-sm border ${
            darkMode 
              ? 'bg-slate-800/50 border-slate-700' 
              : 'bg-white/40 border-white/40 shadow-sm'
          }`}>
            {/* Sliding Pill */}
            <div 
              className={`absolute top-1 bottom-1 rounded-full shadow-lg transition-all duration-300 ease-out z-0 ${
                currentView === 'home' ? 'left-1 w-[calc(50%-4px)]' : 'left-[50%] w-[calc(50%-4px)]'
              } ${
                darkMode 
                  ? 'bg-brand-500 shadow-brand-500/20' 
                  : 'bg-white shadow-sm'
              }`}
            />
            
            <button 
              onClick={() => setCurrentView('home')}
              className={`relative z-10 flex items-center justify-center gap-2 px-3 py-2 rounded-full text-sm font-bold transition-colors duration-300 w-12 md:w-28 ${
                currentView === 'home' 
                  ? (darkMode ? 'text-white' : 'text-brand-600') 
                  : (darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-800 hover:text-brand-700')
              }`}
            >
              <Home className="w-5 h-5 md:w-4 md:h-4" />
              <span className="hidden md:inline">Inicio</span>
            </button>
            <button 
              onClick={() => setCurrentView('history')}
              className={`relative z-10 flex items-center justify-center gap-2 px-3 py-2 rounded-full text-sm font-bold transition-colors duration-300 w-12 md:w-28 ${
                currentView === 'history' 
                  ? (darkMode ? 'text-white' : 'text-brand-600') 
                  : (darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-800 hover:text-brand-700')
              }`}
            >
              <Calendar className="w-5 h-5 md:w-4 md:h-4" />
              <span className="hidden md:inline">Historial</span>
            </button>
          </nav>

          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-full transition-all shadow-sm backdrop-blur-md border ${
              darkMode 
                ? 'bg-slate-800 text-slate-400 hover:text-brand-400 hover:bg-slate-700 border-slate-700' 
                : 'bg-white/40 text-slate-800 hover:bg-white border-white/40'
            }`}
            aria-label="Toggle Theme"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;