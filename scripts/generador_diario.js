import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import axios from 'axios';

// Cargar variables de entorno
dotenv.config();

// Configuración
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GROQ_API_KEY || !ODDS_API_KEY) {
  console.error('❌ Faltan variables de entorno críticas.');
  process.exit(1);
}

// Inicializar clientes
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const groq = new Groq({ apiKey: GROQ_API_KEY });

/**
 * Función Helper: Investigar partido con Tavily
 */
async function investigarPartido(partido) {
  if (!TAVILY_API_KEY) return "Sin investigación (Falta API Key)";
  
  try {
    console.log(`   🕵️ Investigando: ${partido}...`);
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: TAVILY_API_KEY,
      query: `${partido} team news injuries lineups weather betting preview today`,
      search_depth: "basic",
      include_answer: true,
      max_results: 2
    });
    
    // Priorizamos la respuesta directa de la IA de Tavily, si no, tomamos snippets
    const info = response.data.answer || response.data.results.map(r => r.content).join('. ');
    return info.slice(0, 600); // Limitamos caracteres para no saturar el prompt
  } catch (error) {
    console.warn(`   ⚠️ Error investigando ${partido}:`, error.message);
    return "Información no disponible por error de conexión.";
  }
}

// Ligas VIP y sus prioridades (Tal cual tu n8n)
const LIGAS_VIP = [
  { key: 'soccer_uefa_champs_league', priority: 100, label: 'Champions League' },
  { key: 'soccer_epl', priority: 90, label: 'Premier League' },
  { key: 'soccer_spain_la_liga', priority: 85, label: 'La Liga' },
  { key: 'soccer_italy_serie_a', priority: 85, label: 'Serie A' },
  { key: 'soccer_germany_bundesliga', priority: 85, label: 'Bundesliga' },
  { key: 'basketball_nba', priority: 80, label: 'NBA' }
];

/**
 * Paso 1: Obtener Partidos de The Odds API (Bucle por ligas)
 */
