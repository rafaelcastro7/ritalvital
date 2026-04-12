import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Municipio } from '@/types/municipio';
import { RISK_COLORS, COORDS } from '@/types/municipio';

interface Props {
  data: Municipio[];
  onSelect: (m: Municipio) => void;
  selected: Municipio | null;
}

const FitBounds = ({ data }: { data: Municipio[] }) => {
  const map = useMap();
  useEffect(() => {
    const pts = data.map(m => COORDS[m.cod_municipio]).filter(Boolean) as [number, number][];
    if (pts.length) {
      map.fitBounds(pts, { padding: [30, 30] });
    }
  }, [data, map]);
  return null;
};

const RiskMap = ({ data, onSelect, selected }: Props) => (
  <MapContainer
    center={[5.7, -76.7]}
    zoom={7}
    className="h-full w-full rounded-lg"
    style={{ minHeight: 400, background: 'hsl(220,20%,10%)' }}
  >
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    />
    <FitBounds data={data} />
    {data.map(m => {
      const pos = COORDS[m.cod_municipio];
      if (!pos) return null;
      const color = RISK_COLORS[m.nivel_riesgo] || '#888';
      const isSelected = selected?.cod_municipio === m.cod_municipio;
      return (
        <CircleMarker
          key={m.cod_municipio}
          center={pos}
          radius={isSelected ? 14 : 10}
          pathOptions={{
            fillColor: color,
            fillOpacity: 0.85,
            color: isSelected ? '#fff' : color,
            weight: isSelected ? 3 : 2,
            dashArray: m.sin_eventos_reportados ? '5 5' : undefined,
          }}
          eventHandlers={{ click: () => onSelect(m) }}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            <span className="font-semibold">{m.municipio}</span>
            <br />
            IRCA: {(m.iraa_score * 100).toFixed(1)} — {m.nivel_riesgo}
          </Tooltip>
        </CircleMarker>
      );
    })}
  </MapContainer>
);

export default RiskMap;
