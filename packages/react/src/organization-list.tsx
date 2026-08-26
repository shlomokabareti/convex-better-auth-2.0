import { cn } from "./lib/ui";
import { useCallback, type KeyboardEvent } from "react";

// ─── Types ────────────────────────────────────────────────────────────────

export type VortexOrgListOrganization = {
  _id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  roleKey?: string;
};

export type VortexOrgListInvitation = {
  _id: string;
  organizationName: string;
  organizationImageUrl?: string;
  roleKey?: string;
  email?: string;
  expiresAt?: number;
};

export type VortexOrgListClassNames = {
  card?: string;
  header?: string;
  title?: string;
  description?: string;
  body?: string;
  orgItem?: string;
  orgItemActive?: string;
  orgName?: string;
  orgMeta?: string;
  orgImage?: string;
  orgPlaceholder?: string;
  invitationItem?: string;
  invitationMeta?: string;
  actionButton?: string;
  primaryButton?: string;
  secondaryButton?: string;
  dangerButton?: string;
  divider?: string;
  emptyState?: string;
};

export type VortexOrgListCopy = {
  title?: string;
  description?: string;
  membershipsLabel?: string;
  invitationsLabel?: string;
  selectLabel?: string;
  currentLabel?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  createLabel?: string;
  noOrganizationsLabel?: string;
  noInvitationsLabel?: string;
  expiresLabel?: string;
};

export type VortexOrgListProps = {
  organizations: readonly VortexOrgListOrganization[];
  invitations?: readonly VortexOrgListInvitation[];
  currentOrganizationId?: string | null;
  classNames?: VortexOrgListClassNames;
  copy?: VortexOrgListCopy;
  isLoading?: boolean;
  onSelectOrganization: (organizationId: string) => void | Promise<void>;
  onAcceptInvitation?: (invitationId: string) => void | Promise<void>;
  onRejectInvitation?: (invitationId: string) => void | Promise<void>;
  onCreateOrganization?: () => void | Promise<void>;
  showInvitations?: boolean;
};

// ─── Default copy ──────────────────────────────────────────────────────────

const defaultCopy: Required<VortexOrgListCopy> = {
  title: "Workspaces",
  description: "Select a workspace or manage invitations.",
  membershipsLabel: "Your workspaces",
  invitationsLabel: "Invitations",
  selectLabel: "Open",
  currentLabel: "Current",
  acceptLabel: "Accept",
  rejectLabel: "Decline",
  createLabel: "Create workspace",
  noOrganizationsLabel: "You are not a member of any workspace.",
  noInvitationsLabel: "No pending invitations.",
  expiresLabel: "Expires",
};

function resolveCopy(
  copy: VortexOrgListCopy | undefined
): Required<VortexOrgListCopy> {
  return { ...defaultCopy, ...copy };
}

function formatDate(ts?: number): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

// ─── Component ────────────────────────────────────────────────────────────

export function VortexOrganizationList(props: VortexOrgListProps) {
  const {
    organizations,
    invitations = [],
    currentOrganizationId,
    classNames,
    copy,
    isLoading,
    onSelectOrganization,
    onAcceptInvitation,
    onRejectInvitation,
    onCreateOrganization,
    showInvitations = true,
  } = props;

  const resolvedCopy = resolveCopy(copy);

  const handleSelect = useCallback(
    async (id: string) => {
      if (isLoading) return;
      await onSelectOrganization(id);
    },
    [isLoading, onSelectOrganization]
  );

  const handleAccept = useCallback(
    async (id: string) => {
      if (isLoading) return;
      await onAcceptInvitation?.(id);
    },
    [isLoading, onAcceptInvitation]
  );

  const handleReject = useCallback(
    async (id: string) => {
      if (isLoading) return;
      await onRejectInvitation?.(id);
    },
    [isLoading, onRejectInvitation]
  );

  const handleCreate = useCallback(async () => {
    if (isLoading) return;
    await onCreateOrganization?.();
  }, [isLoading, onCreateOrganization]);

  return (
    <div
      className={cn(
        "border-foreground/10 bg-foreground/5 rounded-lg border",
        classNames?.card
      )}
    >
      <OrganizationListHeader classNames={classNames} copy={resolvedCopy} />
      <OrganizationMembershipSection
        classNames={classNames}
        copy={resolvedCopy}
        currentOrganizationId={currentOrganizationId}
        isLoading={isLoading}
        onSelect={handleSelect}
        organizations={organizations}
      />
      {onCreateOrganization ? (
        <CreateOrganizationButton
          classNames={classNames}
          copy={resolvedCopy}
          isLoading={isLoading}
          onCreate={handleCreate}
        />
      ) : null}
      {showInvitations ? (
        <InvitationsSection
          classNames={classNames}
          copy={resolvedCopy}
          invitations={invitations}
          isLoading={isLoading}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      ) : null}
    </div>
  );
}

