import { useChatWorkspaceStore } from "../stores/chatWorkspace";
import type { ChatAreaManagerOptions } from "../types/untilsTypes";
import type { Contact } from "../types/chatTypes";

export type { ChatAreaManagerOptions } from "../types/untilsTypes";

export const handleTopToggle = (
  val: boolean | string | number,
  options: ChatAreaManagerOptions,
): Promise<void> => {
  return useChatWorkspaceStore().handleTopToggle(val, options);
};

export const handleMuteToggle = (
  val: boolean | string | number,
  options: ChatAreaManagerOptions,
): Promise<void> => {
  return useChatWorkspaceStore().handleMuteToggle(val, options);
};

export const updateRemarkPlaceholder = (
  remarkEditableRef: { value: HTMLElement | null },
  activeContact: { value: Contact | undefined },
): void => {
  useChatWorkspaceStore().updateRemarkPlaceholder(remarkEditableRef, activeContact);
};

export const handleRemarkFocus = (
  e: FocusEvent,
  options: ChatAreaManagerOptions,
): void => {
  useChatWorkspaceStore().handleRemarkFocus(e, options);
};

export const handleRemarkInput = (
  e: InputEvent,
  options: ChatAreaManagerOptions,
): void => {
  useChatWorkspaceStore().handleRemarkInput(e, options);
};

export const handleRemarkBlur = (
  e: FocusEvent,
  options: ChatAreaManagerOptions,
): void => {
  useChatWorkspaceStore().handleRemarkBlur(e, options);
};

export const handleRemarkKeyUp = (
  e: KeyboardEvent,
  options: ChatAreaManagerOptions,
): void => {
  useChatWorkspaceStore().handleRemarkKeyUp(e, options);
};

export const saveGroupRule = (options: ChatAreaManagerOptions): void => {
  useChatWorkspaceStore().saveGroupRule(options);
};

export const handleMoreActionCommand = async (
  command: string,
  options: ChatAreaManagerOptions,
): Promise<void> => {
  await useChatWorkspaceStore().handleMoreActionCommand(command, options);
};

export const sendMessage = (options: ChatAreaManagerOptions): void => {
  useChatWorkspaceStore().sendMessage(options);
};

export const handleEnterKey = (
  event: KeyboardEvent,
  options: ChatAreaManagerOptions,
): void => {
  useChatWorkspaceStore().handleEnterKey(event, options);
};