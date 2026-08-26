import { cn } from "./lib/ui";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────

export type ConvexOrgSwitcherOrganization = {
  _id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
};

export type ConvexOrgSwitcherClassNames = {
  trigger?: string;
  triggerName?: string;
  triggerImage?: string;
  triggerPlaceholder?: string;
  dropdown?: string;
  dropdownPanel?: string;
  dropdownSection?: string;
  dropdownSectionTitle?: string;
  dropdownItem?: string;
  dropdownItemActive?: string;
  dropdownItemLabel?: string;
  dropdownItemMeta?: string;
  dropdownDivider?: string;
  createButton?: string;
};

export type ConvexOrgSwitcherCopy = {
  currentOrganizationLabel?: string;
  otherOrganizationsLabel?: string;
  createOrganizationLabel?: string;
  personalAccountLabel?: string;
  noOrganizationsLabel?: string;
};

export type ConvexOrgSwitcherProps = {
  organizations: readonly ConvexOrgSwitcherOrganization[];
  currentOrganizationId?: string | null;
  classNames?: ConvexOrgSwitcherClassNames;
  copy?: ConvexOrgSwitcherCopy;
  onSelectOrganization: (organizationId: string) => void | Promise<void>;
  onSelectPersonalAccount?: () => void | Promise<void>;
  onCreateOrganization?: () => void | Promise<void>;
  showPersonalAccount?: boolean;
  currentOrganization?: ConvexOrgSwitcherOrganization | null;
  personalAccountLabel?: string;
  renderCustomTrigger?: (args: {
    organization: ConvexOrgSwitcherOrganization | null;
    onClick: () => void;
  }) => ReactNode;
};

// ─── Default copy ──────────────────────────────────────────────────────────

const defaultCopy: Required<ConvexOrgSwitcherCopy> = {
  currentOrganizationLabel: "Current workspace",
  otherOrganizationsLabel: "Other workspaces",
  createOrganizationLabel: "Create workspace",
  personalAccountLabel: "Personal account",
  noOrganizationsLabel: "No organizations",
};

function resolveCopy(
  copy: ConvexOrgSwitcherCopy | undefined
): Required<ConvexOrgSwitcherCopy> {
  return { ...defaultCopy, ...copy };
}

function OrganizationAvatar(props: {
  organization: ConvexOrgSwitcherOrganization;
  className?: string;
  placeholderClassName?: string;
}) {
  const { organization, className, placeholderClassName } = props;

  if (organization.imageUrl) {
    return (
      <img
        src={organization.imageUrl}
        alt=""
        className={cn("size-5 rounded-md object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "bg-foreground/10 inline-flex size-5 items-center justify-center rounded-md text-[10px] font-medium",
        placeholderClassName
      )}
    >
      {organization.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function OrganizationSwitcherTrigger(props: {
  currentOrg: ConvexOrgSwitcherOrganization | null;
  open: boolean;
  classNames?: ConvexOrgSwitcherClassNames;
  copy: Required<ConvexOrgSwitcherCopy>;
  onToggle: () => void;
}) {
  const { currentOrg, open, classNames, copy, onToggle } = props;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "border-foreground/10 bg-foreground/5 text-foreground hover:bg-foreground/10 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
        classNames?.trigger
      )}
      aria-haspopup="menu"
      aria-expanded={open}
    >
      {currentOrg ? (
        <OrganizationAvatar
          organization={currentOrg}
          className={classNames?.triggerImage}
          placeholderClassName={classNames?.triggerPlaceholder}
        />
      ) : (
        <span className="text-foreground/40">{copy.noOrganizationsLabel}</span>
      )}
      <span
        className={cn(
          "max-w-[12ch] truncate font-medium",
          classNames?.triggerName
        )}
      >
        {currentOrg?.name ?? copy.noOrganizationsLabel}
      </span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className={cn(
          "text-foreground/60 transition-transform",
          open && "rotate-180"
        )}
      >
        <path
          d="M2.5 4.5L6 8L9.5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

function DropdownDivider(props: { classNames?: ConvexOrgSwitcherClassNames }) {
  return (
    <div
      className={cn(
        "border-foreground/10 border-t",
        props.classNames?.dropdownDivider
      )}
    />
  );
}

function DropdownTitle(props: {
  children: ReactNode;
  classNames?: ConvexOrgSwitcherClassNames;
}) {
  return (
    <div
      className={cn(
        "text-foreground/50 px-3 py-1.5 text-xs font-medium",
        props.classNames?.dropdownSectionTitle
      )}
    >
      {props.children}
    </div>
  );
}

function OrganizationMenuItem(props: {
  organization: ConvexOrgSwitcherOrganization;
  active?: boolean;
  classNames?: ConvexOrgSwitcherClassNames;
  onClick?: () => void;
}) {
  const { organization, active, classNames, onClick } = props;

  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active === true}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
        active
          ? "bg-foreground/10 text-foreground"
          : "text-foreground/80 hover:bg-foreground/5 transition-colors",
        active ? classNames?.dropdownItemActive : classNames?.dropdownItem
      )}
      disabled={active}
      onClick={onClick}
    >
      <OrganizationAvatar organization={organization} />
      <span className={cn("flex-1 truncate", classNames?.dropdownItemLabel)}>
        {organization.name}
      </span>
    </button>
  );
}

