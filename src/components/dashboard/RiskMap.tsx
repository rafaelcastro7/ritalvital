import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Municipio } from '@/types/municipio';
import { RISK_COLORS, COORDS } from '@/types/municipio';

interface Props {
  data: Municipio[];
  onSelect: (m: Municipio) => void;
  selected: Municipio | null;
}

const RiskMap = ({ data, onSelect, selected }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const positions = useMemo(
    () => data.map((m) => COORDS[m.cod_municipio]).filter(Boolean) as [number, number][],
    [data],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([5.7, -76.7], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;

    if (!map || !layer) return;

    layer.clearLayers();

    data.forEach((municipio) => {
      const position = COORDS[municipio.cod_municipio];
      if (!position) return;

      const color = RISK_COLORS[municipio.nivel_riesgo] || '#888';
      const isSelected = selected?.cod_municipio === municipio.cod_municipio;

      const marker = L.circleMarker(position, {
        radius: isSelected ? 14 : 10,
        color: isSelected ? '#ffffff' : color,
        weight: isSelected ? 3 : 2,
        fillColor: color,
        fillOpacity: 0.85,
        dashArray: municipio.sin_eventos_reportados ? '5 5' : undefined,
      });

      marker.bindTooltip(
        `<div><strong>${municipio.municipio}</strong><br/>IRCA: ${(municipio.iraa_score * 100).toFixed(1)} — ${municipio.nivel_riesgo}</div>`,
        {
          direction: 'top',
          offset: [0, -10],
        },
      );

      marker.on('click', () => onSelect(municipio));
      marker.addTo(layer);
    });
  }, [data, onSelect, selected]);

  useEffect(() => {
    if (!mapRef.current || positions.length === 0) return;
    mapRef.current.fitBounds(positions, { padding: [30, 30] });
  }, [positions]);

  return <div ref={containerRef} className="h-full w-full rounded-lg" style={{ minHeight: 400 }} />;
};

export default RiskMap;
