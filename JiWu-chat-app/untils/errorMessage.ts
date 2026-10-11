/**
 * 统一取「后端返回的错误提示」。
 *
 * 后端统一响应体是 `{ status, data: { message, errors } }`，
 * 经 axios 后落在 `error.response.data.data.message`；
 * 少量旧接口只有 `error.response.data.message`，这里一并兼容。
 *
 * 用法：message.error(getErrorMessage(error, "操作失败"));
 */
export const getErrorMessage = (error: any, fallback = "操作失败"): string => {
  const res = error?.response?.data;
  const msg =
    res?.data?.message || // 统一响应体
    res?.message || // 旧响应体
    (error?.response ? error?.message : ""); // 有响应但没消息时回退到 axios 描述
  return msg || fallback;
};

export default getErrorMessage;
