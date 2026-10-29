import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Icon({ title, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} {...props}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function FlipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v18" />
      <path d="M4 8l4-4 4 4" />
      <path d="M20 16l-4 4-4-4" />
      <path d="M8 12H4" />
      <path d="M20 12h-4" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </Icon>
  );
}

export function TorchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 10h6l-1 11H10L9 10Z" />
      <path d="M10 10V7a2 2 0 0 1 4 0v3" />
      <path d="M12 2v2M8 4l1.2 1.2M16 4l-1.2 1.2" />
    </Icon>
  );
}

export function GalleryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="14" height="14" rx="1.5" />
      <path d="M7 19h12a2 2 0 0 0 2-2V7" />
      <circle cx="9" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <path d="M5 16l3.5-3.5L12 16l2-2 3 3" />
    </Icon>
  );
}

export function LooksIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4c2.5 2.2 4 4.8 4 8s-1.5 5.8-4 8c-2.5-2.2-4-4.8-4-8s1.5-5.8 4-8Z" />
      <path d="M4.5 10.5h15M4.5 13.5h15" />
    </Icon>
  );
}

export function ProIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function FocusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}
