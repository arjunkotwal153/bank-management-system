import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface BudgetChartProps {
  data: any[];
}

export default function BudgetChart({ data }: BudgetChartProps) {
  // 1. Filter out only outgoing transactions (debits)
  const outgoing = data.filter((entry) => Number(entry.amount) < 0);

  // 2. Group by category and sum amounts
  const categoryTotals: Record<string, number> = {};
  
  outgoing.forEach((entry) => {
    // Determine category or fallback to 'General'
    const category = entry.transactions?.category || 'General';
    const amount = Math.abs(Number(entry.amount));
    
    if (categoryTotals[category]) {
      categoryTotals[category] += amount;
    } else {
      categoryTotals[category] = amount;
    }
  });

  // 3. Convert to array for Recharts
  const chartData = Object.keys(categoryTotals).map((key) => ({
    name: key,
    value: categoryTotals[key],
  })).sort((a, b) => b.value - a.value);

  // 4. Define colors for categories
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#0ea5e9', '#64748b'];

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500">
        No spending data yet.
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl">
          <p className="font-semibold text-white mb-1">{payload[0].name}</p>
          <p className="text-indigo-400 font-mono">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {chartData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            formatter={(value, _entry, _index) => (
              <span className="text-slate-300 text-sm ml-1">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
