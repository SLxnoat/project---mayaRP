import { useEffect, useRef } from 'react';

export default function VoiceVisualizer({ analyser, isActive }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!isActive || !analyser) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height * 0.8;

        // Create a premium gradient for each bar
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'rgba(14, 165, 233, 0.2)');
        gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.8)');
        gradient.addColorStop(1, 'rgba(14, 165, 233, 1)');

        ctx.fillStyle = gradient;
        
        // Rounded bars
        const radius = barWidth / 2;
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, barWidth, barHeight, [radius, radius, 0, 0]);
        ctx.fill();

        // Add a subtle glow to active bars
        if (dataArray[i] > 100) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = 'rgba(14, 165, 233, 0.5)';
        } else {
          ctx.shadowBlur = 0;
        }

        x += barWidth + 2;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, analyser]);

  return (
    <div className={`relative h-12 w-full bg-gray-800/50 rounded-lg overflow-hidden transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-0 h-0'}`}>
      <canvas
        ref={canvasRef}
        width={400}
        height={48}
        className="w-full h-full"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[10px] uppercase tracking-widest text-primary-400/50 font-bold">Listening...</span>
      </div>
    </div>
  );
}
