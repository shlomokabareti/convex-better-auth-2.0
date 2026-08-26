import { cn } from "./lib/ui";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useState, type ReactNode } from "react";

import {
  useGuardedConvexAction,
  useGuardedConvexMutation,
} from "./protected-writes";

export const vortexOrganizationRoleTemplates = [
  "owner",
  "admin",
  "manager",
  "member",
  "viewer",
] as const;

export type VortexOrganizationRoleTemplate =
  (typeof vortexOrganizationRoleTemplates)[number];

export type VortexOrganizationMemberStatus =
  | "active"
  | "pending"
  | "inactive"
  | "suspended";

export type VortexOrganizationMemberListItem<MemberId extends string = string> =
  {
    _id: MemberId;
    roleTemplate: VortexOrganizationRoleTemplate;
    status: VortexOrganizationMemberStatus;
    createdAt?: number;
    updatedAt?: number;
    user?: {
      _id?: string;
      name?: string;
      email?: string | null;
    } | null;
  };

export type VortexOrganizationInviteFormState<
  Role extends string = VortexOrganizationRoleTemplate,
> = {
  email: string;
  roleTemplate: Role;
};

export type VortexOrganizationMembersCopy = {
  loadingMessage?: string;
  emptyMessage: string;
  unknownMemberLabel?: string;
  roleLabel?: string;
  statusLabel?: string;
  suspendLabel?: string;
  suspendingLabel?: string;
  reactivateLabel?: string;
  reactivatingLabel?: string;
  lastOwnerDisabledLabel?: string;
};

export type VortexOrganizationInviteFormCopy = {
  emailLabel?: string;
  emailPlaceholder?: string;
  roleLabel?: string;
  submitLabel?: string;
  submittingLabel?: string;
};

export type VortexOrganizationMembersClassNames = {
  form?: string;
  formGrid?: string;
  label?: string;
  labelText?: string;
  input?: string;
  select?: string;
  primaryButton?: string;
  primaryButtonDisabled?: string;
  list?: string;
  listCard?: string;
  listContent?: string;
  listHeader?: string;
  memberDetails?: string;
  memberName?: string;
  memberEmail?: string;
  memberMetadata?: string;
  status?: string;
  actions?: string;
  secondaryButton?: string;
  secondaryButtonDisabled?: string;
  stateText?: string;
};

export type VortexOrganizationInviteFormProps<
  Role extends string = VortexOrganizationRoleTemplate,
> = {
  classNames?: VortexOrganizationMembersClassNames;
  copy?: VortexOrganizationInviteFormCopy;
  disabled?: boolean;
  inviting: boolean;
  onEmailChange: (value: string) => void;
  onRoleTemplateChange: (value: Role) => void;
  onSubmit: () => void;
  roleOptions: readonly Role[];
  state: VortexOrganizationInviteFormState<Role>;
};

export type VortexOrganizationMemberListProps<
  Role extends string = VortexOrganizationRoleTemplate,
  MemberId extends string = string,
> = {
  canManageMembers?: boolean;
  canManageRoles?: boolean;
  classNames?: VortexOrganizationMembersClassNames;
  copy: VortexOrganizationMembersCopy;
  formatTimestamp?: (timestamp: number) => string;
  members: readonly VortexOrganizationMemberListItem<MemberId>[] | undefined;
  mutatingMemberId?: MemberId | null;
  onReactivate?: (membershipId: MemberId) => void;
  onRoleChange?: (membershipId: MemberId, roleTemplate: Role) => void;
  onSuspend?: (membershipId: MemberId) => void;
  renderStatus?: (status: VortexOrganizationMemberStatus) => ReactNode;
  roleOptions: readonly Role[];
};

export type VortexOrganizationInviteMemberResult<
  InvitationId extends string = string,
> = {
  acceptUrl: string;
  invitationId: InvitationId;
  token: string;
};

export type VortexOrganizationMemberFunctionReferences<
  Role extends string = VortexOrganizationRoleTemplate,
  MemberId extends string = string,
  OrganizationId extends string = string,
  InvitationId extends string = string,
> = {
  inviteMember: FunctionReference<
    "action",
    "public",
    { email: string; organizationId: OrganizationId; roleTemplate: Role },
    VortexOrganizationInviteMemberResult<InvitationId>
  >;
  listMembers: FunctionReference<
    "query",
    "public",
    EmptyArgs,
    readonly VortexOrganizationMemberListItem<MemberId>[]
  >;
  reactivateMember: FunctionReference<
    "mutation",
    "public",
    { membershipId: string },
    unknown
  >;
  setMemberRole: FunctionReference<
    "mutation",
    "public",
    { membershipId: string; roleTemplate: string },
    unknown
  >;
  suspendMember: FunctionReference<
    "mutation",
    "public",
    { membershipId: string },
    unknown
  >;
};

export type VortexOrganizationMembersSurfaceCopy = {
  actionErrorTitle?: string;
  invitationLinkTitle?: string;
  invite?: VortexOrganizationInviteFormCopy;
  members?: Partial<VortexOrganizationMembersCopy>;
};

