import { cn } from "./lib/ui";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useRef, useState, type ReactNode } from "react";

import { useGuardedConvexMutation } from "./protected-writes";

export type VortexWebhookEndpointStatus = "active" | "disabled" | "archived";

export type VortexWebhookDeliveryStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "failed";

export type VortexWebhookDeliveryFailureKind =
  | "endpoint_inactive"
  | "network_error"
  | "rate_limited"
  | "server_error"
  | "client_error"
  | "unknown_error";

export type VortexWebhookEndpointListItem<
  EventType extends string = string,
  EndpointId extends string = string,
> = {
  _id: EndpointId;
  url: string;
  description?: string;
  status: VortexWebhookEndpointStatus;
  events: readonly EventType[];
  secretPreview: string;
  createdAt: number;
  updatedAt: number;
};

export type VortexWebhookDeliveryListItem<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
> = {
  _id: DeliveryId;
  endpointId: EndpointId;
  organizationId: OrganizationId;
  eventId: string;
  eventType: EventType;
  payload: string;
  status: VortexWebhookDeliveryStatus;
  attemptCount: number;
  nextAttemptAt?: number;
  lastAttemptAt?: number;
  deliveredAt?: number;
  exhaustedAt?: number;
  recoveredAt?: number;
  recoveryCount?: number;
  responseStatus?: number;
  responseBody?: string;
  failureKind?: VortexWebhookDeliveryFailureKind;
  createdAt: number;
  updatedAt: number;
  endpointUrl?: string;
  endpointDescription?: string;
};

export type VortexWebhookDeliveryPage<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
> = {
  items: readonly VortexWebhookDeliveryListItem<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export type VortexWebhookCreateFormState<EventType extends string = string> = {
  url: string;
  description: string;
  events: readonly EventType[];
};

export type VortexWebhookCreateFormCopy = {
  urlLabel?: string;
  urlPlaceholder?: string;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
  createLabel?: string;
  creatingLabel?: string;
};

export type VortexWebhookEndpointListCopy = {
  loadingMessage?: string;
  emptyMessage: string;
  allEventsLabel?: string;
  endpointUrlLabel?: string;
  descriptionLabel?: string;
  secretLabel?: string;
  sendTestLabel?: string;
  sendingTestLabel?: string;
  rotateSecretLabel?: string;
  disableLabel?: string;
  archiveLabel?: string;
  deleteLabel?: string;
  saveLabel?: string;
};

export type VortexWebhookDeliveryCopy = {
  loadingMessage?: string;
  emptyMessage: string;
  historyTitle?: string;
  historyDescription?: string;
  exhaustedLoadingMessage?: string;
  exhaustedTitle?: string;
  exhaustedDescription?: string;
  endpointFilterLabel?: string;
  statusFilterLabel?: string;
  eventFilterLabel?: string;
  allEndpointsLabel?: string;
  allStatusesLabel?: string;
  allEventTypesLabel?: string;
  eventIdLabel?: string;
  createdLabel?: string;
  retryDueLabel?: string;
  recoveredLabel?: string;
  exhaustedLabel?: string;
  responseLabel?: string;
  failureKindLabel?: string;
  retryLabel?: string;
  retryingLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  showingLabel?: string;
  ofLabel?: string;
};

export type VortexWebhookClassNames = {
  card?: string;
  cardContent?: string;
  label?: string;
  labelText?: string;
  input?: string;
  select?: string;
  primaryButton?: string;
  primaryButtonDisabled?: string;
  secondaryButton?: string;
  warningButton?: string;
  destructiveButton?: string;
  endpointList?: string;
  endpointCard?: string;
  endpointHeader?: string;
  endpointMeta?: string;
  endpointActions?: string;
  endpointFormGrid?: string;
  pillList?: string;
  pill?: string;
  pillSelected?: string;
  pillDisabled?: string;
  tag?: string;
  deliveryFilterGrid?: string;
  deliveryPanel?: string;
  deliveryCard?: string;
  deliveryHeader?: string;
  deliveryDetails?: string;
  exhaustedPanel?: string;
  stateText?: string;
  codeBlock?: string;
};

export type VortexWebhookCreateFormProps<EventType extends string = string> = {
  classNames?: VortexWebhookClassNames;
  copy?: VortexWebhookCreateFormCopy;
  creating: boolean;
  enabled: boolean;
  eventOptions: readonly EventType[];
  onDescriptionChange: (value: string) => void;
  onEventsChange: (value: EventType[]) => void;
  onSubmit: () => void;
  onUrlChange: (value: string) => void;
  state: VortexWebhookCreateFormState<EventType>;
};

export type VortexWebhookEndpointListProps<
  EventType extends string = string,
  EndpointId extends string = string,
> = {
  classNames?: VortexWebhookClassNames;
  copy: VortexWebhookEndpointListCopy;
  endpoints:
    | readonly VortexWebhookEndpointListItem<EventType, EndpointId>[]
    | undefined;
  eventOptions: readonly EventType[];
  onArchive: (endpointId: EndpointId) => void;
  onDelete: (endpointId: EndpointId) => void;
  onDisable: (endpointId: EndpointId) => void;
  onRotateSecret: (endpointId: EndpointId) => void;
  onSave: (
    endpointId: EndpointId,
    values: { url: string; description?: string; events: EventType[] }
  ) => void;
  onSendTest: (endpointId: EndpointId) => void;
  renderTag?: (label: string) => ReactNode;
  sendingTestEndpointId: EndpointId | null;
};

export type VortexWebhookDeliveryFiltersProps<
  EventType extends string = string,
  EndpointId extends string = string,
> = {
  classNames?: VortexWebhookClassNames;
  copy?: Partial<VortexWebhookDeliveryCopy>;
  endpointId: EndpointId | "all";
  endpoints:
    | readonly VortexWebhookEndpointListItem<EventType, EndpointId>[]
    | undefined;
  eventOptions: readonly EventType[];
  eventType: EventType | "all";
  onEndpointIdChange: (value: EndpointId | "all") => void;
  onEventTypeChange: (value: EventType | "all") => void;
  onStatusChange: (value: VortexWebhookDeliveryStatus | "all") => void;
  status: VortexWebhookDeliveryStatus | "all";
};

export type VortexWebhookDeliveryPaginationProps<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
> = {
  classNames?: VortexWebhookClassNames;
  copy?: Partial<VortexWebhookDeliveryCopy>;
  onNext: () => void;
  onPrevious: () => void;
  page:
    | VortexWebhookDeliveryPage<
        EventType,
        EndpointId,
        DeliveryId,
        OrganizationId
      >
    | undefined;
};

export type VortexWebhookDeliveryListProps<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
> = {
  classNames?: VortexWebhookClassNames;
  copy: VortexWebhookDeliveryCopy;
  deliveries:
    | readonly VortexWebhookDeliveryListItem<
        EventType,
        EndpointId,
        DeliveryId,
        OrganizationId
      >[]
    | undefined;
  formatTimestamp?: (timestamp: number) => string;
  renderFailureBadge?: (
    failureKind: VortexWebhookDeliveryFailureKind
  ) => ReactNode;
  renderTag?: (label: string) => ReactNode;
};

export type VortexExhaustedWebhookDeliveryListProps<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
> = VortexWebhookDeliveryListProps<
  EventType,
  EndpointId,
  DeliveryId,
  OrganizationId
> & {
  onRetry: (deliveryId: DeliveryId) => void;
  retryingDeliveryId: DeliveryId | null;
};

export type VortexWebhookCreateEndpointResult = {
  secret?: string | null;
};

export type VortexWebhookRotateSecretResult = {
  secret: string;
};

export type VortexWebhookSettingsFunctionReferences<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
> = {
  listEndpoints: FunctionReference<
    "query",
    "public",
    EmptyArgs,
    readonly VortexWebhookEndpointListItem<EventType, EndpointId>[]
  >;
  listExhaustedDeliveries: FunctionReference<
    "query",
    "public",
    { limit?: number },
    readonly VortexWebhookDeliveryListItem<
      EventType,
      EndpointId,
      DeliveryId,
      OrganizationId
    >[]
  >;
  listRecentDeliveries: FunctionReference<
    "query",
    "public",
    {
      endpointId?: EndpointId;
      eventType?: EventType;
      limit?: number;
      offset?: number;
      status?: VortexWebhookDeliveryStatus;
    },
    VortexWebhookDeliveryPage<EventType, EndpointId, DeliveryId, OrganizationId>
  >;
  createEndpoint: FunctionReference<
    "mutation",
    "public",
    {
      description?: string;
      events: string[];
      requestId?: string;
      url: string;
    },
    VortexWebhookCreateEndpointResult
  >;
  updateEndpoint: FunctionReference<
    "mutation",
    "public",
    {
      description?: string;
      endpointId: string;
      events: string[];
      url: string;
    },
    unknown
  >;
  rotateEndpointSecret: FunctionReference<
    "mutation",
    "public",
    { endpointId: string },
    VortexWebhookRotateSecretResult
  >;
  archiveEndpoint: FunctionReference<
    "mutation",
    "public",
    { endpointId: string },
    unknown
  >;
  disableEndpoint: FunctionReference<
    "mutation",
    "public",
    { endpointId: string },
    unknown
  >;
  removeEndpoint: FunctionReference<
    "mutation",
    "public",
    { endpointId: string },
    unknown
  >;
  sendTest: FunctionReference<
    "mutation",
    "public",
    { endpointId: string; requestId?: string },
    unknown
  >;
  retryDelivery: FunctionReference<
    "mutation",
    "public",
    { deliveryId: string },
    unknown
  >;
  triggerProcessing: FunctionReference<
    "mutation",
    "public",
    { limit?: number },
    unknown
  >;
};

export type VortexWebhookSettingsSurfaceCopy = {
  actionErrorTitle?: string;
  create?: VortexWebhookCreateFormCopy;
  deliveries?: Partial<VortexWebhookDeliveryCopy>;
  endpoints?: Partial<VortexWebhookEndpointListCopy>;
  exhaustedDeliveries?: Partial<VortexWebhookDeliveryCopy>;
  processQueueLabel?: string;
  secretTitle?: string;
};

export type VortexWebhookSettingsSurfaceProps<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
> = {
  captureEvent?: (name: string, properties: Record<string, unknown>) => void;
  classNames?: VortexWebhookClassNames;
  confirmDeleteEndpoint?: (args: {
    endpointId: EndpointId;
  }) => boolean | Promise<boolean>;
  copy?: VortexWebhookSettingsSurfaceCopy;
  createRequestId: (prefix: string) => string;
  deliveryLimit?: number;
  enabled: boolean;
  eventOptions: readonly EventType[];
  exhaustedDeliveryLimit?: number;
  formatTimestamp?: (timestamp: number) => string;
  getErrorMessage?: (error: unknown, fallback: string) => string;
  organizationId?: string;
  refs: VortexWebhookSettingsFunctionReferences<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >;
  renderActionError?: (message: string) => ReactNode;
  renderFailureBadge?: (
    failureKind: VortexWebhookDeliveryFailureKind
  ) => ReactNode;
  renderProcessQueueButton?: (args: {
    label: string;
    onClick: () => void;
  }) => ReactNode;
  renderSecret?: (args: { secret: string; title: string }) => ReactNode;
  renderTag?: (label: string) => ReactNode;
};

type EmptyArgs = Record<string, never>;
type MutationRunner<Args, Result> = (args: Args) => Promise<Result>;

const defaultCreateCopy = {
  createLabel: "Create webhook endpoint",
  creatingLabel: "Creating...",
  descriptionLabel: "Description",
  descriptionPlaceholder: "Primary production endpoint",
  urlLabel: "Endpoint URL",
  urlPlaceholder: "https://example.com/webhooks",
} satisfies Required<VortexWebhookCreateFormCopy>;

const defaultEndpointCopy = {
  allEventsLabel: "All events",
  archiveLabel: "Archive",
  deleteLabel: "Delete permanently",
  descriptionLabel: "Description",
  disableLabel: "Disable",
  endpointUrlLabel: "Endpoint URL",
  loadingMessage: "Loading webhook endpoints...",
  rotateSecretLabel: "Rotate secret",
  saveLabel: "Save changes",
  secretLabel: "Secret",
  sendingTestLabel: "Sending...",
  sendTestLabel: "Send test",
} satisfies Omit<VortexWebhookEndpointListCopy, "emptyMessage">;

const defaultDeliveryCopy = {
  allEndpointsLabel: "All endpoints",
  allEventTypesLabel: "All event types",
  allStatusesLabel: "All statuses",
  createdLabel: "Created",
  endpointFilterLabel: "Filter by endpoint",
  eventFilterLabel: "Filter by event type",
  eventIdLabel: "Event ID",
  exhaustedDescription: "Terminal webhook failures needing operator attention.",
  exhaustedLabel: "Exhausted",
  exhaustedLoadingMessage: "Loading exhausted deliveries...",
  exhaustedTitle: "Exhausted deliveries",
  failureKindLabel: "Failure kind",
  historyDescription: "Recent queued, delivered, and failed webhook attempts.",
  historyTitle: "Delivery history",
  loadingMessage: "Loading delivery history...",
  nextLabel: "Next",
  ofLabel: "of",
  previousLabel: "Previous",
  recoveredLabel: "Recovered",
  responseLabel: "Response",
  retryDueLabel: "Retry due",
  retryingLabel: "Retrying...",
  retryLabel: "Retry",
  showingLabel: "Showing",
  statusFilterLabel: "Filter by status",
} satisfies Omit<VortexWebhookDeliveryCopy, "emptyMessage">;

const deliveryStatuses = [
  "pending",
  "processing",
  "delivered",
  "failed",
] as const;

export function canSubmitVortexWebhookCreateForm({
  creating,
  enabled,
  url,
}: {
  creating: boolean;
  enabled: boolean;
  url: string;
}): boolean {
  return enabled && !creating && url.trim().length > 0;
}

export function formatVortexWebhookTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function getVortexWebhookFailureKindLabel(
  failureKind: VortexWebhookDeliveryFailureKind
): string {
  return failureKind.replaceAll("_", " ");
}

export function getVortexWebhookFailureKindTone(
  failureKind: VortexWebhookDeliveryFailureKind
): "destructive" | "warning" | "secondary" {
  if (failureKind === "client_error" || failureKind === "endpoint_inactive") {
    return "destructive";
  }
  if (failureKind === "rate_limited" || failureKind === "server_error") {
    return "warning";
  }
  return "secondary";
}

export function getVortexWebhookMutationErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  return fallback;
}

