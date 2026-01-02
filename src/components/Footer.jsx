import React from 'react';
import { Twitter, Instagram, Mail, ShieldAlert } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative mt-20 border-t border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-b from-white/50 to-brand-50/30 dark:from-slate-950/50 dark:to-slate-900/50 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand & Description */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="NJBET Logo" className="w-8 h-8 object-contain grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all" />
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                NJ<span className="text-brand-500">BET</span>
              </h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-sm">
              Plataforma de análisis deportivo impulsada por Inteligencia Artificial. 
              Nuestros algoritmos procesan miles de datos para ofrecerte las mejores probabilidades del mercado.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-slate-800 dark:text-white font-bold mb-4">Enlaces Rápidos</h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><a href="#" className="hover:text-brand-500 transition-colors">Inicio</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">Historial</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">Metodología</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">Términos de Uso</a></li>
            </ul>
          </div>

          {/* Contact & Social */}
          <div>
            <h4 className="text-slate-800 dark:text-white font-bold mb-4">Síguenos</h4>
            <div className="flex gap-4 mb-4">
              <a href="#" className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                <Twitter size={20} />
              </a>
              <a href="#" className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                <Instagram size={20} />
              </a>
              <a href="#" className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                <Mail size={20} />
              </a>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Contacto: soporte@njbet.com
            </p>
          </div>
        </div>

        {/* Responsible Gambling Warning */}
        <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-8 flex items-start gap-3">
          <ShieldAlert className="text-yellow-500 shrink-0 mt-0.5" size={20} />
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <strong className="text-slate-700 dark:text-slate-300 block mb-1">Juego Responsable</strong>
            El juego puede ser adictivo. Juega con responsabilidad y solo con dinero que puedas permitirte perder. 
            Esta plataforma es solo para fines informativos y de entretenimiento. Prohibido para menores de 18 años.
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
          <p>© {currentYear} NJBET AI Analytics. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-brand-500 transition-colors">Política de Privacidad</a>
            <a href="#" className="hover:text-brand-500 transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