export type VortexOrganizationMembersSurfaceProps<
  Role extends string = VortexOrganizationRoleTemplate,
  MemberId extends string = string,
  OrganizationId extends string = string,
  InvitationId extends string = string,
> = {
  canManageMembers?: boolean;
  canManageRoles?: boolean;
  captureEvent?: (name: string, properties: Record<string, unknown>) => void;
  classNames?: VortexOrganizationMembersClassNames;
  confirmSuspendMember?: (args: {
    membershipId: MemberId;
  }) => boolean | Promise<boolean>;
  copy?: VortexOrganizationMembersSurfaceCopy;
  defaultInviteRoleTemplate?: Role;
  getErrorMessage?: (error: unknown, fallback: string) => string;
  organizationId?: OrganizationId;
  refs: VortexOrganizationMemberFunctionReferences<
    Role,
    MemberId,
    OrganizationId,
    InvitationId
  >;
  renderActionError?: (message: string) => ReactNode;
  renderInvitationLink?: (args: { title: string; value: string }) => ReactNode;
  renderStatus?: (status: VortexOrganizationMemberStatus) => ReactNode;
  roleOptions: readonly Role[];
};

type EmptyArgs = Record<string, never>;
type ActionRunner<Args, Result> = (args: Args) => Promise<Result>;

const defaultInviteCopy = {
  emailLabel: "Email",
  emailPlaceholder: "teammate@example.com",
  roleLabel: "Role",
  submitLabel: "Invite member",
  submittingLabel: "Inviting...",
} satisfies Required<VortexOrganizationInviteFormCopy>;

const defaultMembersCopy = {
  emptyMessage: "No organization members yet.",
  lastOwnerDisabledLabel: "Last active owner",
  loadingMessage: "Loading members...",
  reactivateLabel: "Reactivate",
  reactivatingLabel: "Reactivating...",
  roleLabel: "Role",
  statusLabel: "Status",
  suspendLabel: "Suspend",
  suspendingLabel: "Suspending...",
  unknownMemberLabel: "Unknown member",
} satisfies VortexOrganizationMembersCopy;

const defaultSurfaceCopy = {
  actionErrorTitle: "Action failed",
  invitationLinkTitle: "Invitation link",
} satisfies Required<
  Omit<VortexOrganizationMembersSurfaceCopy, "invite" | "members">
>;

export function canSubmitVortexOrganizationInviteForm({
  disabled,
  email,
  inviting,
  roleTemplate,
}: {
  disabled?: boolean;
  email: string;
  inviting: boolean;
  roleTemplate: string;
}): boolean {
  return (
    !disabled &&
    !inviting &&
    isValidInviteEmail(email) &&
    roleTemplate.trim().length > 0
  );
}

export function getVortexOrganizationMemberLabel(
  member: Pick<VortexOrganizationMemberListItem, "user">,
  unknownMemberLabel = defaultMembersCopy.unknownMemberLabel
): string {
  return member.user?.name ?? member.user?.email ?? unknownMemberLabel;
}

export function getVortexOrganizationRoleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function getVortexOrganizationMemberStatusLabel(
  status: VortexOrganizationMemberStatus
): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function countVortexActiveOwners(
  members: readonly Pick<
    VortexOrganizationMemberListItem,
    "roleTemplate" | "status"
  >[]
): number {
  return members.filter(
    (member) => member.roleTemplate === "owner" && member.status === "active"
  ).length;
}

export function isVortexLastActiveOwner(
  member: Pick<VortexOrganizationMemberListItem, "roleTemplate" | "status">,
  activeOwnerCount: number
): boolean {
  return (
    member.roleTemplate === "owner" &&
    member.status === "active" &&
    activeOwnerCount <= 1
  );
}

export function formatVortexOrganizationMemberTimestamp(
  timestamp: number
): string {
  return new Date(timestamp).toLocaleString();
}

export function VortexOrganizationInviteForm<
  Role extends string = VortexOrganizationRoleTemplate,