export function VortexWebhookSettingsSurface<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
>({
  captureEvent,
  classNames,
  confirmDeleteEndpoint,
  copy,
  createRequestId,
  deliveryLimit = 10,
  enabled,
  eventOptions,
  exhaustedDeliveryLimit = 5,
  formatTimestamp,
  getErrorMessage = getVortexWebhookMutationErrorMessage,
  organizationId,
  refs,
  renderActionError,
  renderFailureBadge,
  renderProcessQueueButton,
  renderSecret,
  renderTag,
}: VortexWebhookSettingsSurfaceProps<
  EventType,
  EndpointId,
  DeliveryId,
  OrganizationId
>) {
  const webhookEndpoints = useQuery(refs.listEndpoints, {});
  const exhaustedDeliveries = useQuery(refs.listExhaustedDeliveries, {
    limit: exhaustedDeliveryLimit,
  });
  const deliveries = useVortexWebhookDeliveryPage({
    deliveryLimit,
    refs,
  });
  const endpointActions = useVortexWebhookEndpointActions({
    captureEvent,
    createRequestId,
    getErrorMessage,
    organizationId,
    refs,
  });
  const endpointCopy = resolveSettingsEndpointCopy(copy?.endpoints);
  const deliveryCopy = resolveSettingsDeliveryCopy(copy?.deliveries);
  const exhaustedCopy = resolveSettingsExhaustedDeliveryCopy(
    copy?.exhaustedDeliveries
  );
  const processQueueLabel =
    copy?.processQueueLabel ?? "Process webhook queue now";
  const secretTitle = copy?.secretTitle ?? "Webhook secret. Copy now.";

  return (
    <>
      <VortexWebhookCreateSection<EventType>
        actions={endpointActions}
        classNames={classNames}
        copy={copy?.create}
        enabled={enabled}
        eventOptions={eventOptions}
        renderActionError={renderActionError}
        renderSecret={renderSecret}
        secretTitle={secretTitle}
        title={copy?.actionErrorTitle ?? "Action failed"}
      />
      <VortexWebhookEndpointSection<EventType, EndpointId>
        actions={endpointActions}
        classNames={classNames}
        confirmDeleteEndpoint={confirmDeleteEndpoint}
        copy={endpointCopy}
        endpoints={webhookEndpoints}
        eventOptions={eventOptions}
        renderTag={renderTag}
      />
      <VortexWebhookProcessQueueSlot
        classNames={classNames}
        label={processQueueLabel}
        onClick={endpointActions.processQueue}
        renderProcessQueueButton={renderProcessQueueButton}
      />
      <VortexWebhookDeliverySection<
        EventType,
        EndpointId,
        DeliveryId,
        OrganizationId
      >
        classNames={classNames}
        copy={deliveryCopy}
        deliveries={deliveries}
        endpoints={webhookEndpoints}
        eventOptions={eventOptions}
        formatTimestamp={formatTimestamp}
        renderFailureBadge={renderFailureBadge}
        renderTag={renderTag}
      />
      <VortexExhaustedWebhookDeliveryList<
        EventType,
        EndpointId,
        DeliveryId,
        OrganizationId
      >
        classNames={classNames}
        copy={exhaustedCopy}
        deliveries={exhaustedDeliveries}
        formatTimestamp={formatTimestamp}
        onRetry={endpointActions.retryDelivery}
        renderFailureBadge={renderFailureBadge}
        renderTag={renderTag}
        retryingDeliveryId={endpointActions.retryingDeliveryId}
      />
    </>
  );
}

function VortexWebhookCreateSection<EventType extends string = string>({
  actions,
  classNames,
  copy,
  enabled,
  eventOptions,
  renderActionError,
  renderSecret,
  secretTitle,
  title,
}: {
  actions: Pick<
    ReturnType<
      typeof useVortexWebhookEndpointActions<EventType, string, string, string>
    >,
    | "actionError"
    | "create"
    | "createdWebhookSecret"
    | "creatingWebhook"
    | "setWebhookDescription"
    | "setWebhookEvents"
    | "setWebhookUrl"
    | "webhookDescription"
    | "webhookEvents"
    | "webhookUrl"
  >;
  classNames: VortexWebhookClassNames | undefined;
  copy: VortexWebhookCreateFormCopy | undefined;
  enabled: boolean;
  eventOptions: readonly EventType[];
  renderActionError: VortexWebhookSettingsSurfaceProps["renderActionError"];
  renderSecret: VortexWebhookSettingsSurfaceProps["renderSecret"];
  secretTitle: string;
  title: string;
}) {
  return (
    <>
      <VortexWebhookCreateForm<EventType>
        classNames={classNames}
        copy={copy}
        creating={actions.creatingWebhook}
        enabled={enabled}
        eventOptions={eventOptions}
        onDescriptionChange={actions.setWebhookDescription}
        onEventsChange={actions.setWebhookEvents}
        onSubmit={actions.create}
        onUrlChange={actions.setWebhookUrl}
        state={{
          description: actions.webhookDescription,
          events: actions.webhookEvents,
          url: actions.webhookUrl,
        }}
      />
      <VortexWebhookSecretSlot
        classNames={classNames}
        renderSecret={renderSecret}
        secret={actions.createdWebhookSecret}
        title={secretTitle}
      />
      <VortexWebhookActionErrorSlot
        classNames={classNames}
        message={actions.actionError}
        renderActionError={renderActionError}
        title={title}
      />
    </>
  );
}

