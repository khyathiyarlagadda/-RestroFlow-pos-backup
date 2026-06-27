import React, { useState, useEffect, useMemo } from 'react';
import { Play, CheckCircle2, ChevronRight, Clock } from 'lucide-react';
import { storage } from '../utils/storage';
import type { KOT, KOTStatus, OrderType } from '../types';


export const KOTScreen: React.FC = () => {
  const [kots, setKots] = useState<KOT[]>([]);
  const [filterType, setFilterType] = useState<'All' | OrderType>('All');
  const [tick, setTick] = useState(0); // forced re-render trigger for time calculations

  // Load KOTs
  const loadKOTs = () => {
    setKots(storage.getKOTs());
  };

  useEffect(() => {
    loadKOTs();

    // Set interval for updating timers (every 15 seconds)
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);

    // Sync in real-time across tabs using custom window event
    const handleKotUpdate = () => {
      loadKOTs();
    };
    window.addEventListener('kotUpdated', handleKotUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('kotUpdated', handleKotUpdate);
    };
  }, []);

  // Filtered KOTs
  const filteredKOTs = useMemo(() => {
    return kots.filter((kot) => {
      if (filterType === 'All') return true;
      return kot.orderType === filterType;
    });
  }, [kots, filterType]);

  // Elapsed time utility
  const getElapsedTime = (isoString: string) => {
    const createdTime = new Date(isoString).getTime();
    const elapsedMs = Date.now() - createdTime;
    const elapsedMins = Math.floor(elapsedMs / 60000);
    
    if (elapsedMins < 1) return 'Just now';
    return `${elapsedMins} min ago`;
  };

  // Status transitions
  const handleTransition = (kotId: string, currentStatus: KOTStatus) => {
    let nextStatus: KOTStatus | null = null;
    if (currentStatus === 'Pending') nextStatus = 'Preparing';
    else if (currentStatus === 'Preparing') nextStatus = 'Ready';
    else if (currentStatus === 'Ready') nextStatus = 'Served';

    if (nextStatus) {
      const updated = kots.map((k) => {
        if (k.id === kotId) {
          return { ...k, status: nextStatus as KOTStatus };
        }
        return k;
      });
      storage.setKOTs(updated);
      setKots(updated);
    }
  };

  // Columns breakdown
  const stages: { status: KOTStatus; title: string; headerBg: string; borderCol: string }[] = [
    { status: 'Pending', title: 'Pending', headerBg: 'bg-[#F59E0B]/10 text-[#B45309]', borderCol: '#F59E0B' },
    { status: 'Preparing', title: 'Preparing', headerBg: 'bg-[#3B82F6]/10 text-[#1D4ED8]', borderCol: '#3B82F6' },
    { status: 'Ready', title: 'Ready', headerBg: 'bg-[#10B981]/10 text-[#047857]', borderCol: '#10B981' },
    { status: 'Served', title: 'Served', headerBg: 'bg-[#6B7280]/10 text-[#374151]', borderCol: '#6B7280' }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-bg-page font-sans text-text-primary transition-all duration-[220ms] ease-in-out select-none">
      <div className="flex-1 flex flex-col h-full overflow-hidden p-8">
        
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h1 className="page-title sentence-case">
              Kitchen Order Tickets (KOT)
            </h1>
            <p className="page-subtitle mt-0.5 sentence-case">
              Monitor active orders sent to the kitchen <span className="hidden" aria-hidden="true">{tick}</span>
            </p>
          </div>


          {/* Filters */}
          <div className="flex items-center gap-1.5 bg-bg-card p-1 border border-border rounded-btn shadow-card">
            {(['All', 'Dine In', 'Takeaway', 'Delivery'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`h-[28px] px-3.5 rounded-btn text-[13px] font-medium transition-all duration-150 ${
                  filterType === type
                    ? 'bg-primary text-white font-medium'
                    : 'text-text-muted hover:bg-bg-page'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* KOT Kanban Columns */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 overflow-hidden h-full pb-2">
          {stages.map((stage) => {
            const stageKOTs = filteredKOTs.filter((k) => k.status === stage.status);

            return (
              <div
                key={stage.status}
                className="bg-bg-card border border-border rounded-card flex flex-col overflow-hidden h-full shadow-card"
              >
                {/* Column Title */}
                <div className={`px-4 py-3 border-b border-border flex justify-between items-center font-medium text-[14px] ${stage.headerBg}`}>
                  <span className="sentence-case">{stage.title}</span>
                  <span className="font-mono bg-white/60 px-2 py-0.5 rounded text-[11px] font-bold">
                    {stageKOTs.length}
                  </span>
                </div>

                {/* Tickets Container */}
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 custom-scrollbar">
                  {stageKOTs.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-center p-4 py-12 text-text-hint text-[13px] sentence-case italic">
                      No orders in this stage
                    </div>
                  ) : (
                    stageKOTs.map((kot) => (
                      <div
                        key={kot.id}
                        style={{ borderLeft: `4px solid ${stage.borderCol}` }}
                        className={`bg-bg-card border border-border rounded-btn p-3 shadow-card transition-all duration-200 flex flex-col gap-2.5 ${
                          stage.status === 'Served' ? 'opacity-70' : ''
                        }`}
                      >
                        {/* Card Title Header */}
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[13px] font-bold text-text-primary block font-mono">
                              Token #{kot.tokenNo.split('-').pop()}
                            </span>
                            <span className="text-[11px] text-text-muted sentence-case mt-0.5 block font-medium">
                              {kot.orderType} {kot.tableNo ? `• Table ${kot.tableNo}` : ''}
                            </span>
                          </div>
                          
                          {/* Timer Elapsed */}
                          <div className="flex items-center gap-1 text-[11px] text-text-hint shrink-0">
                            <Clock className="w-3 h-3" />
                            <span className="font-medium font-mono">{getElapsedTime(kot.timeCreated)}</span>
                          </div>
                        </div>

                        <div className="border-t border-border/60" />

                        {/* Items ordered list */}
                        <div className="flex flex-col gap-1.5 text-[13px]">
                          {kot.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start text-text-primary">
                              <span className="truncate pr-2 sentence-case">
                                {item.name} {item.variationName ? `(${item.variationName})` : ''}
                              </span>
                              <span className="font-mono text-primary font-bold shrink-0">
                                x{item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Next transition button */}
                        {stage.status !== 'Served' && (
                          <div className="border-t border-border/60 pt-2 mt-0.5">
                            <button
                              onClick={() => handleTransition(kot.id, kot.status)}
                              className="w-full h-[28px] bg-primary hover:bg-primary-dark text-white rounded-btn text-[11px] font-medium flex items-center justify-center gap-1 transition-all duration-150"
                            >
                              {stage.status === 'Pending' && (
                                <>
                                  <Play className="w-3 h-3 fill-current" />
                                  Mark Preparing
                                </>
                              )}
                              {stage.status === 'Preparing' && (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  Mark Ready
                                </>
                              )}
                              {stage.status === 'Ready' && (
                                <>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                  Mark Served
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