>({
  classNames,
  copy,
  disabled,
  inviting,
  onEmailChange,
  onRoleTemplateChange,
  onSubmit,
  roleOptions,
  state,
}: VortexOrganizationInviteFormProps<Role>) {
  const resolvedCopy = resolveInviteCopy(copy);
  const canInvite = canSubmitVortexOrganizationInviteForm({
    disabled,
    email: state.email,
    inviting,
    roleTemplate: state.roleTemplate,
  });

  return (
    <div
      className={cn(
        "border-foreground/10 bg-background/20 rounded-lg border p-5",
        classNames?.form
      )}
    >
      <div
        className={cn(
          "grid gap-3 md:grid-cols-[1fr_12rem_auto]",
          classNames?.formGrid
        )}
      >
        <label className={cn("block space-y-2 text-sm", classNames?.label)}>
          <span className={cn("text-foreground/70", classNames?.labelText)}>
            {resolvedCopy.emailLabel}
          </span>
          <input
            className={cn(
              "border-foreground/10 bg-foreground/5 text-foreground placeholder:text-foreground/35 focus:border-foreground/25 h-10 w-full rounded-md border px-3 text-sm transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-60",
              classNames?.input
            )}
            disabled={disabled}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder={resolvedCopy.emailPlaceholder}
            type="email"
            value={state.email}
          />
        </label>
        <label className={cn("block space-y-2 text-sm", classNames?.label)}>
          <span className={cn("text-foreground/70", classNames?.labelText)}>
            {resolvedCopy.roleLabel}
          </span>
          <select
            aria-label="Invitation role"
            className={cn(
              "border-foreground/10 bg-foreground/5 text-foreground focus:border-foreground/25 h-10 w-full rounded-md border px-3 text-sm transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-60",
              classNames?.select
            )}
            disabled={disabled}
            onChange={(event) => {
              const role = roleOptions.find(
                (option) => option === event.target.value
              );
              if (role !== undefined) onRoleTemplateChange(role);
            }}
            value={state.roleTemplate}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {getVortexOrganizationRoleLabel(role)}
              </option>
            ))}
          </select>
        </label>
        <button
          className={cn(
            "bg-foreground text-background hover:bg-foreground/90 mt-auto inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            classNames?.primaryButton,
            !canInvite && classNames?.primaryButtonDisabled
          )}
          disabled={!canInvite}
          onClick={onSubmit}
          type="button"
        >
          {inviting ? resolvedCopy.submittingLabel : resolvedCopy.submitLabel}
        </button>
      </div>
    </div>
  );
}

export function VortexOrganizationMemberList<
  Role extends string = VortexOrganizationRoleTemplate,
  MemberId extends string = string,
>({
  canManageMembers = true,
  canManageRoles = true,
  classNames,
  copy,
  formatTimestamp = formatVortexOrganizationMemberTimestamp,
  members,
  mutatingMemberId,
  onReactivate,
  onRoleChange,
  onSuspend,
  renderStatus,
  roleOptions,
}: VortexOrganizationMemberListProps<Role, MemberId>) {
  const resolvedCopy = resolveMembersCopy(copy);

  if (members === undefined) {
    return (
      <p className={cn("text-foreground/50 text-sm", classNames?.stateText)}>
        {resolvedCopy.loadingMessage}
      </p>
    );
  }

  if (members.length === 0) {
    return (
      <p className={cn("text-foreground/50 text-sm", classNames?.stateText)}>
        {resolvedCopy.emptyMessage}
      </p>
    );
  }

  const activeOwnerCount = countVortexActiveOwners(members);

  return (
    <div className={cn("space-y-3", classNames?.list)}>
      {members.map((member) => (
        <VortexOrganizationMemberCard<Role, MemberId>
          activeOwnerCount={activeOwnerCount}
          canManageMembers={canManageMembers}
          canManageRoles={canManageRoles}
          classNames={classNames}
          copy={resolvedCopy}
          formatTimestamp={formatTimestamp}
          key={member._id}
          member={member}
          mutatingMemberId={mutatingMemberId}
          onReactivate={onReactivate}
          onRoleChange={onRoleChange}
          onSuspend={onSuspend}
          renderStatus={renderStatus}
          roleOptions={roleOptions}
        />
      ))}
    </div>
  );
}

function VortexOrganizationMemberCard<
  Role extends string = VortexOrganizationRoleTemplate,
  MemberId extends string = string,
>({
  activeOwnerCount,
  canManageMembers,
  canManageRoles,
  classNames,
  copy,
  formatTimestamp,
  member,
  mutatingMemberId,
  onReactivate,
  onRoleChange,
  onSuspend,
  renderStatus,
  roleOptions,
}: {
  activeOwnerCount: number;
  canManageMembers: boolean;
  canManageRoles: boolean;
  classNames: VortexOrganizationMembersClassNames | undefined;
  copy: Required<VortexOrganizationMembersCopy>;
  formatTimestamp: (timestamp: number) => string;
  member: VortexOrganizationMemberListItem<MemberId>;
  mutatingMemberId: MemberId | null | undefined;
  onReactivate: ((membershipId: MemberId) => void) | undefined;
  onRoleChange:
    | ((membershipId: MemberId, roleTemplate: Role) => void)
    | undefined;
  onSuspend: ((membershipId: MemberId) => void) | undefined;
  renderStatus:
    | ((status: VortexOrganizationMemberStatus) => ReactNode)
    | undefined;
  roleOptions: readonly Role[];
}) {
  const label = getVortexOrganizationMemberLabel(
    member,
    copy.unknownMemberLabel
  );
  const isLastOwner = isVortexLastActiveOwner(member, activeOwnerCount);
  const isMutating = mutatingMemberId === member._id;

  return (
    <article
      className={cn(
        "border-foreground/10 bg-background/20 rounded-lg border",
        classNames?.listCard
      )}
      data-testid="organization-member-card"
    >
      <div className={cn("space-y-4 p-5", classNames?.listContent)}>
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-4",
            classNames?.listHeader
          )}
        >
          <VortexOrganizationMemberDetails
            classNames={classNames}
            formatTimestamp={formatTimestamp}
            label={label}
            member={member}
          />
          <VortexOrganizationMemberActions<Role, MemberId>
            canManageMembers={canManageMembers}
            canManageRoles={canManageRoles}
            classNames={classNames}
            copy={copy}
            isLastOwner={isLastOwner}
            isMutating={isMutating}
            label={label}
            member={member}
            onReactivate={onReactivate}
            onRoleChange={onRoleChange}
            onSuspend={onSuspend}
            renderStatus={renderStatus}
            roleOptions={roleOptions}
          />
        </div>
        {isLastOwner ? (
          <p className="text-warning text-xs">{copy.lastOwnerDisabledLabel}</p>
        ) : null}
      </div>
    </article>
  );
}

