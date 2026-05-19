'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const SENTIMENT_COLORS = { positive: '#22c55e', neutral: '#9ba6c0', negative: '#ef4444' };

export function SentimentTrendChart({ data }: { data: Array<{ date: string; positive: number; neutral: number; negative: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="pos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="neu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9ba6c0" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#9ba6c0" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="neg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#222b42" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#9ba6c0', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: '#9ba6c0', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: '#0c1020', border: '1px solid #222b42', borderRadius: 8 }} />
        <Area type="monotone" dataKey="positive" stroke={SENTIMENT_COLORS.positive} fill="url(#pos)" />
        <Area type="monotone" dataKey="neutral" stroke={SENTIMENT_COLORS.neutral} fill="url(#neu)" />
        <Area type="monotone" dataKey="negative" stroke={SENTIMENT_COLORS.negative} fill="url(#neg)" />
        <Legend wrapperStyle={{ color: '#9ba6c0', fontSize: 11 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MentionTrendChart({ data }: { data: Array<{ date: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid stroke="#222b42" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#9ba6c0', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: '#9ba6c0', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: '#0c1020', border: '1px solid #222b42', borderRadius: 8 }} />
        <Line type="monotone" dataKey="count" stroke="#34c2ff" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SourceBarChart({ data }: { data: Array<{ source: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 24)}>
      <BarChart layout="vertical" data={data} margin={{ left: 10, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid stroke="#222b42" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#9ba6c0', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="source" tick={{ fill: '#9ba6c0', fontSize: 11 }} width={120} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: '#0c1020', border: '1px solid #222b42', borderRadius: 8 }} />
        <Bar dataKey="count" fill="#34c2ff" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SentimentPie({ pos, neu, neg }: { pos: number; neu: number; neg: number }) {
  const data = [
    { name: 'Positive', value: pos, color: '#22c55e' },
    { name: 'Neutral', value: neu, color: '#9ba6c0' },
    { name: 'Negative', value: neg, color: '#ef4444' },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: '#0c1020', border: '1px solid #222b42', borderRadius: 8 }} />
        <Legend wrapperStyle={{ color: '#9ba6c0', fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
