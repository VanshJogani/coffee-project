import React from "react";
import InteractiveFlavourWheel from "./InteractiveFlavourWheel";

const FlavourWheelModal = ({ isOpen, onClose, onFlavourSelect }) => {
  if (!isOpen) return null;

  const handleFlavourSelect = (flavour) => {
    if (onFlavourSelect) onFlavourSelect(flavour);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="relative bg-[#FBF7F1] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#E4C770]/40 flex items-center justify-between bg-[#FBF7F1] sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-coffee-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              Indian Coffee <em style={{ color: '#C4973B' }}>Flavour Wheel</em>
            </h2>
            <p className="text-sm text-slate-500">Click any tasting note on the outer ring to filter coffees</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <InteractiveFlavourWheel onFlavourSelect={handleFlavourSelect} />
        </div>

        <div className="p-3 border-t border-[#E4C770]/30 bg-[#FBF7F1] text-xs text-slate-400 italic text-center">
          Blue Tokai Coffee Roasters &middot; Adapted for interactive exploration
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
};

export default FlavourWheelModal;