async function obtenerPartidosVIP() {
  console.log('🔍 Escaneando mercados VIP...');
  let todosLosPartidos = [];

  for (const liga of LIGAS_VIP) {
    try {
      console.log(`   Checking ${liga.label}...`);
      const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${liga.key}/odds`, {
        params: {
          apiKey: ODDS_API_KEY,
          regions: 'us,eu', // Prioridad Europa y US
          markets: 'h2h,spreads,totals', // TRAEMOS MERCADOS: Ganador, Hándicap, Goles
          oddsFormat: 'decimal'
        }
      });
      
      // Añadir metadata de prioridad para el filtrado posterior
      const partidosConScore = response.data.map(p => ({
        ...p,
        internal_score: liga.priority,
        liga_label: liga.label
      }));
      
      todosLosPartidos = [...todosLosPartidos, ...partidosConScore];
      
    } catch (error) {
      console.warn(`⚠️ Error consultando ${liga.label}:`, error.message);
    }
  }
  
  return todosLosPartidos;
}

/**
 * Paso 2: Cerebro de Filtrado y Limpieza (Tu lógica de n8n)
 */
function filtrarYLimpiarPartidos(rawGames) {
  console.log(`🧹 Limpiando ${rawGames.length} partidos crudos...`);
  
  const now = new Date();
  // Límite jornada: 20 horas desde ahora (cubre NBA late night)
  const limiteJornada = new Date(now.getTime() + (20 * 60 * 60 * 1000));

  // 1. Filtrado por Tiempo (Solo HOY y PRONTO)
  let validGames = rawGames.filter(g => {
    const gameDate = new Date(g.commence_time);
    return gameDate > now && gameDate < limiteJornada;
  });

  // 2. Ordenar por Importancia (Score) y luego por Hora
  validGames.sort((a, b) => {
    if (b.internal_score !== a.internal_score) return b.internal_score - a.internal_score; // Primero Champions
    return new Date(a.commence_time) - new Date(b.commence_time); // Luego los más tempranos
  });

  // 3. Top 15 (Para no saturar tokens)
  const topGames = validGames.slice(0, 10); // Reducimos a 10 para dar espacio a la investigación

  // 4. Limpieza Extrema (Formato Minificado para la IA)
  // Solo mandamos lo esencial: Quién, Cuándo, Cuánto paga.
  const partidosLimpios = topGames.map(g => {
    // MEJORA: Buscar el bookmaker con más mercados disponibles, no solo el primero
    const bookmaker = g.bookmakers?.reduce((prev, current) => {
      return (current.markets?.length || 0) > (prev?.markets?.length || 0) ? current : prev;
    }, g.bookmakers?.[0]) || null;
    
    // Helper para extraer cuotas
    const getOdds = (key) => {
      const m = bookmaker?.markets?.find(m => m.key === key);
      if (!m || !m.outcomes) return '';
      return m.outcomes.map(o => {
        const label = o.point ? `${o.name} ${o.point}` : o.name;
        return `${label}(${o.price})`;
      }).join(' | ');
    };

    const h2h = getOdds('h2h');
    const spreads = getOdds('spreads');
    const totals = getOdds('totals');

    const cuotasStr = `Ganador: [${h2h}] || Hándicap: [${spreads}] || Goles: [${totals}]`;

    return {
      id_externo: g.id, // Guardamos ID de Odds API para actualizaciones futuras
      liga: g.liga_label,
      partido: `${g.home_team} vs ${g.away_team}`,
      hora: g.commence_time,
      cuotas: cuotasStr
    };
  });

  return partidosLimpios;
}

/**
 * Paso 2.5: Enriquecer con Investigación (Tavily)
 */
async function enriquecerPartidos(partidos) {
  console.log(`\n🕵️ Iniciando investigación profunda para ${partidos.length} partidos...`);
  
  // Procesamos en serie para no saturar rate limits
  for (let i = 0; i < partidos.length; i++) {
    partidos[i].contexto = await investigarPartido(partidos[i].partido);
  }
  
  return partidos;
}

/**
 * Paso 3: Generar Pronósticos con IA (Tu Prompt Maestro)
 */
async function generarPronosticos(partidosLimpios) {
  console.log('🧠 Consultando al Sindicato (Groq Llama 3)...');

  // Convertimos la lista a un string muy compacto para ahorrar tokens
  const partidosTexto = JSON.stringify(partidosLimpios, null, 2);

  const prompt = `
    Actúa como el DIRECTOR DE UN SINDICATO DE APUESTAS PROFESIONAL.
    Tu reputación depende de la CONSISTENCIA y la LÓGICA.

    ────────────────────────
    DATOS EN TIEMPO REAL (YA INVESTIGADOS)
    ────────────────────────
    ${partidosTexto}

    ────────────────────────
    REGLAS DE ORO (VIOLARLAS = DESPIDO)
    ────────────────────────
    1. CONSISTENCIA TOTAL: Define tu postura para cada partido. Si crees que el Milan gana, TODOS los tickets deben reflejarlo (ej: Ticket Seguro: Milan DNB / Ticket Arriesgado: Milan -1.5). JAMÁS apuestes al rival en otro ticket.
    2. USO DE CONTEXTO: Si el campo 'contexto' menciona una baja clave o clima adverso, DEBES mencionarlo en el análisis.
    3. NO PERSEGUIR CUOTAS: No apuestes a un "Underdog" solo porque paga mucho. Si no hay argumentos deportivos, NO LO TOQUES.

    ────────────────────────
    ESTRATEGIA DE LOS 3 TICKETS
    ────────────────────────
    
    A) TICKET "SEGURA" (El Banquero)
    - Objetivo: Proteger el capital.
    - Estrategia: 2 selecciones (máximo 3) de MUY ALTA probabilidad.
    - RESTRICCIÓN DE CUOTA: Las cuotas INDIVIDUALES deben ser bajas (entre 1.20 y 1.45). NO incluyas selecciones de 1.80 aquí.
    - Cuota Total Real: La multiplicación de las cuotas debe dar entre 1.60 y 2.10.
    - Mercados: Doble Oportunidad, Hándicap Asiático +0.5, Más de 1.5 Goles o eo mercado de valor detectado.
    - Stake Recomendado: 8-10 (Confianza Máxima).

    B) TICKET "VALOR" (Inteligente)
    - Objetivo: Rentabilidad a largo plazo (+EV).
    - Estrategia: 2-4 selecciones donde el mercado subestima al favorito.
    - RESTRICCIÓN DE CUOTA: Busca cuotas individuales entre 1.50 y 2.10.
    - Cuota Total Real: La multiplicación de las cuotas debe dar entre 2.50 y 4.50.
    - Mercados: Ganador Directo, Ambos Marcan, Hándicap -0.75, o mercado de valor detectado.
    - Stake Recomendado: 4-7 (Confianza Media).
    
    C) TICKET "ARRIESGADA" (La Escalera)
    - Objetivo: Cuota Alta (+6.00) con LÓGICA.
    - ESTRATEGIA: En lugar de buscar pocas cuotas muy altas (riesgosas), construye la cuota total combinando 4 a 6 selecciones de probabilidad media/alta.
    - INSTRUCCIÓN: Selecciona entre 3 y 5 partidos DIFERENTES. Prioriza la probabilidad sobre la cuota individual alta. La suma de muchas cuotas medias (1.40 - 1.70) es mejor que pocas cuotas imposibles.
    - REGLA TÉCNICA CRÍTICA: Las casas de apuestas NO permiten combinar múltiples apuestas del MISMO partido en un parlay estándar.
    - IDIOMA: Usa español claro. "Más de 2.5 Goles en caso de football o puntos en caso de basket" (No Over), "Ambos Marcan" (No BTTS).
    - Mercados: Doble Oportunidad, Hándicap Asiático +0.5, Más de 1.5 Goles, o cualquier mercado con alta probabilidad.
    - Stake Recomendado: 1-3 (Confianza Baja - High Reward).

    ────────────────────────
    FORMATO JSON DE SALIDA (ARRAY PURO)
    ────────────────────────
    IMPORTANTE: Usa EXACTAMENTE las categorías: "Segura", "Valor", "Arriesgada".
    NO escribas texto introductorio. SOLO devuelve el Array JSON.

    [
      {
        "categoria": "Segura",
        "cuota_total": 1.85,
        "stake": 9,
        "analisis": "Análisis detallado aquí del porque de las selecciones son seguras...",
        "partidos": [
          { 
            "equipoLocal": "Nombre", 
            "equipoVisitante": "Nombre", 
            "liga": "Liga",
            "hora": "ISO String",
            "seleccion": "Milan o Empate", 
            "cuota": 1.25,
            "id_externo": "ID",
            "resultado": "pending"
          }
        ]
      }
    ]
  `;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2, // Baja temperatura para análisis riguroso
    max_tokens: 3000
  });

  const contenido = completion.choices[0]?.message?.content;
  
  console.log('\n🤖 --- RESPUESTA DEL SINDICATO ---');
  console.log(contenido);
  console.log('-----------------------------------\n');

  // Intentar extraer el JSON de forma robusta
  let jsonString = contenido;
  
  // 1. Buscar bloque de código markdown
  const codeBlockMatch = contenido.match(/```json([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1];
  } else {
    // 2. Si no hay bloque, buscar el array JSON puro
    const firstBracket = contenido.indexOf('[');
    const lastBracket = contenido.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      jsonString = contenido.substring(firstBracket, lastBracket + 1);
    }
  }
  
  jsonString = jsonString.trim();
  
  try {
    const jsonFinal = JSON.parse(jsonString);
    
    // RECALCULO MATEMÁTICO DE CUOTAS (Corrección de alucinaciones de la IA)
    if (Array.isArray(jsonFinal)) {
      jsonFinal.forEach(ticket => {
        if (ticket.partidos && Array.isArray(ticket.partidos)) {
          // Multiplicamos todas las cuotas individuales
          const realTotal = ticket.partidos.reduce((acc, p) => acc * (parseFloat(p.cuota) || 1), 1);
          // Ajustamos a 2 decimales
          ticket.cuota_total = parseFloat(realTotal.toFixed(2));
          console.log(`   🧮 Recalculado Ticket ${ticket.categoria}: ${realTotal.toFixed(2)}`);
        }
      });
    }

    console.log('✅ JSON Parseado y Recalculado correctamente. Estructura válida.');
    return jsonFinal;
  } catch (e) {
    console.error('Error parseando respuesta IA:', e);
    return [];
  }
}