function VortexWebhookEndpointSection<
  EventType extends string = string,
  EndpointId extends string = string,
>({
  actions,
  classNames,
  confirmDeleteEndpoint,
  copy,
  endpoints,
  eventOptions,
  renderTag,
}: {
  actions: Pick<
    ReturnType<
      typeof useVortexWebhookEndpointActions<
        EventType,
        EndpointId,
        string,
        string
      >
    >,
    | "archive"
    | "disable"
    | "removeWithConfirmation"
    | "rotateSecret"
    | "save"
    | "sendTest"
    | "sendingTestEndpointId"
  >;
  classNames: VortexWebhookClassNames | undefined;
  confirmDeleteEndpoint:
    | ((args: { endpointId: EndpointId }) => boolean | Promise<boolean>)
    | undefined;
  copy: VortexWebhookEndpointListCopy;
  endpoints:
    | readonly VortexWebhookEndpointListItem<EventType, EndpointId>[]
    | undefined;
  eventOptions: readonly EventType[];
  renderTag: VortexWebhookEndpointListProps<EventType, EndpointId>["renderTag"];
}) {
  return (
    <VortexWebhookEndpointList<EventType, EndpointId>
      classNames={classNames}
      copy={copy}
      endpoints={endpoints}
      eventOptions={eventOptions}
      onArchive={actions.archive}
      onDelete={(endpointId) => {
        void actions.removeWithConfirmation(endpointId, confirmDeleteEndpoint);
      }}
      onDisable={actions.disable}
      onRotateSecret={actions.rotateSecret}
      onSave={actions.save}
      onSendTest={actions.sendTest}
      renderTag={renderTag}
      sendingTestEndpointId={actions.sendingTestEndpointId}
    />
  );
}

function VortexWebhookDeliverySection<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
>({
  classNames,
  copy,
  deliveries,
  endpoints,
  eventOptions,
  formatTimestamp,
  renderFailureBadge,
  renderTag,
}: {
  classNames: VortexWebhookClassNames | undefined;
  copy: VortexWebhookDeliveryCopy;
  deliveries: ReturnType<
    typeof useVortexWebhookDeliveryPage<
      EventType,
      EndpointId,
      DeliveryId,
      OrganizationId
    >
  >;
  endpoints:
    | readonly VortexWebhookEndpointListItem<EventType, EndpointId>[]
    | undefined;
  eventOptions: readonly EventType[];
  formatTimestamp: ((timestamp: number) => string) | undefined;
  renderFailureBadge: VortexWebhookDeliveryListProps<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >["renderFailureBadge"];
  renderTag: VortexWebhookDeliveryListProps<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >["renderTag"];
}) {
  return (
    <>
      <VortexWebhookDeliveryFilters<EventType, EndpointId>
        classNames={classNames}
        endpointId={deliveries.deliveryEndpointId}
        endpoints={endpoints}
        eventOptions={eventOptions}
        eventType={deliveries.deliveryEventType}
        onEndpointIdChange={(value) => {
          deliveries.setDeliveryEndpointId(value);
          deliveries.resetOffset();
        }}
        onEventTypeChange={(value) => {
          deliveries.setDeliveryEventType(value);
          deliveries.resetOffset();
        }}
        onStatusChange={(value) => {
          deliveries.setDeliveryStatus(value);
          deliveries.resetOffset();
        }}
        status={deliveries.deliveryStatus}
      />
      <VortexWebhookDeliveryPagination<
        EventType,
        EndpointId,
        DeliveryId,
        OrganizationId
      >
        classNames={classNames}
        onNext={deliveries.nextPage}
        onPrevious={deliveries.previousPage}
        page={deliveries.webhookDeliveriesPage}
      />
      <VortexWebhookDeliveryList<
        EventType,
        EndpointId,
        DeliveryId,
        OrganizationId
      >
        classNames={classNames}
        copy={copy}
        deliveries={deliveries.webhookDeliveriesPage?.items}
        formatTimestamp={formatTimestamp}
        renderFailureBadge={renderFailureBadge}
        renderTag={renderTag}
      />
    </>
  );
}

function VortexWebhookSecretSlot({
  classNames,
  renderSecret,
  secret,
  title,
}: {
  classNames: VortexWebhookClassNames | undefined;
  renderSecret: VortexWebhookSettingsSurfaceProps["renderSecret"];
  secret: string | null;
  title: string;
}) {
  if (!secret) {
    return null;
  }

  return (
    renderSecret?.({ secret, title }) ?? (
      <VortexWebhookSecretNotice
        classNames={classNames}
        secret={secret}
        title={title}
      />
    )
  );
}

function VortexWebhookActionErrorSlot({
  classNames,
  message,
  renderActionError,
  title,
}: {
  classNames: VortexWebhookClassNames | undefined;
  message: string | null;
  renderActionError: VortexWebhookSettingsSurfaceProps["renderActionError"];
  title: string;
}) {
  if (!message) {
    return null;
  }

  return (
    renderActionError?.(message) ?? (
      <VortexWebhookActionErrorNotice
        classNames={classNames}
        message={message}
        title={title}
      />
    )
  );
}

function VortexWebhookProcessQueueSlot({
  classNames,
  label,
  onClick,
  renderProcessQueueButton,
}: {
  classNames: VortexWebhookClassNames | undefined;
  label: string;
  onClick: () => void;
  renderProcessQueueButton: VortexWebhookSettingsSurfaceProps["renderProcessQueueButton"];
}) {
  return (
    renderProcessQueueButton?.({ label, onClick }) ?? (
      <button
        className={secondaryButtonClassName(classNames)}
        onClick={onClick}
        type="button"
      >
        {label}
      </button>
    )
  );
}

export function VortexWebhookCreateForm<EventType extends string = string>({
  classNames,
  copy,
  creating,
  enabled,
  eventOptions,
  onDescriptionChange,
  onEventsChange,
  onSubmit,
  onUrlChange,
  state,
}: VortexWebhookCreateFormProps<EventType>) {
  const resolvedCopy = resolveCreateCopy(copy);
  const canCreate = canSubmitVortexWebhookCreateForm({
    creating,
    enabled,
    url: state.url,
  });

  return (
    <div
      className={cn(
        "border-foreground/10 bg-background/20 rounded-lg border",
        classNames?.card
      )}
    >
      <div className={cn("space-y-3 p-5", classNames?.cardContent)}>
        <label className={cn("block space-y-2 text-sm", classNames?.label)}>
          <span className={cn("text-foreground/70", classNames?.labelText)}>
            {resolvedCopy.urlLabel}
          </span>
          <input
            className={inputClassName(classNames)}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder={resolvedCopy.urlPlaceholder}
            value={state.url}
          />
        </label>
        <label className={cn("block space-y-2 text-sm", classNames?.label)}>
          <span className={cn("text-foreground/70", classNames?.labelText)}>
            {resolvedCopy.descriptionLabel}
          </span>
          <input
            className={inputClassName(classNames)}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={resolvedCopy.descriptionPlaceholder}
            value={state.description}
          />
        </label>
        <VortexWebhookEventPills
          classNames={classNames}
          disabled={!enabled}
          eventOptions={eventOptions}
          onChange={onEventsChange}
          selected={state.events}
        />
        <button
          className={cn(
            primaryButtonClassName(classNames),
            !canCreate && classNames?.primaryButtonDisabled
          )}
          disabled={!canCreate}
          onClick={onSubmit}
          type="button"
        >
          {creating ? resolvedCopy.creatingLabel : resolvedCopy.createLabel}
        </button>
      </div>
    </div>
  );
}

export function VortexWebhookEndpointList<
  EventType extends string = string,
  EndpointId extends string = string,
