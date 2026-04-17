export interface Municipio {
  cod_municipio: number;
  municipio: string;
  depto: string;
  cod_depto: string;          // 2 dígitos DIVIPOLA
  poblacion: number;
  poblacion_imputada: boolean;
  camas_totales: number;
  camas_por_1000_hab: number;
  total_eventos: number;
  severidad_vial: number;
  expuestos: boolean;
  sin_eventos_reportados: boolean;
  pctl_vuln_salud: number;
  pctl_exposicion: number;
  pctl_severidad: number;
  iraa_score: number;
  nivel_riesgo: 'Bajo' | 'Medio' | 'Alto' | 'Crítico';
  estado_confianza: string;
  recomendacion: string;
  lat?: number;
  lng?: number;
}

export const RISK_LEVELS = ['Crítico', 'Alto', 'Medio', 'Bajo'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/* Tokens semánticos en HSL — coincidir con index.css --risk-* */
export const RISK_COLORS: Record<RiskLevel, string> = {
  'Crítico': 'hsl(4, 68%, 46%)',
  'Alto':    'hsl(24, 80%, 52%)',
  'Medio':   'hsl(37, 90%, 57%)',
  'Bajo':    'hsl(145, 63%, 55%)',
};

/* Subset de coordenadas de Chocó para fallback si DIVIPOLA no trae lat/lng */
export const COORDS: Record<number, [number, number]> = {
  27001: [5.694, -76.659], 27006: [8.514, -77.011], 27025: [6.044, -76.953],
  27050: [5.750, -76.543], 27073: [5.560, -76.393], 27075: [6.221, -77.395],
  27077: [5.256, -77.049], 27086: [7.218, -76.828], 27099: [5.498, -76.701],
  27135: [5.021, -76.809], 27150: [7.384, -77.209], 27160: [5.356, -76.432],
  27205: [5.099, -76.647], 27245: [5.916, -76.155], 27250: [4.738, -77.059],
  27361: [5.168, -76.698], 27372: [7.105, -77.766], 27413: [5.556, -76.531],
  27425: [5.844, -76.723], 27430: [5.424, -76.989], 27450: [4.906, -76.757],
  27491: [4.950, -76.607], 27495: [5.705, -77.277], 27580: [4.980, -76.528],
  27600: [5.388, -76.618], 27615: [7.444, -77.117], 27660: [5.038, -76.279],
  27745: [4.660, -76.625], 27787: [5.271, -76.567], 27800: [8.043, -76.936],
  27810: [5.074, -76.550],
};
