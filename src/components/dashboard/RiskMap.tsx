import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Municipio } from '@/types/municipio';
import { RISK_COLORS, COORDS } from '@/types/municipio';

interface Props {
  data: Municipio[];      // datos filtrados
  onSelect: (m: Municipio) => void;
  selected: Municipio | null;
}

// Aproximación de centroides departamentales — fallback si municipio no tiene lat/lng
const DEPTO_CENTROIDS: Record<string, [number, number]> = {
  '05': [6.8, -75.7], '08': [10.7, -74.9], '11': [4.65, -74.1], '13': [9.0, -74.4],
  '15': [5.6, -73.0], '17': [5.3, -75.5], '18': [1.6, -74.8], '19': [2.5, -76.8],
  '20': [9.5, -73.5], '23': [8.6, -75.7], '25': [4.9, -74.2], '27': [5.7, -76.7],
  '41': [2.6, -75.6], '44': [11.5, -72.5], '47': [10.4, -74.4], '50': [3.4, -73.0],
  '52': [1.5, -77.5], '54': [7.9, -72.8], '63': [4.6, -75.7], '66': [5.0, -75.9],
  '68': [6.6, -73.1], '70': [9.0, -75.3], '73': [4.0, -75.2], '76': [3.8, -76.6],
  '81': [6.5, -71.0], '85': [5.3, -71.3], '86': [0.5, -76.5], '88': [12.6, -81.7],
  '91': [-1.2, -71.5], '94': [2.9, -68.5], '95': [2.5, -72.6], '97': [0.8, -70.5], '99': [4.7, -69.8],
};

const RiskMap = ({ data, onSelect, selected }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const lastFitKey = useRef<string>('');

  /** Calcula coordenada efectiva de cada municipio: lat/lng → COORDS Chocó → centroide depto */
  const positions = useMemo(() => {
    return data.map(m => {
      if (m.lat && m.lng) return [m.lat, m.lng] as [number, number];
      if (COORDS[m.cod_municipio]) return COORDS[m.cod_municipio];
      const c = DEPTO_CENTROIDS[m.cod_depto];
      if (c) {
        // jitter pequeño dentro del depto para evitar superposición exacta
        const jitter = (m.cod_municipio % 100) / 1000;
        return [c[0] + (jitter - 0.05), c[1] + (jitter - 0.05)] as [number, number];
      }
      return null;
    });
  }, [data]);

  // Init mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    }).setView([4.5, -74.0], 6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      layerRef.current?.clearLayers();
      layerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // Radio según población (escalado log)
    const popRadius = (p: number) => {
      if (p <= 0) return 4;
      const r = Math.log10(p) * 1.6;
      return Math.max(4, Math.min(14, r));
    };

    data.forEach((m, i) => {
      const pos = positions[i];
      if (!pos) return;
      const color = RISK_COLORS[m.nivel_riesgo] || '#888';
      const isSelected = selected?.cod_municipio === m.cod_municipio;
      const baseR = popRadius(m.poblacion);

      const marker = L.circleMarker(pos, {
        radius: isSelected ? baseR + 4 : baseR,
        color: isSelected ? '#ffffff' : color,
        weight: isSelected ? 3 : 1.5,
        fillColor: color,
        fillOpacity: 0.78,
        dashArray: m.sin_eventos_reportados ? '4 3' : undefined,
      });

      marker.bindTooltip(
        `<div style="line-height:1.3">
          <strong>${m.municipio}</strong>
          <br/><span style="opacity:.7">${m.depto}</span>
          <br/>IRCA: ${(m.iraa_score * 100).toFixed(1)} — <strong style="color:${color}">${m.nivel_riesgo}</strong>
          <br/><span style="opacity:.7">Pob: ${m.poblacion.toLocaleString('es-CO')}</span>
        </div>`,
        { direction: 'top', offset: [0, -baseR] },
      );

      marker.on('click', () => onSelect(m));
      marker.addTo(layer);
    });
  }, [data, positions, onSelect, selected]);

  // Fit bounds cuando cambia el conjunto (no en cada selección)
  useEffect(() => {
    if (!mapRef.current) return;
    const valid = positions.filter((p): p is [number, number] => p !== null);
    if (valid.length === 0) return;

    const key = `${valid.length}|${valid[0][0]}|${valid[valid.length - 1][0]}`;
    if (key === lastFitKey.current) return;
    lastFitKey.current = key;

    if (valid.length === 1) {
      mapRef.current.setView(valid[0], 9);
    } else {
      mapRef.current.fitBounds(valid, { padding: [40, 40], maxZoom: 9 });
    }
  }, [positions]);

  return <div ref={containerRef} className="h-full w-full" style={{ minHeight: 400 }} />;
};

export default RiskMap;
