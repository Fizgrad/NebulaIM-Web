export enum MessageType {
  UNKNOWN = 0,

  LOGIN_REQ = 1001,
  LOGIN_RESP = 1002,

  HEARTBEAT_REQ = 1101,
  HEARTBEAT_RESP = 1102,

  SEND_SINGLE_MSG_REQ = 2001,
  SEND_SINGLE_MSG_RESP = 2002,

  SEND_GROUP_MSG_REQ = 2101,
  SEND_GROUP_MSG_RESP = 2102,

  PUSH_MSG = 3001,

  ACK_REQ = 4001,
  ACK_RESP = 4002,

  PULL_OFFLINE_MSG_REQ = 5001,
  PULL_OFFLINE_MSG_RESP = 5002,

  ERROR_RESP = 9001
}

const requestResponseMap = new Map<MessageType, MessageType>([
  [MessageType.LOGIN_REQ, MessageType.LOGIN_RESP],
  [MessageType.HEARTBEAT_REQ, MessageType.HEARTBEAT_RESP],
  [MessageType.SEND_SINGLE_MSG_REQ, MessageType.SEND_SINGLE_MSG_RESP],
  [MessageType.SEND_GROUP_MSG_REQ, MessageType.SEND_GROUP_MSG_RESP],
  [MessageType.ACK_REQ, MessageType.ACK_RESP],
  [MessageType.PULL_OFFLINE_MSG_REQ, MessageType.PULL_OFFLINE_MSG_RESP]
]);

export function messageTypeToString(type: MessageType): string {
  return MessageType[type] ?? `UNKNOWN(${type})`;
}

export function isResponseType(type: MessageType): boolean {
  return [...requestResponseMap.values()].includes(type) || type === MessageType.ERROR_RESP;
}

export function requestToResponseType(type: MessageType): MessageType {
  return requestResponseMap.get(type) ?? MessageType.UNKNOWN;
}