>({
  classNames,
  copy,
  endpoints,
  eventOptions,
  onArchive,
  onDelete,
  onDisable,
  onRotateSecret,
  onSave,
  onSendTest,
  renderTag,
  sendingTestEndpointId,
}: VortexWebhookEndpointListProps<EventType, EndpointId>) {
  const resolvedCopy = resolveEndpointCopy(copy);

  if (endpoints === undefined) {
    return (
      <p className={stateTextClassName(classNames)}>
        {resolvedCopy.loadingMessage}
      </p>
    );
  }

  if (endpoints.length === 0) {
    return (
      <p className={stateTextClassName(classNames)}>
        {resolvedCopy.emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", classNames?.endpointList)}>
      {endpoints.map((endpoint) => (
        <VortexWebhookEndpointCard
          classNames={classNames}
          copy={resolvedCopy}
          endpoint={endpoint}
          eventOptions={eventOptions}
          key={endpoint._id}
          onArchive={onArchive}
          onDelete={onDelete}
          onDisable={onDisable}
          onRotateSecret={onRotateSecret}
          onSave={onSave}
          onSendTest={onSendTest}
          renderTag={renderTag}
          sendingTestEndpointId={sendingTestEndpointId}
        />
      ))}
    </div>
  );
}

export function VortexWebhookDeliveryFilters<
  EventType extends string = string,
  EndpointId extends string = string,
>({
  classNames,
  copy,
  endpointId,
  endpoints,
  eventOptions,
  eventType,
  onEndpointIdChange,
  onEventTypeChange,
  onStatusChange,
  status,
}: VortexWebhookDeliveryFiltersProps<EventType, EndpointId>) {
  const resolvedCopy = resolveDeliveryCopy({ emptyMessage: "", ...copy });
  const filterEndpoints =
    endpoints?.filter(
      (endpoint) =>
        endpoint.status !== "archived" || endpoint._id === endpointId
    ) ?? [];

  return (
    <div
      className={cn(
        "border-foreground/10 bg-background/20 grid gap-3 rounded-lg border p-4 md:grid-cols-3",
        classNames?.deliveryFilterGrid
      )}
    >
      <label className={cn("block space-y-2 text-sm", classNames?.label)}>
        <span className={cn("text-foreground/70", classNames?.labelText)}>
          {resolvedCopy.endpointFilterLabel}
        </span>
        <select
          className={selectClassName(classNames)}
          onChange={(event) => {
            const value = event.target.value;
            const selectedEndpointId = filterEndpoints.find(
              (endpoint) => endpoint._id === value
            )?._id;
            if (value === "all") {
              onEndpointIdChange("all");
            } else if (selectedEndpointId !== undefined) {
              onEndpointIdChange(selectedEndpointId);
            }
          }}
          value={endpointId}
        >
          <option value="all">{resolvedCopy.allEndpointsLabel}</option>
          {filterEndpoints.map((endpoint) => (
            <option key={endpoint._id} value={endpoint._id}>
              {endpoint.description ?? endpoint.url}
            </option>
          ))}
        </select>
      </label>
      <label className={cn("block space-y-2 text-sm", classNames?.label)}>
        <span className={cn("text-foreground/70", classNames?.labelText)}>
          {resolvedCopy.statusFilterLabel}
        </span>
        <select
          className={selectClassName(classNames)}
          onChange={(event) => {
            const value = event.target.value;
            const statusValue = deliveryStatuses.find((item) => item === value);
            if (value === "all") {
              onStatusChange("all");
            } else if (statusValue !== undefined) {
              onStatusChange(statusValue);
            }
          }}
          value={status}
        >
          <option value="all">{resolvedCopy.allStatusesLabel}</option>
          {deliveryStatuses.map((item) => (
            <option key={item} value={item}>
              {capitalize(item)}
            </option>
          ))}
        </select>
      </label>
      <label className={cn("block space-y-2 text-sm", classNames?.label)}>
        <span className={cn("text-foreground/70", classNames?.labelText)}>
          {resolvedCopy.eventFilterLabel}
        </span>
        <select
          className={selectClassName(classNames)}
          onChange={(event) => {
            const value = event.target.value;
            const selectedEventType = eventOptions.find(
              (item) => item === value
            );
            if (value === "all") {
              onEventTypeChange("all");
            } else if (selectedEventType !== undefined) {
              onEventTypeChange(selectedEventType);
            }
          }}
          value={eventType}
        >
          <option value="all">{resolvedCopy.allEventTypesLabel}</option>
          {eventOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function VortexWebhookDeliveryPagination<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
>({
  classNames,
  copy,
  onNext,
  onPrevious,
  page,
}: VortexWebhookDeliveryPaginationProps<
  EventType,
  EndpointId,
  DeliveryId,
  OrganizationId
>) {
  const resolvedCopy = resolveDeliveryCopy({ emptyMessage: "", ...copy });

  if (!page) {
    return null;
  }

  const firstItem = page.items.length === 0 ? 0 : page.offset + 1;
  const lastItem = page.offset + page.items.length;

  return (
    <div className="border-foreground/10 bg-background/20 text-foreground/60 flex items-center justify-between rounded-lg border p-4 text-sm">
      <p className="tabular-nums">
        {resolvedCopy.showingLabel} {firstItem}-{lastItem}{" "}
        {resolvedCopy.ofLabel} {page.total}
      </p>
      <div className="flex gap-2">
        <button
          className={secondaryButtonClassName(classNames)}
          disabled={page.offset === 0}
          onClick={onPrevious}
          type="button"
        >
          {resolvedCopy.previousLabel}
        </button>
        <button
          className={secondaryButtonClassName(classNames)}
          disabled={!page.hasMore}
          onClick={onNext}
          type="button"
        >
          {resolvedCopy.nextLabel}
        </button>
      </div>
    </div>
  );
}

export function VortexWebhookDeliveryList<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
>({
  classNames,
  copy,
  deliveries,
  formatTimestamp = formatVortexWebhookTimestamp,
  renderFailureBadge,
  renderTag,
}: VortexWebhookDeliveryListProps<
  EventType,
  EndpointId,
  DeliveryId,
  OrganizationId
>) {
  const resolvedCopy = resolveDeliveryCopy(copy);

  if (deliveries === undefined) {
    return (
      <p className={stateTextClassName(classNames)}>
        {resolvedCopy.loadingMessage}
      </p>
    );
  }

  if (deliveries.length === 0) {
    return (
      <p className={stateTextClassName(classNames)}>
        {resolvedCopy.emptyMessage}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "border-foreground/10 bg-background/20 space-y-3 rounded-lg border p-4",
        classNames?.deliveryPanel
      )}
    >
      <div className="space-y-1">
        <p className="text-foreground/45 text-xs uppercase">
          {resolvedCopy.historyTitle}
        </p>
        <p className="text-foreground/60 text-sm text-pretty">
          {resolvedCopy.historyDescription}
        </p>
      </div>
      <div className="space-y-3">
        {deliveries.map((delivery) => (
          <VortexWebhookDeliveryCard
            classNames={classNames}
            copy={resolvedCopy}
            delivery={delivery}
            formatTimestamp={formatTimestamp}
            key={delivery._id}
            renderFailureBadge={renderFailureBadge}
            renderTag={renderTag}
          />
        ))}
      </div>
    </div>
  );
}

export function VortexExhaustedWebhookDeliveryList<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
>({
  classNames,
  copy,
  deliveries,
  formatTimestamp = formatVortexWebhookTimestamp,
  onRetry,
  renderFailureBadge,
  renderTag,
  retryingDeliveryId,
}: VortexExhaustedWebhookDeliveryListProps<
  EventType,
  EndpointId,
  DeliveryId,
  OrganizationId
>) {
  const resolvedCopy = resolveDeliveryCopy(copy);

  if (deliveries === undefined) {
    return (
      <p className={stateTextClassName(classNames)}>
        {resolvedCopy.exhaustedLoadingMessage}
      </p>
    );
  }

  if (deliveries.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-destructive/30 bg-destructive/5 space-y-3 rounded-lg border p-4",
        classNames?.exhaustedPanel
      )}
    >
      <div className="space-y-1">
        <p className="text-destructive/70 text-xs uppercase">
          {resolvedCopy.exhaustedTitle}
        </p>
        <p className="text-destructive/80 text-sm text-pretty">
          {resolvedCopy.exhaustedDescription}
        </p>
      </div>
      <div className="space-y-3">
        {deliveries.map((delivery) => (
          <VortexWebhookDeliveryCard
            actions={
              <button
                className={secondaryButtonClassName(classNames)}
                disabled={retryingDeliveryId === delivery._id}
                onClick={() => onRetry(delivery._id)}
                type="button"
              >
                {retryingDeliveryId === delivery._id
                  ? resolvedCopy.retryingLabel
                  : resolvedCopy.retryLabel}
              </button>
            }
            classNames={classNames}
            copy={resolvedCopy}
            delivery={delivery}
            formatTimestamp={formatTimestamp}
            key={delivery._id}
            renderFailureBadge={renderFailureBadge}
            renderTag={renderTag}
          />
        ))}
      </div>
    </div>
  );
}

function useVortexWebhookDeliveryPage<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
>({
  deliveryLimit,
  refs,
}: {
  deliveryLimit: number;
  refs: VortexWebhookSettingsFunctionReferences<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >;
}) {
  const [deliveryEndpointId, setDeliveryEndpointId] = useState<
    EndpointId | "all"
  >("all");
  const [deliveryStatus, setDeliveryStatus] = useState<
    VortexWebhookDeliveryStatus | "all"
  >("all");
  const [deliveryEventType, setDeliveryEventType] = useState<EventType | "all">(
    "all"
  );
  const [deliveryOffset, setDeliveryOffset] = useState(0);
  const webhookDeliveriesPage = useQuery(refs.listRecentDeliveries, {
    endpointId: deliveryEndpointId === "all" ? undefined : deliveryEndpointId,
    eventType: deliveryEventType === "all" ? undefined : deliveryEventType,
    limit: deliveryLimit,
    offset: deliveryOffset,
    status: deliveryStatus === "all" ? undefined : deliveryStatus,
  });

  return {
    deliveryEndpointId,
    deliveryEventType,
    deliveryStatus,
    nextPage: () => setDeliveryOffset((current) => current + deliveryLimit),
    previousPage: () =>
      setDeliveryOffset((current) => Math.max(0, current - deliveryLimit)),
    resetOffset: () => setDeliveryOffset(0),
    setDeliveryEndpointId,
    setDeliveryEventType,
    setDeliveryStatus,
    webhookDeliveriesPage,
  };
}

function useVortexWebhookEndpointActions<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
>({
  captureEvent,
  createRequestId,
  getErrorMessage,
  organizationId,
  refs,
}: {
  captureEvent:
    | ((name: string, properties: Record<string, unknown>) => void)
    | undefined;
  createRequestId: (prefix: string) => string;
  getErrorMessage: (error: unknown, fallback: string) => string;
  organizationId: string | undefined;
  refs: VortexWebhookSettingsFunctionReferences<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >;
}) {
  const mutations = useVortexWebhookEndpointMutationRunners<
    EventType,
    EndpointId,
    DeliveryId
  >(refs);
  const [actionError, setActionError] = useState<string | null>(null);
  const setMutationError = (error: unknown, fallback: string) =>
    setActionError(getErrorMessage(error, fallback));
  const createState = useVortexWebhookCreateActionState<EventType>({
    captureEvent,
    createRequestId,
    createWebhookEndpoint: mutations.createWebhookEndpoint,
    organizationId,
    setActionError,
    setMutationError,
  });
  const retryState = useVortexWebhookRetryActionState<DeliveryId>({
    captureEvent,
    retryWebhookDelivery: mutations.retryWebhookDelivery,
    setActionError,
    setMutationError,
  });
  const sendTestState = useVortexWebhookSendTestActionState<EndpointId>({
    createRequestId,
    sendTestWebhook: mutations.sendTestWebhook,
    setActionError,
    setMutationError,
  });
  const endpointMutationActions =
    createVortexWebhookEndpointMutationActions<EndpointId>({
      mutations,
      setActionError,
      setCreatedWebhookSecret: createState.setCreatedWebhookSecret,
      setMutationError,
    });

  return {
    actionError,
    ...createState,
    ...retryState,
    ...sendTestState,
    ...endpointMutationActions,
  };
}

function createVortexWebhookEndpointMutationActions<
  EndpointId extends string = string,
>({
  mutations,
  setActionError,
  setCreatedWebhookSecret,
  setMutationError,
}: {
  mutations: Pick<
    ReturnType<
      typeof useVortexWebhookEndpointMutationRunners<string, EndpointId, string>
    >,
    | "archiveWebhookEndpoint"
    | "disableWebhookEndpoint"
    | "removeWebhookEndpoint"
    | "rotateWebhookSecret"
    | "triggerProcessing"
    | "updateWebhookEndpoint"
  >;
  setActionError: (error: string | null) => void;
  setCreatedWebhookSecret: (secret: string | null) => void;
  setMutationError: (error: unknown, fallback: string) => void;
}) {
  const remove = (endpointId: EndpointId) => {
    runWebhookEndpointMutation(
      mutations.removeWebhookEndpoint,
      endpointId,
      setActionError,
      setMutationError,
      "Could not delete webhook endpoint."
    );
  };

  return {
    archive: (endpointId: EndpointId) =>
      runWebhookEndpointMutation(
        mutations.archiveWebhookEndpoint,
        endpointId,
        setActionError,
        setMutationError,
        "Could not archive webhook endpoint."
      ),
    disable: (endpointId: EndpointId) =>
      runWebhookEndpointMutation(
        mutations.disableWebhookEndpoint,
        endpointId,
        setActionError,
        setMutationError,
        "Could not disable webhook endpoint."
      ),
    processQueue: () =>
      runWebhookQueueProcessing(
        mutations.triggerProcessing,
        setActionError,
        setMutationError
      ),
    remove,
    removeWithConfirmation: (
      endpointId: EndpointId,
      confirmDeleteEndpoint:
        | ((args: { endpointId: EndpointId }) => boolean | Promise<boolean>)
        | undefined
    ) =>
      removeWebhookEndpointAfterConfirmation(
        endpointId,
        confirmDeleteEndpoint,
        remove
      ),
    rotateSecret: (endpointId: EndpointId) =>
      rotateWebhookSecretWithState({
        endpointId,
        rotateWebhookSecret: mutations.rotateWebhookSecret,
        setActionError,
        setCreatedWebhookSecret,
        setMutationError,
      }),
    save: (
      endpointId: EndpointId,
      values: { description?: string; events: string[]; url: string }
    ) =>
      saveWebhookEndpoint(
        endpointId,
        values,
        mutations.updateWebhookEndpoint,
        setActionError,
        setMutationError
      ),
  };
}

function runWebhookEndpointMutation<EndpointId extends string = string>(
  mutation: MutationRunner<{ endpointId: EndpointId }, unknown>,
  endpointId: EndpointId,
  setActionError: (error: string | null) => void,
  setMutationError: (error: unknown, fallback: string) => void,
  fallback: string
) {
  setActionError(null);
  void mutation({ endpointId }).catch((error: unknown) => {
    setMutationError(error, fallback);
  });
}

function runWebhookQueueProcessing(
  triggerProcessing: MutationRunner<{ limit: number }, unknown>,
  setActionError: (error: string | null) => void,
  setMutationError: (error: unknown, fallback: string) => void
) {
  setActionError(null);
  void triggerProcessing({ limit: 20 }).catch((error: unknown) => {
    setMutationError(error, "Could not process webhook queue.");
  });
}

async function removeWebhookEndpointAfterConfirmation<
  EndpointId extends string = string,
>(
  endpointId: EndpointId,
  confirmDeleteEndpoint:
    | ((args: { endpointId: EndpointId }) => boolean | Promise<boolean>)
    | undefined,
  remove: (endpointId: EndpointId) => void
) {
  const confirmed = confirmDeleteEndpoint
    ? await confirmDeleteEndpoint({ endpointId })
    : true;
  if (confirmed) {
    remove(endpointId);
  }
}

function rotateWebhookSecretWithState<EndpointId extends string = string>({
  endpointId,
  rotateWebhookSecret,
  setActionError,
  setCreatedWebhookSecret,
  setMutationError,
}: {
  endpointId: EndpointId;
  rotateWebhookSecret: MutationRunner<
    { endpointId: EndpointId },
    VortexWebhookRotateSecretResult
  >;
  setActionError: (error: string | null) => void;
  setCreatedWebhookSecret: (secret: string | null) => void;
  setMutationError: (error: unknown, fallback: string) => void;
}) {
  setActionError(null);
  void rotateWebhookSecret({ endpointId })
    .then((result) => {
      setCreatedWebhookSecret(result.secret);
    })
    .catch((error: unknown) => {
      setMutationError(error, "Could not rotate webhook secret.");
    });
}

function saveWebhookEndpoint<
  EventType extends string = string,
  EndpointId extends string = string,
>(
  endpointId: EndpointId,
  values: { description?: string; events: EventType[]; url: string },
  updateWebhookEndpoint: MutationRunner<
    {
      description?: string;
      endpointId: EndpointId;
      events: EventType[];
      url: string;
    },
    unknown
  >,
  setActionError: (error: string | null) => void,
  setMutationError: (error: unknown, fallback: string) => void
) {
  setActionError(null);
  void updateWebhookEndpoint({ endpointId, ...values }).catch(
    (error: unknown) => {
      setMutationError(error, "Could not save webhook endpoint.");
    }
  );
}

function useVortexWebhookCreateActionState<EventType extends string = string>({
  captureEvent,
  createRequestId,
  createWebhookEndpoint,
  organizationId,
  setActionError,
  setMutationError,
}: {
  captureEvent:
    | ((name: string, properties: Record<string, unknown>) => void)
    | undefined;
  createRequestId: (prefix: string) => string;
  createWebhookEndpoint: MutationRunner<
    {
      description?: string;
      events: EventType[];
      requestId: string;
      url: string;
    },
    VortexWebhookCreateEndpointResult
  >;
  organizationId: string | undefined;
  setActionError: (error: string | null) => void;
  setMutationError: (error: unknown, fallback: string) => void;
}) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookDescription, setWebhookDescription] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<EventType[]>([]);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<
    string | null
  >(null);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const createRequestIdRef = useRef<string | null>(null);

  return {
    create: () =>
      createWebhookEndpointWithState({
        captureEvent,
        createRequestId,
        createRequestIdRef,
        createWebhookEndpoint,
        organizationId,
        setActionError,
        setCreatedWebhookSecret,
        setCreatingWebhook,
        setMutationError,
        setWebhookDescription,
        setWebhookEvents,
        setWebhookUrl,
        webhookDescription,
        webhookEvents,
        webhookUrl,
      }),
    createdWebhookSecret,
    creatingWebhook,
    setWebhookDescription,
    setWebhookEvents,
    setWebhookUrl,
    setCreatedWebhookSecret,
    webhookDescription,
    webhookEvents,
    webhookUrl,
  };
}

