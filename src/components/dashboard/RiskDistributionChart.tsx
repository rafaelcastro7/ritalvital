import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Municipio } from '@/types/municipio';
import { RISK_COLORS } from '@/types/municipio';

const ORDER = ['Crítico', 'Alto', 'Medio', 'Bajo'] as const;

const RiskDistributionChart = ({ data }: { data: Municipio[] }) => {
  const chartData = ORDER.map(nivel => ({
    name: nivel,
    value: data.filter(m => m.nivel_riesgo === nivel).length,
  })).filter(d => d.value > 0);

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3 text-foreground">Distribución por nivel de riesgo</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            dataKey="value"
            paddingAngle={3}
            stroke="none"
          >
            {chartData.map(entry => (
              <Cell key={entry.name} fill={RISK_COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(220,18%,14%)', border: '1px solid hsl(220,14%,22%)', borderRadius: 8, fontSize: 13 }}
            itemStyle={{ color: 'hsl(210,20%,92%)' }}
            formatter={(value: number) => [`${value} municipios`, '']}
          />
          <Legend
            formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RiskDistributionChart;
