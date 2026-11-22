import Link from "@/components/transition-link";
import styles from "./veil.module.css";

const DOWNLOAD_URL = "https://veil-chat-update-api-production.up.railway.app/download/windows";
const REPOSITORY_URL = "https://github.com/shane1595042264/veil-chat";

const shortcuts = [
  ["Show / hide", "Ctrl", "Shift", "O"],
  ["Move & resize", "Ctrl", "Shift", "M"],
  ["Lock", "Ctrl", "Shift", "L"],
  ["Click-through", "Ctrl", "Shift", "X"],
] as const;

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14" />
    </svg>
  );
}

export default function VeilPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span /> Windows app · Twitch chat</p>
          <h1>Your chat,<br /><em>in your eyeline.</em></h1>
          <p className={styles.lede}>
            Veil puts a transparent, always-on-top Twitch chat on the screen you play on—readable when you need it, invisible when you don&apos;t.
          </p>
          <div className={styles.actions}>
            <a className={styles.primaryAction} href={DOWNLOAD_URL}>
              <DownloadIcon /> Download for Windows
            </a>
            <a className={styles.secondaryAction} href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              View source
            </a>
          </div>
          <p className={styles.meta}>Windows 10/11 · Lightweight Tauri build · Signed automatic updates</p>
        </div>

        <div className={styles.productStage} aria-label="Veil overlay shown over a game scene">
          <div className={styles.gameGlow} />
          <div className={styles.hud}><span>ROUND 04</span><strong>02:17</strong></div>
          <div className={styles.overlayDemo}>
            <div><strong className={styles.pink}>JuniperJay:</strong> that movement was actually so clean</div>
            <div><strong className={styles.purple}>nightpixel:</strong> wait the overlay is kinda gorgeous??</div>
            <div><strong className={styles.green}>moss.exe:</strong> one more run — you have this ✦</div>
            <div><strong className={styles.gold}>TeaAndQuests:</strong> okay that was close</div>
          </div>
          <div className={styles.zeroBackground}><i /> 0% background</div>
        </div>
      </section>

      <section className={styles.promise} aria-labelledby="veil-promise">
        <p>THE DIFFERENCE</p>
        <h2 id="veil-promise">The overlay is for <em>you</em>, not just your audience.</h2>
        <div className={styles.promiseGrid}>
          <article><span>01</span><h3>Actually on your screen</h3><p>Veil stays over borderless games and apps, so chat remains in view without a second monitor.</p></article>
          <article><span>02</span><h3>No permanent panel</h3><p>Lock it and every setup boundary disappears. Only carefully shadowed chat remains.</p></article>
          <article><span>03</span><h3>Clicks pass through</h3><p>One shortcut makes Veil untouchable, sending mouse input straight to the game underneath.</p></article>
        </div>
      </section>

      <section className={styles.shortcuts} aria-labelledby="veil-shortcuts">
        <div>
          <p className={styles.sectionLabel}>NO ALT-TAB REQUIRED</p>
          <h2 id="veil-shortcuts">Run the overlay from your keyboard.</h2>
          <p>Global shortcuts work while your game is focused. Move it, lock it, hide it, or switch to click-through without breaking rhythm.</p>
        </div>
        <div className={styles.shortcutList}>
          {shortcuts.map(([label, ...keys]) => (
            <div key={label}><span>{label}</span><kbd>{keys.map((key) => <b key={key}>{key}</b>)}</kbd></div>
          ))}
        </div>
      </section>

      <section className={styles.setup} id="setup" aria-labelledby="veil-setup">
        <p className={styles.sectionLabel}>START IN A MINUTE</p>
        <h2 id="veil-setup">No developer console. No client ID. No secret.</h2>
        <div className={styles.steps}>
          <article><span>1</span><h3>Install Veil</h3><p>Download the signed Windows installer and open the control room.</p></article>
          <article><span>2</span><h3>Continue with Twitch</h3><p>Your browser handles Twitch sign-in using the account method you already trust.</p></article>
          <article><span>3</span><h3>Choose a channel</h3><p>Connect, place the overlay once, and keep playing.</p></article>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.mark} aria-hidden="true"><i /><i /><i /></div>
        <div><p>VEIL FOR WINDOWS</p><h2>Keep chat close. Keep the game clear.</h2></div>
        <a href={DOWNLOAD_URL}><DownloadIcon /> Download installer</a>
      </section>

      <footer className={styles.footer}>
        <span>Built by <Link href="/">Shane Li</Link></span>
        <span>Twitch tokens stay on your device · No analytics</span>
      </footer>
    </div>
  );
}
