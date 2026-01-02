import React from 'react';
import { Ticket, ExternalLink, CheckCircle2 } from 'lucide-react';

const BetTicket = ({ data }) => {
  if (!data) return null;

  return (
    <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-dark-card rounded-2xl overflow-hidden border border-neon-green/30 shadow-[0_0_30px_rgba(57,255,20,0.15)]">
        {/* Ticket Header */}
        <div className="bg-gradient-to-r from-neon-green/20 to-transparent p-4 border-b border-neon-green/20 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Ticket className="text-neon-green" size={20} />
            <span className="font-bold text-white tracking-wide">TICKET GENERADO</span>
          </div>
          <span className="text-xs font-mono text-neon-green bg-neon-green/10 px-2 py-1 rounded border border-neon-green/30">
            #{Math.random().toString(36).substr(2, 9).toUpperCase()}
          </span>
        </div>

        {/* Ticket Content */}
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            {data.matches.map((match, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-dark-input rounded-lg border border-gray-800">
                <div className="flex flex-col">
                  <span className="font-bold text-white">{match.teams}</span>
                  <span className="text-xs text-gray-400">{match.league} • {match.time}</span>
                </div>
                <div className="text-right">
                  <div className="text-neon-green font-bold">{match.prediction}</div>
                  <div className="text-xs text-gray-500">Cuota: {match.odds}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-gray-800 flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Cuota Total</span>
              <span className="text-3xl font-bold text-white neon-text">{data.totalOdds}</span>
            </div>
            
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Stake</span>
              <div className="flex items-center gap-1">
                <span className="text-xl font-bold text-white">{data.stake || 5}</span>
                <span className="text-xs text-gray-500">/10</span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Probabilidad</span>
              <div className="flex items-center gap-1 text-neon-green">
                <CheckCircle2 size={16} />
                <span className="font-bold">{data.probability}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 bg-dark-input border-t border-gray-800">
          <button className="w-full py-3 bg-neon-green hover:bg-neon-green/90 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 group">
            <span>APOSTAR EN BET365</span>
            <ExternalLink size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BetTicket;