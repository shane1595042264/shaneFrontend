import { formatCertificateCode, type CourseCertificate } from "@/lib/api/courses";

/**
 * SHAN-720. The certificate itself: a sheet of paper on the dark site, so it
 * prints as it looks (globals.css gives it its own landscape page and hides
 * the site around it). Type is sized in container units so the sheet scales
 * like a document instead of reflowing; below `sm` it lets go of the A4 ratio
 * and the clamps keep every line readable on a phone.
 *
 * Server-rendered, no hooks: the whole certificate is in the HTML.
 */

const INK = "#1f1a14";
const MUTED = "#5b4f3e";
const GOLD = "#9a7429";

export function formatIssued(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function Seal() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
      <defs>
        <path id="certificate-seal-ring" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke={GOLD} strokeWidth="2" />
      <circle cx="60" cy="60" r="52" fill="none" stroke={GOLD} strokeWidth="0.75" />
      <circle cx="60" cy="60" r="33" fill="none" stroke={GOLD} strokeWidth="0.75" />
      <text fill={GOLD} fontSize="8.5" letterSpacing="1.7" fontFamily="var(--font-geist-sans), sans-serif">
        <textPath href="#certificate-seal-ring">SHANEJLI.COM · COURSES · CERTIFIED ·</textPath>
      </text>
      <text
        x="60"
        y="67"
        textAnchor="middle"
        fill={GOLD}
        fontSize="21"
        fontStyle="italic"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        SJL
      </text>
    </svg>
  );
}

export function Certificate({ certificate }: { certificate: CourseCertificate }) {
  const code = formatCertificateCode(certificate.code);
  return (
    <article
      data-certificate
      aria-label={`Certificate of completion for ${certificate.recipientName}`}
      className="certificate-sheet relative mx-auto w-full overflow-hidden rounded-sm shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] [container-type:inline-size] sm:aspect-[1.414/1]"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #fbf8f1 0%, #f3ecdd 100%)", color: INK }}
    >
      {/* Double frame */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-[2.2cqw] border" style={{ borderColor: GOLD }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-[2.9cqw] border-[0.5px]" style={{ borderColor: GOLD }} />

      <div className="relative flex h-full flex-col items-center px-[9cqw] pb-[5.5cqw] pt-[6.5cqw] text-center max-sm:px-8 max-sm:py-12">
        <p
          className="font-mono uppercase tracking-[0.35em] text-[clamp(9px,1.25cqw,13px)]"
          style={{ color: MUTED }}
        >
          shanejli.com &middot; courses
        </p>
        <h1 className="mt-[2.2cqw] font-serif text-[clamp(26px,5.2cqw,54px)] leading-none tracking-tight max-sm:mt-4">
          Certificate of Completion
        </h1>
        <div aria-hidden="true" className="mt-[2cqw] h-px w-[16cqw] max-sm:mt-4 max-sm:w-20" style={{ background: GOLD }} />

        <p className="mt-[2.6cqw] text-[clamp(12px,1.55cqw,16px)] max-sm:mt-6" style={{ color: MUTED }}>
          This certifies that
        </p>
        <p className="mt-[1.2cqw] max-w-full break-words font-serif italic text-[clamp(28px,5.6cqw,58px)] leading-tight max-sm:mt-2">
          {certificate.recipientName}
        </p>
        <p className="mt-[1.6cqw] text-[clamp(12px,1.55cqw,16px)] max-sm:mt-4" style={{ color: MUTED }}>
          has completed every lesson of
        </p>
        <p className="mt-[1cqw] max-w-[60ch] text-balance font-serif font-semibold text-[clamp(18px,2.9cqw,30px)] leading-snug max-sm:mt-2">
          {certificate.courseTitle}
        </p>
        <p className="mt-[1.2cqw] text-[clamp(11px,1.35cqw,14px)] tabular-nums max-sm:mt-3" style={{ color: MUTED }}>
          {certificate.lessonCount} lesson{certificate.lessonCount === 1 ? "" : "s"} &middot; graded score{" "}
          {certificate.score}%
        </p>

        <div className="mt-auto grid w-full grid-cols-[1fr_auto_1fr] items-end gap-[3cqw] pt-[3cqw] max-sm:mt-10 max-sm:grid-cols-1 max-sm:justify-items-center max-sm:gap-6">
          <div className="text-[clamp(11px,1.35cqw,14px)] max-sm:order-2">
            <p className="font-serif text-[clamp(14px,1.9cqw,20px)]">{formatIssued(certificate.issuedAt)}</p>
            <div aria-hidden="true" className="mx-auto mt-[0.6cqw] h-px w-[70%]" style={{ background: INK }} />
            <p className="mt-[0.6cqw] uppercase tracking-[0.2em] text-[clamp(9px,1.1cqw,12px)]" style={{ color: MUTED }}>
              Date issued
            </p>
          </div>
          <div className="h-[11cqw] w-[11cqw] min-h-20 min-w-20 max-sm:order-1">
            <Seal />
          </div>
          <div className="text-[clamp(11px,1.35cqw,14px)] max-sm:order-3">
            <p
              className="text-[clamp(22px,3.3cqw,36px)] leading-none"
              style={{ fontFamily: "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', cursive" }}
            >
              Shane J. Li
            </p>
            <div aria-hidden="true" className="mx-auto mt-[0.6cqw] h-px w-[70%]" style={{ background: INK }} />
            <p className="mt-[0.6cqw] uppercase tracking-[0.2em] text-[clamp(9px,1.1cqw,12px)]" style={{ color: MUTED }}>
              Issuer
            </p>
          </div>
        </div>

        <p className="mt-[2.4cqw] break-all font-mono text-[clamp(9px,1.05cqw,12px)] tracking-wide max-sm:mt-8" style={{ color: MUTED }}>
          Verify at shanejli.com/courses/certificates/{code}
        </p>
      </div>
    </article>
  );
}
