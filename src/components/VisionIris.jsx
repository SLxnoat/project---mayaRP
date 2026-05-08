import { useVision } from '../context/VisionContext';

export default function VisionIris() {
  const { isActive, isReady, currentEmotion, isUserPresent, toggleVision } = useVision();

  const getEmotionColor = () => {
    switch (currentEmotion) {
      case 'happy': return 'bg-emerald-500 shadow-emerald-500/50';
      case 'sad': return 'bg-sky-500 shadow-sky-500/50';
      case 'angry': return 'bg-rose-500 shadow-rose-500/50';
      case 'surprised': return 'bg-amber-500 shadow-amber-500/50';
      case 'fearful': return 'bg-violet-500 shadow-violet-500/50';
      default: return 'bg-primary-500 shadow-primary-500/50';
    }
  };

  if (!isReady) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={toggleVision}
        className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
          isActive ? 'scale-110' : 'scale-100 grayscale opacity-50 hover:grayscale-0 hover:opacity-100'
        }`}
        title={isActive ? 'Neural Vision Active' : 'Enable Neural Vision'}
      >
        {/* Outer Ring */}
        <div className={`absolute inset-0 rounded-full border-2 transition-colors duration-500 ${
          isActive ? 'border-primary-500/50 animate-spin-slow' : 'border-slate-700'
        }`}></div>
        
        {/* Inner Iris */}
        <div className={`w-6 h-6 rounded-full transition-all duration-700 ${
          isActive 
            ? isUserPresent 
              ? `${getEmotionColor()} shadow-[0_0_20px_rgba(0,0,0,0.5)] scale-110` 
              : 'bg-primary-500/20 shadow-none scale-90 animate-pulse'
            : 'bg-slate-800'
        }`}>
          {/* Pupil */}
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full transition-transform duration-300 ${
            isUserPresent ? 'scale-100' : 'scale-0'
          }`}></div>
        </div>

        {/* Scan Line effect */}
        {isActive && !isUserPresent && (
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="w-full h-0.5 bg-primary-400/50 absolute top-0 animate-scan"></div>
          </div>
        )}
      </button>
      
      {isActive && (
        <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-500 ${
          isUserPresent ? 'text-primary-400' : 'text-slate-600'
        }`}>
          {isUserPresent ? currentEmotion || 'Perceiving...' : 'Seeking Target'}
        </span>
      )}
    </div>
  );
}