/**
 * Paso 4: Guardar en Supabase (Relacional)
 */
async function guardarTickets(tickets) {
  console.log(`💾 Guardando ${tickets.length} tickets...`);
  const fechaHoy = new Date().toISOString().split('T')[0];

  // Helper para stake por defecto si la IA falla
  const getStakeDefault = (cat) => {
    switch(cat?.toLowerCase()) {
      case 'segura': return 9;
      case 'valor': return 6;
      case 'arriesgada': return 2;
      default: return 5;
    }
  };

  for (const ticket of tickets) {
    // 1. Crear Ticket
    const { data: ticketData, error: tError } = await supabase
      .from('tickets')
      .insert({
        fecha: fechaHoy,
        categoria: ticket.categoria,
        cuota_total: ticket.cuota_total,
        analisis: ticket.analisis,
        stake: ticket.stake || getStakeDefault(ticket.categoria), // Fallback inteligente
        estado: 'pending' // Antes 'status'
      })
      .select()
      .single();

    if (tError) {
      console.error('Error ticket:', tError);
      continue;
    }

    // 2. Crear Partidos
    const partidosData = ticket.partidos.map(p => ({
      ticket_id: ticketData.id,
      id_externo: p.id_externo, // Antes 'external_id'
      deporte: p.liga,
      partido: `${p.equipoLocal} vs ${p.equipoVisitante}`, // Combinamos nombres
      hora: p.hora, // Antes 'hora_inicio'
      seleccion: p.seleccion,
      cuota: p.cuota,
      estado: 'pending'
    }));

    const { error: pError } = await supabase.from('partidos').insert(partidosData);
    if (pError) console.error('Error partidos:', pError);
    else console.log(`✅ Ticket ${ticket.categoria} guardado con éxito (ID: ${ticketData.id}).`);
  }
}

async function main() {
  try {
    // 1. Obtener
    const rawGames = await obtenerPartidosVIP();
    
    // 2. Filtrar
    const cleanGames = filtrarYLimpiarPartidos(rawGames);
    
    if (cleanGames.length === 0) {
      console.log('😴 No hay partidos interesantes hoy.');
      return;
    }

    // 2.5 Enriquecer con Investigación
    const gamesWithContext = await enriquecerPartidos(cleanGames);

    // 3. Analizar
    const tickets = await generarPronosticos(gamesWithContext);

    // 4. Guardar
    if (tickets.length > 0) await guardarTickets(tickets);
    
    console.log('🏁 Fin del proceso.');

  } catch (error) {
    console.error('Fatal:', error);
  }
}

main();