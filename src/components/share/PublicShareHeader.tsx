import { LanguageControl } from '@/components/layout/LanguageControl';
import '@/components/share/public-share.css';

export function PublicShareHeader() {
  return (
    <header className="public-share-header">
      <div className="public-share-header__inner">
        <div className="public-share-header__brand">
          <img src="/lemon-logo-white.png" alt="" />
          <strong>Lemon Studios</strong>
        </div>
        <LanguageControl />
      </div>
    </header>
  );
}
