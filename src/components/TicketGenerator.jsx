import React, { useState } from 'react';
import { Shield, Hammer, Rocket, Loader2, MessageSquare, Send, Bot } from 'lucide-react';
import StrategyCard from './StrategyCard';
import BetTicket from './BetTicket';

const TicketGenerator = () => {
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [customOdds, setCustomOdds] = useState(2.5);
  const [isLoading, setIsLoading] = useState(false);
  const [ticketData, setTicketData] = useState(null);
  
  // Refinement State
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [aiJustification, setAiJustification] = useState(null);

  const strategies = [
    {
      id: 'conservative',
      title: 'La Conservadora',
      description: 'Prioridad efectividad > 90%. Ganancias pequeñas pero seguras.',
      icon: Shield
    },
    {
      id: 'builder',
      title: 'La Segura / Constructor',
      description: 'Tú eliges la cuota. La IA busca la mejor combinación matemática.',
      icon: Hammer
    },
    {
      id: 'dreamer',
      title: 'La Soñadora',
      description: 'Alto riesgo, Alto valor. Buscar sorpresas y cuotas altas.',
      icon: Rocket
    }
  ];

  const handleGenerate = async () => {
    if (!selectedStrategy) return;

    setIsLoading(true);
    setTicketData(null);
    setAiJustification(null);
    setRefinementPrompt('');

    // Simulación de llamada a API
    setTimeout(() => {
      const mockTicket = {
        matches: [
          { teams: 'Real Madrid vs Barcelona', league: 'La Liga', time: '20:00', prediction: 'Ambos marcan', odds: 1.65 },
          { teams: 'Man City vs Liverpool', league: 'Premier League', time: '17:30', prediction: 'Over 2.5 Goles', odds: 1.55 },
          { teams: 'Bayern vs Dortmund', league: 'Bundesliga', time: '18:30', prediction: 'Bayern Gana', odds: 1.45 }
        ],
        totalOdds: selectedStrategy === 'builder' ? customOdds : (selectedStrategy === 'dreamer' ? 15.5 : 3.75),
        probability: selectedStrategy === 'conservative' ? 92 : (selectedStrategy === 'dreamer' ? 35 : 78),
        stake: selectedStrategy === 'conservative' ? 9 : (selectedStrategy === 'dreamer' ? 2 : 6)
      };
      
      setTicketData(mockTicket);
      setIsLoading(false);
    }, 2500);
  };

  const handleRefine = async (e) => {
    e.preventDefault();
    if (!refinementPrompt.trim() || !ticketData) return;

    setIsRefining(true);
    
    // Simulación de llamada a n8n/Backend
    setTimeout(() => {
      // Mock de respuesta inteligente
      const newTicket = { ...ticketData };
      // Modificamos el primer partido como ejemplo de cambio
      newTicket.matches[0] = { 
        teams: 'Real Madrid vs Barcelona', 
        league: 'La Liga', 
        time: '20:00', 
        prediction: 'Empate o Barcelona', 
        odds: 1.85 
      };
      newTicket.totalOdds = (parseFloat(newTicket.totalOdds) + 0.2).toFixed(2);
      
      setTicketData(newTicket);
      setAiJustification(`Entendido. He analizado tu sugerencia: "${refinementPrompt}". Tienes razón en considerar el estado de forma reciente. He ajustado la predicción del Clásico a "Doble Oportunidad" para reducir el riesgo, manteniendo una cuota atractiva.`);
      setRefinementPrompt('');
      setIsRefining(false);
    }, 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Generador de <span className="text-neon-green neon-text">Tickets IA</span>
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Selecciona tu estrategia y deja que nuestros algoritmos de Machine Learning encuentren las mejores oportunidades del mercado en tiempo real.
        </p>
      </div>

      {/* Strategy Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {strategies.map((strategy) => (
          <StrategyCard
            key={strategy.id}
            {...strategy}
            isSelected={selectedStrategy === strategy.id}
            onClick={() => {
              setSelectedStrategy(strategy.id);
              setTicketData(null);
              setAiJustification(null);
            }}
          />
        ))}
      </div>

      {/* Custom Odds Input for Builder Mode */}
      {selectedStrategy === 'builder' && (
        <div className="mb-10 animate-in fade-in slide-in-from-top-4">
          <div className="max-w-xs mx-auto bg-dark-card p-6 rounded-xl border border-gray-700 text-center">
            <label className="block text-sm text-gray-400 mb-2">Cuota Deseada</label>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-bold text-neon-green">x</span>
              <input
                type="number"
                step="0.1"
                min="1.1"
                value={customOdds}
                onChange={(e) => setCustomOdds(e.target.value)}
                className="w-24 bg-dark-input border-b-2 border-neon-green text-3xl font-bold text-center focus:outline-none text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <div className="flex justify-center mb-12">
        <button
          onClick={handleGenerate}
          disabled={!selectedStrategy || isLoading}
          className={`
            relative overflow-hidden px-12 py-4 rounded-full font-bold text-lg tracking-wider transition-all duration-300
            ${!selectedStrategy || isLoading 
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
              : 'bg-neon-green text-black hover:scale-105 shadow-[0_0_20px_rgba(57,255,20,0.4)] hover:shadow-[0_0_40px_rgba(57,255,20,0.6)]'}
          `}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin" />
              <span>ANALIZANDO PARTIDOS...</span>
            </div>
          ) : (
            <span>GENERAR APUESTA CON IA</span>
          )}
        </button>
      </div>

      {/* Result Section */}
      {ticketData && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <BetTicket data={ticketData} />

          {/* AI Justification Message */}
          {aiJustification && (
            <div className="max-w-md mx-auto bg-neon-green/10 border border-neon-green/30 p-4 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2">
              <Bot className="text-neon-green shrink-0 mt-1" size={20} />
              <p className="text-sm text-gray-200 leading-relaxed">
                <span className="font-bold text-neon-green block mb-1">Respuesta de la IA:</span>
                {aiJustification}
              </p>
            </div>
          )}

          {/* Refinement Input */}
          <div className="max-w-md mx-auto">
            <div className="bg-dark-card border border-gray-800 rounded-xl p-4 shadow-lg">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
                <MessageSquare size={16} className="text-neon-green" />
                ¿No te convence? Refuta o consulta a la IA
              </label>
              <form onSubmit={handleRefine} className="flex gap-2">
                <input
                  type="text"
                  value={refinementPrompt}
                  onChange={(e) => setRefinementPrompt(e.target.value)}
                  placeholder="Ej: El Madrid tiene muchas bajas, cámbialo..."
                  className="flex-1 bg-dark-input border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-green transition-colors"
                  disabled={isRefining}
                />
                <button 
                  type="submit"
                  disabled={!refinementPrompt.trim() || isRefining}
                  className="bg-neon-green text-black p-2 rounded-lg hover:bg-neon-green/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRefining ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketGenerator;