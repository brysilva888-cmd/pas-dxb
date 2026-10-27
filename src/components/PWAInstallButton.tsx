import React, { useState } from 'react';
import { Check, Download, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return (
      <span
        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFFCE6] border border-[#BCEE94] text-[#1E5E08] text-xs font-semibold whitespace-nowrap shrink-0"
        title="Installed as an offline-ready app"
      >
        <Check className="w-3.5 h-3.5 text-[#287D0C]" />
        <span>Offline App Ready</span>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (isInstallable) {
            await install();
          } else {
            setShowGuideModal(true);
          }
        }}
        className="px-3 py-2 text-xs font-semibold text-[#111312] bg-[#F5F6F3] border border-[#E6EAE4] rounded-xl hover:bg-[#EAECE6] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
        title="Install PICKLE & SMASH DXB for 100% offline use"
      >
        <Download className="w-3.5 h-3.5 text-[#287D0C]" />
        <span>{isIOS ? 'Install on iOS' : 'Install Offline App'}</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#E6EAE4] p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#111312] text-[#98F64F] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-[#111312] font-display">
                    Use PICKLE &amp; SMASH DXB Offline
                  </h3>
                  <p className="text-xs text-slate-500">
                    All rosters, rounds, scores, and swaps are saved automatically on this device.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 text-slate-400 hover:text-[#111312] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#F8F9F6] border border-[#E6EAE4] rounded-xl p-4 space-y-3 text-xs text-slate-700">
              <div className="flex items-center gap-2 font-bold text-[#111312]">
                <WifiOff className="w-4 h-4 text-[#287D0C]" />
                <span>How Offline Mode Works:</span>
              </div>
              <ul className="space-y-2 list-disc pl-4">
                <li>
                  <strong>Automatic Device Storage:</strong> Every score, player swap, roster import, and round change is saved to your browser&apos;s local storage immediately—even without internet.
                </li>
                <li>
                  <strong>Install as Standalone App (Chrome / Edge / Android):</strong> Open the app URL in its own browser tab (outside the AI Studio preview frame) and click the <strong>Install</strong> icon in the address bar or menu.
                </li>
                <li>
                  <strong>Install on iPhone / iPad (Safari):</strong> Tap the <strong>Share</strong> button in Safari and select <strong>Add to Home Screen</strong>.
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#111312] text-white text-xs font-semibold hover:bg-[#272B29] transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
