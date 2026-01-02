import React from 'react';
import { Shield, Hammer, Rocket } from 'lucide-react';

const StrategyCard = ({ type, title, description, icon: Icon, isSelected, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 group
        ${isSelected 
          ? 'bg-neon-green/5 border-neon-green shadow-[0_0_20px_rgba(57,255,20,0.2)]' 
          : 'bg-dark-card border-gray-800 hover:border-gray-600 hover:bg-dark-input'}
      `}
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div className={`
          p-4 rounded-full transition-colors duration-300
          ${isSelected ? 'bg-neon-green text-black' : 'bg-dark-input text-gray-400 group-hover:text-white'}
        `}>
          <Icon size={32} />
        </div>
        
        <div>
          <h3 className={`text-lg font-bold mb-2 ${isSelected ? 'text-neon-green' : 'text-white'}`}>
            {title}
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      
      {isSelected && (
        <div className="absolute top-3 right-3 w-3 h-3 bg-neon-green rounded-full shadow-[0_0_10px_#39ff14]"></div>
      )}
    </div>
  );
};

export default StrategyCard;