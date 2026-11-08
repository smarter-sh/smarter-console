/**
 * The Download My Data dialog's illustrations: one for its introduction, one for each step of an export,
 * and one each for its success and failure.
 *
 * Each is an inline SVG, animated with the CSS keyframes of styles.css, and colored with its CSS
 * variables, which [data-bs-theme=dark] redefines. The animations stop for a user who prefers reduced
 * motion. They are decoration: the dialog's text says the same thing, so each is aria-hidden.
 */
import type { ReactNode } from "react";

import type { DataExportStepName } from "../../lib/Types";

/** The frame of every illustration: a 240 by 200 canvas, with a soft disc behind the drawing. */
function Frame({ name, children }: { name: string; children: ReactNode }) {
  return (
    <svg
      className={`smarter-dx-art smarter-dx-art-${name}`}
      viewBox="0 0 240 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="smarter-dx-disc" cx="120" cy="100" r="88" />
      {children}
    </svg>
  );
}

/** A manifest: a page with a folded corner and a few lines of YAML. */
function Page({ x, y, className = "" }: { x: number; y: number; className?: string }) {
  return (
    // the position is on the outer group, because a CSS animation's transform replaces an element's own.
    <g transform={`translate(${x} ${y})`}>
      <g className={className}>
        <path className="smarter-dx-paper" d="M0 6a6 6 0 0 1 6-6h30l14 14v52a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6z" />
        <path className="smarter-dx-fold" d="M36 0v10a4 4 0 0 0 4 4h10" />
        <rect className="smarter-dx-key" x="8" y="22" width="14" height="4" rx="2" />
        <rect className="smarter-dx-line" x="25" y="22" width="16" height="4" rx="2" />
        <rect className="smarter-dx-key" x="14" y="32" width="10" height="4" rx="2" />
        <rect className="smarter-dx-line" x="27" y="32" width="14" height="4" rx="2" />
        <rect className="smarter-dx-key" x="14" y="42" width="12" height="4" rx="2" />
        <rect className="smarter-dx-line" x="29" y="42" width="10" height="4" rx="2" />
        <rect className="smarter-dx-key" x="8" y="52" width="18" height="4" rx="2" />
      </g>
    </g>
  );
}

/** An envelope, closed. */
function Envelope({ x, y, className = "" }: { x: number; y: number; className?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={className}>
        <rect className="smarter-dx-paper" x="0" y="0" width="96" height="64" rx="8" />
        <path className="smarter-dx-flap" d="M4 6l44 32L92 6" />
        <path className="smarter-dx-fold" d="M4 60l32-24M92 60L60 36" />
      </g>
    </g>
  );
}

/** The introduction: manifests that fly into a zip file, which an envelope carries away. */
export function IntroIllustration() {
  return (
    <Frame name="intro">
      <Page x={34} y={40} className="smarter-dx-float smarter-dx-delay-0" />
      <Page x={58} y={64} className="smarter-dx-float smarter-dx-delay-1" />
      <Page x={82} y={88} className="smarter-dx-float smarter-dx-delay-2" />
      <path className="smarter-dx-arrow smarter-dx-dash" d="M142 112h22" />
      <path className="smarter-dx-arrow" d="M160 106l6 6-6 6" />
      <g transform="translate(172 84)">
        <g className="smarter-dx-float smarter-dx-delay-1">
          <rect className="smarter-dx-accent-fill" x="0" y="0" width="44" height="56" rx="8" />
          <path className="smarter-dx-zipper" d="M22 4v6h-4v6h4v6h-4v6h4v6" />
          <rect className="smarter-dx-paper" x="14" y="36" width="16" height="12" rx="3" />
        </g>
      </g>
    </Frame>
  );
}

/** Finding the resources: a magnifying glass sweeps over the user's resources, which light up as it finds them. */
function InventoryIllustration() {
  const tiles = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const index = row * 4 + column;
      tiles.push(
        <rect
          key={index}
          className="smarter-dx-tile"
          style={{ animationDelay: `${index * 0.12}s` }}
          x={52 + column * 36}
          y={50 + row * 36}
          width="28"
          height="28"
          rx="7"
        />,
      );
    }
  }
  return (
    <Frame name="inventory">
      {tiles}
      <g className="smarter-dx-sweep">
        <circle className="smarter-dx-lens" cx="0" cy="0" r="22" />
        <path className="smarter-dx-handle" d="M16 16l18 18" />
      </g>
    </Frame>
  );
}

