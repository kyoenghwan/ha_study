import { useEffect, useState } from 'react';
import { Download, Share2, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const isStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

export const PwaInstallPrompt = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneMode);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const isIos = isIosDevice();

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (isInstalled || (!installEvent && !isIos)) return null;

  const handleInstall = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setInstallEvent(null);
  };

  return (
    <section className="pwa-install-card" aria-label="HA-STUDY 앱 설치">
      <div className="pwa-install-copy">
        <span className="pwa-install-icon" aria-hidden="true">
          <Smartphone size={18} />
        </span>
        <div>
          <strong>휴대폰에 앱으로 설치</strong>
          <p>홈 화면에서 더 빠르게 예약을 확인하세요.</p>
        </div>
      </div>
      <button type="button" className="pwa-install-button" onClick={handleInstall}>
        <Download size={15} /> 설치하기
      </button>

      {showIosGuide && (
        <div className="pwa-ios-guide" role="dialog" aria-label="iPhone 설치 안내">
          <button
            type="button"
            className="pwa-guide-close"
            onClick={() => setShowIosGuide(false)}
            aria-label="설치 안내 닫기"
          >
            <X size={16} />
          </button>
          <Share2 size={20} aria-hidden="true" />
          <div>
            <strong>iPhone 설치 방법</strong>
            <p>Safari 하단의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택해 주세요.</p>
          </div>
        </div>
      )}
    </section>
  );
};
