import React from 'react';

interface BarcodeViewProps {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
  className?: string;
}

export const BarcodeView: React.FC<BarcodeViewProps> = ({
  value,
  height = 80,
  showText = true,
  className = '',
}) => {
  // 문자열을 시각적 바코드 패브릭 막대 패턴으로 생성하는 모듈 결정 함수
  const generateBars = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const bars: { x: number; w: number }[] = [];
    let currentX = 15;
    const totalBars = 36;
    
    for (let i = 0; i < totalBars; i++) {
      const charCode = str.charCodeAt(i % str.length) || 65;
      const barWidth = ((charCode + i + Math.abs(hash)) % 3) + 1; // 1 ~ 3px
      const spaceWidth = (((charCode * (i + 1)) + Math.abs(hash)) % 3) + 1; // 1 ~ 3px
      
      bars.push({ x: currentX, w: barWidth });
      currentX += barWidth + spaceWidth;
    }

    return { bars, totalWidth: currentX + 15 };
  };

  const { bars, totalWidth } = generateBars(value);

  return (
    <div className={`flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-[#e5e5ea] ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        width="100%"
        height={height}
        className="max-w-[260px]"
      >
        {/* 바코드 외각 흰색 배경 */}
        <rect x="0" y="0" width={totalWidth} height={height} fill="#ffffff" />
        
        {/* 시작 및 종료 가이드라인 */}
        <rect x="5" y="5" width="2" height={height - 10} fill="#1c1c1e" />
        <rect x="9" y="5" width="1" height={height - 10} fill="#1c1c1e" />
        
        {/* 바코드 막대들 */}
        {bars.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y="5"
            width={bar.w}
            height={height - 10}
            fill="#1c1c1e"
            rx="0.5"
          />
        ))}

        {/* 종료 가이드라인 */}
        <rect x={totalWidth - 10} y="5" width="1" height={height - 10} fill="#1c1c1e" />
        <rect x={totalWidth - 7} y="5" width="2" height={height - 10} fill="#1c1c1e" />
      </svg>

      {showText && (
        <div className="font-mono text-xs font-bold tracking-widest text-[#1c1c1e] mt-1 text-center">
          {value}
        </div>
      )}
    </div>
  );
};