function useVortexWebhookRetryActionState<DeliveryId extends string = string>({
  captureEvent,
  retryWebhookDelivery,
  setActionError,
  setMutationError,
}: {
  captureEvent:
    | ((name: string, properties: Record<string, unknown>) => void)
    | undefined;
  retryWebhookDelivery: MutationRunner<{ deliveryId: DeliveryId }, unknown>;
  setActionError: (error: string | null) => void;
  setMutationError: (error: unknown, fallback: string) => void;
}) {
  const [retryingDeliveryId, setRetryingDeliveryId] =
    useState<DeliveryId | null>(null);

  return {
    retryDelivery: (deliveryId: DeliveryId) =>
      retryWebhookDeliveryWithState({
        captureEvent,
        deliveryId,
        retryWebhookDelivery,
        setActionError,
        setMutationError,
        setRetryingDeliveryId,
      }),
    retryingDeliveryId,
  };
}

function useVortexWebhookSendTestActionState<
  EndpointId extends string = string,
>({
  createRequestId,
  sendTestWebhook,
  setActionError,
  setMutationError,
}: {
  createRequestId: (prefix: string) => string;
  sendTestWebhook: MutationRunner<
    { endpointId: EndpointId; requestId: string },
    unknown
  >;
  setActionError: (error: string | null) => void;
  setMutationError: (error: unknown, fallback: string) => void;
}) {
  const [sendingTestEndpointId, setSendingTestEndpointId] =
    useState<EndpointId | null>(null);
  const sendTestRequestIdsRef = useRef(new Map<EndpointId, string>());

  return {
    sendTest: (endpointId: EndpointId) =>
      sendTestWebhookWithState({
        createRequestId,
        endpointId,
        sendTestRequestIdsRef,
        sendTestWebhook,
        setActionError,
        setMutationError,
        setSendingTestEndpointId,
      }),
    sendingTestEndpointId,
  };
}