function VortexOrganizationMemberDetails<MemberId extends string = string>({
  classNames,
  formatTimestamp,
  label,
  member,
}: {
  classNames: VortexOrganizationMembersClassNames | undefined;
  formatTimestamp: (timestamp: number) => string;
  label: string;
  member: VortexOrganizationMemberListItem<MemberId>;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", classNames?.memberDetails)}>
      <p
        className={cn(
          "text-foreground truncate font-medium",
          classNames?.memberName
        )}
      >
        {label}
      </p>
      {member.user?.email ? (
        <p
          className={cn(
            "text-foreground/45 truncate text-xs",
            classNames?.memberEmail
          )}
        >
          {member.user.email}
        </p>
      ) : null}
      {member.createdAt ? (
        <p
          className={cn(
            "text-foreground/45 text-xs",
            classNames?.memberMetadata
          )}
        >
          Added {formatTimestamp(member.createdAt)}
        </p>
      ) : null}
    </div>
  );
}

function VortexOrganizationMemberActions<
  Role extends string = VortexOrganizationRoleTemplate,
  MemberId extends string = string,
>({
  canManageMembers,
  canManageRoles,
  classNames,
  copy,
  isLastOwner,
  isMutating,
  label,
  member,
  onReactivate,
  onRoleChange,
  onSuspend,
  renderStatus,
  roleOptions,
}: {
  canManageMembers: boolean;
  canManageRoles: boolean;
  classNames: VortexOrganizationMembersClassNames | undefined;
  copy: Required<VortexOrganizationMembersCopy>;
  isLastOwner: boolean;
  isMutating: boolean;
  label: string;
  member: VortexOrganizationMemberListItem<MemberId>;
  onReactivate: ((membershipId: MemberId) => void) | undefined;
  onRoleChange:
    | ((membershipId: MemberId, roleTemplate: Role) => void)
    | undefined;
  onSuspend: ((membershipId: MemberId) => void) | undefined;
  renderStatus:
    | ((status: VortexOrganizationMemberStatus) => ReactNode)
    | undefined;
  roleOptions: readonly Role[];
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-end gap-3",
        classNames?.actions
      )}
    >
      <VortexOrganizationMemberRoleSelect<Role, MemberId>
        canManageRoles={canManageRoles}
        classNames={classNames}
        copy={copy}
        isLastOwner={isLastOwner}
        isMutating={isMutating}
        label={label}
        member={member}
        onRoleChange={onRoleChange}
        roleOptions={roleOptions}
      />
      <VortexOrganizationMemberStatusSlot
        classNames={classNames}
        copy={copy}
        member={member}
        renderStatus={renderStatus}
      />
      <VortexOrganizationMemberLifecycleButtons
        canManageMembers={canManageMembers}
        classNames={classNames}
        copy={copy}
        isLastOwner={isLastOwner}
        isMutating={isMutating}
        member={member}
        onReactivate={onReactivate}
        onSuspend={onSuspend}
      />
    </div>
  );
}

function VortexOrganizationMemberRoleSelect<
  Role extends string = VortexOrganizationRoleTemplate,
  MemberId extends string = string,
>({
  canManageRoles,
  classNames,
  copy,
  isLastOwner,
  isMutating,
  label,
  member,
  onRoleChange,
  roleOptions,
}: {
  canManageRoles: boolean;
  classNames: VortexOrganizationMembersClassNames | undefined;
  copy: Required<VortexOrganizationMembersCopy>;
  isLastOwner: boolean;
  isMutating: boolean;
  label: string;
  member: VortexOrganizationMemberListItem<MemberId>;
  onRoleChange:
    | ((membershipId: MemberId, roleTemplate: Role) => void)
    | undefined;
  roleOptions: readonly Role[];
}) {
  const canChangeRole =
    canManageRoles &&
    member.status !== "pending" &&
    !isLastOwner &&
    Boolean(onRoleChange);

  return (
    <label className={cn("block space-y-2 text-sm", classNames?.label)}>
      <span className={cn("text-foreground/70", classNames?.labelText)}>
        {copy.roleLabel}
      </span>
      <select
        aria-label={`Role for ${label}`}
        className={cn(
          "border-foreground/10 bg-foreground/5 text-foreground focus:border-foreground/25 h-9 min-w-32 rounded-md border px-3 text-sm transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-60",
          classNames?.select
        )}
        disabled={!canChangeRole || isMutating}
        onChange={(event) => {
          const role = roleOptions.find(
            (option) => option === event.target.value
          );
          if (role !== undefined) onRoleChange?.(member._id, role);
        }}
        value={member.roleTemplate}
      >
        {roleOptions.map((role) => (
          <option key={role} value={role}>
            {getVortexOrganizationRoleLabel(role)}
          </option>
        ))}
      </select>
    </label>
  );
}