function CurrentOrganizationSection(props: {
  currentOrg: ConvexOrgSwitcherOrganization | null;
  classNames?: ConvexOrgSwitcherClassNames;
  copy: Required<ConvexOrgSwitcherCopy>;
}) {
  const { currentOrg, classNames, copy } = props;
  if (!currentOrg) return null;

  return (
    <>
      <DropdownTitle classNames={classNames}>
        {copy.currentOrganizationLabel}
      </DropdownTitle>
      <div className={cn("pb-1", classNames?.dropdownPanel)}>
        <OrganizationMenuItem
          organization={currentOrg}
          active={true}
          classNames={classNames}
        />
      </div>
    </>
  );
}

function OtherOrganizationsSection(props: {
  organizations: readonly ConvexOrgSwitcherOrganization[];
  classNames?: ConvexOrgSwitcherClassNames;
  copy: Required<ConvexOrgSwitcherCopy>;
  onSelect: (organizationId: string) => void;
}) {
  const { organizations, classNames, copy, onSelect } = props;
  if (organizations.length === 0) return null;

  return (
    <>
      <DropdownDivider classNames={classNames} />
      <DropdownTitle classNames={classNames}>
        {copy.otherOrganizationsLabel}
      </DropdownTitle>
      <div className={cn("pb-1", classNames?.dropdownPanel)}>
        {organizations.map((org) => (
          <OrganizationMenuItem
            key={org._id}
            organization={org}
            classNames={classNames}
            onClick={() => onSelect(org._id)}
          />
        ))}
      </div>
    </>
  );
}

function PersonalAccountSection(props: {
  enabled: boolean;
  classNames?: ConvexOrgSwitcherClassNames;
  copy: Required<ConvexOrgSwitcherCopy>;
  onSelect: () => void;
}) {
  const { enabled, classNames, copy, onSelect } = props;
  if (!enabled) return null;

  return (
    <>
      <DropdownDivider classNames={classNames} />
      <div className={cn("py-1", classNames?.dropdownPanel)}>
        <button
          type="button"
          role="menuitem"
          className={cn(
            "text-foreground/80 hover:bg-foreground/5 flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
            classNames?.dropdownItem
          )}
          onClick={onSelect}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="text-foreground/50"
          >
            <path
              d="M8 8a3 3 0 100-6 3 3 0 000 6zm0 1a5 5 0 00-5 5v1h10v-1a5 5 0 00-5-5z"
              fill="currentColor"
            />
          </svg>
          <span className={cn(classNames?.dropdownItemLabel)}>
            {copy.personalAccountLabel}
          </span>
        </button>
      </div>
    </>
  );
}

