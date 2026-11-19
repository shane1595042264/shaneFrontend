import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "@/components/transition-link";
import { Certificate, formatIssued } from "@/components/courses/certificate";
import { CertificateActions } from "@/components/courses/certificate-actions";
import { API_URL } from "@/lib/api-url";
import {
  certificatePath,
  formatCertificateCode,
  type CourseCertificate,
} from "@/lib/api/courses";

/**
 * SHAN-720. A course certificate, read by its code. Public on purpose: the
 * code is printed on the certificate so anyone handed it can check it here.
 *
 * Two segments under /courses, so the middleware's /courses/:slug probe never
 * sees it; "certificates" is a reserved course slug on both sides. Dynamic (no
 * generateStaticParams, so the revalidate below only caches the fetch). The
 * certificate itself never changes, but it disappears if its course goes
 * private, so the fetch is not cached forever.
 */
export const revalidate = 300;

async function fetchCertificate(code: string): Promise<CourseCertificate | null> {
  const res = await fetch(`${API_URL}/api/courses/certificates/${encodeURIComponent(code)}`, {
    next: { revalidate },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load certificate: ${res.status}`);
  return ((await res.json()) as { certificate: CourseCertificate }).certificate;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const cert = await fetchCertificate(code);
  if (!cert) return { title: "Certificate not found — Courses — Shane", robots: { index: false } };
  const title = `${cert.recipientName}, ${cert.courseTitle} — Certificate — Shane`;
  const description = `${cert.recipientName} completed every lesson of ${cert.courseTitle} on shanejli.com, issued ${formatIssued(cert.issuedAt)}.`;
  // noindex: a certificate carries a person's name, and it is theirs to share,
  // not the site's to put in search results. Self-canonical so it does not
  // inherit /courses's (SHAN-464).
  const url = `https://shanejli.com${certificatePath(cert.code)}`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "Shane — Periodic Table of Life" },
  };
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cert = await fetchCertificate(code);
  if (!cert) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <div className="certificate-print-hide mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link href="/courses" className="text-sm text-gray-400 hover:text-white">
          &larr; Courses
        </Link>
        <CertificateActions url={`https://shanejli.com${certificatePath(cert.code)}`} />
      </div>

      <Certificate certificate={cert} />

      <div className="certificate-print-hide mt-6 flex flex-wrap items-start justify-between gap-4 text-sm text-gray-400">
        <p className="max-w-[60ch]">
          <span className="font-medium text-teal-300">Verified.</span> Issued by shanejli.com to{" "}
          {cert.recipientName} on {formatIssued(cert.issuedAt)} for finishing all {cert.lessonCount}{" "}
          lesson{cert.lessonCount === 1 ? "" : "s"} of the course. Certificate{" "}
          <span className="font-mono text-gray-300">{formatCertificateCode(cert.code)}</span>.
        </p>
        <Link href={`/courses/${cert.courseSlug}`} className="text-gray-300 hover:text-white">
          See the course &rarr;
        </Link>
      </div>
    </div>
  );
}
