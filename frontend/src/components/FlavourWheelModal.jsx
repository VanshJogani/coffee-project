import React from "react";
import hindiWheel from "../assets/flavour_wheel.png";
import englishWheel from "../assets/flavour_wheel_en.png";

const FlavourWheelModal = ({ isOpen, onClose }) => {
  const [language, setLanguage] = React.useState("hi"); // 'hi' for Hindi, 'en' for English
  const [scale, setScale] = React.useState(1);
  
  if (!isOpen) return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleReset = () => setScale(1);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="relative bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-white sticky top-0 z-10 gap-3">
          <div>
            <h2 className="text-xl font-bold text-coffee-900">Coffee Flavour Wheel</h2>
            <p className="text-sm text-slate-500">Universal reference for coffee tasting notes</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2">
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-600 transition-all"
                title="Zoom Out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="px-2 text-[10px] font-bold text-slate-500 min-w-[45px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-600 transition-all"
                title="Zoom In"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={handleReset}
                className="ml-1 p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-600 transition-all border-l border-slate-200"
                title="Reset Zoom"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            <div className="flex p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setLanguage("hi")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${language === "hi" ? "bg-white text-coffee-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Hindi
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${language === "en" ? "bg-white text-coffee-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                English
              </button>
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
        </div>
        
        <div className="flex-1 overflow-auto p-8 bg-slate-50 flex items-center justify-center min-h-[500px] cursor-grab active:cursor-grabbing">
          <div 
            style={{ 
              transform: `scale(${scale})`, 
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              transformOrigin: 'center center'
            }}
            className="flex items-center justify-center h-full w-full"
          >
            <img 
              src={language === "hi" ? hindiWheel : englishWheel} 
              alt={`Coffee Flavour Wheel - ${language === "hi" ? "Hindi" : "English"}`} 
              className="max-w-full md:max-w-2xl h-auto rounded-lg shadow-xl bg-white"
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-100 bg-white text-xs text-slate-400 italic text-center">
          {language === "hi" 
            ? "Barista Training Academy (BTA) - Indian Coffee Taster's Wheel" 
            : "Specialty Coffee Association (SCA) - Coffee Taster's Flavor Wheel"}
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
};

export default FlavourWheelModal;
