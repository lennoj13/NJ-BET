import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Check, X, Clock, ChevronDown, ChevronUp, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHistory();

    const subscription = supabase
      .channel('history_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => {
        fetchHistory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('tickets')
        .select('*, partidos(*)')
        .order('fecha', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setHistory({});
        return;
      }

      const grouped = (data || []).reduce((acc, ticket) => {
        const date = ticket.fecha || 'Sin Fecha';
        if (!acc[date]) acc[date] = [];
        acc[date].push(ticket);
        return acc;
      }, {});

      setHistory(grouped);
      const firstDate = Object.keys(grouped)[0];
      if (firstDate) {
        setExpandedDates({ [firstDate]: true });
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

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
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getStatusStyle = (status) => {
    const res = (status || '').toLowerCase();
    if (res === 'won') return 'bg-green-500/10 border-green-500/30 dark:bg-green-500/20';
    if (res === 'lost') return 'bg-red-500/10 border-red-500/30 dark:bg-red-500/20';
    return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
  };

  const getStatusTextColor = (status) => {
    const res = (status || '').toLowerCase();
    if (res === 'won') return 'text-green-600 dark:text-green-400';
    if (res === 'lost') return 'text-red-600 dark:text-red-400';
    return 'text-slate-500 dark:text-slate-400';
  };

  const getStatusIcon = (status) => {
    const res = (status || '').toLowerCase();
    if (res === 'won') return <CheckCircle className="w-6 h-6 text-green-500" />;
    if (res === 'lost') return <XCircle className="w-6 h-6 text-red-500" />;
    return <Clock className="w-6 h-6 text-yellow-500" />;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mb-4"></div>
        <p>Cargando historial...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Error al cargar historial</h3>
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button 
          onClick={fetchHistory}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
        <div className="p-2 rounded-full bg-brand-500/10 dark:bg-brand-500/20">
          <Calendar className="w-6 h-6 text-brand-600 dark:text-brand-400" />
        </div>
        Historial de Apuestas
      </h2>

      {Object.keys(history).length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-300 text-lg font-medium">No hay historial disponible.</p>
        </div>
      ) : (
        Object.entries(history).map(([date, tickets]) => (
          <div key={date} className="glass-card overflow-hidden">
            <button 
              onClick={() => toggleDate(date)}
              className="w-full flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-200/50 dark:border-slate-700/50"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-brand-500" />
                <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">
                  {formatDate(date)}
                </span>
                <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full font-medium">
                  {tickets.length} Tickets
                </span>
              </div>
              {expandedDates[date] ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>

            {expandedDates[date] && (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2">
                {tickets.map((ticket) => (
                  <div 
                    key={ticket.id} 
                    className={`border rounded-3xl p-5 ${getStatusStyle(ticket.estado)} transition-all hover:shadow-lg hover:-translate-y-1`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col">
                        <span className={`font-bold text-sm uppercase tracking-wider ${getStatusTextColor(ticket.estado)}`}>
                          {ticket.categoria}
                        </span>
                        {ticket.estado !== 'pending' && (
                          <span className="text-[10px] font-bold mt-1 opacity-75 text-slate-600 dark:text-slate-300">
                            {ticket.estado === 'won' ? 'GANADA' : 'PERDIDA'}
                          </span>
                        )}
                      </div>
                      {getStatusIcon(ticket.estado)}
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      {ticket.partidos && ticket.partidos.length > 0 ? (
                        <>
                          {ticket.partidos.map((match, idx) => (
                            <div key={idx} className="text-sm border-b border-slate-200/50 dark:border-slate-700/50 last:border-0 pb-3 last:pb-0 mb-2 last:mb-0">
                              <div className="flex justify-between items-start gap-3">
                                <div className="font-medium text-slate-700 dark:text-slate-200 leading-tight">
                                  {match.partido}
                                </div>
                                {match.estado === 'won' && (
                                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                                )}
                                {match.estado === 'lost' && (
                                  <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                                )}
                              </div>
                              <div className="flex justify-between items-center mt-1.5">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{match.seleccion}</span>
                                {match.resultado && (
                                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                    {match.resultado}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sin detalles</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cuota: <span className="text-slate-800 dark:text-white font-bold">{ticket.cuota_total}</span></span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Stake: <span className="text-slate-800 dark:text-white font-bold">{ticket.stake || 5}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default History;