function createWebhookEndpointWithState<EventType extends string = string>({
  captureEvent,
  createRequestId,
  createRequestIdRef,
  createWebhookEndpoint,
  organizationId,
  setActionError,
  setCreatedWebhookSecret,
  setCreatingWebhook,
  setMutationError,
  setWebhookDescription,
  setWebhookEvents,
  setWebhookUrl,
  webhookDescription,
  webhookEvents,
  webhookUrl,
}: {
  captureEvent:
    | ((name: string, properties: Record<string, unknown>) => void)
    | undefined;
  createRequestId: (prefix: string) => string;
  createRequestIdRef: { current: string | null };
  createWebhookEndpoint: MutationRunner<
    {
      description?: string;
      events: EventType[];
      requestId: string;
      url: string;
    },
    VortexWebhookCreateEndpointResult
  >;
  organizationId: string | undefined;
  setActionError: (error: string | null) => void;
  setCreatedWebhookSecret: (secret: string | null) => void;
  setCreatingWebhook: (creating: boolean) => void;
  setMutationError: (error: unknown, fallback: string) => void;
  setWebhookDescription: (description: string) => void;
  setWebhookEvents: (events: EventType[]) => void;
  setWebhookUrl: (url: string) => void;
  webhookDescription: string;
  webhookEvents: EventType[];
  webhookUrl: string;
}) {
  if (createRequestIdRef.current) {
    return;
  }
  const requestId = createRequestId("webhook_create");
  createRequestIdRef.current = requestId;
  setCreatingWebhook(true);
  setActionError(null);
  void createWebhookEndpoint({
    description: webhookDescription.trim() || undefined,
    events: webhookEvents,
    requestId,
    url: webhookUrl.trim(),
  })
    .then((result) => {
      setCreatedWebhookSecret(result.secret ?? null);
      setWebhookUrl("");
      setWebhookDescription("");
      setWebhookEvents([]);
      captureEvent?.(
        "settings_webhook_created",
        organizationId ? { organizationId } : {}
      );
    })
    .catch((error: unknown) => {
      setMutationError(error, "Could not create webhook endpoint.");
    })
    .finally(() => {
      createRequestIdRef.current = null;
      setCreatingWebhook(false);
    });
}

function retryWebhookDeliveryWithState<DeliveryId extends string = string>({
  captureEvent,
  deliveryId,
  retryWebhookDelivery,
  setActionError,
  setMutationError,
  setRetryingDeliveryId,
}: {
  captureEvent:
    | ((name: string, properties: Record<string, unknown>) => void)
    | undefined;
  deliveryId: DeliveryId;
  retryWebhookDelivery: MutationRunner<{ deliveryId: DeliveryId }, unknown>;
  setActionError: (error: string | null) => void;
  setMutationError: (error: unknown, fallback: string) => void;
  setRetryingDeliveryId: (
    value:
      | DeliveryId
      | null
      | ((current: DeliveryId | null) => DeliveryId | null)
  ) => void;
}) {
  setRetryingDeliveryId(deliveryId);
  setActionError(null);
  void retryWebhookDelivery({ deliveryId })
    .then(() => {
      captureEvent?.("webhook_delivery_retry_clicked", {
        deliveryId,
      });
    })
    .catch((error: unknown) => {
      setMutationError(error, "Could not retry webhook delivery.");
    })
    .finally(() => {
      setRetryingDeliveryId((currentDeliveryId) =>
        currentDeliveryId === deliveryId ? null : currentDeliveryId
      );
    });
}

function sendTestWebhookWithState<EndpointId extends string = string>({
  createRequestId,
  endpointId,
  sendTestRequestIdsRef,
  sendTestWebhook,
  setActionError,
  setMutationError,
  setSendingTestEndpointId,
}: {
  createRequestId: (prefix: string) => string;
  endpointId: EndpointId;
  sendTestRequestIdsRef: { current: Map<EndpointId, string> };
  sendTestWebhook: MutationRunner<
    { endpointId: EndpointId; requestId: string },
    unknown
  >;
  setActionError: (error: string | null) => void;
  setMutationError: (error: unknown, fallback: string) => void;
  setSendingTestEndpointId: (
    value:
      | EndpointId
      | null
      | ((current: EndpointId | null) => EndpointId | null)
  ) => void;
}) {
  if (sendTestRequestIdsRef.current.has(endpointId)) {
    return;
  }
  const requestId = createRequestId("webhook_test");
  sendTestRequestIdsRef.current.set(endpointId, requestId);
  setSendingTestEndpointId(endpointId);
  setActionError(null);
  void sendTestWebhook({ endpointId, requestId })
    .catch((error: unknown) => {
      setMutationError(error, "Could not send webhook test.");
    })
    .finally(() => {
      sendTestRequestIdsRef.current.delete(endpointId);
      setSendingTestEndpointId((currentEndpointId) =>
        currentEndpointId === endpointId ? null : currentEndpointId
      );
    });
}

function useVortexWebhookEndpointMutationRunners<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
>(
  refs: VortexWebhookSettingsFunctionReferences<
    EventType,
    EndpointId,
    DeliveryId
  >
) {
  const archiveWebhookEndpoint = useGuardedConvexMutation(
    useMutation(refs.archiveEndpoint)
  );
  const createWebhookEndpoint = useGuardedConvexMutation(
    useMutation(refs.createEndpoint)
  );
  const disableWebhookEndpoint = useGuardedConvexMutation(
    useMutation(refs.disableEndpoint)
  );
  const removeWebhookEndpoint = useGuardedConvexMutation(
    useMutation(refs.removeEndpoint)
  );
  const retryWebhookDelivery = useGuardedConvexMutation(
    useMutation(refs.retryDelivery)
  );
  const rotateWebhookSecret = useGuardedConvexMutation(
    useMutation(refs.rotateEndpointSecret)
  );
  const sendTestWebhook = useGuardedConvexMutation(useMutation(refs.sendTest));
  const triggerProcessing = useGuardedConvexMutation(
    useMutation(refs.triggerProcessing)
  );
  const updateWebhookEndpoint = useGuardedConvexMutation(
    useMutation(refs.updateEndpoint)
  );

  return {
    archiveWebhookEndpoint,
    createWebhookEndpoint,
    disableWebhookEndpoint,
    removeWebhookEndpoint,
    retryWebhookDelivery,
    rotateWebhookSecret,
    sendTestWebhook,
    triggerProcessing,
    updateWebhookEndpoint,
  };
}

function VortexWebhookEndpointCard<
  EventType extends string = string,
  EndpointId extends string = string,
>({
  classNames,
  copy,
  endpoint,
  eventOptions,
  onArchive,
  onDelete,
  onDisable,
  onRotateSecret,
  onSave,
  onSendTest,
  renderTag,
  sendingTestEndpointId,
}: {
  classNames: VortexWebhookClassNames | undefined;
  copy: Required<VortexWebhookEndpointListCopy>;
  endpoint: VortexWebhookEndpointListItem<EventType, EndpointId>;
  eventOptions: readonly EventType[];
  onArchive: (endpointId: EndpointId) => void;
  onDelete: (endpointId: EndpointId) => void;
  onDisable: (endpointId: EndpointId) => void;
  onRotateSecret: (endpointId: EndpointId) => void;
  onSave: (
    endpointId: EndpointId,
    values: { url: string; description?: string; events: EventType[] }
  ) => void;
  onSendTest: (endpointId: EndpointId) => void;
  renderTag: VortexWebhookEndpointListProps<EventType, EndpointId>["renderTag"];
  sendingTestEndpointId: EndpointId | null;
}) {
  const [url, setUrl] = useState(endpoint.url);
  const [description, setDescription] = useState(endpoint.description ?? "");
  const [events, setEvents] = useState<EventType[]>(() => [...endpoint.events]);

  return (
    <article
      className={cn(
        "border-foreground/10 bg-background/20 rounded-lg border",
        classNames?.endpointCard
      )}
      data-testid="webhook-endpoint-card"
    >
      <div className={cn("p-5", classNames?.cardContent)}>
        <VortexWebhookEndpointHeader
          classNames={classNames}
          copy={copy}
          endpoint={endpoint}
          onArchive={onArchive}
          onDelete={onDelete}
          onDisable={onDisable}
          onRotateSecret={onRotateSecret}
          onSendTest={onSendTest}
          sendingTestEndpointId={sendingTestEndpointId}
        />
        <VortexWebhookEndpointEditFields
          classNames={classNames}
          copy={copy}
          description={description}
          onDescriptionChange={setDescription}
          onUrlChange={setUrl}
          url={url}
        />
        <div className="mt-3">
          <VortexWebhookEventPills
            classNames={classNames}
            disabled={endpoint.status !== "active"}
            eventOptions={eventOptions}
            onChange={setEvents}
            selected={events}
          />
        </div>
        <VortexWebhookEndpointSaveRow
          classNames={classNames}
          copy={copy}
          endpoint={endpoint}
          events={events}
          onSave={onSave}
          renderTag={renderTag}
          values={{ description, url }}
        />
      </div>
    </article>
  );
}

function VortexWebhookEndpointHeader<
  EventType extends string = string,
  EndpointId extends string = string,
>({
  classNames,
  copy,
  endpoint,
  onArchive,
  onDelete,
  onDisable,
  onRotateSecret,
  onSendTest,
  sendingTestEndpointId,
}: {
  classNames: VortexWebhookClassNames | undefined;
  copy: Required<VortexWebhookEndpointListCopy>;
  endpoint: VortexWebhookEndpointListItem<EventType, EndpointId>;
  onArchive: (endpointId: EndpointId) => void;
  onDelete: (endpointId: EndpointId) => void;
  onDisable: (endpointId: EndpointId) => void;
  onRotateSecret: (endpointId: EndpointId) => void;
  onSendTest: (endpointId: EndpointId) => void;
  sendingTestEndpointId: EndpointId | null;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        classNames?.endpointHeader
      )}
    >
      <VortexWebhookEndpointMeta
        classNames={classNames}
        copy={copy}
        endpoint={endpoint}
      />
      <VortexWebhookEndpointActions
        classNames={classNames}
        copy={copy}
        endpoint={endpoint}
        onArchive={onArchive}
        onDelete={onDelete}
        onDisable={onDisable}
        onRotateSecret={onRotateSecret}
        onSendTest={onSendTest}
        sendingTestEndpointId={sendingTestEndpointId}
      />
    </div>
  );
}