function VortexOrganizationMemberStatusSlot<MemberId extends string = string>({
  classNames,
  copy,
  member,
  renderStatus,
}: {
  classNames: VortexOrganizationMembersClassNames | undefined;
  copy: Required<VortexOrganizationMembersCopy>;
  member: VortexOrganizationMemberListItem<MemberId>;
  renderStatus:
    | ((status: VortexOrganizationMemberStatus) => ReactNode)
    | undefined;
}) {
  return (
    <div className="space-y-2 text-sm">
      <span className={cn("text-foreground/70 block", classNames?.labelText)}>
        {copy.statusLabel}
      </span>
      {renderStatus ? (
        renderStatus(member.status)
      ) : (
        <span
          className={cn(
            "border-foreground/10 text-foreground/70 inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium",
            classNames?.status
          )}
        >
          {getVortexOrganizationMemberStatusLabel(member.status)}
        </span>
      )}
    </div>
  );
}

function VortexOrganizationMemberLifecycleButtons<
  MemberId extends string = string,
>({
  canManageMembers,
  classNames,
  copy,
  isLastOwner,
  isMutating,
  member,
  onReactivate,
  onSuspend,
}: {
  canManageMembers: boolean;
  classNames: VortexOrganizationMembersClassNames | undefined;
  copy: Required<VortexOrganizationMembersCopy>;
  isLastOwner: boolean;
  isMutating: boolean;
  member: VortexOrganizationMemberListItem<MemberId>;
  onReactivate: ((membershipId: MemberId) => void) | undefined;
  onSuspend: ((membershipId: MemberId) => void) | undefined;
}) {
  const canSuspend =
    canManageMembers &&
    member.status === "active" &&
    !isLastOwner &&
    Boolean(onSuspend);
  const canReactivate =
    canManageMembers && member.status === "suspended" && Boolean(onReactivate);

  return (
    <>
      <VortexOrganizationMemberSuspendButton
        canSuspend={canSuspend}
        classNames={classNames}
        copy={copy}
        isMutating={isMutating}
        member={member}
        onSuspend={onSuspend}
      />
      <VortexOrganizationMemberReactivateButton
        canReactivate={canReactivate}
        classNames={classNames}
        copy={copy}
        isMutating={isMutating}
        member={member}
        onReactivate={onReactivate}
      />
    </>
  );
}

function VortexOrganizationMemberSuspendButton<
  MemberId extends string = string,
>({
  canSuspend,
  classNames,
  copy,
  isMutating,
  member,
  onSuspend,
}: {
  canSuspend: boolean;
  classNames: VortexOrganizationMembersClassNames | undefined;
  copy: Required<VortexOrganizationMembersCopy>;
  isMutating: boolean;
  member: VortexOrganizationMemberListItem<MemberId>;
  onSuspend: ((membershipId: MemberId) => void) | undefined;
}) {
  if (member.status !== "active" || !onSuspend) {
    return null;
  }

  return (
    <VortexOrganizationMemberLifecycleButton
      classNames={classNames}
      disabled={!canSuspend || isMutating}
      label={isMutating ? copy.suspendingLabel : copy.suspendLabel}
      onClick={() => onSuspend(member._id)}
    />
  );
}

function VortexOrganizationMemberReactivateButton<
  MemberId extends string = string,
>({
  canReactivate,
  classNames,
  copy,
  isMutating,
  member,
  onReactivate,
}: {
  canReactivate: boolean;
  classNames: VortexOrganizationMembersClassNames | undefined;
  copy: Required<VortexOrganizationMembersCopy>;
  isMutating: boolean;
  member: VortexOrganizationMemberListItem<MemberId>;
  onReactivate: ((membershipId: MemberId) => void) | undefined;
}) {
  if (member.status !== "suspended" || !onReactivate) {
    return null;
  }

  return (
    <VortexOrganizationMemberLifecycleButton
      classNames={classNames}
      disabled={!canReactivate || isMutating}
      label={isMutating ? copy.reactivatingLabel : copy.reactivateLabel}
      onClick={() => onReactivate(member._id)}
    />
  );
}

