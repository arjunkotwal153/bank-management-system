import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function CashFlowChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 font-medium">No cash flow data yet.</div>;
  }

  // Reverse data so chronological order flows left-to-right on the chart
  const chartData = data.slice().reverse().map(entry => ({
    date: new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    amount: Number(entry.amount)
  }));

  return (
    <div className="h-64 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc' }}
            itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
          />
          <Area type="monotone" dataKey="amount" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}