function VortexWebhookEndpointMeta<
  EventType extends string = string,
  EndpointId extends string = string,
>({
  classNames,
  copy,
  endpoint,
}: {
  classNames: VortexWebhookClassNames | undefined;
  copy: Required<VortexWebhookEndpointListCopy>;
  endpoint: VortexWebhookEndpointListItem<EventType, EndpointId>;
}) {
  return (
    <div className={cn("space-y-1", classNames?.endpointMeta)}>
      <p className="text-foreground font-medium">
        {endpoint.description ?? endpoint.url}
      </p>
      <p className="text-foreground/45 text-xs">{endpoint.url}</p>
      <p className="text-foreground/45 text-xs uppercase">{endpoint.status}</p>
      <p className="text-foreground/45 text-xs">
        {copy.secretLabel} {endpoint.secretPreview}
      </p>
    </div>
  );
}

function VortexWebhookEndpointActions<
  EventType extends string = string,
  EndpointId extends string = string,
>({
  classNames,
  copy,
  endpoint,
  onArchive,
  onDelete,
  onDisable,
  onRotateSecret,
  onSendTest,
  sendingTestEndpointId,
}: {
  classNames: VortexWebhookClassNames | undefined;
  copy: Required<VortexWebhookEndpointListCopy>;
  endpoint: VortexWebhookEndpointListItem<EventType, EndpointId>;
  onArchive: (endpointId: EndpointId) => void;
  onDelete: (endpointId: EndpointId) => void;
  onDisable: (endpointId: EndpointId) => void;
  onRotateSecret: (endpointId: EndpointId) => void;
  onSendTest: (endpointId: EndpointId) => void;
  sendingTestEndpointId: EndpointId | null;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap justify-end gap-2",
        classNames?.endpointActions
      )}
    >
      <VortexWebhookSendTestButton
        classNames={classNames}
        copy={copy}
        endpoint={endpoint}
        onSendTest={onSendTest}
        sendingTestEndpointId={sendingTestEndpointId}
      />
      <button
        className={secondaryButtonClassName(classNames)}
        onClick={() => onRotateSecret(endpoint._id)}
        type="button"
      >
        {copy.rotateSecretLabel}
      </button>
      {endpoint.status === "active" ? (
        <button
          className={secondaryButtonClassName(classNames)}
          onClick={() => onDisable(endpoint._id)}
          type="button"
        >
          {copy.disableLabel}
        </button>
      ) : null}
      {endpoint.status !== "archived" ? (
        <button
          className={warningButtonClassName(classNames)}
          onClick={() => onArchive(endpoint._id)}
          type="button"
        >
          {copy.archiveLabel}
        </button>
      ) : null}
      {endpoint.status === "archived" ? (
        <button
          className={destructiveButtonClassName(classNames)}
          onClick={() => onDelete(endpoint._id)}
          type="button"
        >
          {copy.deleteLabel}
        </button>
      ) : null}
    </div>
  );
}

function VortexWebhookSendTestButton<
  EventType extends string = string,
  EndpointId extends string = string,
>({
  classNames,
  copy,
  endpoint,
  onSendTest,
  sendingTestEndpointId,
}: {
  classNames: VortexWebhookClassNames | undefined;
  copy: Required<VortexWebhookEndpointListCopy>;
  endpoint: VortexWebhookEndpointListItem<EventType, EndpointId>;
  onSendTest: (endpointId: EndpointId) => void;
  sendingTestEndpointId: EndpointId | null;
}) {
  if (endpoint.status !== "active") {
    return null;
  }

  return (
    <button
      className={secondaryButtonClassName(classNames)}
      disabled={sendingTestEndpointId === endpoint._id}
      onClick={() => onSendTest(endpoint._id)}
      type="button"
    >
      {sendingTestEndpointId === endpoint._id
        ? copy.sendingTestLabel
        : copy.sendTestLabel}
    </button>
  );
}

function VortexWebhookEndpointEditFields({
  classNames,
  copy,
  description,
  onDescriptionChange,
  onUrlChange,
  url,
}: {
  classNames: VortexWebhookClassNames | undefined;
  copy: Required<VortexWebhookEndpointListCopy>;
  description: string;
  onDescriptionChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  url: string;
}) {
  return (
    <div
      className={cn(
        "mt-4 grid gap-3 md:grid-cols-2",
        classNames?.endpointFormGrid
      )}
    >
      <label className={cn("block space-y-2 text-sm", classNames?.label)}>
        <span className={cn("text-foreground/70", classNames?.labelText)}>
          {copy.endpointUrlLabel}
        </span>
        <input
          className={inputClassName(classNames)}
          onChange={(event) => onUrlChange(event.target.value)}
          value={url}
        />
      </label>
      <label className={cn("block space-y-2 text-sm", classNames?.label)}>
        <span className={cn("text-foreground/70", classNames?.labelText)}>
          {copy.descriptionLabel}
        </span>
        <input
          className={inputClassName(classNames)}
          onChange={(event) => onDescriptionChange(event.target.value)}
          value={description}
        />
      </label>
    </div>
  );
}

function VortexWebhookEndpointSaveRow<
  EventType extends string = string,
  EndpointId extends string = string,
>({
  classNames,
  copy,
  endpoint,
  events,
  onSave,
  renderTag,
  values,
}: {
  classNames: VortexWebhookClassNames | undefined;
  copy: Required<VortexWebhookEndpointListCopy>;
  endpoint: VortexWebhookEndpointListItem<EventType, EndpointId>;
  events: EventType[];
  onSave: (
    endpointId: EndpointId,
    values: { url: string; description?: string; events: EventType[] }
  ) => void;
  renderTag: VortexWebhookEndpointListProps<EventType, EndpointId>["renderTag"];
  values: { description: string; url: string };
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        className={primaryButtonClassName(classNames)}
        disabled={endpoint.status !== "active"}
        onClick={() =>
          onSave(endpoint._id, {
            url: values.url.trim(),
            description: values.description.trim() || undefined,
            events,
          })
        }
        type="button"
      >
        {copy.saveLabel}
      </button>
      <VortexWebhookEndpointEventTags
        classNames={classNames}
        copy={copy}
        endpoint={endpoint}
        renderTag={renderTag}
      />
    </div>
  );
}

function VortexWebhookEndpointEventTags<
  EventType extends string = string,
  EndpointId extends string = string,
>({
  classNames,
  copy,
  endpoint,
  renderTag,
}: {
  classNames: VortexWebhookClassNames | undefined;
  copy: Required<VortexWebhookEndpointListCopy>;
  endpoint: VortexWebhookEndpointListItem<EventType, EndpointId>;
  renderTag: VortexWebhookEndpointListProps<EventType, EndpointId>["renderTag"];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {endpoint.events.length === 0
        ? renderWebhookTag(copy.allEventsLabel, classNames, renderTag)
        : endpoint.events.map((eventType) =>
            renderWebhookTag(eventType, classNames, renderTag)
          )}
    </div>
  );
}

function VortexWebhookEventPills<EventType extends string>({
  classNames,
  disabled,
  eventOptions,
  onChange,
  selected,
}: {
  classNames: VortexWebhookClassNames | undefined;
  disabled: boolean;
  eventOptions: readonly EventType[];
  onChange: (value: EventType[]) => void;
  selected: readonly EventType[];
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", classNames?.pillList)}>
      {eventOptions.map((eventType) => {
        const isSelected = selected.includes(eventType);
        return (
          <button
            aria-pressed={isSelected}
            className={cn(
              "rounded-md border px-3 py-2 text-xs font-medium transition-colors",
              isSelected
                ? "border-info/50 bg-info/10 text-info"
                : "border-foreground/10 bg-foreground/5 text-foreground/60 hover:bg-foreground/10",
              disabled && "cursor-not-allowed opacity-50",
              classNames?.pill,
              isSelected && classNames?.pillSelected,
              disabled && classNames?.pillDisabled
            )}
            disabled={disabled}
            key={eventType}
            onClick={() =>
              onChange(
                isSelected
                  ? selected.filter((item) => item !== eventType)
                  : [...selected, eventType]
              )
            }
            type="button"
          >
            {eventType}
          </button>
        );
      })}
    </div>
  );
}

function VortexWebhookDeliveryCard<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
>({
  actions,
  classNames,
  copy,
  delivery,
  formatTimestamp,
  renderFailureBadge,
  renderTag,
}: {
  actions?: ReactNode;
  classNames: VortexWebhookClassNames | undefined;
  copy: Required<VortexWebhookDeliveryCopy>;
  delivery: VortexWebhookDeliveryListItem<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >;
  formatTimestamp: (timestamp: number) => string;
  renderFailureBadge: VortexWebhookDeliveryListProps<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >["renderFailureBadge"];
  renderTag: VortexWebhookDeliveryListProps<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >["renderTag"];
}) {
  return (
    <article
      className={cn(
        "border-foreground/10 bg-background/30 rounded-lg border p-4",
        classNames?.deliveryCard
      )}
    >
      <VortexWebhookDeliveryHeader
        actions={actions}
        classNames={classNames}
        delivery={delivery}
        renderFailureBadge={renderFailureBadge}
        renderTag={renderTag}
      />
      <VortexWebhookDeliveryDetails
        classNames={classNames}
        copy={copy}
        delivery={delivery}
        formatTimestamp={formatTimestamp}
      />
    </article>
  );
}

