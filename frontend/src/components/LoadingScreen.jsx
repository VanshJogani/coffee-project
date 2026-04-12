import React from "react";
import loadingVideo from "../assets/Dripping_loading_screen_029c2bb9ec.mp4";

const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#F5F0E8]">
      <div className="w-full max-w-sm px-8">
        <video
          src={loadingVideo}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-auto rounded-full mix-blend-multiply opacity-90"
        />
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="text-[10px] uppercase font-bold tracking-[0.3em] text-luxury-gold animate-pulse">
            Brewing Excellence
          </div>
          <div className="w-48 h-[1px] bg-luxury-clay/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-luxury-gold w-1/3 animate-loading-bar" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