function VortexOrganizationMemberLifecycleButton({
  classNames,
  disabled,
  label,
  onClick,
}: {
  classNames: VortexOrganizationMembersClassNames | undefined;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "border-foreground/15 text-foreground/70 hover:bg-foreground/5 mt-auto inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        classNames?.secondaryButton,
        disabled && classNames?.secondaryButtonDisabled
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

export function VortexOrganizationMembersSurface<
  Role extends string = VortexOrganizationRoleTemplate,
  MemberId extends string = string,
  OrganizationId extends string = string,
  InvitationId extends string = string,
>({
  canManageMembers = true,
  canManageRoles = true,
  captureEvent,
  classNames,
  confirmSuspendMember,
  copy,
  defaultInviteRoleTemplate,
  getErrorMessage = getVortexOrganizationMemberMutationErrorMessage,
  organizationId,
  refs,
  renderActionError,
  renderInvitationLink,
  renderStatus,
  roleOptions,
}: VortexOrganizationMembersSurfaceProps<
  Role,
  MemberId,
  OrganizationId,
  InvitationId
>) {
  const members = useQuery(refs.listMembers, {});
  const actions = useVortexOrganizationMemberActions({
    captureEvent,
    confirmSuspendMember,
    defaultInviteRoleTemplate,
    getErrorMessage,
    organizationId,
    refs,
    roleOptions,
  });
  const invitationLinkTitle =
    copy?.invitationLinkTitle ?? defaultSurfaceCopy.invitationLinkTitle;

  return (
    <>
      <VortexOrganizationInviteForm<Role>
        classNames={classNames}
        copy={copy?.invite}
        disabled={!organizationId}
        inviting={actions.inviting}
        onEmailChange={actions.setInviteEmail}
        onRoleTemplateChange={actions.setInviteRoleTemplate}
        onSubmit={actions.invite}
        roleOptions={roleOptions}
        state={{
          email: actions.inviteEmail,
          roleTemplate: actions.inviteRoleTemplate,
        }}
      />
      <VortexOrganizationInvitationLinkSlot
        classNames={classNames}
        renderInvitationLink={renderInvitationLink}
        title={invitationLinkTitle}
        value={actions.latestInviteAcceptUrl}
      />
      <VortexOrganizationMemberActionErrorSlot
        classNames={classNames}
        message={actions.actionError}
        renderActionError={renderActionError}
        title={copy?.actionErrorTitle ?? defaultSurfaceCopy.actionErrorTitle}
      />
      <VortexOrganizationMemberList<Role, MemberId>
        canManageMembers={canManageMembers}
        canManageRoles={canManageRoles}
        classNames={classNames}
        copy={resolveMembersCopy(copy?.members)}
        members={members}
        mutatingMemberId={actions.mutatingMemberId}
        onReactivate={actions.reactivate}
        onRoleChange={actions.setRole}
        onSuspend={actions.suspend}
        renderStatus={renderStatus}
        roleOptions={roleOptions}
      />
    </>
  );
}

function VortexOrganizationInvitationLinkSlot({
  classNames,
  renderInvitationLink,
  title,
  value,
}: {
  classNames: VortexOrganizationMembersClassNames | undefined;
  renderInvitationLink: VortexOrganizationMembersSurfaceProps["renderInvitationLink"];
  title: string;
  value: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    renderInvitationLink?.({ title, value }) ?? (
      <VortexOrganizationInvitationLinkNotice
        classNames={classNames}
        title={title}
        value={value}
      />
    )
  );
}

function VortexOrganizationMemberActionErrorSlot({
  classNames,
  message,
  renderActionError,
  title,
}: {
  classNames: VortexOrganizationMembersClassNames | undefined;
  message: string | null;
  renderActionError: VortexOrganizationMembersSurfaceProps["renderActionError"];
  title: string;
}) {
  if (!message) {
    return null;
  }

  return (
    renderActionError?.(message) ?? (
      <VortexOrganizationMemberActionErrorNotice
        classNames={classNames}
        message={message}
        title={title}
      />
    )
  );
}

function isValidInviteEmail(email: string): boolean {
  const value = email.trim();
  return (
    value.includes("@") &&
    value.indexOf("@") > 0 &&
    value.indexOf("@") < value.length - 1
  );
}

function useVortexOrganizationMemberActions<
  Role extends string = VortexOrganizationRoleTemplate,
  MemberId extends string = string,
  OrganizationId extends string = string,
  InvitationId extends string = string,
>({
  captureEvent,
  confirmSuspendMember,
  defaultInviteRoleTemplate,
  getErrorMessage,
  organizationId,
  refs,
  roleOptions,
}: {
  captureEvent:
    | ((name: string, properties: Record<string, unknown>) => void)
    | undefined;
  confirmSuspendMember:
    | ((args: { membershipId: MemberId }) => boolean | Promise<boolean>)
    | undefined;
  defaultInviteRoleTemplate: Role | undefined;
  getErrorMessage: (error: unknown, fallback: string) => string;
  organizationId: OrganizationId | undefined;
  refs: VortexOrganizationMemberFunctionReferences<
    Role,
    MemberId,
    OrganizationId,
    InvitationId
  >;
  roleOptions: readonly Role[];
}) {
  const mutations = useVortexOrganizationMemberMutationRunners<
    Role,
    MemberId,
    OrganizationId,
    InvitationId
  >(refs);
  const [inviteForm, setInviteForm] = useState<
    VortexOrganizationInviteFormState<Role>
  >({
    email: "",
    roleTemplate: resolveVortexOrganizationDefaultInviteRole({
      defaultInviteRoleTemplate,
      roleOptions,
    }),
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [latestInviteAcceptUrl, setLatestInviteAcceptUrl] = useState<
    string | null
  >(null);
  const [mutatingMemberId, setMutatingMemberId] = useState<MemberId | null>(
    null
  );

  const setMutationError = (error: unknown, fallback: string) =>
    setActionError(getErrorMessage(error, fallback));
  const mutationContext = {
    captureEvent,
    organizationId,
    setActionError,
    setMutationError,
    setMutatingMemberId,
  };

  return {
    actionError,
    invite: () => {
      inviteOrganizationMember({
        captureEvent,
        defaultInviteRoleTemplate,
        inviteForm,
        inviteMember: mutations.inviteMember,
        inviting,
        organizationId,
        roleOptions,
        setActionError,
        setInviteForm,
        setInviting,
        setLatestInviteAcceptUrl,
        setMutationError,
      });
    },
    inviteEmail: inviteForm.email,
    inviteRoleTemplate: inviteForm.roleTemplate,
    inviting,
    latestInviteAcceptUrl,
    mutatingMemberId,
    reactivate: (membershipId: MemberId) => {
      reactivateOrganizationMember({
        membershipId,
        ...mutationContext,
        reactivateMember: () => mutations.reactivateMember({ membershipId }),
      });
    },
    setInviteEmail: (email: string) => {
      setInviteForm((current) => ({ ...current, email }));
    },
    setInviteRoleTemplate: (roleTemplate: Role) => {
      setInviteForm((current) => ({ ...current, roleTemplate }));
    },
    setRole: (membershipId: MemberId, roleTemplate: Role) => {
      updateOrganizationMemberRole({
        membershipId,
        roleTemplate,
        ...mutationContext,
        setMemberRole: () =>
          mutations.setMemberRole({ membershipId, roleTemplate }),
      });
    },
    suspend: (membershipId: MemberId) => {
      void suspendMemberAfterConfirmation({
        confirmSuspendMember,
        membershipId,
        ...mutationContext,
        suspendMember: () => mutations.suspendMember({ membershipId }),
      });
    },
  };
}

function useVortexOrganizationMemberMutationRunners<
  Role extends string = VortexOrganizationRoleTemplate,
  MemberId extends string = string,
  OrganizationId extends string = string,
  InvitationId extends string = string,
>(
  refs: VortexOrganizationMemberFunctionReferences<
    Role,
    MemberId,
    OrganizationId,
    InvitationId
  >
) {
  const inviteMember = useGuardedConvexAction(useAction(refs.inviteMember));
  const reactivateMember = useGuardedConvexMutation(
    useMutation(refs.reactivateMember)
  );
  const setMemberRole = useGuardedConvexMutation(
    useMutation(refs.setMemberRole)
  );
  const suspendMember = useGuardedConvexMutation(
    useMutation(refs.suspendMember)
  );

  return { inviteMember, reactivateMember, setMemberRole, suspendMember };
}

function inviteOrganizationMember<
  Role extends string = VortexOrganizationRoleTemplate,
  OrganizationId extends string = string,
  InvitationId extends string = string,
>({
  captureEvent,
  defaultInviteRoleTemplate,
  inviteForm,
  inviteMember,
  inviting,
  organizationId,
  roleOptions,
  setActionError,
  setInviteForm,
  setInviting,
  setLatestInviteAcceptUrl,
  setMutationError,
}: {
  captureEvent:
    | ((name: string, properties: Record<string, unknown>) => void)
    | undefined;
  defaultInviteRoleTemplate: Role | undefined;
  inviteForm: VortexOrganizationInviteFormState<Role>;
  inviteMember: ActionRunner<
    { email: string; organizationId: OrganizationId; roleTemplate: Role },
    VortexOrganizationInviteMemberResult<InvitationId>
  >;
  inviting: boolean;
  organizationId: OrganizationId | undefined;
  roleOptions: readonly Role[];
  setActionError: (error: string | null) => void;
  setInviteForm: (value: VortexOrganizationInviteFormState<Role>) => void;
  setInviting: (value: boolean) => void;
  setLatestInviteAcceptUrl: (url: string | null) => void;
  setMutationError: (error: unknown, fallback: string) => void;
}) {
  if (!organizationId || inviting) {
    return;
  }

  setInviting(true);
  setActionError(null);
  setLatestInviteAcceptUrl(null);
  void inviteMember({
    email: inviteForm.email.trim(),
    organizationId,
    roleTemplate: inviteForm.roleTemplate,
  })
    .then((result) => {
      setLatestInviteAcceptUrl(result.acceptUrl);
      setInviteForm({
        email: "",
        roleTemplate: resolveVortexOrganizationDefaultInviteRole({
          defaultInviteRoleTemplate,
          roleOptions,
        }),
      });
      captureEvent?.("organization_member_invited", {
        invitationId: result.invitationId,
        organizationId,
        roleTemplate: inviteForm.roleTemplate,
      });
    })
    .catch((error: unknown) => {
      setMutationError(error, "Could not invite member.");
    })
    .finally(() => {
      setInviting(false);
    });
}

function reactivateOrganizationMember<MemberId extends string = string>({
  captureEvent,
  membershipId,
  organizationId,
  reactivateMember,
  setActionError,
  setMutationError,
  setMutatingMemberId,
}: {
  captureEvent:
    | ((name: string, properties: Record<string, unknown>) => void)
    | undefined;
  membershipId: MemberId;
  organizationId: string | undefined;
  reactivateMember: () => Promise<unknown>;
  setActionError: (error: string | null) => void;
  setMutationError: (error: unknown, fallback: string) => void;
  setMutatingMemberId: (membershipId: MemberId | null) => void;
}) {
  setMutatingMemberId(membershipId);
  setActionError(null);
  void reactivateMember()
    .then(() => {
      captureEvent?.("organization_member_reactivated", {
        membershipId,
        organizationId,
      });
    })
    .catch((error: unknown) => {
      setMutationError(error, "Could not reactivate member.");
    })
    .finally(() => {
      setMutatingMemberId(null);
    });
}

function updateOrganizationMemberRole<MemberId extends string = string>({
  captureEvent,
  membershipId,
  organizationId,
  roleTemplate,
  setActionError,
  setMemberRole,
  setMutationError,
  setMutatingMemberId,
}: {
  captureEvent:
    | ((name: string, properties: Record<string, unknown>) => void)
    | undefined;
  membershipId: MemberId;
  organizationId: string | undefined;
  roleTemplate: string;
  setActionError: (error: string | null) => void;
  setMemberRole: () => Promise<unknown>;
  setMutationError: (error: unknown, fallback: string) => void;
  setMutatingMemberId: (membershipId: MemberId | null) => void;
}) {
  setMutatingMemberId(membershipId);
  setActionError(null);
  void setMemberRole()
    .then(() => {
      captureEvent?.("organization_member_role_changed", {
        membershipId,
        organizationId,
        roleTemplate,
      });
    })
    .catch((error: unknown) => {
      setMutationError(error, "Could not change member role.");
    })
    .finally(() => {
      setMutatingMemberId(null);
    });
}

async function suspendMemberAfterConfirmation<
  MemberId extends string = string,
>({
  captureEvent,
  confirmSuspendMember,
  membershipId,
  organizationId,
  setActionError,
  setMutationError,
  setMutatingMemberId,
  suspendMember,
}: {
  captureEvent:
    | ((name: string, properties: Record<string, unknown>) => void)
    | undefined;
  confirmSuspendMember:
    | ((args: { membershipId: MemberId }) => boolean | Promise<boolean>)
    | undefined;
  membershipId: MemberId;
  organizationId: string | undefined;
  setActionError: (error: string | null) => void;
  setMutationError: (error: unknown, fallback: string) => void;
  setMutatingMemberId: (membershipId: MemberId | null) => void;
  suspendMember: () => Promise<unknown>;
}) {
  const confirmed = confirmSuspendMember
    ? await confirmSuspendMember({ membershipId })
    : true;
  if (!confirmed) {
    return;
  }

  setMutatingMemberId(membershipId);
  setActionError(null);
  try {
    await suspendMember();
    captureEvent?.("organization_member_suspended", {
      membershipId,
      organizationId,
    });
  } catch (error) {
    setMutationError(error, "Could not suspend member.");
  } finally {
    setMutatingMemberId(null);
  }
}

export function getVortexOrganizationMemberMutationErrorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

export function resolveVortexOrganizationDefaultInviteRole<
  Role extends string = VortexOrganizationRoleTemplate,
>({
  defaultInviteRoleTemplate,
  roleOptions,
}: {
  defaultInviteRoleTemplate?: Role;
  roleOptions: readonly Role[];
}): Role {
  const role = defaultInviteRoleTemplate ?? roleOptions[0];
  if (role === undefined) {
    throw new Error("At least one organization role option is required");
  }
  return role;
}

export function VortexOrganizationInvitationLinkNotice({
  classNames,
  title,
  value,
}: {
  classNames?: VortexOrganizationMembersClassNames;
  title: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "border-info/25 bg-info/10 rounded-lg border p-4",
        classNames?.listCard
      )}
    >
      <p
        className={cn("text-info text-sm font-medium", classNames?.memberName)}
      >
        {title}
      </p>
      <code
        className={cn(
          "text-info mt-2 block text-xs break-all",
          classNames?.memberEmail
        )}
      >
        {value}
      </code>
    </div>
  );
}

export function VortexOrganizationMemberActionErrorNotice({
  classNames,
  message,
  title,
}: {
  classNames?: VortexOrganizationMembersClassNames;
  message: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "border-destructive/25 bg-destructive/10 rounded-lg border p-4",
        classNames?.listCard
      )}
    >
      <p
        className={cn(
          "text-destructive text-sm font-medium",
          classNames?.memberName
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "text-destructive/80 mt-1 text-sm",
          classNames?.memberEmail
        )}
      >
        {message}
      </p>
    </div>
  );
}

function resolveInviteCopy(
  copy: VortexOrganizationInviteFormCopy | undefined
): Required<VortexOrganizationInviteFormCopy> {
  return { ...defaultInviteCopy, ...copy };
}

function resolveMembersCopy(
  copy: Partial<VortexOrganizationMembersCopy> | undefined
): Required<VortexOrganizationMembersCopy> {
  return { ...defaultMembersCopy, ...copy };
}