function VortexWebhookDeliveryHeader<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
>({
  actions,
  classNames,
  delivery,
  renderFailureBadge,
  renderTag,
}: {
  actions?: ReactNode;
  classNames: VortexWebhookClassNames | undefined;
  delivery: VortexWebhookDeliveryListItem<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >;
  renderFailureBadge: VortexWebhookDeliveryListProps<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >["renderFailureBadge"];
  renderTag: VortexWebhookDeliveryListProps<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >["renderTag"];
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        classNames?.deliveryHeader
      )}
    >
      <div className="space-y-1">
        <p className="text-foreground font-medium">{delivery.eventType}</p>
        <p className="text-foreground/45 text-xs">
          {delivery.endpointDescription ??
            delivery.endpointUrl ??
            "Unknown endpoint"}
        </p>
      </div>
      <VortexWebhookDeliveryBadges
        actions={actions}
        classNames={classNames}
        delivery={delivery}
        renderFailureBadge={renderFailureBadge}
        renderTag={renderTag}
      />
    </div>
  );
}

function VortexWebhookDeliveryBadges<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
>({
  actions,
  classNames,
  delivery,
  renderFailureBadge,
  renderTag,
}: {
  actions?: ReactNode;
  classNames: VortexWebhookClassNames | undefined;
  delivery: VortexWebhookDeliveryListItem<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >;
  renderFailureBadge: VortexWebhookDeliveryListProps<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >["renderFailureBadge"];
  renderTag: VortexWebhookDeliveryListProps<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >["renderTag"];
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {renderWebhookTag(
        `${delivery.status} - attempts ${delivery.attemptCount}`,
        classNames,
        renderTag
      )}
      {delivery.failureKind
        ? renderDeliveryFailureBadge(
            delivery.failureKind,
            classNames,
            renderFailureBadge
          )
        : null}
      {delivery.recoveryCount
        ? renderWebhookTag(
            `recovered ${delivery.recoveryCount}x`,
            classNames,
            renderTag
          )
        : null}
      {actions}
    </div>
  );
}

function VortexWebhookDeliveryDetails<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
>({
  classNames,
  copy,
  delivery,
  formatTimestamp,
}: {
  classNames: VortexWebhookClassNames | undefined;
  copy: Required<VortexWebhookDeliveryCopy>;
  delivery: VortexWebhookDeliveryListItem<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >;
  formatTimestamp: (timestamp: number) => string;
}) {
  return (
    <div
      className={cn(
        "text-foreground/60 mt-3 grid gap-2 text-xs",
        classNames?.deliveryDetails
      )}
    >
      <p>
        {copy.eventIdLabel}: {delivery.eventId}
      </p>
      <p>
        {copy.createdLabel}: {formatTimestamp(delivery.createdAt)}
      </p>
      <VortexWebhookDeliveryOptionalDetails
        copy={copy}
        delivery={delivery}
        formatTimestamp={formatTimestamp}
      />
      {delivery.responseBody ? (
        <pre
          className={cn(
            "border-foreground/10 bg-background/20 text-foreground/55 overflow-x-auto rounded-md border p-3 text-[11px] break-all whitespace-pre-wrap",
            classNames?.codeBlock
          )}
        >
          {delivery.responseBody}
        </pre>
      ) : null}
    </div>
  );
}

function VortexWebhookDeliveryOptionalDetails<
  EventType extends string = string,
  EndpointId extends string = string,
  DeliveryId extends string = string,
  OrganizationId extends string = string,
>({
  copy,
  delivery,
  formatTimestamp,
}: {
  copy: Required<VortexWebhookDeliveryCopy>;
  delivery: VortexWebhookDeliveryListItem<
    EventType,
    EndpointId,
    DeliveryId,
    OrganizationId
  >;
  formatTimestamp: (timestamp: number) => string;
}) {
  return (
    <>
      {delivery.nextAttemptAt && delivery.status === "pending" ? (
        <p>
          {copy.retryDueLabel}: {formatTimestamp(delivery.nextAttemptAt)}
        </p>
      ) : null}
      {delivery.recoveredAt ? (
        <p>
          {copy.recoveredLabel}: {formatTimestamp(delivery.recoveredAt)}
        </p>
      ) : null}
      {delivery.exhaustedAt ? (
        <p>
          {copy.exhaustedLabel}: {formatTimestamp(delivery.exhaustedAt)}
        </p>
      ) : null}
      {delivery.responseStatus ? (
        <p>
          {copy.responseLabel}: HTTP {delivery.responseStatus}
        </p>
      ) : null}
      {delivery.failureKind ? (
        <p>
          {copy.failureKindLabel}:{" "}
          {getVortexWebhookFailureKindLabel(delivery.failureKind)}
        </p>
      ) : null}
    </>
  );
}

function inputClassName(
  classNames: VortexWebhookClassNames | undefined
): string {
  return cn(
    "border-foreground/10 bg-foreground/5 text-foreground placeholder:text-foreground/35 focus:border-foreground/25 h-10 w-full rounded-md border px-3 text-sm transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-60",
    classNames?.input
  );
}

function selectClassName(
  classNames: VortexWebhookClassNames | undefined
): string {
  return cn(
    "border-foreground/10 bg-foreground/5 text-foreground focus:border-foreground/25 h-10 w-full rounded-md border px-3 text-sm transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-60",
    classNames?.select
  );
}

function primaryButtonClassName(
  classNames: VortexWebhookClassNames | undefined
): string {
  return cn(
    "bg-foreground text-background hover:bg-foreground/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    classNames?.primaryButton
  );
}

function secondaryButtonClassName(
  classNames: VortexWebhookClassNames | undefined
): string {
  return cn(
    "border-foreground/15 text-foreground/70 hover:bg-foreground/5 inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    classNames?.secondaryButton
  );
}

function warningButtonClassName(
  classNames: VortexWebhookClassNames | undefined
): string {
  return cn(
    "border-warning/30 text-warning hover:bg-warning/10 inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    classNames?.warningButton
  );
}

function destructiveButtonClassName(
  classNames: VortexWebhookClassNames | undefined
): string {
  return cn(
    "bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    classNames?.destructiveButton
  );
}

function stateTextClassName(
  classNames: VortexWebhookClassNames | undefined
): string {
  return cn("text-foreground/50 text-sm", classNames?.stateText);
}

function renderWebhookTag(
  label: string,
  classNames: VortexWebhookClassNames | undefined,
  renderTag: ((label: string) => ReactNode) | undefined
): ReactNode {
  if (renderTag) {
    return renderTag(label);
  }

  return (
    <span
      className={cn(
        "border-foreground/10 text-foreground/70 inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium",
        classNames?.tag
      )}
      key={label}
    >
      {label}
    </span>
  );
}

function renderDeliveryFailureBadge(
  failureKind: VortexWebhookDeliveryFailureKind,
  classNames: VortexWebhookClassNames | undefined,
  renderFailureBadge:
    | ((failureKind: VortexWebhookDeliveryFailureKind) => ReactNode)
    | undefined
): ReactNode {
  if (renderFailureBadge) {
    return renderFailureBadge(failureKind);
  }

  const tone = getVortexWebhookFailureKindTone(failureKind);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium",
        tone === "destructive" &&
          "border-destructive/25 bg-destructive/10 text-destructive",
        tone === "warning" && "border-warning/25 bg-warning/10 text-warning",
        tone === "secondary" &&
          "border-foreground/10 bg-foreground/10 text-foreground/80",
        classNames?.tag
      )}
    >
      {getVortexWebhookFailureKindLabel(failureKind)}
    </span>
  );
}

function VortexWebhookSecretNotice({
  classNames,
  secret,
  title,
}: {
  classNames: VortexWebhookClassNames | undefined;
  secret: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "border-info/20 bg-info/10 rounded-lg border p-4",
        classNames?.card
      )}
    >
      <p className="text-info text-sm font-medium">{title}</p>
      <code
        className={cn(
          "border-foreground/10 bg-background/30 text-foreground/70 mt-2 block overflow-x-auto rounded-md border p-3 text-xs",
          classNames?.codeBlock
        )}
      >
        {secret}
      </code>
    </div>
  );
}

function VortexWebhookActionErrorNotice({
  classNames,
  message,
  title,
}: {
  classNames: VortexWebhookClassNames | undefined;
  message: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm",
        classNames?.card
      )}
      role="alert"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-pretty">{message}</p>
    </div>
  );
}

function resolveSettingsEndpointCopy(
  copy: Partial<VortexWebhookEndpointListCopy> | undefined
): VortexWebhookEndpointListCopy {
  return {
    ...copy,
    emptyMessage: copy?.emptyMessage ?? "No webhook endpoints configured yet.",
  };
}

function resolveSettingsDeliveryCopy(
  copy: Partial<VortexWebhookDeliveryCopy> | undefined
): VortexWebhookDeliveryCopy {
  return {
    ...copy,
    emptyMessage: copy?.emptyMessage ?? "No webhook deliveries yet.",
  };
}

function resolveSettingsExhaustedDeliveryCopy(
  copy: Partial<VortexWebhookDeliveryCopy> | undefined
): VortexWebhookDeliveryCopy {
  return {
    ...copy,
    emptyMessage: copy?.emptyMessage ?? "No exhausted webhook deliveries.",
  };
}

function resolveCreateCopy(
  copy: VortexWebhookCreateFormCopy | undefined
): Required<VortexWebhookCreateFormCopy> {
  return { ...defaultCreateCopy, ...copy };
}

function resolveEndpointCopy(
  copy: VortexWebhookEndpointListCopy
): Required<VortexWebhookEndpointListCopy> {
  return { ...defaultEndpointCopy, ...copy, emptyMessage: copy.emptyMessage };
}

function resolveDeliveryCopy(
  copy: Partial<VortexWebhookDeliveryCopy> &
    Pick<VortexWebhookDeliveryCopy, "emptyMessage">
): Required<VortexWebhookDeliveryCopy> {
  return { ...defaultDeliveryCopy, ...copy, emptyMessage: copy.emptyMessage };
}

function capitalize(value: string): string {
  return value.length === 0
    ? value
    : `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}
