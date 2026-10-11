import { describe, expect, it } from "vitest";
import { normalizeGroupRouteId, resolveGroupRoleData } from "../../composables/useGroupMembers";

describe("resolveGroupRoleData", () => {
  it("preserves the group_ prefix for route ids", () => {
    expect(normalizeGroupRouteId("group_98")).toBe("group_98");
    expect(normalizeGroupRouteId(98)).toBe("group_98");
    expect(normalizeGroupRouteId("98")).toBe("group_98");
  });

  it("derives group owner and admins from member roles when admin is missing", () => {
    const contact = {
      isGroup: true,
      groupOwnerId: "2",
      owner: { id: "2", nickname: "群主" },
      admin: [],
      groupMembers: [
        { id: "1", name: "成员A", role: "member" },
        { id: "2", name: "群主", role: "owner" },
        { id: "3", name: "管理员A", role: "admin" },
        { id: "4", name: "成员B", role: "member" },
      ],
    };

    const result = resolveGroupRoleData(contact);

    expect(result.owner).toMatchObject({ id: "2", nickname: "群主" });
    expect(result.admins).toHaveLength(1);
    expect(result.admins[0]).toMatchObject({ id: "3", name: "管理员A" });
    expect(result.normalMembers).toHaveLength(2);
  });
});
