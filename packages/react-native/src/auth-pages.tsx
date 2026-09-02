import { useQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

type NavigateTo = (args: { to: string; replace?: boolean }) => void | Promise<void>;

type OrganizationChooserItem = {
  _id: string;
  name: string;
  roleTemplate?: string | null;
};

type CurrentOrganization = {
  _id: string;
  name?: string | null;
} | null;

export type ExpoAuthOrganizationChooserPageProps = {
  getDefaultOrganization: FunctionReference<
    "query",
    "public",
    Record<string, never>,
    CurrentOrganization
  >;
  getAvailableOrganizations: FunctionReference<
    "query",
    "public",
    Record<string, never>,
    readonly OrganizationChooserItem[]
  >;
  setActiveOrganization: FunctionReference<
    "mutation",
    "public",
    { organizationId: string },
    unknown
  >;
  navigate: NavigateTo;
  postChooseOrganizationPath: string;
  title?: string;
  description?: string;
  eyebrow?: string;
  loadingTitle?: string;
  loadingDescription?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  styles?: {
    root?: StyleProp<ViewStyle>;
    title?: StyleProp<TextStyle>;
    description?: StyleProp<TextStyle>;
    organizationButton?: StyleProp<ViewStyle>;
    organizationButtonText?: StyleProp<TextStyle>;
    selectedOrganizationButton?: StyleProp<ViewStyle>;
    loading?: StyleProp<TextStyle>;
    empty?: StyleProp<TextStyle>;
  };
};

export function ExpoAuthOrganizationChooserPage(props: ExpoAuthOrganizationChooserPageProps) {
  const [selectingOrganizationId, setSelectingOrganizationId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const currentOrganization = useQuery(props.getDefaultOrganization, {}) as
    | CurrentOrganization
    | undefined;
  const availableOrganizations = useQuery(props.getAvailableOrganizations, {}) as
    | readonly OrganizationChooserItem[]
    | undefined;

  const setActiveOrganization = useMutation(props.setActiveOrganization);

  const s = props.styles ?? {};
  const title = props.title ?? "Choose organization";
  const description =
    props.description ??
    `Select the workspace you want to use. Current resolved organization: ${
      currentOrganization?.name ?? "none"
    }.`;

  if (currentOrganization === undefined || availableOrganizations === undefined) {
    return (
      <View className="p-4" style={s.root}>
        <Text className="text-2xl font-bold" style={s.title}>
          {props.loadingTitle ?? title}
        </Text>
        <Text className="text-muted-foreground" style={s.description}>
          {props.loadingDescription ?? "Loading workspaces..."}
        </Text>
        <ActivityIndicator className="mt-4" />
      </View>
    );
  }

  if (availableOrganizations.length === 0) {
    return (
      <View className="p-4" style={s.root}>
        <Text className="text-2xl font-bold" style={s.title}>
          {props.emptyTitle ?? title}
        </Text>
        <Text className="text-muted-foreground" style={s.description}>
          {props.emptyDescription ?? "No workspaces available."}
        </Text>
      </View>
    );
  }

  return (
    <View className="p-4" style={s.root}>
      {props.eyebrow !== undefined ? (
        <Text className="text-sm text-muted-foreground" style={s.description}>
          {props.eyebrow}
        </Text>
      ) : null}
      <Text className="text-2xl font-bold" style={s.title}>
        {title}
      </Text>
      <Text className="text-muted-foreground" style={s.description}>
        {description}
      </Text>
      {selectionError !== null ? (
        <Text className="text-destructive mt-2">{selectionError}</Text>
      ) : null}
      {availableOrganizations.map((organization) => {
        const isSelected = currentOrganization?._id === organization._id;
        const isBusy = selectingOrganizationId === organization._id;
        return (
          <Pressable
            key={organization._id}
            className={`border p-3 mt-2 rounded ${isSelected ? "bg-primary" : ""}`}
            style={isSelected ? s.selectedOrganizationButton : s.organizationButton}
            onPress={async () => {
              setSelectionError(null);
              setSelectingOrganizationId(organization._id);
              try {
                await setActiveOrganization({ organizationId: organization._id });
                await props.navigate({ to: props.postChooseOrganizationPath, replace: true });
              } catch (err) {
                setSelectionError(
                  err instanceof Error ? err.message : "Could not switch workspace",
                );
              } finally {
                setSelectingOrganizationId(null);
              }
            }}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator />
            ) : (
              <Text
                className={`text-center ${isSelected ? "text-primary-foreground" : ""}`}
                style={s.organizationButtonText}
              >
                {organization.name}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