/** Writing the manifests: a page whose lines are written one after another, and a pen that writes them. */
function ManifestsIllustration() {
  const lines = [
    { x: 84, width: 40, indent: 0 },
    { x: 96, width: 52, indent: 1 },
    { x: 96, width: 36, indent: 1 },
    { x: 108, width: 44, indent: 2 },
    { x: 108, width: 30, indent: 2 },
    { x: 84, width: 56, indent: 0 },
  ];
  return (
    <Frame name="manifests">
      <path className="smarter-dx-paper" d="M70 36a8 8 0 0 1 8-8h64l22 22v114a8 8 0 0 1-8 8H78a8 8 0 0 1-8-8z" />
      <path className="smarter-dx-fold" d="M142 28v14a8 8 0 0 0 8 8h14" />
      {lines.map((line, index) => (
        <path
          key={index}
          className={`smarter-dx-write ${line.indent === 0 ? "smarter-dx-write-key" : ""}`}
          style={{ animationDelay: `${index * 0.35}s` }}
          d={`M${line.x} ${64 + index * 16}h${line.width}`}
        />
      ))}
      <g className="smarter-dx-pen">
        <path className="smarter-dx-accent-fill" d="M0 0l8 -8 30 30 -8 8z" />
        <path className="smarter-dx-ink" d="M0 0l-4 12 12-4z" />
      </g>
    </Frame>
  );
}

/** Zipping: the manifests drop into a box, which zips itself shut. */
function ArchiveIllustration() {
  return (
    <Frame name="archive">
      <Page x={64} y={14} className="smarter-dx-drop smarter-dx-delay-0" />
      <Page x={96} y={8} className="smarter-dx-drop smarter-dx-delay-1" />
      <Page x={128} y={14} className="smarter-dx-drop smarter-dx-delay-2" />
      <g transform="translate(58 100)">
        <rect className="smarter-dx-accent-fill" x="0" y="0" width="124" height="74" rx="10" />
        <rect className="smarter-dx-box-lid" x="-4" y="-8" width="132" height="18" rx="6" />
        <path className="smarter-dx-zipper smarter-dx-zip" d="M62 10v8h-6v8h6v8h-6v8h6v8h-6v8" />
      </g>
    </Frame>
  );
}

/** Saving to private storage: the zip file rises into a cloud that has a padlock. */
function UploadIllustration() {
  return (
    <Frame name="upload">
      <path
        className="smarter-dx-paper"
        d="M70 110a26 26 0 0 1 8-50 34 34 0 0 1 64-6 26 26 0 0 1 26 30 20 20 0 0 1-6 40H78a14 14 0 0 1-8-14z"
      />
      <g transform="translate(150 82)">
        <path className="smarter-dx-shackle" d="M4 10V4a8 8 0 0 1 16 0v6" />
        <rect className="smarter-dx-ink-fill" x="0" y="10" width="24" height="20" rx="4" />
      </g>
      <g className="smarter-dx-rise">
        <rect className="smarter-dx-accent-fill" x="100" y="130" width="34" height="42" rx="6" />
        <path className="smarter-dx-zipper" d="M117 133v5h-3v5h3v5h-3v5" />
      </g>
      <path className="smarter-dx-arrow smarter-dx-dash" d="M86 176v-36M154 176v-36" />
    </Frame>
  );
}

/** Emailing the link: an envelope flies off, with speed lines behind it. */
function EmailIllustration() {
  return (
    <Frame name="email">
      <g className="smarter-dx-speed">
        <path className="smarter-dx-arrow" d="M30 86h30M20 102h40M34 118h26" />
      </g>
      <Envelope x={72} y={70} className="smarter-dx-fly" />
    </Frame>
  );
}

/** Done: the envelope, with a check that pops onto it. */
export function DoneIllustration() {
  return (
    <Frame name="done">
      <Envelope x={64} y={72} className="smarter-dx-float smarter-dx-delay-0" />
      <g transform="translate(156 76)">
        <g className="smarter-dx-pop">
          <circle className="smarter-dx-success-fill" cx="0" cy="0" r="20" />
          <path className="smarter-dx-check" d="M-9 0l6 6 12-12" />
        </g>
      </g>
    </Frame>
  );
}

/** Failed: a page, with a cross that pops onto it. */
export function FailedIllustration() {
  return (
    <Frame name="failed">
      <Page x={88} y={60} />
      <g transform="translate(146 68)">
        <g className="smarter-dx-pop">
          <circle className="smarter-dx-danger-fill" cx="0" cy="0" r="18" />
          <path className="smarter-dx-check" d="M-7-7l14 14M7-7l-14 14" />
        </g>
      </g>
    </Frame>
  );
}

/** The illustration of a step of an export. A queued export shows the first step's. */
export function StepIllustration({ step }: { step: DataExportStepName }) {
  switch (step) {
    case "manifests":
      return <ManifestsIllustration />;
    case "archive":
      return <ArchiveIllustration />;
    case "upload":
      return <UploadIllustration />;
    case "email":
      return <EmailIllustration />;
    case "done":
      return <DoneIllustration />;
    default:
      return <InventoryIllustration />;
  }
}
