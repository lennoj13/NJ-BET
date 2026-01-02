import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Zap, 
  TrendingUp, 
  ShieldCheck, 
  Loader2, 
  Trophy,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle
} from 'lucide-react';
import Header from './components/Header';
import History from './components/History';
import Footer from './components/Footer';

function App() {
  const [dailyPicks, setDailyPicks] = useState([]);
  const [loadingPicks, setLoadingPicks] = useState(true);
  const [currentView, setCurrentView] = useState('home');
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    // Initialize theme
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);

  useEffect(() => {
    fetchDailyPicks();

    // Real-time subscription
    const subscription = supabase
      .channel('tickets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => {
        console.log('Change received!', payload);
        fetchDailyPicks();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchDailyPicks = async () => {
    try {
      setLoadingPicks(true);
      const today = new Date().toISOString().split('T')[0];
      
      // Nueva consulta relacional: tickets + partidos
      const { data, error } = await supabase
        .from('tickets')
        .select('*, partidos(*)')
        .eq('fecha', today)
        .order('id', { ascending: true });

      if (error) throw error;
      setDailyPicks(data || []);
    } catch (error) {
      console.error('Error fetching picks:', error);
    } finally {
      setLoadingPicks(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-brand-500 selection:text-white transition-colors duration-300 overflow-x-hidden">
      
      {/* Background Gradients for Liquid Effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Light Mode Blobs - Active Liquid Flow */}
        <div className="absolute top-0 left-0 w-[80%] h-[80%] bg-gradient-to-br from-emerald-300/40 via-teal-300/30 to-cyan-300/40 blur-[80px] animate-flow mix-blend-multiply dark:hidden" />
        <div className="absolute top-0 right-0 w-[80%] h-[80%] bg-gradient-to-bl from-orange-300/40 via-amber-300/30 to-yellow-300/40 blur-[80px] animate-flow animation-delay-2000 mix-blend-multiply dark:hidden" />
        <div className="absolute -bottom-40 left-20 w-[80%] h-[80%] bg-gradient-to-t from-blue-300/40 via-indigo-300/30 to-purple-300/40 blur-[80px] animate-flow animation-delay-4000 mix-blend-multiply dark:hidden" />

        {/* Dark Mode Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-500/20 blur-[120px] animate-pulse hidden dark:block" />
        <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[100px] animate-pulse delay-1000 hidden dark:block" />
        <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] rounded-full bg-purple-600/10 blur-[90px] animate-pulse delay-500 hidden dark:block" />
      </div>

      <Header 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        darkMode={darkMode}
        toggleTheme={toggleTheme}
      />

      <main className="relative max-w-6xl mx-auto px-4 py-8 space-y-12 z-10">
        
        {currentView === 'home' ? (
          <>
            {/* SECCIÓN 1: Picks del Día */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-full bg-brand-500/10 dark:bg-brand-500/20">
                  <Zap className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Picks del Día</h2>
              </div>

              {loadingPicks ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-64 glass-card animate-pulse" />
                  ))}
                </div>
              ) : dailyPicks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {dailyPicks.map((pick) => (
                    <PickCard key={pick.id} pick={pick} />
                  ))}
                </div>
              ) : (
                <div className="glass-card p-12 text-center">
                  <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-4" />
                  <p className="text-slate-600 dark:text-slate-300 text-lg font-medium">Analizando mercado...</p>
                  <p className="text-slate-400 text-sm mt-2">Nuestra IA está buscando las mejores oportunidades.</p>
                </div>
              )}
            </section>
          </>
        ) : (
          <History />
        )}

      </main>

      <Footer />
    </div>
  );
}

function PickCard({ pick }) {
  const { categoria, partidos, cuota_total, estado, analisis, fecha, stake } = pick;
  const [showReason, setShowReason] = useState(false);
  
  // Helper para colores según categoría
  const getCategoryStyle = (cat) => {
    switch(cat?.toLowerCase()) {
      case 'segura': return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'arriesgada': return 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'valor': return 'text-brand-600 dark:text-brand-400 bg-brand-500/10 border-brand-500/20';
      default: return 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getIcon = (cat) => {
    switch(cat?.toLowerCase()) {
      case 'segura': return <ShieldCheck className="w-4 h-4" />;
      case 'arriesgada': return <Zap className="w-4 h-4" />;
      case 'valor': return <TrendingUp className="w-4 h-4" />;
      default: return <Trophy className="w-4 h-4" />;
    }
  };

  const isLost = (estado || '').toLowerCase() === 'lost';
  const isWon = (estado || '').toLowerCase() === 'won';

  // Helper para formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  };

  return (
    <div className={`glass-card p-0 group relative overflow-hidden flex flex-col h-full transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${isWon ? 'shadow-green-500/20 border-green-500/40' : ''} ${isLost ? 'shadow-red-500/20 border-red-500/40' : ''}`}>
      
      {/* Status Badge */}
      {isLost && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-2xl shadow-sm z-10">PERDIDA</div>}
      {isWon && <div className="absolute top-0 right-0 bg-brand-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-2xl shadow-sm z-10">GANADA</div>}

      <div className="p-6 flex-1">
        <div className="flex justify-between items-start mb-6">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm ${getCategoryStyle(categoria)}`}>
            {getIcon(categoria)}
            <span className="uppercase tracking-wide">{categoria}</span>
          </div>
          <span className="text-slate-400 text-xs font-medium bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
            {formatDate(fecha)}
          </span>
        </div>

        <div className="space-y-4 mb-4">
          {partidos && partidos.length > 0 ? (
            partidos.map((match, idx) => (
              <div key={idx} className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{match.partido}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{match.seleccion}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-1.5 py-0.5 rounded">
                    {match.cuota}
                  </span>
                </div>
                
                {(match.estado === 'won' || match.estado === 'lost') && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {match.estado === 'won' ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-500" />
                    )}
                    <span className="text-[10px] text-slate-400">
                      {match.resultado || (match.estado === 'won' ? 'Acertado' : 'Fallado')}
                    </span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-400 italic">Información de partidos no disponible</div>
          )}
        </div>
      </div>

      <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 border-t border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">Cuota Total</span>
            <span className="text-xl font-bold text-slate-800 dark:text-white">{cuota_total}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">Stake</span>
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                {[...Array(10)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-1 h-3 rounded-full ${i < (stake || 5) ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  />
                ))}
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">{stake || 5}</span>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => setShowReason(!showReason)}
          className="w-full glass-button py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 group-hover:bg-brand-500 group-hover:text-white group-hover:border-brand-500 transition-all"
        >
          {showReason ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showReason ? 'Ocultar Análisis' : 'Ver Análisis IA'}
        </button>

        {showReason && (
          <div className="mt-3 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg text-sm text-slate-600 dark:text-slate-300 animate-in fade-in slide-in-from-top-2 border border-slate-200 dark:border-slate-700">
            <p className="italic leading-relaxed">
              "{analisis || "Análisis no disponible."}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;