import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "./cn";
export { cn } from "./cn";

export function Badge(props: HTMLAttributes<HTMLSpanElement> & { variant?: string }) {
  return <span {...props} className={cn(props.className)} />;
}

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return <button type="button" {...props} className={cn(props.className)} />;
}

export function Card(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn(props.className)} />;
}

export function CardContent(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn(props.className)} />;
}

export function CardDescription(props: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn(props.className)} />;
}

export function CardHeader(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn(props.className)} />;
}

export function CardTitle(props: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props} className={cn(props.className)} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(props.className)} />;
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={cn(props.className)} />;
}

export function Separator(props: HTMLAttributes<HTMLHRElement>) {
  return <hr {...props} className={cn(props.className)} />;
}
