'use client';

import React from 'react';
import { useReveal, useCountUp } from '@/hooks/use-reveal';

function StatCounter({ value, suffix, prefix }: { value: number; suffix?: string; prefix?: string }) {
  const { ref, visible } = useReveal<HTMLSpanElement>(0.3);
  const count = useCountUp(value, 1600, visible);
  const formatted = count >= 100000
    ? `${(count / 100000).toFixed(1)}L`
    : count >= 1000
    ? `${(count / 1000).toFixed(0)}K`
    : `${count}`;
  return (
    <span ref={ref}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

const transactions = [
  { name: 'Priya Menon', apt: 'A-204', amount: '₹6,500', type: 'Maintenance Due', status: 'Paid', color: '#16A34A' },
  { name: 'Arjun Nair', apt: 'B-108', amount: '₹4,200', type: 'Water Bill', status: 'Paid', color: '#16A34A' },
  { name: 'Sunita Rao', apt: 'C-312', amount: '₹6,500', type: 'Maintenance Due', status: 'Overdue', color: '#DC2626' },
  { name: 'Deepak Verma', apt: 'A-506', amount: '₹3,800', type: 'Parking', status: 'Pending', color: '#D97706' },
];

export default function PaymentsFinance() {
  const { ref, visible } = useReveal();

  return (
    <section ref={ref} className="py-14 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className={`text-center mb-8 reveal ${visible ? 'visible' : ''}`}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-3.5 text-xs font-bold tracking-widest uppercase bg-[#F0FDFA] text-[#0D9488] border border-[#99F6E4]">
            Payments &amp; Finance
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-tight text-slate-950 mb-3" style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}>
            Clear finances. Better decisions.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Automated maintenance billing, zero-reconciliation errors, and instant UPI receipts direct to residents.
          </p>
        </div>

        <div className={`reveal ${visible ? 'visible' : ''} grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8`}>
          {/* Summary cards */}
          <div className="rounded-2xl p-6 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
            <div className="text-xs font-bold uppercase tracking-wider mb-2 text-blue-700 font-mono">Collected</div>
            <div className="text-4xl font-extrabold leading-none text-slate-900 font-mono">
              ₹<StatCounter value={1840000} />
            </div>
            <div className="text-xs text-slate-500 mt-2">This month</div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5"><path d="M8 3v10M3 8l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              +12% vs last month
            </div>
          </div>

          <div className="rounded-2xl p-6 bg-amber-50 border border-amber-200">
            <div className="text-xs font-bold uppercase tracking-wider mb-2 text-amber-700 font-mono">Outstanding</div>
            <div className="text-4xl font-extrabold leading-none text-slate-900 font-mono">
              ₹<StatCounter value={210000} />
            </div>
            <div className="text-xs text-slate-500 mt-2">Pending collection</div>
            <div className="mt-3 text-xs font-semibold text-amber-800">18 residents pending</div>
          </div>

          <div className="rounded-2xl p-6 bg-rose-50 border border-rose-200">
            <div className="text-xs font-bold uppercase tracking-wider mb-2 text-red-700 font-mono">Overdue</div>
            <div className="text-4xl font-extrabold leading-none text-slate-900 font-mono">
              ₹<StatCounter value={48000} />
            </div>
            <div className="text-xs text-slate-500 mt-2">Beyond due date</div>
            <div className="mt-3 text-xs font-semibold text-red-700">4 residents — reminders sent</div>
          </div>
        </div>

        <div className={`reveal reveal-delay-2 ${visible ? 'visible' : ''} grid grid-cols-1 lg:grid-cols-3 gap-5`}>
          {/* Collection trend */}
          <div className="lg:col-span-2 rounded-2xl p-6 bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-slate-900">Collection Trend</div>
              <div className="text-xs text-slate-400 font-mono">Last 6 months</div>
            </div>
            <div className="flex items-end gap-3 h-28">
              {[
                { label: 'Mar', pct: 78 },
                { label: 'Apr', pct: 82 },
                { label: 'May', pct: 76 },
                { label: 'Jun', pct: 88 },
                { label: 'Jul', pct: 91 },
                { label: 'Aug', pct: 96 },
              ].map((d) => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-slate-500 font-mono mb-1">{d.pct}%</div>
                  <div
                    className="w-full rounded-t-md"
                    style={{
                      height: `${d.pct}px`,
                      background: d.label === 'Aug' ? 'linear-gradient(180deg, #3B82F6, #1D4ED8)' : 'linear-gradient(180deg, #93C5FD, #BFDBFE)',
                    }}
                  />
                  <div className="text-[10px] text-slate-500 font-medium">{d.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent transactions */}
          <div className="rounded-2xl p-6 bg-slate-50 border border-slate-200">
            <div className="text-sm font-bold text-slate-900 mb-3">Recent Transactions</div>
            <div className="space-y-2.5">
              {transactions.map((tx) => (
                <div key={tx.name + tx.apt} className="flex items-center justify-between py-2 border-b border-slate-200/80 last:border-0">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{tx.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{tx.apt} • {tx.type}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900 font-mono">{tx.amount}</div>
                    <div className="text-[10px] font-bold" style={{ color: tx.color }}>{tx.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
