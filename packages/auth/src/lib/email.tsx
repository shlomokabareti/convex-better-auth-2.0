import { renderToStaticMarkup } from "react-dom/server";
import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export type EmailProps = {
  children?: ReactNode;
  muted?: boolean;
};

export type EmailButtonProps = AnchorHTMLAttributes<HTMLAnchorElement>;

export function EmailButton(props: EmailButtonProps) {
  return (
    <a
      {...props}
      style={{
        display: "inline-block",
        padding: "12px 24px",
        backgroundColor: "#111",
        color: "#fff",
        borderRadius: "6px",
        textDecoration: "none",
      }}
    >
      {props.children}
    </a>
  );
}

export const Button = EmailButton;

export function EmailHeading(props: HTMLAttributes<HTMLHeadingElement>) {
  return <h1 {...props} style={{ margin: "0 0 16px" }} />;
}

export function EmailLayout(props: { preview?: string; children: ReactNode }) {
  return (
    <html>
      <head>
        {props.preview ? <title>{props.preview}</title> : null}
      </head>
      <body style={{ fontFamily: "sans-serif", padding: 24 }}>
        {props.children}
      </body>
    </html>
  );
}

export function EmailStrong(props: HTMLAttributes<HTMLElement>) {
  return <strong {...props} />;
}

export function EmailText(props: EmailProps) {
  const { muted, ...rest } = props;
  return <p {...rest} style={{ margin: "0 0 12px", color: muted ? "#666" : undefined }} />;
}

export type EmailDraft = {
  html: string;
  text: string;
  from: string;
  to: string;
  subject: string;
};

export function renderEmail(element: ReactNode): string {
  return `<!doctype html>${renderToStaticMarkup(<>{element}</>)}`;
}

export function renderEmailText(_element: ReactNode): string {
  return "";
}