type ResolvedOrgListCopy = Required<VortexOrgListCopy>;

function OrganizationListHeader(args: {
  classNames?: VortexOrgListClassNames;
  copy: ResolvedOrgListCopy;
}) {
  return (
    <div className={cn("px-5 pt-5 pb-2", args.classNames?.header)}>
      <h3 className={cn("text-base font-semibold", args.classNames?.title)}>
        {args.copy.title}
      </h3>
      <p
        className={cn(
          "text-foreground/60 text-sm",
          args.classNames?.description
        )}
      >
        {args.copy.description}
      </p>
    </div>
  );
}

function OrganizationMembershipSection(args: {
  classNames?: VortexOrgListClassNames;
  copy: ResolvedOrgListCopy;
  currentOrganizationId?: string | null;
  isLoading?: boolean;
  onSelect: (organizationId: string) => void;
  organizations: readonly VortexOrgListOrganization[];
}) {
  return (
    <>
      <div
        className={cn(
          "text-foreground/50 px-5 pb-2 text-xs font-medium",
          args.classNames?.body
        )}
      >
        {args.copy.membershipsLabel}
      </div>
      {args.organizations.length > 0 ? (
        args.organizations.map((organization) => (
          <OrganizationRow
            key={organization._id}
            classNames={args.classNames}
            copy={args.copy}
            isCurrent={organization._id === args.currentOrganizationId}
            isLoading={args.isLoading}
            onSelect={args.onSelect}
            organization={organization}
          />
        ))
      ) : (
        <EmptyState
          classNames={args.classNames}
          label={args.copy.noOrganizationsLabel}
        />
      )}
    </>
  );
}

function OrganizationRow(args: {
  classNames?: VortexOrgListClassNames;
  copy: ResolvedOrgListCopy;
  isCurrent: boolean;
  isLoading?: boolean;
  onSelect: (organizationId: string) => void;
  organization: VortexOrgListOrganization;
}) {
  const { classNames, isCurrent, organization } = args;
  const select = () => {
    if (!isCurrent) args.onSelect(organization._id);
  };
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-5 py-2.5 transition-colors",
        isCurrent ? "bg-foreground/10" : "hover:bg-foreground/5 cursor-pointer",
        isCurrent ? classNames?.orgItemActive : classNames?.orgItem
      )}
      onClick={select}
      role="button"
      tabIndex={isCurrent ? undefined : 0}
      onKeyDown={(event) => handleOrganizationRowKeyDown(event, select)}
    >
      <OrganizationAvatar
        classNames={classNames}
        imageUrl={organization.imageUrl}
        name={organization.name}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-foreground truncate text-sm font-medium",
            classNames?.orgName
          )}
        >
          {organization.name}
        </p>
        {organization.roleKey ? (
          <p className={cn("text-foreground/40 text-xs", classNames?.orgMeta)}>
            {organization.roleKey}
          </p>
        ) : null}
      </div>
      {isCurrent ? (
        <span className="text-success text-xs font-medium">
          {args.copy.currentLabel}
        </span>
      ) : (
        <button
          type="button"
          className={cn(
            "bg-foreground text-background hover:bg-foreground/90 inline-flex h-7 items-center rounded-md px-3 text-xs font-medium transition-colors",
            classNames?.primaryButton
          )}
          onClick={(event) => {
            event.stopPropagation();
            args.onSelect(organization._id);
          }}
          disabled={args.isLoading}
        >
          {args.copy.selectLabel}
        </button>
      )}
    </div>
  );
}

function handleOrganizationRowKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  select: () => void
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select();
  }
}

