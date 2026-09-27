import React from 'react';
import { Clock, ArrowUp, ArrowDown, Download, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { TransferHistoryItem } from '../types';
import { formatBytes, formatSpeed } from '../utils/format';

interface TransferHistoryViewProps {
  history: TransferHistoryItem[];
  onClearHistory: () => void;
}

export const TransferHistoryView: React.FC<TransferHistoryViewProps> = ({
  history,
  onClearHistory,
}) => {
  return (
    <div className="w-full rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Transfer Receipts & Activity</span>
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Audit log stored strictly in your browser's private local memory.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 mb-3">
            <Clock className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">
            No transfer activity yet
          </p>
          <p className="mt-1 text-xs text-neutral-500 max-w-xs mx-auto">
            Files transferred between your PC and mobile device will record encrypted receipts here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800 text-neutral-400 uppercase font-mono text-[10px]">
                <th className="py-3 px-2">Direction</th>
                <th className="py-3 px-2">Filename</th>
                <th className="py-3 px-2">Size</th>
                <th className="py-3 px-2">Avg Speed</th>
                <th className="py-3 px-2">Device</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition">
                  <td className="py-3 px-2 whitespace-nowrap">
                    <span className="flex items-center gap-1.5 font-medium">
                      {item.direction === 'sent' ? (
                        <>
                          <ArrowUp className="h-3.5 w-3.5 text-indigo-500" />
                          <span className="text-neutral-700 dark:text-neutral-300">Sent</span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-neutral-700 dark:text-neutral-300">Received</span>
                        </>
                      )}
                    </span>
                  </td>

                  <td className="py-3 px-2 font-medium text-neutral-900 dark:text-white truncate max-w-[200px]">
                    {item.fileName}
                  </td>

                  <td className="py-3 px-2 font-mono text-neutral-500 tabular-nums whitespace-nowrap">
                    {formatBytes(item.fileSize)}
                  </td>

                  <td className="py-3 px-2 font-mono text-neutral-500 tabular-nums whitespace-nowrap">
                    {item.speedAvgBps ? formatSpeed(item.speedAvgBps) : '--'}
                  </td>

                  <td className="py-3 px-2 text-neutral-500 truncate max-w-[140px]">
                    {item.peerName || 'Direct Peer'}
                  </td>

                  <td className="py-3 px-2 whitespace-nowrap">
                    {item.status === 'completed' ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Completed</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-500">
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="capitalize">{item.status}</span>
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-2 text-right font-mono text-neutral-400 tabular-nums whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
