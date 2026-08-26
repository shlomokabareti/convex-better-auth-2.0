export type ProvisionIdentityInput = {
  identityId: string;
  provider: string;
  subject: string;
  issuer: string;
  tokenIdentifier: string;
  email: string | null;
  emailVerified: boolean;
  sessionId: string | null;
};

export type ProvisionIdentityDecision =
  | {
      kind: "existingIdentity";
      userId: string;
      createdUser: false;
      linkedExistingIdentity: true;
      shouldCreateIdentity: false;
      shouldPatchIdentity: true;
    }
  | {
      kind: "linkExistingUser";
      userId: string;
      createdUser: false;
      linkedExistingIdentity: false;
      shouldCreateIdentity: true;
      shouldPatchIdentity: false;
    }
  | {
      kind: "createUser";
      createdUser: true;
      linkedExistingIdentity: false;
      shouldCreateIdentity: true;
      shouldPatchIdentity: false;
    };

export function decideIdentityProvision(args: {
  identity: ProvisionIdentityInput;
  existingIdentityUserId: string | null;
  existingUserByEmailId: string | null;
}): ProvisionIdentityDecision {
  if (args.existingIdentityUserId !== null) {
    return {
      kind: "existingIdentity",
      userId: args.existingIdentityUserId,
      createdUser: false,
      linkedExistingIdentity: true,
      shouldCreateIdentity: false,
      shouldPatchIdentity: true,
    };
  }

  if (
    args.identity.email !== null &&
    args.identity.emailVerified &&
    args.existingUserByEmailId !== null
  ) {
    return {
      kind: "linkExistingUser",
      userId: args.existingUserByEmailId,
      createdUser: false,
      linkedExistingIdentity: false,
      shouldCreateIdentity: true,
      shouldPatchIdentity: false,
    };
  }

  return {
    kind: "createUser",
    createdUser: true,
    linkedExistingIdentity: false,
    shouldCreateIdentity: true,
    shouldPatchIdentity: false,
  };
}