function OrganizationAvatar(args: {
  classNames?: VortexOrgListClassNames;
  imageUrl?: string;
  name: string;
}) {
  return args.imageUrl ? (
    <img
      src={args.imageUrl}
      alt=""
      className={cn(
        "size-8 rounded-md object-cover",
        args.classNames?.orgImage
      )}
    />
  ) : (
    <span
      className={cn(
        "bg-foreground/10 inline-flex size-8 items-center justify-center rounded-md text-xs font-medium",
        args.classNames?.orgPlaceholder
      )}
    >
      {args.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function CreateOrganizationButton(args: {
  classNames?: VortexOrgListClassNames;
  copy: ResolvedOrgListCopy;
  isLoading?: boolean;
  onCreate: () => void;
}) {
  return (
    <div className={cn("px-5 py-3", args.classNames?.body)}>
      <button
        type="button"
        disabled={args.isLoading}
        onClick={args.onCreate}
        className={cn(
          "border-foreground/15 bg-foreground/5 text-foreground/80 hover:bg-foreground/10 inline-flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          args.classNames?.secondaryButton
        )}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {args.copy.createLabel}
      </button>
    </div>
  );
}

function InvitationsSection(args: {
  classNames?: VortexOrgListClassNames;
  copy: ResolvedOrgListCopy;
  invitations: readonly VortexOrgListInvitation[];
  isLoading?: boolean;
  onAccept: (invitationId: string) => void;
  onReject: (invitationId: string) => void;
}) {
  return (
    <>
      <div
        className={cn(
          "border-foreground/10 border-t",
          args.classNames?.divider
        )}
      />
      <div
        className={cn(
          "text-foreground/50 px-5 py-2 text-xs font-medium",
          args.classNames?.body
        )}
      >
        {args.copy.invitationsLabel}
      </div>
      {args.invitations.length > 0 ? (
        args.invitations.map((invitation) => (
          <InvitationRow
            key={invitation._id}
            invitation={invitation}
            {...args}
          />
        ))
      ) : (
        <EmptyState
          classNames={args.classNames}
          label={args.copy.noInvitationsLabel}
        />
      )}
    </>
  );
}

function InvitationRow(args: {
  classNames?: VortexOrgListClassNames;
  copy: ResolvedOrgListCopy;
  invitation: VortexOrgListInvitation;
  isLoading?: boolean;
  onAccept: (invitationId: string) => void;
  onReject: (invitationId: string) => void;
}) {
  const { classNames, invitation } = args;
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-5 py-2.5",
        classNames?.invitationItem
      )}
    >
      <OrganizationAvatar
        classNames={classNames}
        imageUrl={invitation.organizationImageUrl}
        name={invitation.organizationName}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-foreground truncate text-sm font-medium",
            classNames?.orgName
          )}
        >
          {invitation.organizationName}
        </p>
        <p
          className={cn(
            "text-foreground/40 text-xs",
            classNames?.invitationMeta
          )}
        >
          {formatInvitationMeta(invitation, args.copy)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <InvitationActionButton
          className={classNames?.primaryButton}
          disabled={args.isLoading}
          label={args.copy.acceptLabel}
          onClick={() => args.onAccept(invitation._id)}
          tone="primary"
        />
        <InvitationActionButton
          className={classNames?.secondaryButton}
          disabled={args.isLoading}
          label={args.copy.rejectLabel}
          onClick={() => args.onReject(invitation._id)}
          tone="secondary"
        />
      </div>
    </div>
  );
}

function formatInvitationMeta(
  invitation: VortexOrgListInvitation,
  copy: ResolvedOrgListCopy
): string {
  const role = invitation.roleKey ?? "";
  const expiry = invitation.expiresAt
    ? ` · ${copy.expiresLabel} ${formatDate(invitation.expiresAt)}`
    : "";
  return `${role}${expiry}`;
}

function InvitationActionButton(args: {
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  tone: "primary" | "secondary";
}) {
  const toneClass =
    args.tone === "primary"
      ? "bg-foreground text-background hover:bg-foreground/90"
      : "border border-foreground/15 text-foreground/60 hover:bg-foreground/5";
  return (
    <button
      type="button"
      disabled={args.disabled}
      onClick={args.onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-md px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        toneClass,
        args.className
      )}
    >
      {args.label}
    </button>
  );
}

function EmptyState(args: {
  classNames?: VortexOrgListClassNames;
  label: string;
}) {
  return (
    <div
      className={cn(
        "text-foreground/40 px-5 py-4 text-sm",
        args.classNames?.emptyState
      )}
    >
      {args.label}
    </div>
  );
}
