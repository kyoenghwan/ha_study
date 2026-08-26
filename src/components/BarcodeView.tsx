import React from 'react';

interface BarcodeViewProps {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
}

// 📌 표준 Code 39 인코딩 테이블 (9개 요소: 막대/공백 교차 패턴)
// 1 = 굵은(Wide) 요소, 0 = 가는(Narrow) 요소
const CODE39_MAP: Record<string, string> = {
  '0': '000110100',
  '1': '100100001',
  '2': '001100001',
  '3': '101100000',
  '4': '000110001',
  '5': '100110000',
  '6': '001110000',
  '7': '000100101',
  '8': '100100100',
  '9': '001100100',
  'A': '100001001',
  'B': '001001001',
  'C': '101001000',
  'D': '000011001',
  'E': '100011000',
  'F': '001011000',
  'G': '000001101',
  'H': '100001100',
  'I': '001001100',
  'J': '000011100',
  'K': '100000011',
  'L': '001000011',
  'M': '101000010',
  'N': '000010011',
  'O': '100010010',
  'P': '001010010',
  'Q': '000000111',
  'R': '100000110',
  'S': '001000110',
  'T': '000010110',
  'U': '110000001',
  'V': '011000001',
  'W': '111000000',
  'X': '010010001',
  'Y': '110010000',
  'Z': '011010000',
  '-': '010000101',
  '.': '110000100',
  ' ': '011000100',
  '$': '010101000',
  '/': '010100010',
  '+': '010001010',
  '%': '000101010',
  '*': '010010100', // Start / Stop 캐릭터
};

export const BarcodeView: React.FC<BarcodeViewProps> = ({
  value,
  height = 80,
  showText = true,
  className = '',
}) => {
  // 입력 문자열 전처리 (앞뒤 * 가 없으면 붙여서 Code 39 규격 맞춤)
  const safeVal = (value || '*M091063684*').trim().toUpperCase();
  const cleanStr = safeVal || '*M091063684*';
  const code39Str = cleanStr.startsWith('*') && cleanStr.endsWith('*') && cleanStr.length > 2
    ? cleanStr
    : `*${cleanStr.replace(/\*/g, '')}*`;

  // Code 39 정통 막대 및 공백 계산
  const generateCode39Elements = (str: string) => {
    const narrowWidth = 1.6;
    const wideWidth = 4.2;
    const gapWidth = 2.0; // 문자 간 격리 공백

    let currentX = 15;
    const rects: { x: number; w: number }[] = [];

    for (let charIdx = 0; charIdx < str.length; charIdx++) {
      const char = str[charIdx];
      const pattern = CODE39_MAP[char] || CODE39_MAP['*'];

      for (let i = 0; i < 9; i++) {
        const isBar = i % 2 === 0;
        const isWide = pattern[i] === '1';
        const width = isWide ? wideWidth : narrowWidth;

        if (isBar) {
          rects.push({ x: currentX, w: width });
        }
        currentX += width;
      }

      // 문자 간 격리 공백 추가
      currentX += gapWidth;
    }

    return { rects, totalWidth: currentX + 15 };
  };

  const { rects, totalWidth } = generateCode39Elements(code39Str);

  return (
    <div className={`flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-[#e5e5ea] ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        width="100%"
        height={height}
        className="max-w-[320px]"
      >
        {/* 흰색 바코드 배경 */}
        <rect x="0" y="0" width={totalWidth} height={height} fill="#ffffff" />
        
        {/* Code 39 표준 막대 드로잉 */}
        {rects.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y="4"
            width={bar.w}
            height={height - 8}
            fill="#1c1c1e"
          />
        ))}
      </svg>

      {showText && (
        <div className="font-mono text-xs font-extrabold tracking-widest text-[#1c1c1e] mt-1 text-center">
          {code39Str}
        </div>
      )}
    </div>
  );
};
