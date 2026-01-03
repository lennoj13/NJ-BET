import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, CheckCircle, XCircle, Clock, Filter, ChevronDown, ChevronUp, Search, PieChart } from 'lucide-react';

const PAGE_SIZE = 10;

// Helper functions
const getStatusStyle = (status) => {
  const res = (status || '').toLowerCase();
  if (res === 'won') return 'bg-green-500/10 border-green-500/20 dark:bg-green-500/10';
  if (res === 'lost') return 'bg-red-500/10 border-red-500/20 dark:bg-red-500/10';
  return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
};

const getStatusIcon = (status) => {
  const res = (status || '').toLowerCase();
  if (res === 'won') return <CheckCircle className="w-6 h-6 text-green-500" />;
  if (res === 'lost') return <XCircle className="w-6 h-6 text-red-500" />;
  return <Clock className="w-6 h-6 text-yellow-500" />;
};

const TicketCard = ({ ticket }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className={`relative rounded-2xl border overflow-hidden transition-all hover:shadow-lg flex flex-col glass-card ${getStatusStyle(ticket.estado)}`}
    >
      {/* Header del Ticket */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/30 dark:bg-slate-900/30">
        <div className="flex items-center gap-2">
          {getStatusIcon(ticket.estado)}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            ticket.categoria === 'Segura' ? 'bg-blue-100/80 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
            ticket.categoria === 'Valor' ? 'bg-purple-100/80 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
            'bg-orange-100/80 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
          }`}>
            {ticket.categoria}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Cuota</p>
          <p className="text-lg font-black text-slate-800 dark:text-white leading-none">
            {ticket.cuota_total}
          </p>
        </div>
      </div>

      {/* Partidos */}
      <div className="p-3 space-y-2 bg-white/20 dark:bg-slate-900/20 flex-1">
        {ticket.partidos?.map((partido, idx) => (
          <div key={idx} className="flex items-start gap-2 text-xs">
            <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              partido.estado === 'won' ? 'bg-green-500' :
              partido.estado === 'lost' ? 'bg-red-500' :
              'bg-slate-300 dark:bg-slate-600'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-700 dark:text-slate-200 truncate">
                {partido.partido}
              </p>
              <div className="flex justify-between items-center mt-0.5">
                <p className="text-slate-500 dark:text-slate-400 truncate pr-2">
                  {partido.seleccion}
                </p>
                <span className="font-mono font-medium text-slate-600 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 px-1 py-0.5 rounded text-[10px]">
                  @{partido.cuota}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer: Stake y Análisis */}
      <div className="p-3 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/30 dark:bg-slate-900/30 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Stake</span>
          <div className="flex gap-0.5">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className={`w-1 h-3 rounded-full ${
                  i < (ticket.stake || 5) 
                    ? 'bg-brand-500' 
                    : 'bg-slate-200/50 dark:bg-slate-700/50'
                }`} 
              />
            ))}
          </div>
        </div>
        
        {ticket.analisis && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Ocultar
              </>
            ) : (
              <>
                <Search className="w-3 h-3" />
                Ver Análisis
              </>
            )}
          </button>
        )}
      </div>

      {/* Análisis Expandible */}
      {isExpanded && (
        <div className="p-3 bg-white/40 dark:bg-slate-900/40 border-t border-slate-200/50 dark:border-slate-700/50 text-xs text-slate-600 dark:text-slate-300 leading-relaxed animate-in slide-in-from-top-2 fade-in duration-200">
          <p className="font-bold mb-1 text-slate-800 dark:text-slate-200">Análisis del Modelo:</p>
          {ticket.analisis}
        </div>
      )}
    </div>
  );
};

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedDates, setExpandedDates] = useState({});
  const [error, setError] = useState(null);
  
  // Filtros
  const [filterCategory, setFilterCategory] = useState('all'); // all, Segura, Valor, Arriesgada
  const [filterDate, setFilterDate] = useState(''); // YYYY-MM-DD
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Estadísticas
  const [stats, setStats] = useState({ total: 0, won: 0, winRate: 0 });

  useEffect(() => {
    // Resetear lista al cambiar filtros
    setHistory([]);
    setPage(0);
    setHasMore(true);
    fetchTickets(0, true);
    fetchStats();
  }, [filterCategory, filterDate]);

  const fetchStats = async () => {
    try {
      let query = supabase
        .from('tickets')
        .select('estado', { count: 'exact' })
        .in('estado', ['won', 'lost']); // Solo terminados

      if (filterCategory !== 'all') {
        query = query.eq('categoria', filterCategory);
      }
      // Nota: No filtramos por fecha en stats para mostrar el rendimiento global de esa categoría
      // Si el usuario quiere stats de un día, podría ser confuso si solo hay 1 ticket.
      // Pero si hay fecha seleccionada, tal vez sí deberíamos filtrar.
      if (filterDate) {
        query = query.eq('fecha', filterDate);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      const totalFinished = data.length;
      const won = data.filter(t => t.estado === 'won').length;
      const winRate = totalFinished > 0 ? ((won / totalFinished) * 100).toFixed(1) : 0;

      setStats({ total: totalFinished, won, winRate });
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchTickets = async (pageNumber, isNewFilter = false) => {
    try {
      if (pageNumber === 0) setLoading(true);
      else setLoadingMore(true);
      
      let query = supabase
        .from('tickets')
        .select('*, partidos(*)')
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
        .range(pageNumber * PAGE_SIZE, (pageNumber + 1) * PAGE_SIZE - 1);

      if (filterCategory !== 'all') {
        query = query.eq('categoria', filterCategory);
      }

      if (filterDate) {
        query = query.eq('fecha', filterDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      }

      setHistory(prev => {
        const newTickets = isNewFilter ? data : [...prev, ...data];
        // Agrupar por fecha
        return newTickets;
      });

      // Expandir automáticamente la primera fecha si es la primera carga
      if (pageNumber === 0 && data.length > 0) {
        setExpandedDates({ [data[0].fecha]: true });
      }

    } catch (error) {
      console.error('Error fetching history:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTickets(nextPage);
  };

  // Agrupar tickets para renderizado
  const groupedHistory = history.reduce((acc, ticket) => {
    const date = ticket.fecha || 'Sin Fecha';
    if (!acc[date]) acc[date] = [];
    acc[date].push(ticket);
    return acc;
  }, {});

  const toggleDate = (date) => {
    setExpandedDates(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      
      {/* Panel de Control: Filtros y Estadísticas */}
      <div className="glass-card p-4 space-y-4">
        
        {/* Estadísticas Rápidas */}
        <div className="flex items-center justify-between bg-white/30 dark:bg-slate-800/30 p-3 rounded-2xl border border-white/40 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-100/80 dark:bg-brand-900/30 rounded-full text-brand-600 dark:text-brand-400">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Efectividad</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white">
                {stats.winRate}% <span className="text-xs font-normal text-slate-400">({stats.won}/{stats.total})</span>
              </p>
            </div>
          </div>
          {filterCategory !== 'all' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-500 text-white capitalize shadow-lg shadow-brand-500/20">
              {filterCategory}
            </span>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-3">
          {/* Selector de Categoría */}
          <div className="flex-1 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
            <div className="flex gap-2">
              {['all', 'Segura', 'Valor', 'Arriesgada'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    filterCategory === cat
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg'
                      : 'glass-button text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {cat === 'all' ? 'Todas' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Selector de Fecha */}
          <div className="relative min-w-[150px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 glass-input text-sm text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Lista de Historial */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mb-4"></div>
          <p>Cargando historial...</p>
        </div>
      ) : Object.keys(groupedHistory).length === 0 ? (
        <div className="text-center py-20 glass-card border-dashed border-slate-300 dark:border-slate-700">
          <Filter className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No se encontraron tickets con estos filtros.</p>
          <button 
            onClick={() => {setFilterCategory('all'); setFilterDate('');}}
            className="mt-4 text-brand-500 hover:underline text-sm font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedHistory).map(([date, tickets]) => (
            <div key={date} className="glass-card overflow-hidden">
              <button
                onClick={() => toggleDate(date)}
                className="w-full flex items-center justify-between p-4 bg-white/30 dark:bg-slate-800/30 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/50 dark:bg-slate-700/50 rounded-full shadow-sm">
                    <Calendar className="w-5 h-5 text-brand-500" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                      {formatDate(date)}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {tickets.length} Tickets
                    </p>
                  </div>
                </div>
                {expandedDates[date] ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {expandedDates[date] && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-white/20 dark:border-slate-700/30">
                  {tickets.map((ticket) => (
                    <TicketCard key={ticket.id} ticket={ticket} />
                  ))}
                </div>
              )}
            </div>
          ))}
          
          {/* Botón Cargar Más */}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 glass-button text-slate-600 dark:text-slate-300 font-medium flex items-center justify-center gap-2"
            >
              {loadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  Cargando...
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Cargar más tickets
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default History;