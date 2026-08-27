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
const isMobileDevice = () => /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);

export const PwaInstallPrompt = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneMode);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const isIos = isIosDevice();
  const isMobile = isMobileDevice();

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

  // 카카오톡 등 인앱 브라우저는 beforeinstallprompt를 제공하지 않는다.
  // 모바일에서는 설치 진입점을 유지하고 외부 브라우저 설치 방법을 안내한다.
  if (isInstalled || (!installEvent && !isMobile)) return null;

  const handleInstall = async () => {
    if (isIos || !installEvent) {
      setShowInstallGuide(true);
      return;
    }
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

      {showInstallGuide && (
        <div className="pwa-ios-guide" role="dialog" aria-label="앱 설치 안내">
          <button
            type="button"
            className="pwa-guide-close"
            onClick={() => setShowInstallGuide(false)}
            aria-label="설치 안내 닫기"
          >
            <X size={16} />
          </button>
          <Share2 size={20} aria-hidden="true" />
          <div>
            <strong>{isIos ? 'iPhone 설치 방법' : 'Android 설치 방법'}</strong>
            {isIos ? (
              <p>Safari로 연 뒤 공유 버튼을 누르고 ‘홈 화면에 추가’를 선택해 주세요.</p>
            ) : (
              <p>카카오톡 화면의 우측 하단 ⋮ 메뉴에서 ‘다른 브라우저로 열기’를 선택한 뒤 Chrome 또는 삼성 인터넷에서 ‘설치하기’를 눌러 주세요.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
