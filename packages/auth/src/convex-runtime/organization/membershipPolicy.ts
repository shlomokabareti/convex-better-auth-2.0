export function wouldRemoveLastActiveOwner(args: {
  ownerRoleId: string;
  membershipRoleId: string;
  membershipStatus: string;
  nextRoleId: string;
  nextStatus: string;
  activeMemberships: Array<{
    roleId: string;
    status: string;
  }>;
}): boolean {
  const isCurrentlyActiveOwner =
    args.membershipRoleId === args.ownerRoleId && args.membershipStatus === "active";
  const remainsActiveOwner = args.nextRoleId === args.ownerRoleId && args.nextStatus === "active";

  if (!isCurrentlyActiveOwner || remainsActiveOwner) {
    return false;
  }

  const ownerCount = args.activeMemberships.filter(
    (membership) => membership.roleId === args.ownerRoleId && membership.status === "active",
  ).length;

  return ownerCount <= 1;
}
