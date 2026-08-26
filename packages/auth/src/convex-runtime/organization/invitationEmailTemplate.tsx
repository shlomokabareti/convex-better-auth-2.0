import {
  Button,
  EmailHeading,
  EmailLayout,
  EmailText,
  renderEmail,
  renderEmailText,
} from "../../lib/email";

import type { OrganizationInvitationEmailDraft } from "./invitationEmail";

export type OrganizationInvitationEmailTemplateProps = {
  acceptUrl: string;
  organizationName: string;
  roleName: string;
  inviterLabel: string;
  expiresAt: number;
};

export function OrganizationInvitationEmailTemplate(
  props: OrganizationInvitationEmailTemplateProps,
) {
  const expiresAt = new Date(props.expiresAt).toUTCString();

  return (
    <EmailLayout preview={`You're invited to ${props.organizationName}`}>
      <EmailHeading>You're invited to {props.organizationName}</EmailHeading>
      <EmailText>
        {props.inviterLabel} invited you to join {props.organizationName} as {props.roleName}.
      </EmailText>
      <Button href={props.acceptUrl}>Accept invitation</Button>
      <EmailText muted>This invitation expires {expiresAt}.</EmailText>
    </EmailLayout>
  );
}

export async function renderOrganizationInvitationEmailDraft(args: {
  from: string;
  to: string;
  acceptUrl: string;
  organizationName: string;
  roleName: string;
  inviterLabel: string;
  expiresAt: number;
}): Promise<OrganizationInvitationEmailDraft> {
  const template = <OrganizationInvitationEmailTemplate {...args} />;
  const [html, text] = await Promise.all([renderEmail(template), renderEmailText(template)]);

  return {
    from: args.from,
    to: args.to,
    subject: `You're invited to ${args.organizationName}`,
    html,
    text,
  };
}
