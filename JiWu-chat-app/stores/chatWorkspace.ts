import { getErrorMessage } from "../untils/errorMessage";
import { defineStore } from "pinia";
import { message, Modal } from "ant-design-vue";
import { nextTick } from "vue";
import type { ChatAreaManagerOptions } from "../types/untilsTypes";
import type { Contact } from "../types/chatTypes";
import request from "../untils/request";
import { deleteTemporaryContact } from "../untils/temporaryContactManager";

export const useChatWorkspaceStore = defineStore("chatWorkspace", () => {
    const restoreContactStates = (contacts: Contact[], currentUserId: string) => {
        try {
            const top = JSON.parse(localStorage.getItem("contactTopStatus") || "{}");
            const mute = JSON.parse(localStorage.getItem("contactMuteStatus") || "{}");

            const selfId = String(currentUserId || "");

            contacts.forEach((contact) => {
                contact.isTop = top[contact.id] ?? false;
                contact.isMuted = mute[contact.id] ?? false;

                // 兜底补全「当前用户自己」标记：
                // 缓存 / 后端数据可能丢失 isSelf，导致排序与默认选中失效
                // （表现为进入消息页没有默认选中自己）。
                if (selfId && String(contact.id) === selfId && !contact.isGroup) {
                    contact.isSelf = true;
                    contact.isFriend = false;
                }
            });

            contacts.sort((a, b) => {
                // 「当前用户自己」始终排在最前
                if (!!a.isSelf !== !!b.isSelf) return a.isSelf ? -1 : 1;
                if (a.isTop !== b.isTop) return Number(b.isTop) - Number(a.isTop);
                if (a.isMuted !== b.isMuted) return Number(b.isMuted) - Number(a.isMuted);
                const left = Number(a.lastMessageAt || a.lastMessageTime || 0);
                const right = Number(b.lastMessageAt || b.lastMessageTime || 0);
                if (left !== right) return right - left;
                return String(a.name).localeCompare(String(b.name));
            });
        } catch {
            // 静默失败，保留现有状态
        }
    };

    const triggerContactsUpdate = (contacts: Contact[]) => [...contacts];

    const triggerContactUpdate = (contacts: Contact[], contactId: string) => {
        const contactIndex = contacts.findIndex((item) => item.id === contactId);
        if (contactIndex !== -1) {
            contacts[contactIndex] = { ...contacts[contactIndex] };
        }

        return triggerContactsUpdate(contacts);
    };

    const updateRemarkPlaceholder = (
        remarkEditableRef: { value: HTMLElement | null },
        activeContact: { value: Contact | undefined },
    ): void => {
        if (!remarkEditableRef.value || !activeContact.value) return;

        const element = remarkEditableRef.value;
        const currentRemark = activeContact.value.remark || "";
        const placeholder = element.getAttribute("data-placeholder") || "";

        element.textContent = "";

        if (currentRemark.trim() === "") {
            element.textContent = placeholder;
            element.classList.add("remark-placeholder");
        } else {
            element.textContent = currentRemark;
            element.classList.remove("remark-placeholder");
        }
    };

    const handleRemarkFocus = (
        e: FocusEvent,
        options: ChatAreaManagerOptions,
    ): void => {
        const target = e.target as HTMLElement;
        const placeholder = target.getAttribute("data-placeholder") || "";

        if (target.textContent === placeholder) {
            target.textContent = "";
            target.classList.remove("remark-placeholder");
        }

        options.tempRemark.value = target.textContent || "";
    };

    const handleRemarkInput = (
        e: InputEvent,
        options: ChatAreaManagerOptions,
    ): void => {
        const target = e.target as HTMLElement;
        options.tempRemark.value = target.textContent || "";
    };

    const handleRemarkBlur = (
        e: FocusEvent,
        options: ChatAreaManagerOptions,
    ): void => {
        const target = e.target as HTMLElement;
        const nextRemark = options.tempRemark.value.trim();

        if (nextRemark === "") {
            const placeholder = target.getAttribute("data-placeholder") || "";
            target.textContent = placeholder;
            target.classList.add("remark-placeholder");
        } else {
            target.textContent = nextRemark;
            target.classList.remove("remark-placeholder");
        }

        if (
            options.activeContact.value &&
            nextRemark !== (options.activeContact.value.remark || "")
        ) {
            options.emit("editRemark", options.activeContactId, nextRemark);
        }
    };

    const handleRemarkKeyUp = (
        e: KeyboardEvent,
        options: ChatAreaManagerOptions,
    ): void => {
        if (e.key === "Enter") {
            const target = e.target as HTMLElement;
            target.blur();
        }
    };

    const handleTopToggle = (
        val: boolean | string | number,
        options: ChatAreaManagerOptions,
    ): Promise<void> => {
        if (!options.activeContact.value) return Promise.resolve();

        const nextValue = Boolean(val);
        options.isTop.value = nextValue;
        options.emit("toggleTop", options.activeContactId, nextValue);

        return Promise.resolve();
    };

    const handleMuteToggle = (
        val: boolean | string | number,
        options: ChatAreaManagerOptions,
    ): Promise<void> => {
        if (!options.activeContact.value) return Promise.resolve();

        const nextValue = Boolean(val);
        options.isMuted.value = nextValue;
        options.emit("toggleMute", options.activeContactId, nextValue);
        options.showContactDrawer.value = false;

        return Promise.resolve();
    };

    const saveGroupRule = (options: ChatAreaManagerOptions): void => {
        if (!options.activeContact.value || !options.tempGroupRule.value.trim()) {
            message.warning("群公告内容不能为空");
            return;
        }

        options.emit(
            "updateGroupRule",
            String(options.activeContactId),
            options.tempGroupRule.value.trim(),
        );
        options.isEditingRule.value = false;
    };

    const handleMoreActionCommand = async (
        command: string,
        options: ChatAreaManagerOptions,
    ): Promise<void> => {
        if (!options.activeContact.value) return;

        const isCurrentUserContact =
            String(options.activeContact.value.id).trim() ===
            String(options.currentUserId).trim();

        switch (command) {
            case "clearHistory":
                Modal.confirm({
                    title: "删除聊天记录",
                    content: "确定删除聊天记录吗？删除后仅自己看不到，对方及群成员不受影响。",
                    okText: "删除",
                    cancelText: "取消",
                    okType: "danger",
                    async onOk() {
                        try {
                            await request.delete(`/message/clear/${options.activeContactId}`);
                            options.emit("clearChat", options.activeContactId);
                            await nextTick();
                            options.showContactDrawer.value = false;
                            message.success("聊天记录已删除");
                        } catch (error: any) {
                            const messageText =
                                error.response?.data?.data?.message ||
                                error.response?.data?.message ||
                                "删除聊天记录失败";
                            message.error(messageText);
                        }
                    },
                    onCancel() {
                        message.info("已取消删除");
                    },
                });
                break;

            case "deleteFriend":
                if (isCurrentUserContact) {
                    message.warning("无法删除自己的账号!");
                    return;
                }

                Modal.confirm({
                    title: "删除好友",
                    content: "确定要删除该好友吗?删除后将无法接收对方消息!",
                    okText: "确定",
                    cancelText: "取消",
                    okType: "danger",
                    async onOk() {
                        const pureId = String(options.activeContactId).replace("friend_", "");
                        try {
                            await request.delete(`/friends/${pureId}`);
                            options.emit("deleteFriend", options.activeContactId);
                            await nextTick();
                            options.showContactDrawer.value = false;
                        } catch (error: any) {
                            const messageText =
                                getErrorMessage(error, "删除好友失败");
                            message.error(messageText);
                        }
                    },
                    onCancel() {
                        message.info("已取消删除操作");
                    },
                });
                break;

            case "quitGroup":
                Modal.confirm({
                    title: "退出群聊",
                    content: "确定要退出该群聊吗?退出后将无法接收群消息!",
                    okText: "确定",
                    cancelText: "取消",
                    okType: "danger",
                    async onOk() {
                        const pureId = String(options.activeContactId).replace("group_", "");
                        try {
                            const response = await request.post(`/group/${pureId}/quit`);
                            options.emit("quitGroup", String(options.activeContactId));
                            await nextTick();
                            options.showContactDrawer.value = false;
                            message.success(response.data.message);
                        } catch (error: any) {
                            const messageText =
                                getErrorMessage(error, "退出群聊失败");
                            message.error(messageText);
                        }
                    },
                    onCancel() {
                        message.info("已取消退出操作");
                    },
                });
                break;

            case "dissolveGroup":
                Modal.confirm({
                    title: "解散群聊",
                    content: "确定要解散该群聊吗?解散后所有成员都将被移出,且无法恢复!",
                    okText: "确定",
                    cancelText: "取消",
                    okType: "danger",
                    async onOk() {
                        const pureId = String(options.activeContactId).replace("group_", "");
                        try {
                            const response = await request.delete(`/group/${pureId}`);
                            options.emit("dissolveGroup", String(options.activeContactId));
                            await nextTick();
                            options.showContactDrawer.value = false;
                            message.success(response.data.message);
                        } catch (error: any) {
                            const messageText =
                                getErrorMessage(error, "解散群聊失败");
                            message.error(messageText);
                        }
                    },
                    onCancel() {
                        message.info("已取消解散操作");
                    },
                });
                break;

            case "deleteTemporaryContact":
                if (isCurrentUserContact) {
                    message.warning("无法删除自己的会话!");
                    return;
                }

                Modal.confirm({
                    title: "删除临时对话",
                    content: "确定要删除该临时对话吗?删除后将无法接收对方消息!",
                    okText: "确定",
                    cancelText: "取消",
                    okType: "danger",
                    async onOk() {
                        const contactId = Number(
                            String(options.activeContactId).replace("friend_", ""),
                        );
                        try {
                            await deleteTemporaryContact(contactId);
                            options.emit("deleteTemporaryContact", options.activeContactId);
                            await nextTick();
                            options.showContactDrawer.value = false;
                        } catch (error: any) {
                            const messageText =
                                error.response?.data?.message || "删除临时对话失败";
                            message.error(messageText);
                        }
                    },
                    onCancel() {
                        message.info("已取消删除操作");
                    },
                });
                break;
        }
    };

    const sendMessage = (options: ChatAreaManagerOptions): void => {
        if (!options.newMessage.value.trim() || !options.activeContact.value) return;

        options.emit(
            "sendMessage",
            options.activeContact.value.id,
            options.newMessage.value,
        );
        options.newMessage.value = "";
    };

    const handleEnterKey = (
        event: KeyboardEvent,
        options: ChatAreaManagerOptions,
    ): void => {
        if (event.shiftKey) return;
        event.preventDefault();
        sendMessage(options);
    };

    const extractJoinMessages = (messages: any[]) => {
        return messages
            .filter((msg: any) => {
                try {
                    // 兼容两类入群消息：
                    //   1) 后端邀请流程：messageType = group_invite_accepted / group_invite_pending
                    //   2) 通用群通知：messageType = group_notification
                    const isJoinType =
                        msg.messageType === "group_invite_accepted" ||
                        msg.messageType === "group_invite_pending" ||
                        msg.messageType === "group_notification";
                    if (!isJoinType) return false;

                    const content = JSON.parse(msg.content);
                    // 兼容字段命名：后端用 invitee，旧结构用 joinedUser
                    return !!(content?.invitee || content?.joinedUser);
                } catch {
                    return false;
                }
            })
            .map((msg: any) => {
                try {
                    const content = JSON.parse(msg.content);
                    // 兼容 invitee / joinedUser 两种字段
                    const joined = content.invitee || content.joinedUser;
                    const rawTime =
                        msg.createdAt ||
                        (typeof msg._timestamp === "number" && msg._timestamp > 0
                            ? new Date(msg._timestamp).toISOString()
                            : "") ||
                        content.timestamp ||
                        content.createdAt ||
                        new Date().toISOString();
                    return {
                        userId: String(joined.id),
                        userName:
                            joined.name ||
                            joined.nickname ||
                            joined.username ||
                            "用户",
                        // 🔥 时间必须取可解析的原始时间戳（ISO），不能取 msg.time。
                        //    msg.time / content.createdAt 是展示用的「今天 14:30」类字符串，
                        //    getMessageTimestamp 解析不了会返回 0，导致：
                        //      1) 列表里多条入群记录排序错乱；
                        //      2) WS group_member_joined 的去重判断失效 → 同一个人被重复添加，
                        //         提示条出现「XX、XX 加入了群聊」。
                        time: String(rawTime),
                    };
                } catch {
                    return null;
                }
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => {
                const left = new Date(a.time).getTime();
                const right = new Date(b.time).getTime();
                return left - right;
            });
    };

    return {
        restoreContactStates,
        triggerContactsUpdate,
        triggerContactUpdate,
        updateRemarkPlaceholder,
        handleRemarkFocus,
        handleRemarkInput,
        handleRemarkBlur,
        handleRemarkKeyUp,
        handleTopToggle,
        handleMuteToggle,
        saveGroupRule,
        handleMoreActionCommand,
        sendMessage,
        handleEnterKey,
        extractJoinMessages,
    };
});
