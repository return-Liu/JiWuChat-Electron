import { computed } from "vue";

const normalizeId = (value: any): string => String(value ?? "").trim();

export const normalizeGroupRouteId = (value: string | number | null | undefined): string => {
    const raw = normalizeId(value).replace(/^group_/i, "");
    const cleaned = raw || "0";
    return `group_${cleaned}`;
};

export const normalizeGroupNumericId = (value: string | number | null | undefined): number => {
    const raw = normalizeId(value).replace(/^group_/i, "");
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
};

export function resolveGroupRoleData(contact: any) {
    const c = contact || {};
    if (!c?.isGroup) {
        return {
            owner: null,
            admins: [],
            normalMembers: [],
        };
    }

    const groupMembers = Array.isArray(c.groupMembers) ? c.groupMembers : [];
    const explicitOwner = c.owner || null;
    const ownerFromGroupMembers =
        groupMembers.find((m: any) => {
            const memberRole = String(m?.role || "").toLowerCase();
            return memberRole === "owner" || normalizeId(m?.id) === normalizeId(c.groupOwnerId);
        }) || null;
    const owner = explicitOwner || ownerFromGroupMembers || null;
    const ownerId = owner ? normalizeId(owner.id ?? owner.userId ?? "") : "";

    const explicitAdmins = Array.isArray(c.admin) && c.admin.length > 0 ? c.admin : [];
    const derivedAdmins = groupMembers
        .filter((m: any) => String(m?.role || "").toLowerCase() === "admin")
        .map((m: any) => ({
            ...m,
            id: m.id ?? m.userId ?? m.user?.id,
            name: m.name ?? m.nickname ?? m.username ?? "管理员",
        }));

    const adminList = explicitAdmins.length > 0 ? explicitAdmins : derivedAdmins;
    const admins = adminList.filter((a: any) => {
        const adminId = normalizeId(a.id ?? a.userId ?? a.user?.id ?? "");
        return adminId && adminId !== ownerId && String(a?.role || "").toLowerCase() !== "owner";
    });

    const adminIds = new Set(admins.map((a: any) => normalizeId(a.id ?? a.userId ?? a.user?.id ?? "")));

    const normalMembers = groupMembers.filter((m: any) => {
        const memberId = normalizeId(m?.id ?? m?.userId ?? m?.user?.id ?? "");
        if (!memberId) return false;
        if (ownerId && memberId === ownerId) return false;
        if (adminIds.has(memberId)) return false;
        const role = String(m?.role || "").toLowerCase();
        return role !== "owner" && role !== "admin";
    });

    return {
        owner,
        admins,
        normalMembers,
    };
}

/**
 * 群成员分类 composable
 * 从群联系人数据中提取群主、管理员、普通成员
 */
export function useGroupMembers(contact: () => any) {
    const groupOwner = computed(() => {
        const c = contact();
        if (!c?.isGroup) return null;

        const cachedOwner = c.cachedOwner;
        if (cachedOwner) return cachedOwner;

        const { owner } = resolveGroupRoleData(c);
        if (owner && c.isGroup) {
            c.cachedOwner = owner;
        }

        return owner;
    });

    const groupAdmins = computed(() => {
        const c = contact();
        if (!c?.isGroup) return [];
        return resolveGroupRoleData(c).admins;
    });

    const normalMembers = computed(() => {
        const c = contact();
        if (!c?.isGroup) return [];
        return resolveGroupRoleData(c).normalMembers;
    });

    const displayedMembers = computed(() => {
        const c = contact();
        if (!Array.isArray(c?.groupMembers)) return [];
        return c.groupMembers.slice(0, 30);
    });

    return {
        groupOwner,
        groupAdmins,
        normalMembers,
        displayedMembers,
    };
}