function CreateOrganizationSection(props: {
  enabled: boolean;
  classNames?: ConvexOrgSwitcherClassNames;
  copy: Required<ConvexOrgSwitcherCopy>;
  onCreate: () => void;
}) {
  const { enabled, classNames, copy, onCreate } = props;
  if (!enabled) return null;

  return (
    <>
      <DropdownDivider classNames={classNames} />
      <div className={cn("py-1", classNames?.dropdownPanel)}>
        <button
          type="button"
          role="menuitem"
          className={cn(
            "text-foreground/60 hover:bg-foreground/5 flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
            classNames?.createButton ?? classNames?.dropdownItem
          )}
          onClick={onCreate}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="text-foreground/40"
          >
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className={cn(classNames?.dropdownItemLabel)}>
            {copy.createOrganizationLabel}
          </span>
        </button>
      </div>
    </>
  );
}

function OrganizationSwitcherDropdown(props: {
  currentOrg: ConvexOrgSwitcherOrganization | null;
  otherOrgs: readonly ConvexOrgSwitcherOrganization[];
  classNames?: ConvexOrgSwitcherClassNames;
  copy: Required<ConvexOrgSwitcherCopy>;
  showPersonalAccount: boolean;
  canCreateOrganization: boolean;
  onSelect: (organizationId: string) => void;
  onPersonal: () => void;
  onCreate: () => void;
}) {
  const {
    currentOrg,
    otherOrgs,
    classNames,
    copy,
    showPersonalAccount,
    canCreateOrganization,
    onSelect,
    onPersonal,
    onCreate,
  } = props;

  return (
    <div
      className={cn(
        "border-foreground/10 bg-background absolute top-full left-0 z-50 mt-2 w-64 rounded-lg border shadow-xl",
        classNames?.dropdown
      )}
      role="menu"
    >
      <CurrentOrganizationSection
        currentOrg={currentOrg}
        classNames={classNames}
        copy={copy}
      />
      <OtherOrganizationsSection
        organizations={otherOrgs}
        classNames={classNames}
        copy={copy}
        onSelect={onSelect}
      />
      <PersonalAccountSection
        enabled={showPersonalAccount}
        classNames={classNames}
        copy={copy}
        onSelect={onPersonal}
      />
      <CreateOrganizationSection
        enabled={canCreateOrganization}
        classNames={classNames}
        copy={copy}
        onCreate={onCreate}
      />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export function ConvexOrganizationSwitcher(props: ConvexOrgSwitcherProps) {
  const {
    organizations,
    currentOrganizationId,
    classNames,
    copy,
    onSelectOrganization,
    onSelectPersonalAccount,
    onCreateOrganization,
    showPersonalAccount,
    currentOrganization,
    renderCustomTrigger,
  } = props;

  const resolvedCopy = resolveCopy(copy);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        e.target instanceof Node &&
        !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSelect = useCallback(
    async (orgId: string) => {
      setOpen(false);
      await onSelectOrganization(orgId);
    },
    [onSelectOrganization]
  );

  const handlePersonal = useCallback(async () => {
    setOpen(false);
    await onSelectPersonalAccount?.();
  }, [onSelectPersonalAccount]);

  const handleCreate = useCallback(async () => {
    setOpen(false);
    await onCreateOrganization?.();
  }, [onCreateOrganization]);

  const currentOrg =
    currentOrganization ??
    organizations.find((o) => o._id === currentOrganizationId) ??
    null;
  const otherOrgs = organizations.filter(
    (o) => o._id !== currentOrganizationId
  );

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {renderCustomTrigger ? (
        renderCustomTrigger({
          organization: currentOrg,
          onClick: () => setOpen((prev) => !prev),
        })
      ) : (
        <OrganizationSwitcherTrigger
          currentOrg={currentOrg}
          open={open}
          classNames={classNames}
          copy={resolvedCopy}
          onToggle={() => setOpen((prev) => !prev)}
        />
      )}

      {open ? (
        <OrganizationSwitcherDropdown
          currentOrg={currentOrg}
          otherOrgs={otherOrgs}
          classNames={classNames}
          copy={resolvedCopy}
          showPersonalAccount={
            showPersonalAccount === true &&
            typeof onSelectPersonalAccount === "function"
          }
          canCreateOrganization={typeof onCreateOrganization === "function"}
          onSelect={handleSelect}
          onPersonal={handlePersonal}
          onCreate={handleCreate}
        />
      ) : null}
    </div>
  );
}
